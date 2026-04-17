-- =====================================================
-- TurnIA — Migración 006: Recrear vistas materializadas
-- y funciones de stats (dropeadas en migración 005)
-- =====================================================
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Debe correrse DESPUÉS de 005_business_id_to_uuid.sql
-- y DESPUÉS de scripts/rls_policies.sql
-- =====================================================

-- ─── 1. Materialized view: mv_business_stats ─────────────────────────────────
-- Totales de turnos agrupados por negocio y mes.
-- Usada por get_business_stats() y get_stats_dashboard().

DROP MATERIALIZED VIEW IF EXISTS mv_business_stats;

CREATE MATERIALIZED VIEW mv_business_stats AS
SELECT
    business_id,
    to_char(date_trunc('month', date_start), 'YYYY-MM') AS month,
    COUNT(*)                                              AS total_appointments
FROM appointments
GROUP BY business_id, date_trunc('month', date_start);

CREATE UNIQUE INDEX idx_mv_business_stats_pk
    ON mv_business_stats (business_id, month);


-- ─── 2. Materialized view: mv_patient_stats ──────────────────────────────────
-- Totales de pacientes por negocio.
-- new_this_month se calcula en vivo en get_patient_stats() para mayor precisión.

DROP MATERIALIZED VIEW IF EXISTS mv_patient_stats;

CREATE MATERIALIZED VIEW mv_patient_stats AS
SELECT
    business_id,
    COUNT(*) FILTER (WHERE deleted_at IS NULL)                         AS total_patients,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND human_takeover = false) AS active_patients
FROM patients
GROUP BY business_id;

CREATE UNIQUE INDEX idx_mv_patient_stats_pk
    ON mv_patient_stats (business_id);


-- ─── 3. RPC: get_business_stats() ────────────────────────────────────────────
-- Retorna el historial mensual de turnos del negocio del usuario autenticado.
-- Retorna: [{month: 'YYYY-MM', total_appointments: N, count: N}]

DROP FUNCTION IF EXISTS get_business_stats();

CREATE OR REPLACE FUNCTION get_business_stats()
RETURNS TABLE (month TEXT, total_appointments BIGINT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mv.month,
        mv.total_appointments,
        mv.total_appointments AS count
    FROM public.mv_business_stats mv
    WHERE mv.business_id = public.get_user_business_id()
    ORDER BY mv.month ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_business_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_business_stats() TO authenticated;


-- ─── 4. RPC: get_patient_stats() ─────────────────────────────────────────────
-- Retorna KPIs de pacientes del negocio del usuario autenticado.
-- total_patients y active_patients vienen del MV (snapshot).
-- new_this_month se calcula en vivo para que siempre sea preciso.

DROP FUNCTION IF EXISTS get_patient_stats();

CREATE OR REPLACE FUNCTION get_patient_stats()
RETURNS TABLE (total_patients BIGINT, active_patients BIGINT, new_this_month BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_bid UUID;
BEGIN
    v_bid := public.get_user_business_id();

    RETURN QUERY
    SELECT
        mv.total_patients,
        mv.active_patients,
        (
            SELECT COUNT(*)
            FROM public.patients p
            WHERE p.business_id = v_bid
              AND p.deleted_at IS NULL
              AND p.created_at >= date_trunc('month', now())
              AND p.created_at <  date_trunc('month', now()) + interval '1 month'
        )::BIGINT AS new_this_month
    FROM public.mv_patient_stats mv
    WHERE mv.business_id = v_bid;
END;
$$;

REVOKE ALL ON FUNCTION get_patient_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_patient_stats() TO authenticated;


-- ─── 5. RPC: get_stats_dashboard(p_month_start, p_month_end) ─────────────────
-- RPC principal de stats — combina todo en un solo round-trip.
-- Retorna JSONB: { appt_stats, patient_stats, month_appointments, sent_count, received_count }

DROP FUNCTION IF EXISTS get_stats_dashboard(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_stats_dashboard(
    p_month_start TIMESTAMPTZ,
    p_month_end   TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_bid             UUID;
    v_appt_stats      JSONB;
    v_patient_stats   JSONB;
    v_month_apts      JSONB;
    v_sent            BIGINT := 0;
    v_received        BIGINT := 0;
    v_new_this_month  BIGINT := 0;
BEGIN
    v_bid := public.get_user_business_id();

    -- Historial mensual de turnos desde el MV
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.month ASC), '[]'::JSONB)
    INTO v_appt_stats
    FROM (
        SELECT month, total_appointments, total_appointments AS count
        FROM public.mv_business_stats
        WHERE business_id = v_bid
    ) t;

    -- KPIs de pacientes: MV + new_this_month en vivo
    SELECT COUNT(*) INTO v_new_this_month
    FROM public.patients
    WHERE business_id = v_bid
      AND deleted_at IS NULL
      AND created_at >= date_trunc('month', now())
      AND created_at <  date_trunc('month', now()) + interval '1 month';

    SELECT row_to_json(t)::JSONB
    INTO v_patient_stats
    FROM (
        SELECT
            mv.total_patients,
            mv.active_patients,
            v_new_this_month AS new_this_month
        FROM public.mv_patient_stats mv
        WHERE mv.business_id = v_bid
    ) t;

    -- Turnos del mes (detalle para KPIs y donut)
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
    INTO v_month_apts
    FROM (
        SELECT id, status, confirmed, created_by, date_start, created_at
        FROM public.appointments
        WHERE business_id = v_bid
          AND date_start >= p_month_start
          AND date_start <  p_month_end
    ) t;

    -- Conteo de mensajes del mes desde history
    SELECT COUNT(*) INTO v_sent
    FROM public.history
    WHERE business_id = v_bid
      AND role = 'assistant'
      AND created_at >= p_month_start
      AND created_at <  p_month_end;

    SELECT COUNT(*) INTO v_received
    FROM public.history
    WHERE business_id = v_bid
      AND role = 'user'
      AND created_at >= p_month_start
      AND created_at <  p_month_end;

    RETURN jsonb_build_object(
        'appt_stats',         v_appt_stats,
        'patient_stats',      v_patient_stats,
        'month_appointments', v_month_apts,
        'sent_count',         v_sent,
        'received_count',     v_received
    );
END;
$$;

REVOKE ALL ON FUNCTION get_stats_dashboard(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_stats_dashboard(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


-- ─── 6. RPC: get_appointment_trend (actualizar p_business_id a UUID) ──────────
-- El parámetro era INTEGER antes de la migración 005. Se reescribe con UUID.

DROP FUNCTION IF EXISTS get_appointment_trend(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_appointment_trend(INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_appointment_trend(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_appointment_trend(
    p_business_id UUID,
    p_granularity TEXT,       -- 'day' | 'week' | 'month'
    p_start       TIMESTAMPTZ,
    p_end         TIMESTAMPTZ
)
RETURNS TABLE (period TEXT, total BIGINT, completed BIGINT, cancelled BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_granularity = 'day' THEN
        RETURN QUERY
        SELECT
            to_char(date_trunc('day', date_start), 'YYYY-MM-DD') AS period,
            COUNT(*)                                               AS total,
            COUNT(*) FILTER (WHERE status = 'completed')          AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled')          AS cancelled
        FROM public.appointments
        WHERE business_id = p_business_id
          AND date_start >= p_start
          AND date_start <  p_end
        GROUP BY date_trunc('day', date_start)
        ORDER BY date_trunc('day', date_start);

    ELSIF p_granularity = 'week' THEN
        RETURN QUERY
        SELECT
            to_char(date_trunc('week', date_start), 'YYYY-MM-DD') AS period,
            COUNT(*)                                                AS total,
            COUNT(*) FILTER (WHERE status = 'completed')           AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled')           AS cancelled
        FROM public.appointments
        WHERE business_id = p_business_id
          AND date_start >= p_start
          AND date_start <  p_end
        GROUP BY date_trunc('week', date_start)
        ORDER BY date_trunc('week', date_start);

    ELSE -- 'month' (default)
        RETURN QUERY
        SELECT
            to_char(date_trunc('month', date_start), 'YYYY-MM') AS period,
            COUNT(*)                                              AS total,
            COUNT(*) FILTER (WHERE status = 'completed')         AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled')         AS cancelled
        FROM public.appointments
        WHERE business_id = p_business_id
          AND date_start >= p_start
          AND date_start <  p_end
        GROUP BY date_trunc('month', date_start)
        ORDER BY date_trunc('month', date_start);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION get_appointment_trend(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_appointment_trend(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


-- ─── 7. RPC: get_plan_limits (actualizar p_business_id a UUID si existe) ──────
-- Si esta función existe con p_business_id INTEGER, actualizarla.

DROP FUNCTION IF EXISTS get_plan_limits(INTEGER);
DROP FUNCTION IF EXISTS get_plan_limits(UUID);

CREATE OR REPLACE FUNCTION get_plan_limits(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_plan TEXT;
BEGIN
    SELECT plan INTO v_plan
    FROM public.businesses
    WHERE id = p_business_id;

    RETURN CASE v_plan
        WHEN 'starter' THEN '{"max_patients": 100, "max_appointments_month": 200}'::JSONB
        WHEN 'pro'      THEN '{"max_patients": 500, "max_appointments_month": 1000}'::JSONB
        WHEN 'enterprise' THEN '{"max_patients": null, "max_appointments_month": null}'::JSONB
        ELSE                 '{"max_patients": 50,  "max_appointments_month": 100}'::JSONB
    END;
END;
$$;

REVOKE ALL ON FUNCTION get_plan_limits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_plan_limits(UUID) TO authenticated;


-- ─── 8. RLS para materialized views ──────────────────────────────────────────
-- Los MVs no soportan RLS nativo — el acceso se controla revocando SELECT directo
-- y forzando el paso por las RPCs SECURITY DEFINER anteriores.

REVOKE SELECT ON mv_business_stats FROM anon, authenticated;
REVOKE SELECT ON mv_patient_stats  FROM anon, authenticated;


-- ─── VERIFICACIÓN FINAL ───────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_business_stats') THEN
        RAISE EXCEPTION 'mv_business_stats no fue creada';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_patient_stats') THEN
        RAISE EXCEPTION 'mv_patient_stats no fue creada';
    END IF;
    RAISE NOTICE 'OK: vistas materializadas y RPCs recreadas correctamente.';
END $$;
