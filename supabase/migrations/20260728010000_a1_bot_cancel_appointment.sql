-- A1 · RPC bot_cancel_appointment — cancelación de turnos acotada al tenant.
--
-- HALLAZGO (Automatización IA - n8n §2 A1 / §4.1): los 3 nodos
-- `Tool - Cancelar Cita {Basic|Pro|Enterprise}` del workflow de n8n hacen
--     PATCH /rest/v1/appointments?id=eq.{{ $fromAI('appointment_id') }}
-- con la clave service_role (que SALTA toda la RLS) y SIN filtro de business_id;
-- el UUID lo decide el LLM. Es la única de las 20 tools que no acota por tenant
-- (las otras 17 pasan p_business_id desde el flujo). Un cliente que induzca al
-- modelo a usar otro UUID cancela un turno de CUALQUIER negocio de la plataforma.
--
-- FIX: sustituir el PATCH crudo por esta RPC, que valida en el servidor que el
-- turno pertenezca al negocio (y además al propio paciente) antes de cancelar.
-- Aunque el modelo invente un UUID, la RPC no encuentra fila y no escribe nada.
--
-- Migración ADITIVA: solo CREATE FUNCTION + grants. No toca datos ni esquema.
-- SECURITY DEFINER con search_path fijado y EXECUTE exclusivo de service_role,
-- mismo patrón verificado en producción de bot_offer_services / bot_offer_promos
-- / bot_offer_slots (ACL {postgres, service_role}; PUBLIC/anon/authenticated sin
-- execute). El estado 'cancelled' es un valor válido del enum appt_status y
-- appointments.cancelled_at existe (verificado contra el esquema real).
--
-- SQL tomado tal cual del spec ya diseñado en Automatización IA - n8n §4.1.

CREATE OR REPLACE FUNCTION public.bot_cancel_appointment(
  p_business_id uuid, p_patient_id uuid, p_appointment_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row appointments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM appointments
   WHERE id = p_appointment_id
     AND business_id = p_business_id      -- aislamiento real
     AND patient_id  = p_patient_id;      -- y además, del propio paciente

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turno no encontrado para este cliente.');
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'already_cancelled', true);
  END IF;

  UPDATE appointments SET status = 'cancelled', cancelled_at = now()
   WHERE id = p_appointment_id;

  RETURN jsonb_build_object('ok', true, 'id', p_appointment_id);
END $$;

REVOKE ALL ON FUNCTION public.bot_cancel_appointment(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_cancel_appointment(uuid,uuid,uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- NOTA OPERATIVA — recableado de n8n (FUERA DEL ALCANCE de esta migración).
-- Los 3 nodos `Tool - Cancelar Cita {Basic|Pro|Enterprise}` deben pasar a llamar
-- esta RPC por POST:
--     POST /rest/v1/rpc/bot_cancel_appointment
-- con p_business_id y p_patient_id tomados del flujo (nodos `Negocio - Obtener`
-- y `Paciente`), NUNCA del LLM, y solo p_appointment_id desde $fromAI.
-- DEBE ser POST: por GET, PostgREST ejecuta la función en una transacción de
-- solo-lectura y el UPDATE se descarta EN SILENCIO (200 OK sin efecto). Es una
-- lección real del proyecto, documentada en Automatización IA - n8n §8 y en el
-- backlog de completadas §8; los bot_offer_* ya van por POST por lo mismo.
--
-- RIESGO RESIDUAL: hasta que se recableen los 3 nodos, el agujero A1 sigue
-- ABIERTO — los nodos todavía hacen el PATCH crudo sin filtro de tenant. Esta
-- migración solo deja lista la superficie segura para que n8n la consuma.
-- ---------------------------------------------------------------------------
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.bot_cancel_appointment(uuid, uuid, uuid);
