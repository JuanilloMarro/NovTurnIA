-- =====================================================
-- NovTurnIA — Migración 011: Staff visibility admin-safe
-- =====================================================
--
-- DEPENDE DE: 010_plan_soft_limits.sql
--
-- POR QUÉ:
--   En 010 la RPC ordenaba por created_at DESC (top-N más recientes).
--   Como el dueño / admin del negocio se crea PRIMERO (manualmente desde
--   Supabase, antes que ningún staff), DESC lo dejaba fuera del top-N
--   apenas el dueño contrataba más empleados que su cupo.
--
-- CAMBIO:
--   ORDER BY created_at ASC → el primer staff (admin) siempre cae dentro
--   del top-N. El staff más nuevo es el que queda oculto si se pasa del
--   cupo, lo cual es coherente: la data se preserva y reaparece al subir
--   de plan, pero el dueño nunca pierde acceso visible a sí mismo.
-- =====================================================

BEGIN;

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
      ORDER BY created_at ASC   -- admin (más antiguo) siempre visible
      LIMIT v_max
    ) sub;
  END IF;

  RETURN COALESCE(v_ids, ARRAY[]::UUID[]);
END;
$$;

REVOKE ALL ON FUNCTION get_visible_staff_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_visible_staff_ids(UUID) TO authenticated;

COMMIT;
