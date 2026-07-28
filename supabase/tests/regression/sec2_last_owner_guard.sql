-- =====================================================================
-- REGRESSION PROBE · SEC-2 — el negocio nunca queda sin administrador
-- ---------------------------------------------------------------------
-- Invariante protegido (Auditoría Técnica §2.2):
--   Un negocio no puede quedarse sin ningún administrador activo
--   (manage_roles = true, active = true). La RLS no puede expresar
--   "al menos un owner"; lo garantiza el trigger trg_guard_last_owner.
--
-- A diferencia de SEC-1, aquí el actor SÍ tiene manage_roles = true, así
-- que la RLS de DELETE lo deja pasar. El único freno es el trigger. Este
-- probe verifica ese freno: el ÚNICO admin del negocio intenta eliminarse
-- a sí mismo → debe abortar con HINT = LAST_OWNER_GUARD.
--
-- Migración que lo cierra:
--   supabase/migrations/20260728001251_sec1_sec2_staff_users_privilege_escalation_guard.sql
--   (función guard_last_owner + trigger trg_guard_last_owner BEFORE DELETE OR UPDATE)
--
-- Resultado esperado:
--   RESULTADO >> PROTEGIDO - El negocio quedaria sin ningun administrador activo. <<
--   El owner sigue existiendo.
--
-- Método (Contrato §4.4): transacción real, impersonación, RAISE EXCEPTION
-- de cierre → rollback garantizado. Aborta siempre.
-- =====================================================================
DO $$
DECLARE
  v_biz         uuid := gen_random_uuid();
  v_owner       uuid := gen_random_uuid();
  v_member      uuid := gen_random_uuid();
  v_owner_role  int;
  v_member_role int;
  v_plan        uuid;
  v_result      text := 'NO EJECUTADO';
  v_rows        int;
  v_owner_alive int;
BEGIN
  SELECT id INTO v_plan FROM public.plans ORDER BY id LIMIT 1;

  INSERT INTO auth.users (id) VALUES (v_owner), (v_member);

  INSERT INTO public.businesses (id, name, phone_number_id, whatsapp_token, plan_id, limit_overrides)
  VALUES (v_biz, 'SEC-2 regression seed', 'probe', 'probe', v_plan, '{"max_staff":1000}'::jsonb);

  INSERT INTO public.staff_roles (business_id, name, permissions)
  VALUES (v_biz, 'owner', '{"manage_roles":true}'::jsonb) RETURNING id INTO v_owner_role;
  INSERT INTO public.staff_roles (business_id, name, permissions)
  VALUES (v_biz, 'secretaria', '{"manage_roles":false}'::jsonb) RETURNING id INTO v_member_role;

  -- El owner es el ÚNICO administrador activo; el otro es un miembro sin manage_roles.
  INSERT INTO public.staff_users (id, business_id, role_id, full_name, active) VALUES
    (v_owner,  v_biz, v_owner_role,  'Owner',  true),
    (v_member, v_biz, v_member_role, 'Member', true);

  -- --- Impersonar al owner (manage_roles = true: la RLS lo deja pasar) -
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- --- El ataque: el último admin se elimina a sí mismo ---------------
  BEGIN
    DELETE FROM public.staff_users WHERE id = v_owner;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_result := 'VULNERABLE - negocio quedo sin administrador activo ('||v_rows||' fila eliminada)';
  EXCEPTION WHEN OTHERS THEN
    v_result := 'PROTEGIDO - ' || SQLERRM;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- --- Defensa en profundidad: el owner debe seguir existiendo --------
  SELECT count(*) INTO v_owner_alive FROM public.staff_users WHERE id = v_owner;
  IF v_owner_alive = 0 THEN
    v_result := 'VULNERABLE - el owner fue eliminado pese a: ' || v_result;
  END IF;

  RAISE EXCEPTION 'RESULTADO >> % <<', v_result;   -- aborta: nada se persiste
END $$;
