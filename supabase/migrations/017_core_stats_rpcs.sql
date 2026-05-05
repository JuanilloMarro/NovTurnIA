-- ============================================================
-- 017: Core Stats RPCs — get_appointment_trend + get_stats_dashboard
-- Ambas estaban creadas directamente en Supabase sin filtro de business_id.
-- Se definen aquí con SECURITY DEFINER + WHERE business_id = p_business_id.
-- ============================================================

-- ── get_appointment_trend ─────────────────────────────────
-- Agrupa turnos por período (day/week/month) para el gráfico principal.
-- Devuelve: [{period TEXT, total BIGINT, completed BIGINT, cancelled BIGINT}]
CREATE OR REPLACE FUNCTION get_appointment_trend(
  p_business_id UUID,
  p_granularity TEXT        DEFAULT 'month',
  p_start       TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 month',
  p_end         TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  period    TEXT,
  total     BIGINT,
  completed BIGINT,
  cancelled BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    CASE p_granularity
      WHEN 'day'  THEN TO_CHAR(
                         date_start AT TIME ZONE 'America/Guatemala',
                         'YYYY-MM-DD'
                       )
      WHEN 'week' THEN TO_CHAR(
                         date_trunc('week',
                           (date_start AT TIME ZONE 'America/Guatemala')::date
                         ),
                         'YYYY-MM-DD'
                       )
      ELSE             TO_CHAR(
                         date_start AT TIME ZONE 'America/Guatemala',
                         'YYYY-MM'
                       )
    END                                           AS period,
    COUNT(*)                                      AS total,
    COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
    COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled
  FROM appointments
  WHERE business_id = p_business_id
    AND date_start >= p_start
    AND date_start <  p_end
  GROUP BY 1
  ORDER BY 1;
$$;

-- ── get_stats_dashboard ───────────────────────────────────
-- Devuelve en un único round-trip todos los datos del dashboard de métricas.
-- Requiere p_business_id explícito para evitar cualquier leak entre negocios.
CREATE OR REPLACE FUNCTION get_stats_dashboard(
  p_business_id UUID,
  p_month_start TIMESTAMPTZ,
  p_month_end   TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_appt_stats    JSONB;
  v_patient_stats JSONB;
  v_month_apts    JSONB;
  v_sent          BIGINT;
  v_received      BIGINT;
BEGIN
  -- Historial mensual de los últimos 12 meses (para variación)
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]')
  INTO v_appt_stats
  FROM (
    SELECT
      TO_CHAR(date_start AT TIME ZONE 'America/Guatemala', 'YYYY-MM') AS month,
      COUNT(*) AS total_appointments
    FROM appointments
    WHERE business_id = p_business_id
      AND date_start >= p_month_start - INTERVAL '12 months'
      AND date_start <  p_month_end
    GROUP BY 1
    ORDER BY 1
  ) r;

  -- Estadísticas de pacientes
  SELECT jsonb_build_object(
    'total_patients',  COUNT(DISTINCT id),
    'active_patients', COUNT(DISTINCT id) FILTER (
                         WHERE id IN (
                           SELECT DISTINCT patient_id
                           FROM appointments
                           WHERE business_id = p_business_id
                             AND date_start >= NOW() - INTERVAL '6 months'
                         )
                       ),
    'new_this_month',  COUNT(DISTINCT id) FILTER (
                         WHERE created_at >= p_month_start
                           AND created_at <  p_month_end
                       )
  )
  INTO v_patient_stats
  FROM patients
  WHERE business_id = p_business_id
    AND deleted_at IS NULL;

  -- Turnos del período solicitado (detalle individual para KPIs)
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]')
  INTO v_month_apts
  FROM (
    SELECT id, status, confirmed, created_by, date_start, created_at
    FROM appointments
    WHERE business_id = p_business_id
      AND date_start >= p_month_start
      AND date_start <  p_month_end
    ORDER BY date_start
  ) r;

  -- Mensajes enviados/recibidos en el período
  SELECT COUNT(*) FILTER (WHERE role = 'assistant'),
         COUNT(*) FILTER (WHERE role = 'user')
  INTO v_sent, v_received
  FROM history
  WHERE business_id = p_business_id
    AND created_at >= p_month_start
    AND created_at <  p_month_end;

  RETURN jsonb_build_object(
    'appt_stats',         v_appt_stats,
    'patient_stats',      v_patient_stats,
    'month_appointments', v_month_apts,
    'sent_count',         COALESCE(v_sent,     0),
    'received_count',     COALESCE(v_received, 0)
  );
END;
$$;
