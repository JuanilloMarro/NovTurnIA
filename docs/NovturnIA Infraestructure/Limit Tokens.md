# Límites reales de tokens IA (Centro IA) — Pro y Enterprise

## Contexto

Hoy el Centro IA (chat de negocio + reportes) gasta tokens de Gemini con la key del dueño **sin ningún tope real**: solo existe un rate limit de 30 llamadas/hora. La `UsageBar` del chat es decorativa (`percent={42}` hardcodeado). Además, los tokens del dashboard se están sumando al contador **mensual del bot de WhatsApp** (`usage_counters` vía `record_usage`), contaminando esa telemetría.

Objetivo: límite **semanal** de tokens estilo Claude Pro, aplicado de verdad en Supabase (la Edge Function rechaza con 429 cuando se agota — imposible de saltar desde el cliente), con barra de consumo real en el front y techo de costo garantizado para el dueño.

## Estrategia económica (opción "Equilibrado", confirmada)

| | Pro (Q1,999) | Enterprise (Q3,999) |
|---|---|---|
| Límite semanal | **750,000 tokens** | **2,000,000 tokens** |
| Equivale a | ~135 preguntas ó ~70 reportes/sem | ~360 preguntas ó ~180 reportes/sem |
| Costo techo mensual (100% × 4 sem, blend peor caso $0.60/M) | ~Q15 (**0.75%** del precio) | ~Q40 (**1.0%** del precio) |
| Costo esperado real (uso típico 10-40%) | Q2–6 | Q4–16 |
| Margen v3 tras IA | ~92-93% (era 93%) | ~86-87% (era 87%) |

- Básico: `ai_weekly_tokens = 0` (no tiene Centro IA; `stats_intelligence` sigue false).
- **Pro se desbloquea**: `plans.features.stats_intelligence → true` (hoy solo Enterprise lo tiene; el usuario pidió IA "tanto para pro como para enterprise").
- Reset: lunes 00:00 América/Guatemala (sin cron — la semana se deriva por fecha, las filas viejas quedan como historial de costos).
- Overrides por negocio: `businesses.limit_overrides->>'ai_weekly_tokens'` (mismo patrón que `max_conversations`).
- Se registra además `cost_microusd` real por semana/negocio → telemetría de margen consultable por SQL.
- Unidad = tokens totales (in+out, incluye thinking). El costo queda acotado porque cada request ya tiene `maxOutputTokens` fijo y thinking apagado (`_shared/gemini.ts`).

## Arquitectura (3 capas)

```
Front (UsageBar real, input bloqueado)  ← get_ai_usage() [authenticated]
Edge Functions ai-chat / ai-insights    ← check_ai_budget() ANTES de Gemini → 429 si agotado
                                        ← record_ai_usage() DESPUÉS con tokens+costo reales
DB ai_usage_weekly + plans.ai_weekly_tokens  (fuente de verdad, service_role only)
```

Carrera concurrente: check→spend→record permite un overshoot máximo de 1 request (~20K tokens ≈ Q0.08) — aceptable, se documenta.

## Fase 1 — Migración DB (`apply_migration` `ai_token_metering`, proyecto `kwpaaqdkklwwfslhkqpb`)

1. **Tabla `ai_usage_weekly`**: `(business_id uuid FK, week_start date, tokens_in bigint, tokens_out bigint, tokens_total generated (in+out), requests int, cost_microusd bigint, updated_at)` PK `(business_id, week_start)`. RLS ON: SELECT con `business_id = (SELECT get_user_business_id())` (patrón initplan de la casa); sin policies de escritura (solo RPC definer).
2. **`plans.ai_weekly_tokens bigint`** + seed: basic 0 · pro 750000 · enterprise 2000000. Y `jsonb_set` de `features.stats_intelligence = true` en Pro.
3. **RPCs** (todas `SECURITY DEFINER`, `set search_path`):
   - `get_ai_usage()` → json `{used_tokens, limit_tokens, resets_at, week_start}` para el dashboard; business del JWT vía `get_user_business_id()`; limit = `coalesce(override, plans.ai_weekly_tokens, 0)`. GRANT a authenticated.
   - `check_ai_budget(p_business_id)` → `{allowed, used_tokens, limit_tokens, resets_at}`. Solo service_role (REVOKE authenticated/anon — mismo patrón de grants que `record_usage`).
   - `record_ai_usage(p_business_id, p_tokens_in, p_tokens_out, p_cost_microusd, p_requests default 1)` → upsert de la semana. Solo service_role.
   - Semana: `date_trunc('week', now() at time zone 'America/Guatemala')::date`; `resets_at` = lunes siguiente 00:00 GT en ISO.

## Fase 2 — Edge Functions (redeploy con imports `./_shared/...`)

- **`_shared/gemini.ts`**: exportar `GEMINI_RATES` ($/M = µ$/token: flash 0.30/2.50, flash-lite 0.10/0.40) y `costMicroUsd(model, tokensIn, tokensOut)`.
- **`ai-chat/index.ts`**: tras el rate limit y ANTES de insertar el mensaje del usuario → `check_ai_budget`; si `!allowed` → 429 `{error: 'Alcanzaste tu límite semanal de IA. Se reinicia el lunes.', code: 'ai_limit_reached', resets_at}`. Acumular costo del router (lite) + respuesta (flash). Reemplazar `record_usage` por `record_ai_usage` (los contadores mensuales del bot quedan limpios).
- **`ai-insights/index.ts`**: budget check después del cache-hit (leer cache sigue gratis) y del rate limit; mismo 429; costo del modelo del scope; reemplazar `record_usage`.

## Fase 3 — Frontend

- **`src/services/supabaseService.js`**: `getAIUsage()` (rpc); en `askBusinessAI`/`generateAIInsight` leer también `body.code` del error y adjuntarlo (`err.code = 'ai_limit_reached'`) — el helper `functionErrorMessage` (línea ~1506) ya extrae el mensaje.
- **`src/hooks/useAIUsage.js`** (nuevo): `{usedTokens, limitTokens, pct, resetsAt, blocked, refresh}`; carga al montar (solo si `unlocked`).
- **`src/pages/AIHub.jsx`**:
  - `UsageBar` recibe el `pct` real (adiós `percent={42}` y el comentario "Solo UI por ahora"); tooltip "N de M tokens esta semana · se reinicia el lunes".
  - `refresh()` tras cada `send()` del chat y tras cada generación de insight.
  - Estado bloqueado: input del chat deshabilitado con placeholder "Límite semanal de IA alcanzado"; las action cards muestran el error 429 del server (el drawer ya renderiza errores).
  - Badge del header: mostrar también "Plan Pro" (hoy solo Enterprise) ya que Pro queda desbloqueado.
s
## Fase 4 — Docs + memoria

- `docs/NovturnIA Infraestructure/Automatización Agente IA.md` §B.6: límites reales implementados.
- `docs/NovturnIA Infraestructure/Modelo de Negocio.md`: fila `ai_weekly_tokens` en la matriz de límites (§8) + techo de costo IA por plan.
- Memoria: actualizar `usage-tracking.md` (nueva tabla/RPCs, EFs ya no tocan `usage_counters`) y nota en `business-model-costs.md`.

## Orden y verificación

Orden de despliegue: migración → EFs → front (si las EFs salieran antes que los RPCs, darían 500).

1. `npm run build` limpio.
2. Advisors de Supabase (security + performance) tras la migración.
3. Probes SQL: `record_ai_usage`/`check_ai_budget` como service_role funcionan; con impersonación `authenticated` → denegado; `get_ai_usage` solo devuelve el negocio propio.
4. E2E con override: `limit_overrides.ai_weekly_tokens = 1000` en el negocio real → el usuario manda 1 pregunta → 429 con mensaje amable y barra al 100%; quitar override → la pregunta funciona, `ai_usage_weekly` registra tokens+costo reales (verificado por SQL y `get_logs`), la barra avanza.
5. Confirmar que `usage_counters` del mes ya no crece con uso del dashboard.