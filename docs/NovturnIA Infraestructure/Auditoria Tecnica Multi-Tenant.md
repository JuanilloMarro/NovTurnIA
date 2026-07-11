# Auditoría Técnica y de Producto — NovTurnIA (SaaS Multi-Tenant)

> **Fecha:** 2026-07-03 · **Alcance:** Base de datos (Supabase/PostgreSQL 17), Dashboard (React 19 + Vite + Zustand), Infraestructura/Resiliencia y Producto/Unit-Economics. **Excluye** la automatización n8n (se evalúa por separado).
> **Método:** inspección directa de la base de producción vía MCP de Supabase (proyecto `kwpaaqdkklwwfslhkqpb`) — `pg_policies`, `information_schema`, `pg_proc`, advisors de seguridad/rendimiento, `cron.job`, `pg_publication_tables` — más lectura del código del frontend (`src/**`).
> **Tono:** implacable y educativo. Cada hallazgo trae las 4 secciones pedidas: **Estado Actual · Vectores de Riesgo · Solución/Refactor · Lección de Arquitectura**.

---

## Resumen ejecutivo

La arquitectura del **frontend es sólida** (multi-tenancy derivada de Auth y no de la URL, limpieza correcta de canales Realtime, capa de servicio centralizada, code-splitting, cabeceras de seguridad fuertes en Vercel). El **riesgo real y grave estaba en la base de datos**: la seguridad descansaba en RLS que **valida propiedad de fila pero no columna ni rol**. Eso convertía el RBAC y los límites de plan del cliente en **cosméticos**: cualquier usuario autenticado podía, vía la API REST directa, subirse de plan gratis y auto-asignarse permisos de administrador.

La base está prácticamente vacía (0 filas salvo `plans`=3), por lo que se aplicaron los fixes críticos en caliente sin riesgo de datos.

| # | Hallazgo | Área | Severidad | Estado |
|---|----------|------|-----------|--------|
| 1 | Auto-upgrade de plan y fuga de credenciales por `UPDATE` directo a `businesses` | DB / RLS | **CRÍTICO** | ✅ Corregido |
| 2 | Escalación de privilegios RBAC (permisos/rol editables por cualquier staff) | DB / RLS | **CRÍTICO** | ✅ Corregido |
| 3 | RPCs `SECURITY DEFINER` ejecutables por `anon` (inyección/fuga cross-tenant) | DB / API | **ALTO** | ✅ Corregido |
| 4 | Telemetría de consumo (metering) — patrón y guard `IS NULL` | DB / Producto | **ALTO→OK** | ✅ Endurecido |
| 5 | Vista `SECURITY DEFINER` + `search_path` mutable en 12 funciones | DB / Hardening | **MEDIO** | ✅ Corregido |
| 6 | RLS re-evaluada por fila + índices compuestos faltantes/redundantes | DB / Rendimiento | **MEDIO** | ⏳ Documentado |
| 7 | Auditoría síncrona en el hot path transaccional | DB / Rendimiento | **MEDIO** | ⏳ Documentado |
| 8 | Bugs latentes del esquema entero heredado (`reactivate_bot`, overloads) | DB / Correctitud | **BAJO** | ✅ `reactivate_bot` corregido; resto documentado |
| 9 | Resiliencia: sin retry/backoff ni circuit breaker | Frontend / Infra | **MEDIO** | ⏳ Documentado |
| 10 | Rate limiting inter-tenant y saturación del pool (Supavisor) | Infra | **MEDIO** | ⏳ Documentado |
| 11 | Observabilidad: sin correlation-id tenant↔request↔DB | Infra | **MEDIO** | ⏳ Documentado |
| 12 | Unit-economics y fricción de aprovisionamiento | Producto | **MEDIO** | ⏳ Documentado |

**Fixes aplicados esta sesión (6 migraciones en producción):** `secure_businesses_column_level_update`, `rbac_permission_gate_on_staff_rls`, `revoke_anon_execute_on_sensitive_rpcs`, `revoke_public_execute_on_sensitive_rpcs`, `harden_security_definer_view_and_fn_search_path`, `fix_reactivate_bot_uuid_and_schema`. Ver [§ Fixes aplicados](#fixes-aplicados-y-verificados) y [§ Scorecard](#scorecard--puntajes-por-aspecto).

---

## Scorecard — puntajes por aspecto

Escala **0–10** (0 = ausente/roto, 5 = funcional con deuda, 7 = sólido, 9+ = ejemplar). Donde hubo fix esta sesión se muestra **antes → después**. El rasero es de **seguridad multi-tenant estricta**, por eso el número es más conservador que evaluaciones previas más optimistas (que no contabilizaban los hoyos de RLS).

### A. Base de Datos — **7.5 / 10** (antes ≈ 5.2)

| Sub-aspecto | Puntaje | Qué falta para subir |
|---|---|---|
| Aislamiento RLS de tenants | 3.0 → **8.5** | Gate `manage_roles` también en INSERT/DELETE; validar `business_id` dentro de RPCs `DEFINER`. |
| Higiene de RPC/funciones (grants, `search_path`, vista) | 4.0 → **8.5** | Aún hay funciones `DEFINER` amplias a `authenticated`; revisar una por una. |
| Indexación multi-tenant | **6.5** | Índice `(business_id, date_start)`, podar 20+ índices `unused`, RLS *InitPlan*. |
| Estructuras flexibles (JSONB/GIN) | **7.5** | Quitar GIN `feature_flags` sin uso; validar shape con `pg_jsonschema`. |
| Correctitud del esquema (bugs latentes) | 5.0 → **6.5** | `DROP` de overloads/funciones muertas; unificar en `get_user_business_id()`. |

### B. Dashboard (React + Vite) — **8.2 / 10**

| Sub-aspecto | Puntaje | Qué falta para subir |
|---|---|---|
| Ciclo de vida Realtime / fugas de memoria | **9.0** | Cerrar T-11 (banner de estado); ya limpia canales correctamente. |
| Auth / sesión / JWT / race conditions | **8.0** | Fijar `autoRefreshToken`/`persistSession` explícitos; endurecer bypass super-admin. |
| Estado global / caching / re-render | **7.5** | Adoptar React Query/SWR para dedupe + reintentos; hoy caché TTL casera. |

### C. Infraestructura y Resiliencia — **6.4 / 10**

| Sub-aspecto | Puntaje | Qué falta para subir |
|---|---|---|
| Rate limiting inter-tenant (aislamiento de ruido) | **5.5** | Cuota por `business_id` en el borde; `statement_timeout` por rol. |
| Degradación graciosa / retry / circuit breaker | **5.0** | `withRetry` con backoff, breaker, detección offline. |
| Observabilidad / trazabilidad multi-tenant | **6.5** | `correlation_id` tenant↔request↔DB; registrar denegaciones. |
| Cabeceras/seguridad de despliegue (Vercel) | **8.5** | Endurecer CSP (quitar `unsafe-inline`/`unsafe-eval`); sourcemaps ocultos. |

### D. Producto / SaaS / Unit-Economics — **6.4 / 10**

| Sub-aspecto | Puntaje | Qué falta para subir |
|---|---|---|
| Telemetría de consumo (metering) | 6.0 → **8.0** | Idempotencia por `event_id`; `usage_counters` sin grants a `authenticated`. |
| Aprovisionamiento / onboarding | **6.5** | RPC transaccional atómica; medir latencia de onboarding como SLO. |
| Límites de plan / enforcement | 4.0 → **5.5** | Enforcement real en `INSERT` (trigger `BEFORE`), no solo ocultamiento. |
| Coherencia de márgenes | **5.5** | Alinear `max_conversations` a costo real; revisar viabilidad del plan Básico. |

### Resumen y puntaje final del sistema

| Área | Peso | Puntaje (después) | Contribución | (antes) |
|---|---|---|---|---|
| A. Base de Datos | 35% | **7.5** | 2.63 | 5.2 |
| B. Dashboard | 25% | **8.2** | 2.05 | 8.2 |
| C. Infraestructura y Resiliencia | 20% | **6.4** | 1.28 | 6.4 |
| D. Producto / SaaS | 20% | **6.4** | 1.28 | 5.5 |
| **PUNTAJE GLOBAL PONDERADO** | 100% | **7.2 / 10** | **7.24** | **≈ 6.3** |

**Lectura:** los fixes de esta sesión subieron el sistema de ≈6.3 a **7.2** al cerrar los dos hoyos críticos de RLS y la superficie `anon`. El **techo actual** lo ponen tres frentes, en orden de prioridad para tu roadmap:
1. **Resiliencia** (retry/backoff, circuit breaker, rate-limit por tenant) — es el área más baja y la que más duele en producción bajo carga real.
2. **Enforcement de negocio en servidor** (límites de plan en `INSERT`, onboarding atómico) — protege el margen y la consistencia.
3. **Rendimiento multi-tenant** (RLS *InitPlan*, índice `(business_id, date_start)`, poda de índices) — barato de hacer y evita degradación exponencial al crecer de tenants.

---

## ★ RE-EVALUACIÓN 2026-07-11 (última revisión — todo verificado en vivo)

Desde la auditoría original (2026-07-03/04) se ejecutó la mayor parte del roadmap que este documento pedía. Estado por área con el **scorecard actualizado**:

| Área | Peso | Antes (07-04) | **Ahora (07-11)** | Qué cambió (verificado) |
|---|---|---|---|---|
| A. Base de Datos | 35% | 7.5 | **8.7** | InitPlan en todas las políticas; índices compuestos calientes + poda; particionado automatizado (crons horizonte/limpieza); retención por plan; mínimo privilegio EXECUTE (anon 24→3, Aud.#1); dunning DB completo (payments/record_payment/run-dunning); suspensión con dientes (RLS escritura 10 tablas); `finance_categories` con el patrón completo; advisor: **0 ERROR**. Restan: overloads duplicados de 5 RPCs stats, ownership-check en `get_visible_*_ids`, Vault para tokens |
| B. Dashboard | 25% | 8.2 | **8.5** | Límites de plan con booleanos reales + FeatureLock sin flash (SAFE_DEFAULTS); RBAC granular ampliado (ofertas, categorías); módulo Categorías; AdminPanel con overrides/ai_paused/uso. Restan: F-1 (gate staff), F-4 (sin retry — sigue siendo el mayor debe del front), 4 `window.confirm` |
| C. Infraestructura y Resiliencia | 20% | 6.4 | **7.3** | 9 crons activos 0 fallos/7d; buffer/rate-limits con limpieza; Edge Functions ×5 v-actuales; fix del navigator-lock (adminService timeout). Restan: retry/backoff front (§9 sigue abierto), Sentry prod sin DSN, n8n instancia única |
| D. Producto / SaaS | 20% | 6.4 | **7.2** | Pricing v2 aplicado y v3 decidida con benchmarking GT; enforcement real de límites en dashboard; dunning DB listo. Lo que lo frena (deuda comercial, doc Modelo de Negocio §8): **metering muerto (H1)**, bot ignora `ai_paused` (H2), reminders/auto_confirm vendidos sin motor (H6), `plan_expires_at` NULL (H5) |
| **GLOBAL** | 100% | **7.2** | **8.1 / 10** | |

**Los 3 hallazgos originales CRÍTICO/ALTO: todos cerrados y verificados** (#1 UPDATE por columnas, #2 escalación RBAC, #3 superficie anon). #4 metering: la arquitectura existe y es correcta — sigue sin productor (H1). #5 ✅ · #6 ✅ · #7 (audit síncrono) aceptado por volumen · #8 fósiles dropeados · #9 **sigue abierto** (retry/backoff) · #10 parcial (rate-limit por usuario sí; por tenant pendiente) · #11 sin Sentry prod · #12 superseded por el [Modelo de Negocio v3](Modelo%20de%20Negocio.md) (Q599/1,999/3,999 — los Q499/Q999 de §12 son históricos).

**Techo actual para pasar de 8.1 → 9:** (1) cerrar H1/H2 (metering + kill-switch del bot), (2) retry/backoff en el front (§9/F-4), (3) Sentry en prod + prueba de carga sintética (Aud.#3 diseñada). Detalle operativo en el [Backlog Maestro](Backlog%20Maestro.md).

---

## 1. [CRÍTICO] Auto-upgrade de plan y fuga de credenciales por `UPDATE` directo a `businesses`

### Estado Actual y Funcionamiento
La política `businesses_update` es `USING/WITH CHECK (id = get_user_business_id())` para el rol `authenticated`. Además, `anon` y `authenticated` tenían el `GRANT UPDATE` **a nivel de tabla completa** (default de Supabase). El dashboard escribe con un UPDATE directo:

```js
// src/services/supabaseService.js:841
export async function updateBusinessInfo(fields) {
  const { error, count } = await supabase
    .from('businesses')
    .update(fields, { count: 'exact' })
    .eq('id', getBID());   // ← solo acota la FILA, no las COLUMNAS
}
```

La tabla `businesses` contiene, en la **misma fila del tenant**: `plan_id` (uuid), `feature_flags` (jsonb), `limit_overrides` (jsonb), `plan_status`, `ai_paused`, `ai_paused_reason`, y credenciales de WhatsApp (`whatsapp_token`, `phone_number_id`).

### Vectores de Riesgo e Impacto Técnico
La RLS autoriza la escritura porque la fila **es** del tenant; no mira qué columna cambia. **Peor escenario:** cualquier usuario autenticado (incluso el rol más bajo) abre la consola del navegador —o hace un `PATCH` directo a `/rest/v1/businesses?id=eq.<suyo>` con su propio JWT— y ejecuta:

```js
await supabase.from('businesses').update({
  plan_id: '<uuid-del-plan-enterprise>',
  feature_flags: { finance:true, supplies:true, auto_confirm:true, export_patients:true },
  limit_overrides: { max_patients: 999999, max_conversations: 999999 },
  ai_paused: false
}).eq('id', BID);
```

Resultado: **bypass total de facturación** (Enterprise gratis), anulación de los cortes de uso (`ai_paused=false`) y, peor aún, lectura/escritura del `whatsapp_token` del negocio (secuestro del canal de WhatsApp). La UI no expone estos campos, pero la API sí: la seguridad "por UI" es una ilusión.

### Solución Propuesta y Refactorización
RLS de Postgres no filtra por columna en el `WITH CHECK`; la herramienta correcta es el **privilegio de columna**. Se revoca el UPDATE de tabla y se concede solo a las columnas legítimas del dashboard (verificadas contra `updateBusinessInfo` y `BusinessSettings.jsx`):

```sql
REVOKE UPDATE ON public.businesses FROM authenticated, anon;
GRANT UPDATE (
  name, business_type, timezone,
  schedule_start, schedule_end, schedule_days,
  appointment_duration, notification_email, custom_prompt
) ON public.businesses TO authenticated;
```

`plan_id`, `feature_flags`, `limit_overrides`, `plan_status`, `ai_paused*`, `whatsapp_token`, `phone_number_id`, `active` quedan **solo escribibles por `service_role`** (Edge Functions `admin-update-business`, que es como el AdminPanel ya opera). El `updated_at` lo pone el trigger `BEFORE UPDATE` (no requiere privilegio de columna del usuario).

### Lección de Arquitectura
**La RLS es control de acceso por fila, no por columna ni por operación de negocio.** Cuando en una misma tabla conviven datos que el tenant edita (horario) y datos que solo el proveedor debe tocar (plan, billing, credenciales), hay que separar el privilegio: *column grants*, o mejor aún, mover los campos sensibles a una tabla `business_billing` con RLS de solo-lectura para el tenant y escritura exclusiva de `service_role`. Principio: **nunca dejes que el mismo rol que posee la fila decida su propio nivel de servicio.**

---

## 2. [CRÍTICO] Escalación de privilegios RBAC

### Estado Actual y Funcionamiento
El RBAC se deriva **solo en el cliente** desde `staff_roles.permissions` (jsonb):

```js
// src/hooks/usePermissions.js:75
canManageRoles: !!perms.manage_roles,   // gobierna Usuarios / Actividad / Configuración
```

Pero las políticas de escritura no exigían rol alguno: `staff_roles_update` y `staff_users_update` eran `business_id = get_user_business_id()` a secas. Y el service layer expone:

```js
// src/services/supabaseService.js:917 y :1289
updateRolePermissions(roleId, permissions) // UPDATE staff_roles SET permissions=...
updateStaffUserRole(userId, roleId)        // UPDATE staff_users SET role_id=...
```

### Vectores de Riesgo e Impacto Técnico
Cualquier usuario autenticado del tenant —una recepcionista, un rol "invitado"— puede llamar directamente a la API y **reescribir su propio conjunto de permisos** o **cambiar su `role_id`** a uno con `manage_roles`, `view_finance`, `delete_users`, etc. El RBAC del frontend (30+ flags en `usePermissions`) se vuelve decorativo: bloquea botones, no datos. **Peor escenario:** un empleado descontento se auto-asigna `void_finance` y `delete_patients`, exporta toda la base de pacientes (`export_patients`) y anula ingresos, todo con su cuenta legítima y sin tocar la UI.

### Solución Propuesta y Refactorización
Mover el gate del RBAC al servidor. Función que lee el permiso del `auth.uid()` actual y políticas que lo exigen:

```sql
CREATE OR REPLACE FUNCTION public.user_has_permission(p_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT (r.permissions ->> p_perm)::boolean
       FROM staff_users u JOIN staff_roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() LIMIT 1), false);
$$;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(text) FROM anon;

CREATE POLICY staff_roles_update ON public.staff_roles
  FOR UPDATE TO authenticated
  USING      (business_id = (SELECT get_user_business_id()) AND (SELECT user_has_permission('manage_roles')))
  WITH CHECK (business_id = (SELECT get_user_business_id()) AND (SELECT user_has_permission('manage_roles')));
-- idéntico para staff_users_update
```

> Nota: se usó `manage_roles` (la clave real que `usePermissions` verifica), **no** `manage_staff` (que aparece en el default heredado de la columna y está obsoleto). Usar la clave equivocada habría bloqueado a los administradores.
>
> **Pendiente recomendado:** el `INSERT`/`DELETE` de `staff_roles`/`staff_users` sigue sin gate de rol (la creación real pasa por Edge Function con `service_role`, pero conviene endurecerlo por defensa en profundidad).

### Lección de Arquitectura
**El control del cliente es UX, no seguridad.** Todo permiso que protege datos debe evaluarse en el mismo plano donde viven los datos (RLS/RPC). Un patrón robusto es tratar los permisos como *claims* verificados en el servidor y que el frontend solo consuma para pintar/ocultar. Además, cuidado con las **referencias recursivas**: la tabla que define permisos (`staff_roles`) nunca debe ser editable por el sujeto cuyos permisos define, sin un gate que ya presuponga el privilegio.

---

## 3. [ALTO] Superficie de RPC ejecutable por `anon`

### Estado Actual y Funcionamiento
El advisor de seguridad marcó **32 funciones `SECURITY DEFINER` ejecutables por `anon`** vía `/rest/v1/rpc/...`. Entre ellas, funciones que **escriben o filtran datos de cualquier tenant** sin autenticación:

- `create_patient_with_phone(p_business_id uuid, …)` — inserta en `patients`/`patient_phones` de **cualquier** `business_id` (corre como owner; no valida al llamante).
- `get_plan_limits(p_business_id uuid)` — su guard es `p_business_id = get_user_business_id() OR get_user_business_id() IS NULL`; para `anon`, `get_user_business_id()` es `NULL` ⇒ **devuelve límites/uso de cualquier negocio**.
- `get_patient_by_phone`, `reactivate_bot`, `enforce_feature`, `check_rate_limit`, `create_monthly_partition`, `ensure_future_partitions`.

### Vectores de Riesgo e Impacto Técnico
`SECURITY DEFINER` ejecuta con permisos del creador y **omite RLS**. Un atacante anónimo que conozca (o adivine, en un esquema con ids correlativos) un `business_id` puede inyectar pacientes basura, enumerar límites/consumo de competidores, o abusar de funciones de mantenimiento. **Peor escenario:** spam masivo de `create_patient_with_phone` contra un tenant ⇒ ensuciado de datos + disparo de triggers de auditoría/notificación (amplificación de escritura). Con `business_id` uuid la enumeración es difícil, pero "difícil" no es "imposible", y la superficie no debería existir.

### Solución Propuesta y Refactorización
El dashboard siempre está autenticado y el bot usa `service_role`; **`anon` no necesita ninguna de estas funciones**. Se revoca:

```sql
-- Solo se quita a anon (authenticated + service_role conservan lo que usan):
REVOKE EXECUTE ON FUNCTION public.create_patient_with_phone(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_plan_limits(uuid)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.reactivate_bot(uuid)                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_feature(text, uuid)                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_business_stats()                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_patient_by_phone(character varying)      FROM anon;
-- Mantenimiento/rate-limit: exclusivo de service_role
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(character varying, timestamptz)     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_monthly_partition(text, timestamptz)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_future_partitions(integer)                    FROM anon, authenticated;
```

**Sutileza crítica (verificada esta sesión):** varias de estas funciones tenían además `EXECUTE` concedido a **`PUBLIC`** (el ACL `=X/postgres`). Como `anon` es miembro de `PUBLIC`, un `REVOKE ... FROM anon` **no basta**: hay que `REVOKE ... FROM PUBLIC`. Se aplicó en la migración `revoke_public_execute_on_sensitive_rpcs`, conservando los grants explícitos a `authenticated`/`service_role`:

```sql
REVOKE EXECUTE ON FUNCTION public.create_patient_with_phone(uuid, text, text) FROM PUBLIC;      -- deja authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.get_patient_by_phone(character varying)     FROM PUBLIC, authenticated; -- deja service_role (evita lookup cross-tenant por authenticated)
REVOKE EXECUTE ON FUNCTION public.reactivate_bot(uuid)                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(character varying, timestamptz)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_monthly_partition(text, timestamptz)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_future_partitions(integer)                    FROM PUBLIC;
```

Verificación: `SELECT proacl` sobre las 6 funciones ⇒ `public_can_execute=false` y `anon_explicit=false`. Complemento (pendiente): que `create_patient_with_phone` valide `p_business_id = get_user_business_id()` internamente para no depender solo del `GRANT`.

### Lección de Arquitectura
En PostgREST, **cada función en un esquema expuesto es un endpoint HTTP**. `SECURITY DEFINER` + `GRANT EXECUTE` por defecto a `anon`/`authenticated` = API pública sin querer. Regla: toda función `DEFINER` nace con `REVOKE EXECUTE FROM public` y se concede **explícitamente** al rol mínimo. Las funciones de sistema/mantenimiento no pertenecen al esquema `public` expuesto.

---

## 4. [ALTO→OK] Arquitectura de Telemetría de Consumo (Metering)

### Estado Actual y Funcionamiento
`record_usage(p_business_id, p_tokens_in, p_tokens_out, p_messages)` hace `INSERT … ON CONFLICT (business_id, period) DO UPDATE` sobre `usage_counters` (una fila por negocio/mes) y, al alcanzar `max_conversations`, marca `businesses.ai_paused=true, ai_paused_reason='usage_limit'`. Está **correctamente restringida a `service_role`** (solo el bot n8n la invoca). Un `cron.job` mensual (`5 0 1 * *`) reactiva la IA al iniciar el período. La escritura de metering está **desacoplada** de la tabla caliente `appointments` (tabla propia, upsert de una fila) ⇒ sin deadlocks contra el flujo de turnos.

### Vectores de Riesgo e Impacto Técnico
El diseño es bueno; el riesgo latente era el **acceso**: si `record_usage` hubiera sido ejecutable por `anon`/`authenticated`, un atacante podría inflar el contador de un competidor y **cortarle la IA** (DoS de metering) o falsear su propio consumo a cero. También, el guard `IS NULL` de `get_plan_limits` (§3) permitía leer consumo ajeno. Con `anon` revocado, `IS NULL` solo lo alcanza `service_role` (confiable), por lo que es aceptable.

### Solución Propuesta y Refactorización
Mantener metering **service_role-only** (ya lo está). Endurecer idempotencia y trazabilidad:

```sql
-- Registrar de forma idempotente por evento para poder reintentar sin doble-conteo:
ALTER TABLE usage_counters ADD COLUMN IF NOT EXISTS last_event_id text;
-- y en record_usage: WHERE last_event_id IS DISTINCT FROM p_event_id
```

Además, exponer el consumo al tenant **solo por RPC de lectura** (`get_plan_limits`) y nunca dar `SELECT`/`UPDATE` de tabla sobre `usage_counters` a `authenticated` (hoy `usage_select` es rol `public`; endurecer a `authenticated` con gate de `business_id`).

### Lección de Arquitectura
La telemetría que dispara **decisiones de negocio con impacto monetario** (cortar servicio, facturar por uso) es una superficie de abuso: debe ser **escribible solo por el emisor de confianza**, **idempotente** (para reintentos) y **auditable**. Sepárala de las tablas transaccionales calientes para evitar contención de locks.

---

## 5. [MEDIO] Vista `SECURITY DEFINER` y `search_path` mutable — *(SQL listo, aplicar)*

### Estado Actual y Funcionamiento
Advisor **ERROR**: la vista `services_with_active_offer` es `SECURITY DEFINER` (corre con permisos del creador). Advisor **WARN** ×12: funciones con `search_path` no fijado (`get_patient_ltv`, `get_retention_rate`, `get_service_analytics`, `get_appointment_prediction`, `get_appointment_trend`, `get_stats_dashboard(uuid,…)`, `offers_set_updated_at`, `update_plans_updated_at`).

### Vectores de Riesgo e Impacto Técnico
Una vista `DEFINER` puede **saltarse la RLS** del consumidor (aunque aquí ya filtra por `get_user_business_id()`, el patrón es frágil ante cambios). Un `search_path` mutable en una función `SECURITY DEFINER` permite **secuestro de resolución de nombres** (crear un objeto homónimo en un esquema de mayor prioridad y ejecutar código con privilegios elevados).

### Solución Propuesta y Refactorización
```sql
ALTER VIEW public.services_with_active_offer SET (security_invoker = true);
ALTER FUNCTION public.get_patient_ltv(uuid, timestamptz, timestamptz) SET search_path = public;
-- … repetir SET search_path = public para las 12 funciones marcadas
```
> **Aplicado y verificado esta sesión** (migración `harden_security_definer_view_and_fn_search_path`). Verificación: `services_with_active_offer.reloptions = {security_invoker=true}` y `function_search_path_mutable` bajó de **12 → 0** en el advisor de seguridad; el advisor `security_definer_view` (ERROR) desapareció.

### Lección de Arquitectura
En Postgres 15+, **las vistas deben ser `security_invoker` salvo excepción justificada**, y **toda función `SECURITY DEFINER` debe fijar `search_path`** (a `public` o `''` con nombres calificados). Es cinturón-y-tirantes contra escalada por resolución de nombres.

---

## 6. [MEDIO] Indexación multi-tenant y RLS evaluada por fila

### Estado Actual y Funcionamiento
Las políticas usan `business_id = get_user_business_id()` **sin envolver** la función. Hay muchos índices de una sola columna `business_id` (`idx_services_business_id`, `idx_staff_users_business_id`, `idx_patient_phones_business_id`, GIN `idx_businesses_feature_flags`, …) que el advisor reporta como **`unused`** (20+), y coexisten con compuestos mejores (`idx_patients_business_active_created`, `idx_expense_business_occurred`). Para el calendario, `appointments` tiene `idx_appointments_business_id` (una columna) y el GIST de solape, pero **no** un btree `(business_id, date_start)`.

### Vectores de Riesgo e Impacto Técnico
`get_user_business_id()` es `STABLE SECURITY DEFINER`; sin envolver, el planner puede **re-evaluarla por fila**, degradando `O(filas)` cada consulta a escala (el clásico `auth_rls_initplan`). Los índices redundantes **amplifican la escritura** (cada INSERT/UPDATE mantiene todos) y engordan el WAL. La consulta caliente del calendario (rango de fechas por negocio) sin `(business_id, date_start)` cae en filtros menos eficientes conforme crecen los turnos.

### Solución Propuesta y Refactorización
```sql
-- 1) Cachear la función una vez por statement (InitPlan):
--    reemplazar en TODAS las políticas  business_id = get_user_business_id()
--    por                                 business_id = (SELECT get_user_business_id())
-- 2) Índice compuesto para el calendario:
CREATE INDEX idx_appointments_biz_start ON appointments (business_id, date_start);
-- 3) Eliminar índices de una columna redundantes con un compuesto que ya prefija business_id:
DROP INDEX IF EXISTS idx_services_business_id, idx_staff_users_business_id,
                     idx_patient_phones_business_id, idx_businesses_feature_flags;
```
Verificar con `EXPLAIN (ANALYZE, BUFFERS)` antes/después; usar `index_advisor`/`hypopg` (ya instalables) para validar hipótesis sin crear índices reales.

### Lección de Arquitectura
En multi-tenant, **el `tenant_id` va primero en el índice compuesto** y las cláusulas RLS deben ser *InitPlan-friendly* (`(SELECT fn())`) para evaluarse una vez por consulta, no por fila. Menos índices correctos > muchos índices por si acaso: cada índice es un costo de escritura permanente.

---

## 7. [MEDIO] Auditoría síncrona en el hot path transaccional

### Estado Actual y Funcionamiento
Triggers `AFTER INSERT/UPDATE/DELETE` (`trigger_audit_log`) en `appointments`, `patients`, `income_entries`, `expense_entries`, `service_supplies`, `supplies` escriben en `audit_log` (particionada por mes, `id+created_at`) **dentro de la misma transacción** del cambio. Lo bueno: el particionado está **bien resuelto** (`ensure_future_partitions(6)` corre semanal por `cron`, retención a 90 días por `cron`, particiones hasta `2026m12`).

### Vectores de Riesgo e Impacto Técnico
Cada operación de negocio paga la latencia de **una escritura extra** (más el índice) en la misma transacción; bajo ráfagas (p. ej. una sincronización masiva del bot) el `audit_log` del mes en curso se vuelve un **punto caliente de escritura** y alarga los locks del flujo de turnos. Es contención acoplada: un pico de auditoría degrada la operación real.

### Solución Propuesta y Refactorización
- Corto plazo: asegurar índices mínimos en el `audit_log` (ya hay varios `unused` por mes; podarlos reduce el costo por INSERT).
- Medio plazo: **desacoplar** la auditoría con `pgmq` (ya disponible) o `pg_net`: el trigger encola el evento y un worker lo materializa fuera de la transacción caliente. Alternativa gestionada: `pgaudit` para auditoría a nivel de sesión.

### Lección de Arquitectura
La auditoría es *cross-cutting* pero **no debe compartir el camino crítico de latencia** de la operación que audita. Cuando el volumen crece, muévela a un pipeline asíncrono (cola/outbox) para que "observar" nunca frene "operar".

---

## 8. [BAJO] Bugs latentes del esquema entero heredado

### Estado Actual y Funcionamiento
El esquema migró de `business_id integer` a `uuid`, pero quedaron restos. `reactivate_bot(uuid)` estaba roto en **tres frentes** simultáneos (se descubrió al inspeccionar el esquema real de `patients`):
1. Declaraba `v_business_id INTEGER` pero `patients.business_id` es `uuid`.
2. Llamaba `get_my_business_id()`, que a su vez **`RETURNS integer`** leyendo un `business_id` uuid (helper también roto).
3. Hacía `SET handoff_reason=NULL, handoff_at=NULL`, columnas que **no existen** en `patients` (el modelo real de handoff es solo `human_takeover boolean`).

Aclaración importante: el dashboard **no** usa este RPC — `reactivateBot()` ([supabaseService.js:561](src/services/supabaseService.js)) hace un `UPDATE` directo a `patients.human_takeover`. El RPC `reactivate_bot` es una vía separada (bot/`service_role`), por lo que el bug no afectaba a la reactivación desde `BusinessSettings`, pero dejaba el RPC inservible para cualquier llamante.

Otros fósiles (documentados, sin aplicar aún): overloads muertos `suspend_tenant(integer, …)` y `get_available_slots(integer, date)`; `handle_new_staff_user()` castea a `INTEGER` y está **huérfana**; `get_my_business_id()` (integer) sigue rota pero ya nadie la usa tras el fix.

### Vectores de Riesgo e Impacto Técnico
Un RPC `SECURITY DEFINER` que compila pero falla en runtime es una trampa: cualquier integración futura (o el bot) que lo invoque recibe un error opaco. Los overloads/funciones muertas amplían la superficie de `SECURITY DEFINER` sin aportar valor.

### Solución Propuesta y Refactorización *(aplicada y verificada)*
Se reescribió `reactivate_bot` contra el esquema real, con la variable `uuid`, usando `get_user_business_id()` (uuid) y scoping por negocio del llamante (`service_role`/n8n opera por `patient_id`):

```sql
CREATE OR REPLACE FUNCTION public.reactivate_bot(p_patient_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer; v_business_id uuid;
        v_caller_business uuid := public.get_user_business_id();
BEGIN
  INSERT INTO api_rate_limits (key, window_start, call_count)
  VALUES ('reactivate_bot', date_trunc('minute', now()), 1)
  ON CONFLICT (key, window_start) DO UPDATE SET call_count = api_rate_limits.call_count + 1
  RETURNING call_count INTO v_count;
  IF v_count > 50 THEN RAISE EXCEPTION 'Rate limit exceeded: max 50 calls/minute for reactivate_bot'; END IF;

  SELECT business_id INTO v_business_id FROM patients
   WHERE id = p_patient_id AND (v_caller_business IS NULL OR business_id = v_caller_business);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Paciente no encontrado o sin permisos'); END IF;

  UPDATE patients SET human_takeover = false WHERE id = p_patient_id;
  RETURN jsonb_build_object('ok', true);
END; $$;
```

Smoke-test verificado: `reactivate_bot('000…000')` ⇒ `{"ok":false,"error":"Paciente no encontrado o sin permisos"}` (corre sin error de tipo). **Pendiente** de limpieza (no aplicado): `DROP FUNCTION` de `suspend_tenant(integer,…)`, `get_available_slots(integer,date)`, `handle_new_staff_user()`, `get_my_business_id()`.

### Lección de Arquitectura
Los cambios de tipo de PK/FK (`integer → uuid`) dejan **fósiles** peligrosos (casts, overloads, funciones huérfanas) que compilan pero fallan en runtime. Toda migración de tipo necesita un barrido de `pg_proc` para eliminar overloads obsoletos y una prueba de humo de cada RPC.

---

## 9. [MEDIO] Resiliencia: sin retry/backoff ni circuit breaker

### Estado Actual y Funcionamiento
Existe `ErrorBoundary` (con `Sentry.captureException`) y un `withTimeout(promise, 12s)` en `useStats`/`useAppointments`. La capa de servicio **no** tiene reintentos, backoff, ni circuit breaker; `withTimeout` solo **detecta**, no reintenta. No hay detección de offline. Realtime limpia bien (`removeChannel` en cleanup, `src/hooks/useRealtime.js:41`) y la RLS protege los canales aunque el filtro `business_id=eq.X` sea provisto por el cliente. El `fetch` global fuerza `cache:'no-store'` para **todas** las peticiones.

### Vectores de Riesgo e Impacto Técnico
Ante microcortes de red o 429/503 transitorios de Supabase, cada acción del usuario **falla de inmediato** con modal de error (mala UX, sensación de fragilidad). Sin circuit breaker, N fallos consecutivos siguen martillando el backend degradado. `cache:'no-store'` global desactiva incluso el caché HTTP benigno de lecturas idempotentes, aumentando round-trips.

### Solución Propuesta y Refactorización
Un envoltorio con backoff exponencial + jitter para RPC/lecturas idempotentes:

```js
async function withRetry(fn, { tries = 3, base = 300 } = {}) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      const retriable = e?.status === 429 || (e?.status >= 500) || e?.message?.includes('Failed to fetch');
      if (!retriable || i >= tries - 1) throw e;
      await new Promise(r => setTimeout(r, base * 2 ** i + Math.random() * base));
    }
  }
}
```
Aplicar solo a operaciones **idempotentes** (nunca a `create_appointment`, que ya maneja `23P01`). Mover `cache:'no-store'` a un wrapper *opt-in* para botones "Actualizar". Considerar `@tanstack/react-query` para dedupe + reintentos + estados por defecto (hoy hay `_inflight` casero solo en `usePlanLimits`).

### Lección de Arquitectura
Resiliencia = **detectar + reintentar con criterio + fallar rápido**. El backoff exponencial con jitter evita tormentas de reintentos sincronizados; el circuit breaker corta la sangría cuando el dependiente está caído. La idempotencia es el prerrequisito: solo se reintenta con seguridad lo que no duplica efectos.

---

## 10. [MEDIO] Rate limiting inter-tenant y saturación del pool (Supavisor)

### Estado Actual y Funcionamiento
Hay una tabla `api_rate_limits (key, window_start)` y `check_rate_limit(key, …)`, pero la `key` es arbitraria y (hasta este fix) ejecutable por `anon`. No hay cuota por-tenant que aísle el tráfico: un tenant ruidoso comparte el mismo pool de conexiones (Supavisor) y CPU de Postgres con los demás.

### Vectores de Riesgo e Impacto Técnico
**Peor escenario:** el Tenant A recibe una oleada (legítima o ataque) y sus consultas —agravadas por la RLS evaluada por fila (§6) y funciones `SECURITY DEFINER STABLE` invocadas por fila— saturan el pool; el Tenant B ve latencias y timeouts (*noisy neighbor*). En serverless/n8n, abrir conexiones directas en modo *session* agota rápido el pooler.

### Solución Propuesta y Refactorización
- **Pooler:** usar Supavisor en **transaction mode** para n8n/Edge/serverless (conexiones efímeras); reservar *session mode* solo donde se necesiten prepared statements persistentes. Vigilar `SHOW max_connections` vs. conexiones activas de Supavisor.
- **Cuotas por tenant:** llave de rate-limit = `business_id + ventana`, y aplicarla en el borde (Edge Function/n8n) antes de tocar la DB. Considerar `statement_timeout` por rol para acotar consultas descontroladas.
- Reducir el costo por-fila de RLS (§6) baja la presión de CPU bajo ráfaga.

### Lección de Arquitectura
En multi-tenant sobre infraestructura compartida, **el aislamiento de rendimiento no es gratis**: swithout cuotas por inquilino, la capacidad es un bien común que un solo tenant puede agotar. El rate-limit debe ser *por tenant* y estar lo más cerca posible del borde.

---

## 11. [MEDIO] Observabilidad y trazabilidad multi-tenant

### Estado Actual y Funcionamiento
Sentry está configurado con **redacción de PII** (elimina `bid` de la URL y el email del usuario) y `tracesSampleRate: 0.1`. `ErrorBoundary` reporta a Sentry. Existe un `audit_log` rico (old/new data, `changed_by`). Falta: correlación **tenant ↔ request ↔ consulta DB**, registro de **denegaciones de permiso** (el audit solo guarda mutaciones exitosas), y métricas de latencia. Pendiente operativo: `VITE_SENTRY_DSN` y sourcemaps ocultos en Vercel prod.

### Vectores de Riesgo e Impacto Técnico
Cuando algo falla para "un cliente", no hay un identificador correlativo para filtrar toda la telemetría de esa petición de punta a punta ⇒ diagnóstico lento y a ciegas. Sin registrar denegaciones RLS/permiso, un ataque de escalada (como los §1–§2) pasa desapercibido.

### Solución Propuesta y Refactorización
- Propagar un `X-Request-Id`/`correlation_id` desde el cliente, adjuntarlo como `Sentry.setTag('business_id', bid)` y `setTag('request_id', …)`, y pasarlo a los RPC para dejarlo en logs de Postgres (`SET application_name`).
- Registrar intentos denegados (p. ej. un RPC que valide permiso y escriba a `audit_log` con `action='DENIED'`).
- Cerrar los pendientes: `VITE_SENTRY_DSN` en Vercel prod + `sourcemap: 'hidden'` con subida a Sentry (hoy `vite.config.js` tiene `sourcemap:false`).

### Lección de Arquitectura
**Sin un id correlativo que hilvane cliente→request→tenant→consulta, la observabilidad multi-tenant es humo.** El objetivo es poder responder "¿qué le pasó al Tenant X a las 10:03?" con un solo filtro, y ver también lo que fue **rechazado**, no solo lo que ocurrió.

---

## 12. [MEDIO] Unit-economics técnicos y fricción de aprovisionamiento

### Estado Actual y Funcionamiento
Los límites de plan del cliente son **informativos**: `usePlanLimits` devuelve `canAddPatient: true` y `canAddStaff: true` siempre (`src/hooks/usePlanLimits.js:83`). El *enforcement* real es por ocultamiento: `get_visible_patient_ids(business_id)` devuelve solo los N primeros según el plan y el cliente filtra con `.in('id', visibleIds)`; **no bloquea la creación**, solo esconde el excedente. El aprovisionamiento de nuevos tenants es **manual pero correcto**: pasa por Edge Functions con `service_role` (`adminService.js` → `admin-update-business`), no por el cliente.

Planes: Básico Q499 (10 pacientes/1 staff), Pro Q999 (100/5), Enterprise Q1999 (ilimitado). El scorecard interno estima **Básico ~10% de margen** (frágil frente a fees + soporte) y riesgo en Enterprise por *templates* de WhatsApp salientes ($/plantilla).

### Vectores de Riesgo e Impacto Técnico
- **Económico:** si no hay tope real de creación, un cliente Básico puede acumular datos/costo por encima de lo pagado (el "ocultamiento" no evita el almacenamiento ni el consumo del bot). Combinado con el §1 (auto-upgrade), el margen era directamente evadible.
- **Onboarding:** proceso manual ⇒ latencia de aprovisionamiento alta y sin atomicidad verificable (si la Edge Function falla a mitad, el tenant queda inconsistente).

### Solución Propuesta y Refactorización
- **Enforcement en servidor:** validar límites en el `INSERT` (trigger `BEFORE INSERT` que compare `count(*)` vs `get_plan_limits`), devolviendo un error de negocio claro (`PLAN_LIMIT_REACHED`) que el frontend traduzca a un modal de upsell.
- **Aprovisionamiento atómico:** envolver la creación de `businesses` + rol admin + `staff_users` en una **RPC transaccional** (`service_role`) para garantizar todo-o-nada, y medir la latencia de onboarding como SLO.
- **Márgenes:** alinear `max_conversations` con el costo real de tokens+WhatsApp; revisar viabilidad del plan Básico o subir su precio/tope.

### Lección de Arquitectura
En SaaS con consumo de recursos, **los límites de plan son una regla de negocio con impacto en el margen: deben vivir en el servidor y aplicarse en la escritura**, no en la UI. El aprovisionamiento debe ser atómico e idempotente; si no es todo-o-nada, tendrás tenants "a medio crear" que drenan soporte.

---

## Fixes aplicados y verificados

Migraciones aplicadas a producción (`kwpaaqdkklwwfslhkqpb`) esta sesión, con verificación posterior:

| Migración | Efecto | Verificación |
|-----------|--------|--------------|
| `secure_businesses_column_level_update` | `authenticated` solo puede `UPDATE` 9 columnas seguras; `anon` sin `UPDATE`. | `column_privileges` → `authenticated`: `appointment_duration, business_type, custom_prompt, name, notification_email, schedule_days, schedule_end, schedule_start, timezone`. `plan_id/feature_flags/limit_overrides/whatsapp_token` ya **no** editables por tenant. |
| `rbac_permission_gate_on_staff_rls` | `staff_roles_update` y `staff_users_update` exigen `manage_roles`. | `pg_policies` → `qual`/`with_check` incluyen `user_has_permission('manage_roles')`. |
| `revoke_anon_execute_on_sensitive_rpcs` | Quita grants explícitos de `anon` en 9 RPCs. | Cierra a `anon` en `enforce_feature`, `get_business_stats`, `get_plan_limits`. |
| `revoke_public_execute_on_sensitive_rpcs` | Quita `EXECUTE` a `PUBLIC` (el hueco que dejaba entrar a `anon`) en 6 RPCs. | `proacl` → `public_can_execute=false` y `anon_explicit=false` en las 6. |
| `harden_security_definer_view_and_fn_search_path` | Vista → `security_invoker`; `search_path=public` en 12 funciones. | Advisor: `security_definer_view` (ERROR) desaparece; `function_search_path_mutable` **12→0**. |
| `fix_reactivate_bot_uuid_and_schema` | Reescribe `reactivate_bot` contra el esquema real (uuid, `human_takeover`). | Smoke-test ⇒ `{"ok":false,...}` sin error de tipo. |

**Impacto en n8n:** nulo. El bot usa `service_role`, que conserva todos los privilegios; los `REVOKE` afectan solo a `anon`/`authenticated`/`PUBLIC`.

### Pendiente (SQL listo en este documento)
1. RLS *InitPlan* `(SELECT get_user_business_id())` + índice `(business_id, date_start)` + poda de índices redundantes (§6).
2. Auditoría asíncrona vía `pgmq` (§7).
3. Limpieza de fósiles: `DROP FUNCTION` de `suspend_tenant(integer,…)`, `get_available_slots(integer,date)`, `handle_new_staff_user()`, `get_my_business_id()` (§8).
4. Gate de `manage_roles` también en `INSERT`/`DELETE` de `staff_roles`/`staff_users` (§2); validación interna de `business_id` en `create_patient_with_phone` (§3).
5. `withRetry`/circuit breaker + `cache:'no-store'` opt-in (§9).
6. Enforcement de límites en `INSERT` + RPC de onboarding atómica (§12).

---

## Lecciones transversales

1. **La seguridad multi-tenant es de servidor, no de UI.** RBAC y límites de plan deben aplicarse donde viven los datos (RLS/RPC). El frontend solo pinta.
2. **RLS controla filas, no columnas ni operaciones.** Separa por privilegio de columna o por tabla lo que el tenant puede tocar de lo que solo el proveedor decide (billing, credenciales, permisos).
3. **Cada función en el esquema `public` es un endpoint.** `SECURITY DEFINER` sin `REVOKE`/`search_path` es API pública y escalada latente.
4. **El `tenant_id` primero en el índice; RLS *InitPlan-friendly*.** El rendimiento multi-tenant se gana en el diseño del índice y en cómo se evalúa la política.
5. **Observar no debe frenar operar.** Auditoría y metering, desacoplados del hot path; correlación por tenant de punta a punta.
