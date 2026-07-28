-- =====================================================================
-- REGRESSION PROBE · SEC-1 Vector B — expulsión del dueño
-- ---------------------------------------------------------------------
-- Exploit reproducido (Auditoría Técnica §1.3, Vector B):
--   Un miembro con manage_roles = false hacía
--   DELETE /rest/v1/staff_users?id=eq.<uuid del dueño> → 204 No Content.
--   El dueño perdía el acceso: get_user_business_id() le devolvía NULL y
--   toda la RLS lo dejaba fuera de su propio tenant. El gate estaba solo
--   en UPDATE; DELETE lo omitía.
--
-- Migración que lo cierra:
--   supabase/migrations/20260728001251_sec1_sec2_staff_users_privilege_escalation_guard.sql
--   (política staff_users_delete: business_id + user_has_permission('manage_roles'))
--
-- Nota de método: la RLS de DELETE filtra por USING; una fila filtrada NO
-- lanza excepción, simplemente afecta 0 filas. Por eso la detección aquí
-- es por ROW_COUNT + persistencia del dueño, no por captura de excepción.
--
-- Resultado esperado:
--   RESULTADO >> PROTEGIDO - RLS filtro el DELETE (0 filas afectadas) <<
--   El dueño sigue existiendo.
--
-- Método (Contrato §4.4): transacción real, impersonación, RAISE EXCEPTION
-- de cierre → rollback garantizado. Aborta siempre.
-- =====================================================================
DO $$
DECLARE
  v_biz         uuid := gen_random_uuid();
  v_owner       uuid := gen_random_uuid();
  v_attacker    uuid := gen_random_uuid();
  v_owner_role  int;
  v_member_role int;
  v_plan        uuid;
  v_result      text := 'NO EJECUTADO';
  v_rows        int;
  v_owner_alive int;
BEGIN
  SELECT id INTO v_plan FROM public.plans ORDER BY id LIMIT 1;

  INSERT INTO auth.users (id) VALUES (v_owner), (v_attacker);

  INSERT INTO public.businesses (id, name, phone_number_id, whatsapp_token, plan_id, limit_overrides)
  VALUES (v_biz, 'SEC-1B regression seed', 'probe', 'probe', v_plan, '{"max_staff":1000}'::jsonb);

  INSERT INTO public.staff_roles (business_id, name, permissions)
  VALUES (v_biz, 'owner', '{"manage_roles":true}'::jsonb) RETURNING id INTO v_owner_role;
  INSERT INTO public.staff_roles (business_id, name, permissions)
  VALUES (v_biz, 'secretaria', '{"manage_roles":false}'::jsonb) RETURNING id INTO v_member_role;

  INSERT INTO public.staff_users (id, business_id, role_id, full_name, active) VALUES
    (v_owner,    v_biz, v_owner_role,  'Owner',    true),
    (v_attacker, v_biz, v_member_role, 'Attacker', true);

  -- --- Impersonar al atacante (manage_roles = false) ------------------
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_attacker::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- --- El ataque ------------------------------------------------------
  BEGIN
    DELETE FROM public.staff_users WHERE id = v_owner;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_result := 'VULNERABLE - dueno eliminado por miembro sin manage_roles ('||v_rows||' fila)';
    ELSE
      v_result := 'PROTEGIDO - RLS filtro el DELETE (0 filas afectadas)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_result := 'PROTEGIDO - ' || SQLERRM;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- --- Defensa en profundidad: el dueño debe seguir existiendo --------
  SELECT count(*) INTO v_owner_alive FROM public.staff_users WHERE id = v_owner;
  IF v_owner_alive = 0 THEN
    v_result := 'VULNERABLE - el dueno fue eliminado pese a: ' || v_result;
  END IF;

  RAISE EXCEPTION 'RESULTADO >> % <<', v_result;   -- aborta: nada se persiste
END $$;
