-- ============================================================================
-- B4 — `businesses.extra_messages`: paquetes de mensajes adicionales
-- ----------------------------------------------------------------------------
-- Sin esta columna NO se pueden vender los paquetes de Q350/1,000 mensajes que
-- el modelo de negocio ya ofrece. El cupo efectivo de salientes pasa a ser
--     plan (o limit_overrides) + extra_messages − consumido
--
-- Detalle de diseño: `get_plan_limits` y `record_usage` (migración B1/B2/B7,
-- 20260728020000) YA leen esta columna de forma tolerante vía
-- `to_jsonb(b)->>'extra_messages'` con coalesce a 0, precisamente para que el
-- día que existiera se activara sola. Por eso esta migración NO toca ninguna
-- función: crear la columna basta para que el cupo empiece a sumarla.
--
-- Reinicio con el ciclo: el modelo de negocio define los paquetes como
-- mensuales, así que se agrega el reset al cron `reset-usage-ai-pause`, que ya
-- corre el día 1 a las 00:05 y es el que despausa a los negocios cortados por
-- `usage_limit`. Va en el MISMO job a propósito: si el reset de extras corriera
-- en otro momento que el despause, habría una ventana donde el negocio tiene
-- extras pero sigue pausado (o al revés).
--
-- Free tier (Contrato §4): aditivo (ADD COLUMN con DEFAULT). No borra nada, no
-- reescribe funciones. Rollback al pie.
-- ============================================================================

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS extra_messages integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.businesses.extra_messages IS
  'Mensajes SALIENTES adicionales comprados como paquete (B4). Se suma al cupo '
  'del plan y se reinicia a 0 con el ciclo mensual (cron reset-usage-ai-pause). '
  'Lo leen get_plan_limits y record_usage.';

-- Reinicio mensual: se reemplaza el comando del cron existente para que, además
-- de despausar, ponga los extras en 0. Mismo job, misma cadencia (día 1, 00:05).
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'reset-usage-ai-pause'),
  command => $cmd$
    update public.businesses
       set ai_paused = false,
           ai_paused_reason = null
     where ai_paused = true and ai_paused_reason = 'usage_limit';

    -- B4: los paquetes de mensajes son mensuales y no se acumulan.
    update public.businesses
       set extra_messages = 0
     where extra_messages <> 0;
  $cmd$
);

-- ============================================================================
-- ROLLBACK:
--   -- 1. Devolver el cron a su comando original:
--   SELECT cron.alter_job(
--     (SELECT jobid FROM cron.job WHERE jobname = 'reset-usage-ai-pause'),
--     command => $rb$ update public.businesses set ai_paused = false, ai_paused_reason = null
--        where ai_paused = true and ai_paused_reason = 'usage_limit' $rb$);
--   -- 2. Quitar la columna (destructivo — solo si nada la lee):
--   ALTER TABLE public.businesses DROP COLUMN IF EXISTS extra_messages;
-- ============================================================================
