-- =====================================================================
-- REGRESSION PROBE · SEC-1 Vector A — escalación por cuenta secundaria
-- ---------------------------------------------------------------------
-- Exploit reproducido (Auditoría Técnica §1.3, Vector A):
--   Un miembro autenticado con manage_roles = false hacía
--   POST /rest/v1/staff_users asignando role_id de owner a una SEGUNDA
--   cuenta auth que controla → 201 Created. La cuenta cómplice quedaba
--   como owner del tenant. El gate estaba solo en UPDATE; INSERT lo omitía.
--
-- Migración que lo cierra:
--   supabase/migrations/20260728001251_sec1_sec2_staff_users_privilege_escalation_guard.sql
--   (política staff_users_insert: business_id + user_has_permission('manage_roles')
--    + role_id acotado al mismo negocio)
--
-- Resultado esperado:
--   RESULTADO >> PROTEGIDO - ... row-level security ... <<
--   La fila del cómplice NO persiste con rol owner.
--
-- Método (Contrato §4.4): transacción real con impersonación y RAISE
-- EXCEPTION de cierre → rollback garantizado, nada se persiste.
-- Ejecutar contra producción vía MCP execute_sql o psql. Aborta siempre.
-- =====================================================================
DO $$
DECLARE
  v_biz         uuid := gen_random_uuid();
  v_owner       uuid := gen_random_uuid();
  v_attacker    uuid := gen_random_uuid();
  v_accomplice  uuid := gen_random_uuid();
  v_owner_role  int;
  v_member_role int;
  v_plan        uuid;
  v_result      text := 'NO EJECUTADO';
  v_persisted   int;
BEGIN
  SELECT id INTO v_plan FROM public.plans ORDER BY id LIMIT 1;

  -- --- Escenario sintético (negocio semilla, no un tenant real) -------
  INSERT INTO auth.users (id) VALUES (v_owner), (v_attacker), (v_accomplice);

  -- limit_overrides alto: que trg_enforce_staff_limit no se adelante a la RLS
  INSERT INTO public.businesses (id, name, phone_number_id, whatsapp_token, plan_id, limit_overrides)
  VALUES (v_biz, 'SEC-1A regression seed', 'probe', 'probe', v_plan, '{"max_staff":1000}'::jsonb);

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
    INSERT INTO public.staff_users (id, business_id, role_id, full_name, active)
    VALUES (v_accomplice, v_biz, v_owner_role, 'Accomplice', true);   -- rol OWNER
    v_result := 'VULNERABLE - complice insertado como owner sin manage_roles';
  EXCEPTION WHEN OTHERS THEN
    v_result := 'PROTEGIDO - ' || SQLERRM;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- --- Defensa en profundidad: la fila maliciosa no debe persistir ----
  SELECT count(*) INTO v_persisted
  FROM public.staff_users
  WHERE id = v_accomplice AND role_id = v_owner_role;
  IF v_persisted > 0 THEN
    v_result := 'VULNERABLE - la fila persistio pese a: ' || v_result;
  END IF;

  RAISE EXCEPTION 'RESULTADO >> % <<', v_result;   -- aborta: nada se persiste
END $$;
