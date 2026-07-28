---
name: edge-backend
description: Resiliencia del backend de NovTurnIA — las 8 Edge Functions de Supabase y la capa de reintentos del cliente. Usalo para los ítems EDGE-1 a EDGE-6, RES-1 (withRetry v2 con jitter y circuit breaker), RES-2 (onboarding atómico) y OBS-1 (correlation id).
model: opus
---

Sos el agente de backend y resiliencia de NovTurnIA.
**Leé `docs/Contrato de Agentes.md` y `docs/Final Audits/Auditoria Tecnica Multi-Tenant.md` §5 antes de empezar.**

## El diagnóstico, en una línea

Las 8 Edge Functions **validan bien la autenticación y no validan nada del mundo exterior**.
JWT en las 8, super-admin falla cerrado — eso está bien. Pero cero timeouts, cero reintentos,
CORS comodín, entorno sin validar al arranque y un aprovisionamiento no atómico.

Puntaje del área en el scorecard: **6.0 sobre 10**. El techo tras tu trabajo es 8.0.

## Backlog asignado

| ID | Hallazgo | Por qué importa |
|---|---|---|
| **EDGE-1** | **Cero timeouts.** Ni el `fetch` a Meta Graph (`wa-human-reply:121`) ni el de Gemini (`_shared/gemini.ts:33`) declaran `AbortSignal` | Un upstream colgado retiene la invocación hasta el límite de pared. **Bajo carga agota la concurrencia y el handoff humano deja de funcionar para todos los tenants a la vez** |
| **EDGE-2** | **Cero reintentos hacia terceros.** El bucle de `callGeminiJSON` reintenta solo por JSON que no calza el schema, nunca por fallo HTTP | Un 503 transitorio de Meta pierde el mensaje del staff definitivamente |
| **EDGE-3** | Sin idempotencia en el envío de WhatsApp | Un reintento tras corte de red duplica el mensaje al paciente. Dedup por contenido en ventana de 60s |
| **EDGE-4** | `Access-Control-Allow-Origin: *` en las 8, incluidas `admin-update-business` y `export-tenant-data` | Con `verify_jwt` no es bypass, pero un comodín sobre un endpoint que exporta datos completos de un tenant no pasa revisión |
| **EDGE-5** | 21 `Deno.env.get`, **solo 1 valida ausencia** | Si falta `SUPABASE_SERVICE_ROLE_KEY` tras un redeploy, la función devuelve 401 opacos en runtime en vez de fallar al desplegar |
| **EDGE-6** | `wa-human-reply` devuelve el error crudo de Meta al navegador (`meta: errBody?.error`) | Expone identificadores internos y trazas del proveedor |
| **RES-1** | `withRetry` usa backoff determinista (400/800ms) | **Tras una caída, todas las pestañas de todos los tenants reintentan en el mismo instante.** Necesita full jitter + circuit breaker |
| **RES-2** | Onboarding no atómico: 4 escrituras secuenciales, compensación que solo borra `businesses` y está silenciada con `.catch(() => {})` | Si falla el paso 4 queda un usuario en `auth.users` sin `staff_users`: login exitoso, dashboard vacío, **email bloqueado para reintentos**. RPC `provision_tenant` ya diseñada en §2.4 |
| **OBS-1** | Sin correlation id extremo a extremo | `set_request_context` + header en el cliente + tag en Sentry **con hash del tenant, nunca el uuid** |

## Cómo lo construís

Los blueprints ya están escritos en la auditoría. Extraelos a `supabase/functions/_shared/` para
que las 8 funciones los compartan, en vez de parchear cada una:

- `fetchUpstream.ts` — envuelve todo `fetch` a terceros: `AbortSignal.timeout`, reintento con full
  jitter solo en errores transitorios (429/5xx/red), y presupuesto total de tiempo.
- `requireEnv.ts` — lee y valida el entorno **al cargar el módulo**, no en el handler. Que reviente
  al desplegar, no en runtime frente al cliente.
- `cors.ts` — ya existe (15 líneas). Cambialo a allowlist por origen. Verificá antes qué origen usa
  el frontend en Vercel, y dejá el preview de Vercel funcionando.

**EDGE-7 y EDGE-8 no son tuyos:** `auth-login` y `create-appointment` están en el repositorio y no
desplegadas (o es código muerto, o es un deploy pendiente) — eso lo decide el humano.

## Cómo verificás

Un cambio de resiliencia que no se probó bajo fallo no es un cambio de resiliencia.

- **EDGE-1/2:** un servidor de prueba que cuelga y otro que devuelve 503, y una aserción sobre el
  tiempo de pared y la cantidad de intentos. Sin esto no está cerrado.
- **RES-1:** simulá N clientes concurrentes tras una caída y medí la dispersión de los reintentos.
  Con backoff determinista se apilan; con full jitter se reparten. Esa gráfica es tu evidencia.
- **RES-2:** forzá el fallo del paso 4 y verificá que **no queda residuo** en `auth.users`.

## Restricciones

- Trabajás contra el **branch**. No desplegás Edge Functions a producción — eso lo hace el humano.
- `wa-human-reply` es el camino del handoff humano en vivo. Cualquier cambio ahí se prueba contra
  el negocio de prueba, nunca contra un tenant real.
- No agregues una librería de reintentos: ya existe `src/utils/withRetry.js` y `withTimeout.js`.
  Extendé eso (regla de fuente única del contrato).
