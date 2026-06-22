-- ============================================================
-- 022: Respuesta humana en WhatsApp (handoff de agente)
--   1. Nuevo valor 'agent' en message_role para distinguir los mensajes
--      enviados por un humano desde el dashboard de los de la IA ('assistant').
--      La Edge Function `wa-human-reply` inserta en `history` con role='agent'
--      al reenviar la respuesta del staff por la Cloud API del tenant.
--   2. Hardening: habilitar RLS en message_buffer (advisor lo marca CRÍTICO).
-- ============================================================

-- ── 1. Rol 'agent' ─────────────────────────────────────────
-- ADD VALUE es seguro dentro de transacción en PG12+ mientras no se USE el valor
-- en la misma transacción (aquí solo se agrega).
ALTER TYPE message_role ADD VALUE IF NOT EXISTS 'agent';


-- ── 2. RLS en message_buffer ───────────────────────────────
-- NOTA: aplicar solo si n8n accede a message_buffer con la service_role key
-- (que ignora RLS). Si n8n usara la anon/authenticated key, primero confirmá
-- que las policies de abajo cubren su patrón de acceso para no romper el bot.
ALTER TABLE public.message_buffer ENABLE ROW LEVEL SECURITY;

-- Policies con el patrón unificado del proyecto: business_id = get_user_business_id().
-- Idempotentes (DROP IF EXISTS + CREATE) para poder re-correr la migración.
DROP POLICY IF EXISTS message_buffer_select ON public.message_buffer;
CREATE POLICY message_buffer_select ON public.message_buffer
    FOR SELECT USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS message_buffer_insert ON public.message_buffer;
CREATE POLICY message_buffer_insert ON public.message_buffer
    FOR INSERT WITH CHECK (business_id = get_user_business_id());

DROP POLICY IF EXISTS message_buffer_delete ON public.message_buffer;
CREATE POLICY message_buffer_delete ON public.message_buffer
    FOR DELETE USING (business_id = get_user_business_id());
