-- ============================================================
-- 020: Limpiar enum appt_status y corregir get_appointment_trend
-- ============================================================

-- ── 1. Preparar filas con valores obsoletos ───────────────────
UPDATE appointments SET status = 'confirmed' WHERE status::TEXT = 'completed';
UPDATE appointments SET status = 'scheduled' WHERE status::TEXT = 'active';

-- ── 2. Dropear TODOS los triggers que dependen de la columna status
DROP TRIGGER IF EXISTS prevent_mass_cancel        ON appointments;
DROP TRIGGER IF EXISTS trg_validate_appointment   ON appointments;
DROP TRIGGER IF EXISTS validate_appointment       ON appointments;

-- ── 3. Reemplazar el enum ─────────────────────────────────────
ALTER TABLE appointments ALTER COLUMN status TYPE TEXT;
DROP TYPE IF EXISTS appt_status;
CREATE TYPE appt_status AS ENUM ('scheduled', 'confirmed', 'cancelled', 'no_show');
ALTER TABLE appointments ALTER COLUMN status TYPE appt_status USING status::appt_status;

-- ── 4. Recrear prevent_mass_delete (trigger de cancelaciones masivas) ──
CREATE OR REPLACE FUNCTION public.prevent_mass_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.appointments
    WHERE status = 'cancelled'
      AND updated_at > NOW() - INTERVAL '5 seconds'
  ) > 10 THEN
    RAISE EXCEPTION 'Mass cancellation detected. Maximum 10 cancellations per 5 seconds.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER prevent_mass_cancel
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (NEW.status::TEXT = 'cancelled')
  EXECUTE FUNCTION public.prevent_mass_delete();

-- ── 5. Recrear validate_appointment ──────────────────────────
CREATE OR REPLACE FUNCTION public.validate_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    biz RECORD;
    start_hour INTEGER;
    end_hour INTEGER;
BEGIN
    IF NEW.date_start >= NEW.date_end THEN
        RAISE EXCEPTION 'La hora de inicio debe ser anterior a la hora de fin.';
    END IF;

    SELECT schedule_start, schedule_end, timezone
    INTO biz
    FROM businesses
    WHERE id = NEW.business_id;

    IF biz IS NULL THEN
        RAISE EXCEPTION 'El negocio con ID % no existe.', NEW.business_id;
    END IF;

    start_hour := EXTRACT(HOUR FROM NEW.date_start AT TIME ZONE COALESCE(biz.timezone, 'America/Guatemala'));
    end_hour   := EXTRACT(HOUR FROM NEW.date_end   AT TIME ZONE COALESCE(biz.timezone, 'America/Guatemala'));

    IF start_hour < biz.schedule_start OR end_hour > biz.schedule_end THEN
        RAISE EXCEPTION 'El turno está fuera del horario del negocio (% a %).', biz.schedule_start, biz.schedule_end;
    END IF;

    IF EXISTS (
        SELECT 1 FROM appointments
        WHERE business_id = NEW.business_id
          AND status IN ('scheduled', 'confirmed')
          AND id IS DISTINCT FROM NEW.id
          AND NEW.date_start < date_end
          AND NEW.date_end > date_start
    ) THEN
        RAISE EXCEPTION 'Ya existe un turno activo en ese horario.';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_appointment
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment();

-- ── 6. Corregir get_appointment_trend ────────────────────────
CREATE OR REPLACE FUNCTION get_appointment_trend(
  p_business_id UUID,
  p_granularity TEXT        DEFAULT 'month',
  p_start       TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 month',
  p_end         TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  period    TEXT,
  total     BIGINT,
  no_show   BIGINT,
  cancelled BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    CASE p_granularity
      WHEN 'day'  THEN TO_CHAR(date_start AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD')
      WHEN 'week' THEN TO_CHAR(date_trunc('week', (date_start AT TIME ZONE 'America/Guatemala')::date), 'YYYY-MM-DD')
      ELSE             TO_CHAR(date_start AT TIME ZONE 'America/Guatemala', 'YYYY-MM')
    END                                                          AS period,
    COUNT(*) FILTER (WHERE status IN ('scheduled', 'confirmed')) AS total,
    COUNT(*) FILTER (WHERE status = 'no_show')                   AS no_show,
    COUNT(*) FILTER (WHERE status = 'cancelled')                 AS cancelled
  FROM appointments
  WHERE business_id = p_business_id
    AND date_start >= p_start
    AND date_start <  p_end
  GROUP BY 1
  ORDER BY 1;
$$;
