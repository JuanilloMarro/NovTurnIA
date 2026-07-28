-- SEC-1 · Cierra la escalación de privilegios probada en staff_users.
--   Vector A: un miembro con manage_roles=false insertaba una fila asignando
--             rol owner a una segunda cuenta auth que controla.
--   Vector B: ese mismo miembro borraba al dueño del negocio.
-- El gate de permiso estaba en UPDATE y faltaba en INSERT y DELETE.
--
-- Verificado antes de aplicar: la UI crea y da de baja staff mediante la Edge
-- Function `manage-staff`, que usa service_role y por lo tanto salta RLS
-- (insert en index.ts:148, soft-delete en index.ts:212). Estas políticas no
-- las usa la aplicación: existen solo como superficie de la API REST.

DROP POLICY IF EXISTS staff_users_insert ON public.staff_users;
CREATE POLICY staff_users_insert ON public.staff_users
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id = (SELECT get_user_business_id())
    AND (SELECT user_has_permission('manage_roles'))
    -- el rol asignado debe pertenecer al mismo negocio
    AND (
      role_id IS NULL
      OR role_id IN (
        SELECT r.id FROM public.staff_roles r
        WHERE r.business_id = (SELECT get_user_business_id())
      )
    )
  );

DROP POLICY IF EXISTS staff_users_delete ON public.staff_users;
CREATE POLICY staff_users_delete ON public.staff_users
  FOR DELETE TO authenticated
  USING (
    business_id = (SELECT get_user_business_id())
    AND (SELECT user_has_permission('manage_roles'))
  );

-- COD-5 · Declarar explícitas las políticas de staff_roles que hoy están
-- denegadas por ausencia, para que el invariante quede escrito y no dependa
-- de que nadie agregue una política permisiva por descuido.
DROP POLICY IF EXISTS staff_roles_insert ON public.staff_roles;
CREATE POLICY staff_roles_insert ON public.staff_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id = (SELECT get_user_business_id())
    AND (SELECT user_has_permission('manage_roles'))
  );

DROP POLICY IF EXISTS staff_roles_delete ON public.staff_roles;
CREATE POLICY staff_roles_delete ON public.staff_roles
  FOR DELETE TO authenticated
  USING (
    business_id = (SELECT get_user_business_id())
    AND (SELECT user_has_permission('manage_roles'))
  );

-- SEC-2 · Invariante que la RLS no puede expresar: un negocio nunca puede
-- quedarse sin ningún administrador activo. Hoy hay exactamente 1 owner por
-- tenant, así que el riesgo de lockout es real y no hipotético.
CREATE OR REPLACE FUNCTION public.guard_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_was_admin boolean;
  v_is_admin  boolean;
  v_remaining integer;
BEGIN
  SELECT OLD.active AND COALESCE((r.permissions ->> 'manage_roles')::boolean, false)
    INTO v_was_admin
    FROM staff_roles r
   WHERE r.id = OLD.role_id;

  -- La fila afectada no era administrador: nada que proteger.
  IF NOT COALESCE(v_was_admin, false) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- En UPDATE, si sigue siendo administrador activo del mismo negocio, pasa.
  IF TG_OP = 'UPDATE' THEN
    SELECT NEW.active AND COALESCE((r.permissions ->> 'manage_roles')::boolean, false)
      INTO v_is_admin
      FROM staff_roles r
     WHERE r.id = NEW.role_id;

    IF COALESCE(v_is_admin, false) AND NEW.business_id = OLD.business_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT count(*)
    INTO v_remaining
    FROM staff_users u
    JOIN staff_roles r ON r.id = u.role_id
   WHERE u.business_id = OLD.business_id
     AND u.id <> OLD.id
     AND u.active
     AND COALESCE((r.permissions ->> 'manage_roles')::boolean, false);

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'El negocio quedaria sin ningun administrador activo.'
      USING ERRCODE = 'P0001', HINT = 'LAST_OWNER_GUARD';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_owner ON public.staff_users;
CREATE TRIGGER trg_guard_last_owner
  BEFORE DELETE OR UPDATE ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_owner();

REVOKE ALL ON FUNCTION public.guard_last_owner() FROM PUBLIC, anon, authenticated;
