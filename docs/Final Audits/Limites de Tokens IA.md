# Límites de Tokens IA — Auditoría de Cumplimiento

> Verifica que el techo semanal de tokens del Centro IA se aplique de verdad en las tres capas.
> **Límites vigentes:** Básico 0 (sin acceso) · Pro 750,000 tokens/semana · Enterprise 2,000,000 tokens/semana. Reinicio lunes 00:00 América/Guatemala.
> **Techo de costo:** Pro ~Q16/mes · Enterprise ~Q42/mes (FX Q8.00/USD).

---

## 1. Diseño

### 1.1 Estrategia económica

| | **Básico** | **Pro** | **Enterprise** |
|---|---|---|---|
| Límite semanal | **0** (sin acceso) | **750,000 tokens** | **2,000,000 tokens** |
| Equivale a | — | ~135 preguntas ó ~70 reportes/semana | ~360 preguntas ó ~180 reportes/semana |
| Costo techo mensual | — | **Q16** | **Q42** |
| Techo sobre el precio del plan | — | **0.8%** | **1.1%** |

El techo existe para acotar el abuso, no el uso normal: 135 preguntas semanales son 27 por día hábil.

### 1.2 Mecánica

| | |
|---|---|
| Unidad medida | Tokens totales `in + out`, incluyendo razonamiento (`thoughtsTokenCount` se factura como salida) |
| Ventana | Semanal, lunes 00:00 América/Guatemala |
| Reinicio | Sin cron — la semana se deriva por fecha; las filas viejas quedan como historial de costos |
| Override por negocio | `businesses.limit_overrides->>'ai_weekly_tokens'` |
| Telemetría de margen | `cost_microusd` real por semana y negocio, consultable por SQL |
| Bolsa del bot de WhatsApp | Separada: el bot se controla por límite de mensajes, no por tokens |

### 1.3 Arquitectura — 3 capas

```
Frontend          UsageBar real + input bloqueado
                  ← get_ai_usage()                    [authenticated]

Edge Functions    ai-chat · ai-insights
                  ← check_ai_budget()   ANTES de Gemini → 429 si agotado
                  ← record_ai_usage()   DESPUÉS con tokens y costo reales

Base de datos     ai_usage_weekly + plans.ai_weekly_tokens
                  fuente de verdad · solo service_role
```

El tope de verdad vive en la capa 2: el frontend solo refleja. Si el frontend miente o falla, el límite igual se aplica — siempre que la capa 2 no falle abierta (T1).

---

## 2. Estado actual

| Pieza | Estado |
|---|---|
| Chequeo de presupuesto antes de gastar | ⚠️ Existe pero **falla abierto** (T1) |
| Registro de consumo tras gastar | ⚠️ Existe pero **se pierde en los fallos** (T2) y **puede fallar en silencio** (T3) |
| Punto de aplicación en servidor | ✅ En Edge Function, imposible de saltar desde el cliente |
| Cache no consume presupuesto | ✅ El chequeo va después del cache-hit |
| Razonamiento (thinking) apagado | ✅ `thinkingBudget: 0` |
| `thoughtsTokenCount` contado como salida | ✅ No subcontabiliza |
| Modelo desconocido se cobra al más caro | ✅ Nunca subestima |
| Bloqueo visual en el dashboard | ✅ Input y botón deshabilitados |
| Barra de consumo real | ⚠️ Muestra 0% si el RPC falla (T5) |
| Tokens del bot de WhatsApp | ⚠️ Se miden en `usage_counters`, pero **sin techo ni visibilidad** (T6) |
| Objetos en migraciones versionadas | ❌ **Nada existe en el repositorio** (T7) |

---

## 3. Hallazgos

| # | Sev | Hallazgo |
|---|---|---|
| **T1** | 🔴 | **El chequeo de presupuesto falla abierto.** `const { data: budget } = await supabaseAdmin.rpc('check_ai_budget', …)` descarta el `error`. Si el RPC falla por cualquier causa (función ausente, permisos, DB saturada), `budget` queda `null` y la condición `budget && budget.allowed === false` da falso → **la función procede y gasta**. Cualquier fallo del RPC desactiva el techo en silencio. `ai-chat/index.ts:111` · `ai-insights/index.ts:322` |
| **T2** | 🔴 | **Los tokens gastados en fallos nunca se descuentan.** `callGeminiJSON` reintenta hasta 2 veces acumulando tokens y luego lanza. En `ai-insights` el `catch` devuelve 502 sin llamar `record_ai_usage`; en `ai-chat` el throw sube al catch general → 500. Google ya cobró esos tokens y el presupuesto no se movió. Repetir la condición de fallo permite consumir sin tope. `_shared/gemini.ts` (bucle de reintento) · `ai-insights/index.ts:340` |
| **T3** | 🟠 | **`record_ai_usage` puede fallar en silencio.** El resultado no se verifica y `supabase-js` no lanza por defecto: si el RPC falla, la request responde 200 con los tokens gastados y sin descontar. `ai-chat/index.ts:184` · `ai-insights/index.ts:364` |
| **T4** | 🟠 | **El overshoot no es de 1 request.** El diseño documenta un exceso máximo de una request en vuelo, pero eso solo aplica si están serializadas. Con N requests concurrentes, las N pasan el chequeo antes de que ninguna registre. El rate limit de 30/hora acota el daño, no lo elimina. |
| **T5** | 🟠 | **El bloqueo visual desaparece si el RPC de lectura falla.** `useAIUsage` traga el error (`catch { }`), deja `usage` en `null`, y entonces `limitTokens = 0` hace que `blocked` sea siempre falso. La barra marca 0% y el input queda habilitado. El servidor sigue bloqueando, así que el usuario descubre el límite al recibir un 429. `useAIUsage.js:16,24` |
| **T6** | 🟠 | **El bot de WhatsApp mide tokens pero no tiene techo.** Verificado en producción: `usage_counters` sí acumula `tokens_in`/`tokens_out` del bot (17 mensajes → 7,991 entrada + 1,080 salida). Lo que no existe es un **límite**: `record_usage` solo corta por cantidad de mensajes, nunca por tokens, y el consumo no se muestra en ninguna pantalla. Una conversación con contexto muy largo gasta sin que nada la detenga. |
| **T7** | 🟠 | **Ningún objeto existe en migraciones del repositorio.** `ai_usage_weekly`, `check_ai_budget`, `record_ai_usage`, `get_ai_usage` y `plans.ai_weekly_tokens` solo viven en la base de producción. Un restore desde código deja el Centro IA sin techo alguno. |
| **T8** | 🟡 | **El presupuesto se consulta una vez para dos llamadas.** `ai-chat` chequea una vez y luego invoca el router (flash-lite) y la respuesta (flash). Si la segunda falla, la primera ya gastó — se agrava con T2. |

---

## 4. Supabase — backend

| # | Qué hacer | Cierra |
|---|---|---|
| S1 | **Fallar cerrado en el chequeo de presupuesto.** Capturar el `error` del RPC y devolver 503 si no se pudo verificar, en vez de continuar. Un techo que se apaga cuando algo falla no es un techo | T1 |
| S2 | **Registrar los tokens de intentos fallidos.** `callGeminiJSON` debe adjuntar los tokens acumulados a la excepción, y ambos callers registrarlos antes de devolver el error | T2 |
| S3 | **Verificar el resultado de `record_ai_usage` y loguear si falla.** Con reintento corto; si no persiste, dejar traza para reconciliar | T3 |
| S4 | **Reserva atómica antes de gastar.** Convertir `check_ai_budget` en `reserve_ai_budget(p_business_id, p_estimated_tokens)` que incremente el contador en la misma transacción del chequeo, y liquidar con el consumo real al terminar. Elimina la carrera de concurrencia | T4 |
| S5 | **Volcar a migraciones versionadas:** `ai_usage_weekly`, `check_ai_budget`, `record_ai_usage`, `get_ai_usage`, `plans.ai_weekly_tokens` y sus grants | T7 |
| S6 | **Techo de tokens para el bot.** Los datos ya se acumulan en `usage_counters.tokens_in/tokens_out`; falta que `record_usage` corte también por tokens y que el consumo se exponga en el panel | T6 |

**Probes de verificación** — los tres primeros ya se ejecutaron contra producción y **pasan**: los límites por plan están cargados (0 / 750,000 / 2,000,000) y ni `check_ai_budget` ni `record_ai_usage` son ejecutables por `anon` ni `authenticated`.

```sql
-- 1. El límite por plan está cargado
SELECT tier, ai_weekly_tokens FROM plans ORDER BY display_order;
-- Esperado: basic 0 · pro 750000 · enterprise 2000000

-- 2. Los RPC sensibles NO son ejecutables por el cliente
SELECT p.proname, r.rolname
FROM pg_proc p
CROSS JOIN unnest(ARRAY['anon','authenticated']::name[]) AS r(rolname)
WHERE p.proname IN ('check_ai_budget','record_ai_usage')
  AND has_function_privilege(r.rolname, p.oid, 'EXECUTE');
-- Esperado: 0 filas

-- 3. get_ai_usage solo devuelve el negocio del JWT
--    (impersonando authenticated de dos negocios distintos)

-- 4. La semana se calcula en hora de Guatemala
SELECT date_trunc('week', now() AT TIME ZONE 'America/Guatemala')::date;
```

**Prueba end-to-end del tope:**
1. `UPDATE businesses SET limit_overrides = jsonb_set(coalesce(limit_overrides,'{}'), '{ai_weekly_tokens}', '1000') WHERE id = '<negocio>';`
2. Enviar una pregunta desde el Centro IA → debe responder **429** con `code: 'ai_limit_reached'` y la barra al 100%.
3. Quitar el override → la pregunta funciona y `ai_usage_weekly` registra tokens y costo reales.
4. Confirmar que `usage_counters` del mes **no** creció por uso del dashboard.

---

## 5. Dashboard — frontend

| # | Qué hacer | Cierra |
|---|---|---|
| D1 | **Distinguir "sin datos" de "sin consumo".** Si `getAIUsage` falla, marcar estado desconocido y mostrarlo, en vez de pintar 0% y habilitar el input | T5 |
| D2 | **Manejar el 429 `ai_limit_reached` en la UI del chat y de los insights**, mostrando la fecha de reinicio que devuelve el servidor | — |
| D3 | **Reintentar la lectura de consumo** con el `withRetry` que ya existe para otras lecturas calientes | T5 |
| D4 | **Mostrar el consumo de tokens en AdminPanel** por negocio y semana, con opción de override | Operación |

**Verificación manual:**
1. Con el plan Pro, abrir Centro IA → la barra debe mostrar un porcentaje coherente con `ai_usage_weekly`.
2. Enviar una pregunta → la barra debe avanzar sin recargar la página.
3. Con override a 1,000 tokens → input deshabilitado, placeholder de límite alcanzado.
4. Bloquear la red del RPC `get_ai_usage` en DevTools → **hoy** la barra cae a 0% y el input se habilita; tras D1 debe indicar estado desconocido.

---

## 6. Automatización n8n

El bot **no** consume el presupuesto semanal del Centro IA: son dos bolsas distintas. El bot se controla por el límite de mensajes; el Centro IA por tokens. Lo que hay que verificar es que esa separación se cumpla y que el bot no gaste tokens de forma invisible.

| # | Qué verificar | Por qué |
|---|---|---|
| N1 | **Ningún nodo llama a `check_ai_budget` ni a `record_ai_usage`** | Si el bot tocara el presupuesto semanal, agotaría el del Centro IA y ambos límites quedarían mal medidos |
| N2 | **Todos los nodos de modelo tienen `modelName` explícito** | Sin él, n8n usa el default de su versión: el costo real deja de corresponder al plan vendido y el escalado de modelos por tier no se cumple |
| N3 | **El modelo corresponde al tier**: Básico flash-lite, Pro y Enterprise flash | Es la feature `ai_reasoning` que se vende |
| N4 | **Existe un tope de contexto por conversación** (ventana de historial acotada) | Sin tope, una conversación larga crece sin límite y el costo por mensaje se dispara por encima del presupuestado |
| N5 | **`record_usage` se llama una vez por cada mensaje saliente** | Es el control real del costo del bot |

**Cómo verificarlo cuando el túnel esté disponible:**

```bash
MSYS_NO_PATHCONV=1 node scripts/n8n-api.mjs GET "/workflows/1npQWgfgBBIwVuxX" > wf.json
```

```bash
node -e "const w=require('./wf.json');const n=w.nodes||[];console.log('check_ai_budget/record_ai_usage:',JSON.stringify(n).match(/check_ai_budget|record_ai_usage/g)||'ninguno (correcto)');n.filter(x=>/Modelo|Model/i.test(x.name)).forEach(x=>console.log(x.name,'→ modelName:',x.parameters?.modelName?.value||x.parameters?.model?.value||'<<< AUSENTE >>>'));console.log('nodos record_usage:',n.filter(x=>JSON.stringify(x).includes('record_usage')).map(x=>x.name));"
```

Resultado esperado: sin coincidencias de `check_ai_budget`/`record_ai_usage`, todos los nodos de modelo con `modelName` explícito y acorde al tier, y un nodo `record_usage` por rama de plan.

---

## 7. Orden de ejecución

| Bloque | Contenido | Efecto |
|---|---|---|
| **1** | S1, S2, S3 | El techo deja de poder apagarse solo y de perder tokens en los fallos |
| **2** | D1, D2, D3 | El usuario ve el estado real y entiende el bloqueo |
| **3** | S4 | Elimina el overshoot por concurrencia |
| **4** | S5 | El techo se vuelve reproducible desde el repositorio |
| **5** | S6, N4 | Visibilidad y tope del consumo de tokens del bot |
| **6** | D4 | Operación y soporte |

**El bloque 1 es obligatorio.** Con T1 y T2 abiertos, el límite semanal es una recomendación, no un tope: basta un fallo del RPC o una condición de error repetible para gastar sin descontar.

---

## 8. Costo expuesto si no se cierra

| Escenario | Costo |
|---|---|
| Tope funcionando (Pro) | Q16/mes |
| Tope funcionando (Enterprise) | Q42/mes |
| T1 activo — el chequeo falla y no bloquea | Sin techo: solo lo limita el rate limit de 30 requests/hora ≈ **Q1,150/mes** por negocio |
| T2 activo — fallos repetidos sin registro | Consumo proporcional a los reintentos, invisible en el contador |

El rate limit de 30/hora es la única red debajo del techo de tokens. Es lo que separa un desbordamiento acotado de uno abierto.
