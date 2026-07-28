-- ============================================================================
-- INF-13 — `create_patient_with_phone` sin validación interna de business_id
-- ----------------------------------------------------------------------------
-- ⚠️ CORRECCIÓN AL DIAGNÓSTICO DEL BACKLOG: estaba catalogado como "depende solo
-- del GRANT/RLS externo" (es decir, defensa en profundidad). **Es explotable.**
-- La función es SECURITY DEFINER, así que SALTA la RLS, y aceptaba
-- `p_business_id` del caller sin verificarlo contra el negocio del usuario.
--
-- Probado contra producción (transacción con ROLLBACK garantizado): un staff
-- autenticado del negocio `0dcfe80e-…` llamó la RPC pasando el uuid de otro
-- negocio y **creó un paciente dentro del tenant ajeno**:
--     PROBE_ANTES_INF13 >> VULNERABLE - creo paciente 84be7265-… en el negocio AJENO <<
-- Es una escritura cross-tenant, el invariante central del producto.
--
-- FIX: ownership-check interno, con el mismo patrón que ya usan
-- `get_visible_patient_ids`/`get_visible_staff_ids` — si el caller tiene perfil
-- de staff, se le fuerza SU negocio. `get_user_business_id()` devuelve NULL para
-- `service_role` (no hay JWT), así que el bot de n8n y las Edge Functions, que
-- legítimamente pasan cualquier `business_id` de su propio flujo, NO se ven
-- afectados.
--
-- Free tier (Contrato §4): solo se reemplaza el cuerpo de una función; sin
-- cambios de esquema ni de datos. Rollback al pie.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_patient_with_phone(p_business_id uuid, p_display_name text, p_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_patient_id UUID;
    v_caller_biz UUID;
BEGIN
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'business_id requerido';
    END IF;

    -- Ownership-check (INF-13). Si quien llama es un staff autenticado, solo
    -- puede crear pacientes en SU propio negocio. Para service_role (bot, Edge
    -- Functions) esto devuelve NULL y no restringe: ese caller ya es de confianza
    -- y toma el business_id de su flujo, no del usuario final.
    v_caller_biz := public.get_user_business_id();
    IF v_caller_biz IS NOT NULL AND v_caller_biz <> p_business_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: no podes crear pacientes en otro negocio'
            USING ERRCODE = 'P0001', HINT = 'TENANT_MISMATCH';
    END IF;

    INSERT INTO public.patients (business_id, display_name)
    VALUES (p_business_id, p_display_name)
    RETURNING id INTO v_patient_id;

    INSERT INTO public.patient_phones (patient_id, business_id, phone, is_primary)
    VALUES (v_patient_id, p_business_id, p_phone, true);

    RETURN v_patient_id;
END;
$function$;

-- Grants: idénticos al estado previo (authenticated + service_role; sin PUBLIC).
REVOKE ALL ON FUNCTION public.create_patient_with_phone(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_patient_with_phone(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_patient_with_phone(uuid, text, text) TO service_role;

-- ============================================================================
-- ROLLBACK (restaura la versión sin validación — reabre el agujero cross-tenant,
-- hacerlo solo con conocimiento de causa):
--   CREATE OR REPLACE FUNCTION public.create_patient_with_phone(p_business_id uuid, p_display_name text, p_phone text)
--   RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $rb$
--   DECLARE v_patient_id UUID;
--   BEGIN
--     INSERT INTO public.patients (business_id, display_name)
--     VALUES (p_business_id, p_display_name) RETURNING id INTO v_patient_id;
--     INSERT INTO public.patient_phones (patient_id, business_id, phone, is_primary)
--     VALUES (v_patient_id, p_business_id, p_phone, true);
--     RETURN v_patient_id;
--   END; $rb$;
-- ============================================================================
