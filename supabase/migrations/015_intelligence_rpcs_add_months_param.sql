-- Update intelligence RPCs to accept p_months parameter for dynamic range filtering

-- get_patient_ltv: filter by configurable date range (default 12 months)
CREATE OR REPLACE FUNCTION get_patient_ltv(
  p_business_id UUID,
  p_months      INT DEFAULT 12
)
RETURNS TABLE (
  patient_id         UUID,
  display_name       TEXT,
  total_appointments BIGINT,
  total_revenue      NUMERIC,
  last_visit         TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id                                       AS patient_id,
    COALESCE(p.display_name, 'Sin nombre')     AS display_name,
    COUNT(a.id)                                AS total_appointments,
    COALESCE(SUM(s.price), 0)                  AS total_revenue,
    MAX(a.date_start)                          AS last_visit
  FROM patients p
  JOIN appointments a ON a.patient_id = p.id AND a.business_id = p_business_id
  LEFT JOIN services s ON s.id = a.service_id
  WHERE p.business_id = p_business_id
    AND p.deleted_at IS NULL
    AND a.status IN ('confirmed', 'completed', 'no_show')
    AND a.date_start >= NOW() - (p_months || ' months')::INTERVAL
  GROUP BY p.id, p.display_name
  ORDER BY total_revenue DESC, total_appointments DESC
  LIMIT 15;
$$;

-- get_retention_rate: replaces hardcoded 6 months with p_months
CREATE OR REPLACE FUNCTION get_retention_rate(
  p_business_id UUID,
  p_months      INT DEFAULT 6
)
RETURNS TABLE (
  total_patients    BIGINT,
  retained_patients BIGINT,
  retention_pct     NUMERIC,
  period_label      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH period AS (
    SELECT NOW() - (p_months || ' months')::INTERVAL AS from_date
  ),
  active_patients AS (
    SELECT DISTINCT a.patient_id
    FROM appointments a, period
    WHERE a.business_id = p_business_id
      AND a.status IN ('confirmed', 'completed', 'no_show')
      AND a.date_start >= period.from_date
  ),
  retained AS (
    SELECT a.patient_id
    FROM appointments a, period
    WHERE a.business_id = p_business_id
      AND a.status IN ('confirmed', 'completed', 'no_show')
      AND a.date_start >= period.from_date
    GROUP BY a.patient_id
    HAVING COUNT(*) >= 2
  )
  SELECT
    COUNT(DISTINCT ap.patient_id)::BIGINT  AS total_patients,
    COUNT(DISTINCT r.patient_id)::BIGINT   AS retained_patients,
    CASE
      WHEN COUNT(DISTINCT ap.patient_id) = 0 THEN 0
      ELSE ROUND(
        COUNT(DISTINCT r.patient_id)::NUMERIC
        / COUNT(DISTINCT ap.patient_id)::NUMERIC * 100, 1
      )
    END                                    AS retention_pct,
    CASE p_months
      WHEN 1  THEN 'Último mes'
      WHEN 12 THEN 'Último año'
      ELSE 'Últimos ' || p_months || ' meses'
    END                                    AS period_label
  FROM active_patients ap
  LEFT JOIN retained r ON r.patient_id = ap.patient_id;
$$;

-- get_appointment_prediction: replaces hardcoded 90 days with p_months
CREATE OR REPLACE FUNCTION get_appointment_prediction(
  p_business_id UUID,
  p_months      INT DEFAULT 3
)
RETURNS TABLE (
  day_of_week         INT,
  day_label           TEXT,
  total_appointments  BIGINT,
  avg_appointments    NUMERIC,
  has_sufficient_data BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH period AS (
    SELECT
      NOW() - (p_months || ' months')::INTERVAL  AS from_date,
      NOW()                                       AS to_date,
      GREATEST((p_months * 4)::INT, 4)            AS num_weeks
  ),
  history AS (
    SELECT
      EXTRACT(DOW FROM a.date_start AT TIME ZONE 'America/Guatemala')::INT AS dow,
      COUNT(*) AS cnt
    FROM appointments a
    JOIN period p ON TRUE
    WHERE a.business_id = p_business_id
      AND a.status NOT IN ('cancelled', 'scheduled')
      AND a.date_start BETWEEN p.from_date AND p.to_date
    GROUP BY dow
  ),
  total_count AS (SELECT COALESCE(SUM(cnt), 0) AS total FROM history),
  weeks       AS (SELECT num_weeks AS n FROM period)
  SELECT
    d.dow                                             AS day_of_week,
    CASE d.dow
      WHEN 0 THEN 'Dom' WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar'
      WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie'
      ELSE 'Sáb'
    END                                               AS day_label,
    COALESCE(h.cnt, 0)::BIGINT                        AS total_appointments,
    ROUND(COALESCE(h.cnt, 0)::NUMERIC / w.n, 1)       AS avg_appointments,
    (tc.total >= 30)                                  AS has_sufficient_data
  FROM generate_series(0, 6) AS d(dow)
  LEFT JOIN history h ON h.dow = d.dow
  CROSS JOIN total_count tc
  CROSS JOIN weeks w
  ORDER BY d.dow;
$$;
