-- RES-2 · provision_tenant — alta de tenant en UNA transacción.
--
-- HALLAZGO (Auditoría Técnica §2.4): `onboard-tenant` hace 4 escrituras
-- secuenciales (businesses → staff_roles → auth.users → staff_users) y compensa
-- a mano en el catch. Las dos compensaciones están silenciadas con
-- `.catch(() => {})`, así que si la compensación TAMBIÉN falla queda un usuario
-- en `auth.users` sin fila en `staff_users`: login exitoso, dashboard vacío, y
-- el email queda tomado — el cliente no puede reintentar el alta.
--
-- FIX: las 3 escrituras de Postgres pasan a esta función, que es atómica por
-- definición (una excepción revierte todo). En la Edge Function queda solo
-- `auth.admin.createUser`, que no puede vivir en Postgres, y se ejecuta PRIMERO
-- para que su fallo no deje nada que compensar. El único caso que sigue
-- necesitando compensación es "auth ok + RPC falla", y ahí basta con borrar el
-- usuario de auth: la transacción ya se encargó de que no exista nada más.
--
-- ─── DÓNDE ME APARTO DEL SPEC DE LA AUDITORÍA, Y POR QUÉ ────────────────────
--
-- 1. `RETURNING id INTO v_owner_role` sobre un INSERT de DOS filas devuelve la
--    ÚLTIMA insertada, que es 'secretary', no 'owner'. El propio documento lo
--    advierte. Acá los roles se insertan y el id de owner se toma con un SELECT
--    explícito por nombre, que no depende del orden.
--
-- 2. El rol se llama 'secretary', no 'secretaria' como dice el spec: así está en
--    la función desplegada y así lo espera el resto del sistema.
--
-- 3. Los permisos NO se escriben acá. Son dos objetos JSON de ~40 llaves que hoy
--    viven en la Edge Function; duplicarlos en SQL crearía dos fuentes de verdad
--    que se desincronizan en el primer permiso nuevo. Entran como parámetros.
--
-- 4. `p_plan_expires_at` entra calculado desde la Edge Function en vez de
--    resolverse acá con `now() + interval '1 month'`. NO es capricho: el JS usa
--    `setMonth`, que ante un alta el 31 desborda al mes siguiente (31-ene →
--    3-mar), y ese desborde está documentado como deliberado porque `record_payment`
--    hace lo mismo. `interval '1 month'` en Postgres recorta al último día del mes
--    (28-feb) — o sea que resolverlo en SQL cambiaría el vencimiento de esas altas
--    y desalinearía alta y renovación.
--
-- 5. El spec omite `schedule_start/end`, `schedule_days`, `phone_number_id` y
--    `whatsapp_token`, que la función SÍ escribe y son NOT NULL. Están incluidos.
--
-- El `plan_status` se arma con literales SIN tipar a propósito: así Postgres los
-- coacciona al tipo real de la columna sin que esta migración tenga que conocer
-- el nombre del enum.
--
-- Migración ADITIVA: solo CREATE FUNCTION + grants. No toca datos ni esquema.

CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_user_id                uuid,
  p_business_name          text,
  p_plan_id                uuid,
  p_trial                  boolean,
  p_plan_expires_at        timestamptz,
  p_timezone               text,
  p_schedule_start         integer,
  p_schedule_end           integer,
  p_schedule_days          text,
  p_phone_number_id        text,
  p_whatsapp_token         text,
  p_owner_permissions      jsonb,
  p_secretary_permissions  jsonb,
  p_owner_name             text,
  p_owner_email            text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_business_id uuid;
  v_owner_role  uuid;
BEGIN
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_id es requerido' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO businesses (
    name, plan_id, plan_status, plan_expires_at, timezone,
    schedule_start, schedule_end, schedule_days,
    phone_number_id, whatsapp_token
  ) VALUES (
    p_business_name,
    p_plan_id,
    CASE WHEN p_trial THEN 'trial' ELSE 'active' END,
    p_plan_expires_at,
    p_timezone,
    p_schedule_start,
    p_schedule_end,
    p_schedule_days,
    coalesce(p_phone_number_id, ''),
    coalesce(p_whatsapp_token, '')
  )
  RETURNING id INTO v_business_id;

  INSERT INTO staff_roles (business_id, name, permissions) VALUES
    (v_business_id, 'owner',     p_owner_permissions),
    (v_business_id, 'secretary', p_secretary_permissions);

  -- Por nombre, NO por RETURNING: un INSERT de 2 filas devuelve la última.
  SELECT id INTO v_owner_role
    FROM staff_roles
   WHERE business_id = v_business_id AND name = 'owner';

  IF v_owner_role IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver el rol owner del negocio %', v_business_id
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO staff_users (id, business_id, role_id, full_name, email, active)
  VALUES (p_user_id, v_business_id, v_owner_role, p_owner_name, p_owner_email, true);

  RETURN v_business_id;
END $$;

-- Solo la Edge Function (service_role) puede provisionar tenants.
REVOKE ALL ON FUNCTION public.provision_tenant(
  uuid, text, uuid, boolean, timestamptz, text, integer, integer, text, text, text, jsonb, jsonb, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.provision_tenant(
  uuid, text, uuid, boolean, timestamptz, text, integer, integer, text, text, text, jsonb, jsonb, text, text
) TO service_role;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.provision_tenant(
--     uuid, text, uuid, boolean, timestamptz, text, integer, integer, text, text, text, jsonb, jsonb, text, text);
