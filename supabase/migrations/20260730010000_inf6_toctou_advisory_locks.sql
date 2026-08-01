-- ============================================================================
-- INF-6 — TOCTOU en los 3 triggers de límite de plan
-- ----------------------------------------------------------------------------
-- EL BUG: los tres triggers hacen
--     SELECT count(*) INTO v_used ...;
--     IF v_used >= v_max THEN RAISE EXCEPTION ...
-- y eso NO es atómico. Entre el count y el INSERT no hay nada que impida que
-- otra transacción haga exactamente lo mismo: dos INSERT concurrentes del mismo
-- negocio leen el mismo conteo (N), ambos concluyen que N < max, y ambos
-- insertan. Resultado: el tenant termina con N+2 filas habiendo un cupo de N+1.
-- No es teórico — es la carrera clásica de "check-then-act", y en un SaaS con
-- cupos por plan significa entregar más de lo vendido (o facturar de menos).
--
-- EL FIX: `pg_advisory_xact_lock` con una llave derivada de (negocio, recurso).
-- Es un lock de aplicación, no de fila: la segunda transacción se BLOQUEA hasta
-- que la primera confirme o aborte, y recién entonces hace su count — que ya ve
-- la fila de la primera. Se libera solo al terminar la transacción (variante
-- `xact`), así que no hay riesgo de lock huérfano ni de olvidarse de soltarlo.
--
-- Granularidad: la llave incluye el business_id, así que dos negocios distintos
-- NUNCA se bloquean entre sí. Para turnos incluye además el mes, porque el cupo
-- es mensual: altas en meses distintos del mismo negocio tampoco se serializan.
-- El costo es que dos altas simultáneas del MISMO recurso y MISMO negocio se
-- ordenan uno detrás del otro — que es exactamente lo que queremos.
--
-- Se preserva intacto el resto del comportamiento: la exención para
-- `auth.uid() IS NULL` (bot/service_role, con gate amable aguas arriba), los
-- ERRCODE/HINT `PLAN_LIMIT_*` que el frontend ya mapea a mensajes de upgrade, y
-- el respeto a `limit_overrides` vía `get_effective_limit`.
--
-- Free tier (Contrato §4): solo se reemplaza el cuerpo de 3 funciones. Sin
-- cambios de esquema, sin tocar datos. Rollback al pie.
-- ============================================================================

-- ─── Clientes ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_patient_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_max int; v_used int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- bot/service_role: sin cap duro
  v_max := public.get_effective_limit(NEW.business_id, 'max_patients');
  IF v_max IS NOT NULL THEN
    -- INF-6: serializa las altas concurrentes de ESTE negocio antes de contar.
    PERFORM pg_advisory_xact_lock(hashtext('plan_limit:patients:' || NEW.business_id::text));

    SELECT count(*) INTO v_used FROM patients
     WHERE business_id = NEW.business_id AND deleted_at IS NULL;
    IF v_used >= v_max THEN
      RAISE EXCEPTION 'Límite de % clientes de tu plan alcanzado. Sube de plan para agregar más.', v_max
        USING ERRCODE = 'P0001', HINT = 'PLAN_LIMIT_PATIENTS';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ─── Staff ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_staff_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_max int; v_used int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- bot/service_role: sin cap duro
  v_max := public.get_effective_limit(NEW.business_id, 'max_staff');
  IF v_max IS NOT NULL THEN
    -- INF-6
    PERFORM pg_advisory_xact_lock(hashtext('plan_limit:staff:' || NEW.business_id::text));

    SELECT count(*) INTO v_used FROM staff_users
     WHERE business_id = NEW.business_id AND active = true;
    IF v_used >= v_max THEN
      RAISE EXCEPTION 'Límite de % usuarios de staff de tu plan alcanzado.', v_max
        USING ERRCODE = 'P0001', HINT = 'PLAN_LIMIT_STAFF';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ─── Turnos (cupo MENSUAL: la llave incluye el mes) ─────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_appointment_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_max int; v_used int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- bot/service_role: gate amable aguas arriba
  v_max := public.get_effective_limit(NEW.business_id, 'max_appointments');
  IF v_max IS NOT NULL THEN
    -- INF-6: el cupo es por mes, así que la llave lleva el mes del turno. Altas
    -- en meses distintos del mismo negocio no se bloquean entre sí.
    PERFORM pg_advisory_xact_lock(hashtext(
      'plan_limit:appointments:' || NEW.business_id::text || ':' ||
      to_char(date_trunc('month', NEW.date_start), 'YYYY-MM')
    ));

    SELECT count(*) INTO v_used FROM appointments
     WHERE business_id = NEW.business_id
       AND date_trunc('month', date_start) = date_trunc('month', NEW.date_start)
       AND status <> 'cancelled';
    IF v_used >= v_max THEN
      RAISE EXCEPTION 'Límite de % turnos/mes de tu plan alcanzado para ese mes.', v_max
        USING ERRCODE = 'P0001', HINT = 'PLAN_LIMIT_APPOINTMENTS';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ============================================================================
-- ROLLBACK (quita los locks; reabre la carrera de check-then-act):
--   Volver a crear las 3 funciones sin la línea `PERFORM pg_advisory_xact_lock(...)`.
--   La definición previa está en el historial de git de este archivo.
-- ============================================================================
