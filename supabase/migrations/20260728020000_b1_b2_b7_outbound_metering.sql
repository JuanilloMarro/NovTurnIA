-- ============================================================================
-- B1 · B2 · B7 — Medición de mensajes SALIENTES (outbound metering)
-- ----------------------------------------------------------------------------
-- Contexto: el contador de consumo del bot (usage_counters.messages) mezcla
-- entrantes y salientes. El corte de cupo lee ese total, así que dispara al
-- doble de velocidad de lo que cuesta: solo los SALIENTES tienen costo (WhatsApp
-- + IA). Ver docs/Final Audits/Modelo de Negocio.md §8-9 (B1, B2, B7).
--
-- Alcance de esta migración (SOLO Bloque 1 de medición):
--   B1  Separar entrantes/salientes en usage_counters (messages_in/messages_out).
--       El corte del bot pasa a leer SOLO messages_out.
--   B2  record_usage recibe la dirección del mensaje ('in' | 'out') y acumula en
--       la columna correspondiente. Compatibilidad hacia atrás: los 3 nodos n8n
--       "Uso - Registrar {plan}" (hoy NO editables — túnel de n8n bloqueado)
--       llaman con 4 args y no pasan dirección; el DEFAULT 'out' preserva el
--       comportamiento actual.
--   B7  get_plan_limits devuelve messages_out (consumido) y el cupo efectivo de
--       salientes (plan + extras − consumido).
--
-- Disciplina (free tier, sin branch ni PITR — ver Contrato de Agentes §4):
--   · Aditivo: NO se borra la columna `messages`; su retiro lo decide el humano
--     en otra sesión una vez que nada la lea.
--   · Reversible: rollback escrito al pie de este archivo.
--   · extra_messages (B4) todavía NO existe: se lee de forma tolerante vía
--     to_jsonb(b) → NULL → coalesce 0. Cuando B4 agregue la columna, el término
--     se activa solo, sin tocar estas funciones.
--
-- RIESGO RESIDUAL: el metering por dirección NO es real hasta que el agente
-- n8n-bot recablee los 3 nodos `Uso - Registrar {plan}` para pasar p_direction
-- explícito (entrante='in' en el webhook, saliente='out' al enviar). Hasta
-- entonces todo entra como una sola bolsa saliente (conservador: nunca subcuenta
-- el margen). Dependencia registrada: A5/N2 (n8n) y B4 (businesses.extra_messages).
-- ============================================================================

-- ─── B1: columnas direccionales (ADITIVO) ───────────────────────────────────
ALTER TABLE public.usage_counters
  ADD COLUMN IF NOT EXISTS messages_in  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_out integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.usage_counters.messages_out IS
  'Mensajes SALIENTES del período (bot + staff). Fuente del corte de cupo (B1).';
COMMENT ON COLUMN public.usage_counters.messages_in IS
  'Mensajes ENTRANTES del período. Informativo; no consume cupo (B1).';
COMMENT ON COLUMN public.usage_counters.messages IS
  'Total histórico (in+out). Retenido por compatibilidad; su retiro lo decide el humano.';

-- Backfill conservador: los mensajes históricos combinados se trasladan a
-- messages_out para NO debilitar el corte al migrar. Es exactamente el conteo de
-- hoy (in+out juntos) leído ahora como salientes; el split real llega cuando n8n
-- pase la dirección. Nunca subcuenta ⇒ nunca desprotege el margen. Idempotente:
-- solo toca filas cuyo messages_out sigue en 0.
UPDATE public.usage_counters
   SET messages_out = messages
 WHERE messages_out = 0 AND messages > 0;

-- ─── B2: record_usage con dirección ──────────────────────────────────────────
-- Agregar un parámetro crea un OVERLOAD; una llamada de 4 args seguiría pegando
-- a la firma vieja. Para que los 3 nodos n8n (4 args) resuelvan a la nueva
-- función, se retira la firma vieja y se crea la de 5 args con DEFAULT en el 5º.
-- DROP FUNCTION de una firma reemplazada no es pérdida de datos y es el patrón
-- que ya usa 008_plans_restructure.sql. Rollback recrea la firma vieja.
DROP FUNCTION IF EXISTS public.record_usage(uuid, bigint, bigint, integer);

CREATE OR REPLACE FUNCTION public.record_usage(
  p_business_id uuid,
  p_tokens_in   bigint  DEFAULT 0,
  p_tokens_out  bigint  DEFAULT 0,
  p_messages    integer DEFAULT 1,
  p_direction   text    DEFAULT 'out'   -- 'in' | 'out'. DEFAULT 'out' preserva el
                                        -- comportamiento actual: hasta que n8n-bot
                                        -- recablee, cada llamada cuenta como
                                        -- saliente (conservador para el margen).
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_period date := date_trunc('month', now())::date;
  v_dir    text := lower(coalesce(p_direction, 'out'));
  v_in     int  := 0;
  v_out    int  := 0;
  v_messages     int;
  v_messages_out int;
  v_tokens       bigint;
  v_max   int;
  v_extra int;
  v_cap   int;
  v_limit_reached boolean := false;
begin
  if p_business_id is null then raise exception 'business_id requerido'; end if;
  if v_dir not in ('in', 'out') then
    raise exception 'p_direction inválido: % (use in|out)', p_direction;
  end if;

  if v_dir = 'in' then
    v_in  := greatest(p_messages, 0);
  else
    v_out := greatest(p_messages, 0);
  end if;

  insert into public.usage_counters
        (business_id, period, messages, messages_in, messages_out, tokens_in, tokens_out)
  values (p_business_id, v_period, greatest(p_messages, 0), v_in, v_out,
          greatest(p_tokens_in, 0), greatest(p_tokens_out, 0))
  on conflict (business_id, period) do update
    set messages     = public.usage_counters.messages     + greatest(p_messages, 0),
        messages_in  = public.usage_counters.messages_in  + v_in,
        messages_out = public.usage_counters.messages_out + v_out,
        tokens_in    = public.usage_counters.tokens_in    + greatest(p_tokens_in, 0),
        tokens_out   = public.usage_counters.tokens_out   + greatest(p_tokens_out, 0),
        updated_at   = now()
  returning messages, messages_out, tokens_total into v_messages, v_messages_out, v_tokens;

  -- Cupo efectivo de SALIENTES = max_conversations (override o plan) + extras.
  -- extras (B4) aún no existe: lectura tolerante vía to_jsonb(b) → NULL → 0.
  select coalesce((b.limit_overrides->>'max_conversations')::int, p.max_conversations),
         coalesce((to_jsonb(b)->>'extra_messages')::int, 0)
    into v_max, v_extra
  from public.businesses b
  join public.plans p on p.id = b.plan_id
  where b.id = p_business_id;

  v_cap := v_max + coalesce(v_extra, 0);

  -- B1: el corte lee SOLO salientes.
  if v_max is not null and v_messages_out >= v_cap then
    v_limit_reached := true;
    update public.businesses
       set ai_paused = true, ai_paused_reason = 'usage_limit'
     where id = p_business_id and ai_paused = false;
  end if;

  return json_build_object(
    'messages',      v_messages,       -- total histórico (in+out), backward compat
    'messages_out',  v_messages_out,   -- salientes acumulados (nuevo)
    'tokens_total',  v_tokens,
    'max',           v_max,            -- max_conversations efectivo (sin extras), compat
    'cap',           v_cap,            -- cupo saliente efectivo = max + extras
    'limit_reached', v_limit_reached   -- ahora basado en salientes (B1)
  );
end;
$function$;

-- record_usage es EXCLUSIVA de service_role (la llama n8n / edge). Tras recrear
-- la firma hay que re-asentar los grants o quedaría expuesta a PUBLIC por default.
REVOKE ALL ON FUNCTION public.record_usage(uuid, bigint, bigint, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_usage(uuid, bigint, bigint, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.record_usage(uuid, bigint, bigint, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_usage(uuid, bigint, bigint, integer, text) TO service_role;

-- ─── B7: get_plan_limits devuelve salientes + cupo efectivo ──────────────────
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_business_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  result  json;
  v_period date := date_trunc('month', now())::date;
begin
  select json_build_object(
    'plan',              p.tier,
    'plan_name',         p.name,
    'plan_status',       b.plan_status,
    'monthly_price',     p.monthly_price,
    'annual_discount',   p.annual_discount,
    'max_patients',      coalesce((b.limit_overrides->>'max_patients')::int,      p.max_patients),
    'max_staff',         coalesce((b.limit_overrides->>'max_staff')::int,         p.max_staff),
    'max_appointments',  coalesce((b.limit_overrides->>'max_appointments')::int,  p.max_appointments),
    'max_conversations', coalesce((b.limit_overrides->>'max_conversations')::int, p.max_conversations),
    'features',          coalesce(p.features,'{}'::jsonb) || coalesce(b.feature_flags,'{}'::jsonb),
    'ai_paused',         b.ai_paused,
    'patients_used',     (select count(*) from public.patients   where business_id = p_business_id and deleted_at is null),
    'staff_used',        (select count(*) from public.staff_users where business_id = p_business_id and active = true),
    'appointments_used', (select count(*) from public.appointments
                          where business_id = p_business_id
                            and date_trunc('month', date_start) = date_trunc('month', now())
                            and status <> 'cancelled'),
    -- conversations_used = total histórico (in+out). Retenido por compatibilidad
    -- con usePlanLimits.js / PlansModal; NO es la fuente del corte.
    'conversations_used',(select coalesce(messages,0) from public.usage_counters
                          where business_id = p_business_id and period = v_period),
    -- ── B7: salientes (fuente del bloqueo del dashboard) ──
    'messages_in',       (select coalesce(messages_in,0)  from public.usage_counters
                          where business_id = p_business_id and period = v_period),
    'messages_out',      (select coalesce(messages_out,0) from public.usage_counters
                          where business_id = p_business_id and period = v_period),
    'extra_messages',    coalesce((to_jsonb(b)->>'extra_messages')::int, 0),
    -- cupo saliente = max_conversations efectivo + extras (B4, coalesce 0 hoy)
    'max_messages_out',  coalesce((b.limit_overrides->>'max_conversations')::int, p.max_conversations)
                           + coalesce((to_jsonb(b)->>'extra_messages')::int, 0),
    -- cupo EFECTIVO = cap − consumido (salientes), piso 0
    'messages_out_effective', greatest(
        coalesce((b.limit_overrides->>'max_conversations')::int, p.max_conversations)
          + coalesce((to_jsonb(b)->>'extra_messages')::int, 0)
          - coalesce((select messages_out from public.usage_counters
                      where business_id = p_business_id and period = v_period), 0)
      , 0)
  ) into result
  from public.businesses b
  join public.plans p on p.id = b.plan_id
  where b.id = p_business_id
    and (p_business_id = public.get_user_business_id() or public.get_user_business_id() is null);
  return result;
end;
$function$;

-- Grants (reproducibilidad — INF-1): igual al estado actual (authenticated lee su
-- propio negocio vía el guard interno; anon no).
REVOKE ALL ON FUNCTION public.get_plan_limits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_plan_limits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_limits(uuid) TO service_role;

-- ============================================================================
-- ROLLBACK (aplicar manualmente solo si es necesario; el humano decide):
-- ----------------------------------------------------------------------------
-- -- 1. Restaurar record_usage a su firma de 4 args (sin dirección, corte por total):
-- DROP FUNCTION IF EXISTS public.record_usage(uuid, bigint, bigint, integer, text);
-- CREATE OR REPLACE FUNCTION public.record_usage(
--   p_business_id uuid, p_tokens_in bigint DEFAULT 0, p_tokens_out bigint DEFAULT 0, p_messages integer DEFAULT 1)
-- RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $rb$
-- declare v_period date := date_trunc('month', now())::date;
--   v_messages int; v_tokens bigint; v_max int; v_limit_reached boolean := false;
-- begin
--   if p_business_id is null then raise exception 'business_id requerido'; end if;
--   insert into public.usage_counters (business_id, period, messages, tokens_in, tokens_out)
--   values (p_business_id, v_period, greatest(p_messages,0), greatest(p_tokens_in,0), greatest(p_tokens_out,0))
--   on conflict (business_id, period) do update
--     set messages = public.usage_counters.messages + greatest(p_messages,0),
--         tokens_in = public.usage_counters.tokens_in + greatest(p_tokens_in,0),
--         tokens_out = public.usage_counters.tokens_out + greatest(p_tokens_out,0),
--         updated_at = now()
--   returning messages, tokens_total into v_messages, v_tokens;
--   select coalesce((b.limit_overrides->>'max_conversations')::int, p.max_conversations) into v_max
--   from public.businesses b join public.plans p on p.id = b.plan_id where b.id = p_business_id;
--   if v_max is not null and v_messages >= v_max then
--     v_limit_reached := true;
--     update public.businesses set ai_paused = true, ai_paused_reason = 'usage_limit'
--       where id = p_business_id and ai_paused = false;
--   end if;
--   return json_build_object('messages', v_messages, 'tokens_total', v_tokens, 'max', v_max, 'limit_reached', v_limit_reached);
-- end; $rb$;
-- REVOKE ALL ON FUNCTION public.record_usage(uuid, bigint, bigint, integer) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.record_usage(uuid, bigint, bigint, integer) TO service_role;
--
-- -- 2. Restaurar get_plan_limits sin las claves de salientes (ver definición previa
-- --    en la base antes de esta migración; solo se agregaron claves, es seguro dejarla).
--
-- -- 3. Quitar las columnas direccionales (destructivo — solo si nada las lee):
-- ALTER TABLE public.usage_counters DROP COLUMN IF EXISTS messages_out;
-- ALTER TABLE public.usage_counters DROP COLUMN IF EXISTS messages_in;
-- ============================================================================
