-- =====================================================
-- NovTurnIA — Migración 010: Límites blandos por visibilidad
-- =====================================================
--
-- DEPENDE DE: 009_plan_enforcement.sql
--
-- CAMBIO DE DISEÑO:
--   La migración 009 BLOQUEABA inserciones más allá del cupo del plan.
--   El producto requiere que NO se bloquee: el negocio puede seguir
--   creando pacientes / staff sin tope; simplemente sólo se mostrarán
--   los N más recientes en la UI. Toda la data queda preservada y
--   "reaparece" automáticamente al subir de plan.
--
-- QUÉ HACE:
--   1. Elimina los triggers y funciones de bloqueo de 009.
--   2. Expone RPCs que devuelven los IDs de las N filas más recientes
--      según el plan del negocio:
--        - get_visible_patient_ids(business_id) → uuid[]
--        - get_visible_staff_ids(business_id)   → uuid[]
--      NULL en max_* = ilimitado → devuelve TODOS los IDs.
--   3. Conserva has_feature / enforce_feature y los datos del plan.
-- =====================================================

BEGIN;

-- ─── PASO 1: Quitar la lógica de bloqueo de 009 ─────────────────────────────

DROP TRIGGER  IF EXISTS trg_enforce_patient_plan_limit ON patients;
DROP TRIGGER  IF EXISTS trg_enforce_staff_plan_limit   ON staff_users;
DROP FUNCTION IF EXISTS enforce_patient_plan_limit();
DROP FUNCTION IF EXISTS enforce_staff_plan_limit();


-- ─── PASO 2: RPC de IDs visibles para PACIENTES ──────────────────────────────

DROP FUNCTION IF EXISTS get_visible_patient_ids(UUID);
CREATE OR REPLACE FUNCTION get_visible_patient_ids(p_business_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max INTEGER;
  v_ids UUID[];
BEGIN
  SELECT pl.max_patients INTO v_max
  FROM public.businesses b
  JOIN public.plans pl ON pl.id = b.plan_id
  WHERE b.id = p_business_id;

  -- NULL = sin límite → devolver todos los IDs activos
  IF v_max IS NULL THEN
    SELECT array_agg(id) INTO v_ids
    FROM public.patients
    WHERE business_id = p_business_id AND deleted_at IS NULL;
  ELSE
    -- Top N más recientes (created_at DESC). Los demás quedan
    -- preservados pero ocultos hasta que el negocio suba de plan.
    SELECT array_agg(id) INTO v_ids
    FROM (
      SELECT id
      FROM public.patients
      WHERE business_id = p_business_id AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT v_max
    ) sub;
  END IF;

  RETURN COALESCE(v_ids, ARRAY[]::UUID[]);
END;
$$;

REVOKE ALL ON FUNCTION get_visible_patient_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_visible_patient_ids(UUID) TO authenticated;


-- ─── PASO 3: RPC de IDs visibles para STAFF ──────────────────────────────────

DROP FUNCTION IF EXISTS get_visible_staff_ids(UUID);
CREATE OR REPLACE FUNCTION get_visible_staff_ids(p_business_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max INTEGER;
  v_ids UUID[];
BEGIN
  SELECT pl.max_staff INTO v_max
  FROM public.businesses b
  JOIN public.plans pl ON pl.id = b.plan_id
  WHERE b.id = p_business_id;

  IF v_max IS NULL THEN
    SELECT array_agg(id) INTO v_ids
    FROM public.staff_users
    WHERE business_id = p_business_id AND active = true;
  ELSE
    SELECT array_agg(id) INTO v_ids
    FROM (
      SELECT id
      FROM public.staff_users
      WHERE business_id = p_business_id AND active = true
      ORDER BY created_at DESC
      LIMIT v_max
    ) sub;
  END IF;

  RETURN COALESCE(v_ids, ARRAY[]::UUID[]);
END;
$$;

REVOKE ALL ON FUNCTION get_visible_staff_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_visible_staff_ids(UUID) TO authenticated;


-- ─── PASO 4: Ajuste a get_plan_limits para reportar uso real ─────────────────
--
-- patients_used / staff_used ahora cuentan TODA la data (incluida la oculta),
-- para que el front pueda mostrar "tienes 12 clientes guardados, sólo se ven
-- los 10 más recientes — sube de plan para verlos todos".
-- (La firma JSON ya devuelve esto; no hace falta cambiar la RPC.)


COMMIT;

-- =====================================================
-- POST-MIGRACIÓN:
--   - Las RPCs son llamadas desde el service layer:
--       supabase.rpc('get_visible_patient_ids', { p_business_id: bid })
--     y luego se aplica .in('id', ids) en la query principal.
--   - Al subir de plan basic → pro, la siguiente lectura ya devuelve más IDs.
--   - El CRUD de pacientes / staff vuelve a ser libre (sin bloqueo PT001/PT002).
-- =====================================================
