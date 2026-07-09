# Puntos de Mejora — Implementables con la Infraestructura Supabase Actual

> **Fecha:** 2026-07-06 · Cada punto usa SOLO piezas que ya tienes (pg_cron, Edge Functions, RLS, Realtime, Storage, extensiones disponibles) — sin servicios nuevos que pagar, salvo donde se indica.
> Esfuerzo: **S** (<1 día) · **M** (1–3 días) · **L** (semana+).

---

## 0. Verificación solicitada: política de planes atrasados (7 / 30 días)

**Lo que SIGUE ACTIVO (front):**
- `AccountStatusModal` ([src/components/AccountStatusModal.jsx](../../src/components/AccountStatusModal.jsx)) montado en [App.jsx:155](../../src/App.jsx): si `plan_status = 'suspended'` → modal ámbar **cerrable** ("Hay un pago pendiente. Regulariza tus pagos…"); si `'cancelled'` → modal rojo **no cerrable** (bloqueo duro del dashboard). El estado se carga al login (`getBusinessStatus()`).
- **La palanca manual funciona**: el super-admin cambia `plan_status` desde AdminPanel (tab Datos o Uso+acciones) → eso es "cambiarle al usuario si su pago estaba realizado". Sigue operativo vía `admin-update-business`.

**Lo que NO existe (Supabase) — verificado hoy:**
- ❌ Ningún cron ni función mueve `active → suspended → cancelled` automáticamente (los 8 cron jobs actuales no tocan `plan_status`).
- ❌ `businesses.plan_expires_at` existe como columna pero **ninguna función de la DB la lee** (0 referencias en `pg_proc`).
- ❌ `is_business_active()` existe pero está **huérfana** — ni políticas RLS ni RPCs la usan → el "bloqueo" es solo visual: el staff de un negocio suspendido aún puede leer/escribir por la API REST, y el bot sigue respondiendo (salvo `ai_paused`).

**Actualización 2026-07-06:** ya NO se deja así — la parte de DB del dunning quedó **implementada y verificada** (ver #1 abajo y doc 07 Aud.#2): cron de suspensión/cancelación automática, `is_business_active()` ahora sí bloquea escritura (RLS), y `record_payment()` extiende el vencimiento. Solo falta el **botón "Marcar pagado"** en el AdminPanel ([TÚ]).

---

## A. Monetización y ciclo de vida del cliente

### 1. ⭐ Dunning automatizado 7/30 días — ✅ DB IMPLEMENTADA (2026-07-06) · falta el botón
**Hecho (Aud.#2, doc 07):** tabla `payments`; `record_payment()` (extiende `plan_expires_at` +1 mes, reactiva); cron `run-dunning` diario (active→suspended a 7d, suspended→cancelled a 30d); `is_business_active` ampliada.
**Falta [TÚ]:** botón "Marcar pagado" en AdminPanel → `admin-update-business` → `record_payment`. (Opcional: aviso "vence en 3 días" vía `notifications`.)

### 2. Enforcement server-side de la suspensión — ✅ HECHO (2026-07-06)
`is_business_active()` (ampliada a active+trial) añadida a las políticas RLS de **escritura** de 9 tablas de producto (migración `audit2b_rls_suspend_writes`). Suspendido = **solo-lectura real** en el dashboard. Verificado por impersonación (active escribe / suspended bloqueado). El bot usa service_role (ignora RLS) y conserva su gate `¿Plan Activo?`.

### 3. Trial de 14 días self-service — Esfuerzo S · Impacto MEDIO
`plan_status = 'trial'` ya existe en el enum y el AdminPanel ya lo muestra. Falta: `onboard-tenant` acepte `plan_status:'trial'` + `plan_expires_at = now() + 14 días`, y el cron del punto 1 lo venza automáticamente. Vender sin cobrar el mes 1 baja la fricción del primer cliente.

### 4. Stripe (T-03) — Esfuerzo M · Impacto ALTO (cuando >5 clientes)
Edge Function `stripe-webhook` (mismo patrón que las admin-*): `invoice.paid` → inserta en `payments` y extiende `plan_expires_at`. El dunning del punto 1 queda 100% automático. Costo: comisión Stripe, sin infra nueva.

---

## B. Comunicación

### 5. Emails transaccionales — Esfuerzo M · Impacto ALTO
**Qué falta:** el sistema no envía ningún email (bienvenida, recordatorio de pago, reset es el único vía Auth).
**Cómo:** Edge Function `send-email` + Resend (3,000 emails/mes gratis) usando `businesses.notification_email` (columna ya existe). Disparadores: cron de dunning (punto 1), alta de tenant, corte por límite de mensajes (`ai_paused_reason='usage_limit'`).

### 6. Web Push para handoffs — Esfuerzo M · Impacto MEDIO
Cuando el bot activa `human_takeover`, la secretaria se entera solo si tiene el dashboard abierto. Realtime ya emite el cambio; falta service worker + Push API del navegador (VAPID, sin costo). Un handoff no atendido = cliente WhatsApp esperando en silencio (gap conocido del flujo).

---

## C. Datos e IA

### 7. Memoria semántica del bot (`ai_memory` — ya la vendes en Pro+) — Esfuerzo L · Impacto ALTO
El feature flag `ai_memory` existe en `plans.features` pero no hay soporte de datos detrás. **pgvector está disponible en Supabase** (extensión, $0): tabla `patient_memories (business_id, patient_id, content, embedding vector(768))` + índice HNSW + RPC `match_memories()`. n8n genera el embedding (Gemini `text-embedding` es barato) y recupera contexto antes de responder. Convierte el flag en una feature real y diferenciadora.

### 8. Búsqueda global del dashboard — Esfuerzo S · Impacto MEDIO
`pg_trgm` ya está instalado (lo usa `search_patients`). RPC `search_global(q)` que una pacientes + turnos + notas del tenant, y un command-palette (Ctrl+K). Todo con índices que ya existen o GIN pequeños.

### 9. Export de datos del tenant — Esfuerzo S · Impacto MEDIO
Para churn ordenado (y confianza al vender): Edge Function que arma JSON/CSV del negocio (pacientes, turnos, finanzas) y lo sube a un bucket de **Supabase Storage** (sin uso hoy) con URL firmada de 24h. También te sirve de backup lógico por-tenant.

---

## D. Operación y resiliencia

### 10. Rate limiting por tenant — Esfuerzo S · Impacto MEDIO
`api_rate_limits` + `check_rate_limit()` **ya existen** y solo los usa n8n por usuario final. Falta usarlos con clave `wa:{business_id}` para aislar ráfagas de un tenant (que uno saturado no degrade a los demás). Es llamar la función que ya tienes desde el workflow/triggers con otra clave.

### 11. Alerta de churn silencioso — Esfuerzo S · Impacto ALTO para retención
Cron semanal: negocios sin turnos nuevos ni mensajes en 7 días → fila en `notifications` para ti (o email del punto 5). Un cliente que dejó de usar el bot es un cancelado del mes siguiente; hoy no te enterarías.

### 12. Histórico de consumo — Esfuerzo S · Impacto MEDIO
`usage_counters` guarda por mes pero el AdminPanel solo muestra el mes actual. Con la retención de conversaciones activa, `usage_counters` es tu única serie histórica de actividad: gráfico de tendencia (mensajes/tokens por mes) en el panel = detectar crecimiento/caída por cliente de un vistazo. Solo front — los datos ya están.

### 13. Storage para logos y adjuntos — Esfuerzo M · Impacto MEDIO
Supabase Storage (incluido en Pro: 100 GB) sin uso. (a) Logo del negocio para personalizar el dashboard; (b) imágenes que los pacientes mandan por WhatsApp — hoy el bot las ignora/pierde; guardarlas en bucket por-tenant con RLS de Storage y mostrarlas en Conversaciones.

---

## E. Ya identificados en documentos previos (no repetidos aquí)

| Punto | Dónde está el detalle |
|---|---|
| Vault para `whatsapp_token` | [03-infraestructura §9.1](03-infraestructura-supabase.md) |
| Revocar grants de escritura sobre `plans` | 03 §9.3 |
| `AdminOnboarding` leyendo planes de la tabla | 03 §9.4 |
| Columna `waba_id` (migración a Tech Provider) | 03 §9.6 · [02-whatsapp §4](02-whatsapp-cloud-api.md) |
| Retry/backoff + circuit breaker en el front | Auditoría técnica §9 (`docs/Auditoria Tecnica Multi-Tenant.md`) |

---

## Priorización sugerida

| Orden | Punto | Por qué primero |
|---|---|---|
| 1 | **#1 Dunning 7/30 días** | Es la pieza que verificamos que falta y toca ingresos directamente; el front ya está listo. |
| 2 | **#2 Suspensión server-side** | 1 migración corta; sin esto el dunning es decorativo para un usuario técnico. |
| 3 | **#11 Alerta de churn** | Un cron; protege el ingreso recurrente que ya tienes. |
| 4 | **#5 Emails** | Multiplica el valor de #1 y #11. |
| 5 | **#3 Trial** | Baja la fricción de venta con lo mismo que construiste en #1. |
| 6+ | #7 (ai_memory), #10, #12, #8, #9, #13, #4 (Stripe al pasar ~5 clientes) | Valor creciente, sin urgencia. |
