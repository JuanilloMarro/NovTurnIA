# Infraestructura Supabase — Auditoría Integral y Soluciones Aplicadas

> **Fecha:** 2026-07-05 (actualizado tras aprobación del usuario) · Proyecto `kwpaaqdkklwwfslhkqpb` (Postgres 17, us-west-2)
> Todo lo descrito como "aplicado" está **en producción y verificado** con smoke tests. Las 2 acciones que estaban bloqueadas por el clasificador fueron **aprobadas y ejecutadas** (§8).

---

## 1. Resumen ejecutivo

| Área | Estado |
|---|---|
| Integración front↔DB (tablas/RPCs/vistas) | ✅ **100% verificada** — las 17 tablas y 20 RPCs que usa el front existen en la DB. **1 bug real encontrado y corregido** (permisos de onboarding, §3). |
| Retención de conversaciones | ✅ **Implementada**: 3 meses Básico/Pro, 12 meses Enterprise, borrado diario automático. La facturación NO se afecta (§4). |
| Particionado | ✅ **Ya era automático** (no manual, como creías) — cron semanal existente. Optimizado: horizonte 6→2 meses + limpieza mensual automática (§5). |
| Índices multi-tenant | ✅ 5 índices nuevos (queries calientes de Conversaciones/Actividad/Calendario + FKs), 4 redundantes eliminados. |
| Funciones muertas | ✅ 4 fósiles eliminados (`get_my_business_id`, `suspend_tenant(int)`, `get_available_slots(int)`, `handle_new_staff_user`). |
| Drift repo↔producción (edge functions) | ✅ Corregido: `admin-list-businesses` y `admin-update-business` ahora están en el repo. |
| Limpieza visual de particiones | ✅ **Aplicada** (aprobada por el usuario): 16 particiones vacías eliminadas — cada tabla pasó de 12 a **4** particiones (§8.1). |
| RLS InitPlan | ✅ **Aplicada** (aprobada por el usuario): 0 políticas sin wrapper; `message_buffer` deduplicada 6→3 (§8.2). |
| Cuelgue del alta de tenants ("se queda trabado") | ✅ Causa raíz encontrada (navigator lock de gotrue atascado en el navegador — la request nunca salía) y front blindado con fetch directo + timeout (§10). |

---

## 2. Inventario de tablas (23) y vistas (2)

Todas con **RLS habilitado** y FK `business_id → businesses` con `ON DELETE CASCADE` (borrar un negocio arrastra TODOS sus datos — verificado FK por FK).

| Tabla | Propósito | La usa | Índice clave |
|---|---|---|---|
| `businesses` | Tenants (config, plan, WhatsApp, ai_paused) | Front + n8n + edge | pk |
| `plans` | Catálogo Básico/Pro/Enterprise + límites + `history_retention_months` (nuevo) | Front + edge | `tier` unique |
| `app_super_admins` | Fuente de verdad del super-admin (por user_id) | Edge functions | pk |
| `staff_users` / `staff_roles` | Usuarios del negocio + RBAC (jsonb `permissions`) | Front + edge | `(business_id, created_at)` |
| `patients` | Pacientes (+ `human_takeover` para handoff) | Front + n8n | trigram nombre, `(business_id, created_at)` parcial |
| `patient_phones` | Teléfonos por paciente (formato wa_id sin `+`) | Front + n8n | `(patient_id, phone)` unique |
| `appointments` | Turnos (enum 6 estados; GIST anti-doble-booking) | Front + n8n | **`(business_id, date_start)` (nuevo)** + GIST |
| `services` | Servicios del negocio | Front + n8n | `(business_id)` |
| `offers` | Ofertas dinámicas (GIST anti-solape por servicio) | Front + n8n | GIST parcial |
| `history` (particionada) | Mensajes de conversaciones (rol user/assistant/system/agent) | Front + n8n | **`(business_id, patient_id, created_at)` (nuevo)** |
| `audit_log` (particionada) | Auditoría de cambios (triggers en 5 tablas) | Front (Actividad) | **`(business_id, created_at)` (nuevo)** |
| `notifications` | Notificaciones del dashboard | Front | `(business_id)` |
| `message_buffer` | Buffer de mensajes entrantes de n8n (TTL) | n8n | `(phone, created_at)` |
| `api_rate_limits` | Contadores de rate limit (`check_rate_limit`) | n8n/RPCs | pk `(key, window_start)` |
| `usage_counters` | **Metering** mensajes/tokens por negocio/mes (fuente de facturación) | n8n (`record_usage`) + panel admin | pk `(business_id, period)` |
| `supplies`, `service_supplies` | Insumos + receta (BOM) | Front (Finanzas) | `(business_id, active)` |
| `income_entries`, `expense_entries` | Ingresos/egresos snapshot | Front (Finanzas) | compuestos + **5 índices FK (nuevos)** |
| Vistas: `v_service_cost`, `services_with_active_offer` | Costo BOM por servicio / precios con oferta activa | Front / n8n | `security_invoker` ✓ |

**Conclusión de integridad:** no hay tablas huérfanas ni datos "solo en front". Cada número que muestra el dashboard sale de una tabla, vista o RPC real (mapa completo en §3).

---

## 3. Verificación integración front↔DB

### 3.1 Lo verificado ✅
- **20 RPCs** llamadas por `supabaseService.js`/hooks — todas existen y con grants correctos: `search_patients`, `create_patient_with_phone`, `get_stats_dashboard`, `get_business_stats`, `get_patient_stats`, `get_plan_limits`, `get_appointment_trend/prediction`, `get_patient_ltv`, `get_retention_rate`, `get_service_analytics`, `get_visible_patient_ids/staff_ids`, `get_finance_summary/trend`, `submit/confirm_income_validation`, `void_income/expense_entry`, `get_pending_validations`.
- **17 tablas/vistas** referenciadas con `.from()` — todas existen (incluida `v_service_cost`).
- **Edge functions** del front (`onboard-tenant`, `admin-list-businesses`, `admin-update-business` — esta última también hace el reset de password) — desplegadas y ahora **sincronizadas en el repo**.
- Enums alineados: `plan_status_enum` = los 4 estados del panel admin; `appt_status` cubre los estados del front (queda un valor legacy `active` en el enum, inofensivo); `message_role` = user/assistant/system/agent ✓.

### 3.2 Bug real encontrado y corregido 🔧
**Los permisos que `onboard-tenant` asignaba NO coincidían con el vocabulario del front.** `usePermissions.js` lee 37 llaves (`reschedule_appointments`, `create_services`, `view_finance`, `reply_conversations`…), pero el rol *owner* de un tenant nuevo se creaba con solo 15 — **un dueño recién onboardeado encontraba medio dashboard bloqueado** (sin reagendar, sin servicios, sin ofertas, sin finanzas, sin responder chats). Además el `DEFAULT` de la columna `staff_roles.permissions` usaba llaves muertas (`manage_staff`, `reactivate_bot`, `view_audit_log`) que el front jamás lee.

**Aplicado:** `onboard-tenant` **v11** crea *owner* con las 37 llaves reales en `true` y *secretary* con un subconjunto operativo sensato; el `DEFAULT` de la columna ahora es un baseline tipo secretaria con el vocabulario real (migración `aux_retention_and_permissions_default`).

### 3.3 Menores (documentados, sin acción urgente)
- `AdminOnboarding.jsx` hardcodea `PLANS = ['basic','pro','enterprise']` — coincide con `plans.tier`, pero idealmente debería leerse de la tabla (como ya hace `AdminPanel`).
- `CLAUDE.md` menciona vistas materializadas `mv_business_stats`/`mv_patient_stats` que **ya no existen** (las stats van por RPCs `get_stats_dashboard` etc.) — actualizar cuando toque.
- `plans` tiene GRANTs de escritura a nivel tabla para anon/authenticated; RLS los bloquea (sin policy de write), pero conviene revocarlos en un hardening futuro.

---

## 4. Retención de conversaciones — implementada

**Tu pregunta:** ¿mostrar al cliente Básico/Pro todas sus conversaciones o solo los últimos 3 meses? → **Implementado: solo los últimos 3 meses** (12 para Enterprise, como diferenciador del plan).

| Pieza | Detalle |
|---|---|
| Configuración | Columna nueva `plans.history_retention_months`: basic=3, pro=3, enterprise=12. Cambiar = un `UPDATE plans`, sin deploy. |
| Ejecución | Función `apply_history_retention()` (SECURITY DEFINER, solo servicio) borra por-negocio lo más viejo que su retención. Cron **diario 03:30 UTC** (`retain-history`). |
| Front | Sin cambios: Conversaciones ya pagina con cursor (`getPatientHistory`), simplemente dejará de encontrar mensajes viejos. |
| **Facturación intacta** | El metering vive en `usage_counters` (mensajes/tokens por mes), NO en `history`. Borrar historial viejo **no altera** contadores, límites de plan ni estadísticas (las RPCs de stats usan `appointments`/`income`, no `history`). |
| Beneficio | `history` es la tabla que más crece (cada mensaje de WhatsApp = 1 fila). Con retención, el disco se estabiliza y te mantienes años dentro de los 8 GB del plan Pro. |

---

## 5. Particionado — la realidad y lo optimizado

**Corrección importante: el particionado NO era manual.** Ya existía un cron semanal (`ensure-future-partitions`, domingos 03:00) que crea particiones futuras automáticamente — por eso existía ya `history_y2027m01`. **Para 2027 no hay que hacer NADA manual**: las particiones se crean solas.

### Lo optimizado hoy
1. **Horizonte 6 → 2 meses** (`cron.alter_job`): antes pre-creaba 6 meses de particiones vacías (la "basura visual" que te molesta); ahora solo el mes actual +2. El cron semanal repone conforme avanza el calendario.
2. **Limpieza automática nueva** (`drop-old-partitions`, mensual día 1, 03:15): dropea particiones de `history` > 13 meses y de `audit_log` > 4 meses (siempre por encima de las retenciones de filas: 12m y 90d). Nunca más acumulación infinita.
3. Función `drop_old_partitions(parent, months_to_keep)` reutilizable y restringida a servicio.

### pg_partman (las "particiones automáticas de Supabase")
Evaluado: es una **extensión gratuita** (costo $0) disponible en Supabase. **No la necesitas** — hace exactamente lo que tu dupla `ensure_future_partitions` + pg_cron ya hace, y adoptarla implicaría migrar la gestión existente sin ganancia. Decisión: seguir con el mecanismo nativo actual.

### Plan detallado para 2027 (lo que pediste)
- **Nada que hacer.** Enero 2027: el cron del domingo previo ya habrá creado `*_y2027m01` y `*_y2027m02`.
- Verificación opcional (1 query, enero): `SELECT relname FROM pg_class WHERE relname ~ '_y2027m0[12]$';` → deben aparecer 4 tablas (history+audit × 2 meses).
- Si alguna vez fallara el cron: `SELECT public.ensure_future_partitions(2);` a mano y listo. Los inserts nunca se pierden: caerían en `*_default` mientras tanto.

### Sobre la "basura visual" restante
Las particiones son tablas reales — el Studio siempre las mostrará. Lo que sí se puede: eliminar las **16 particiones vacías** actuales (pasadas al reset del 1-jul: `m03–m06`; futuras más allá de +2: `m10–m12` y `y2027m01`), dejando solo `default + m07 + m08 + m09` por tabla (4 en vez de 12). **Ese DROP quedó bloqueado por el clasificador — SQL listo en §8.1.**

---

## 6. Jobs de pg_cron (estado final: 8)

| Job | Horario (UTC) | Qué hace | Estado |
|---|---|---|---|
| `clean-message-buffer` | cada minuto | Borra buffer expirado de n8n | Existente |
| `retain-audit-log` | diario 09:00 | audit_log > 90 días | Existente |
| `ensure-future-partitions` | dom 03:00 | Crea particiones +2 meses | **Optimizado (era 6)** |
| `reset-usage-ai-pause` | día 1, 00:05 | Despausa IA cortada por límite | Existente |
| `retain-history` | diario 03:30 | **Retención conversaciones por plan** | **Nuevo** |
| `drop-old-partitions` | día 1, 03:15 | Dropea particiones viejas (13m/4m) | **Nuevo** |
| `clean-api-rate-limits` | diario 03:20 | rate_limits > 2 días (crecía sin límite) | **Nuevo** |
| `retain-notifications` | diario 03:25 | notificaciones > 90 días | **Nuevo** |

---

## 7. Migraciones aplicadas hoy (verificadas)

| Migración | Contenido | Verificación |
|---|---|---|
| `history_retention_per_plan` | Columna + `apply_history_retention()` + cron | Smoke: `{deleted: 0}` ✓; basic=3, ent=12 ✓ |
| `partition_horizon_and_maintenance` | `drop_old_partitions()` + horizonte 2 + cron mensual | Smoke: `{dropped: [], cutoff: 2025-06-01}` ✓ |
| `composite_indexes_multi_tenant` | 3 compuestos calientes + 5 índices FK − 4 redundantes | 5/5 nuevos presentes ✓ |
| `aux_retention_and_permissions_default` | 2 crons de retención + DEFAULT permisos real | Crons listados ✓ |
| `drop_dead_functions` | 4 fósiles fuera | 0 restantes ✓ |
| Edge `onboard-tenant` **v11** | Permisos owner/secretary alineados al front | Desplegada ACTIVE ✓ |

---

## 8. ✅ Acciones aprobadas por el usuario y APLICADAS (2026-07-05)

Estas dos acciones quedaron inicialmente bloqueadas por el clasificador de seguridad del modo automático; el usuario las aprobó explícitamente en el chat y se ejecutaron y verificaron:

### 8.1 Limpieza visual: 16 particiones vacías eliminadas ✅
Migración `drop_empty_clutter_partitions_user_approved`. Se verificó `count=0` en `history` y `audit_log` antes del DROP. Resultado verificado post-aplicación:

| Tabla | Antes | Después |
|---|---|---|
| `history` | 12 particiones | **4**: `default`, `y2026m07`, `y2026m08`, `y2026m09` |
| `audit_log` | 12 particiones | **4**: `default`, `y2026m07`, `y2026m08`, `y2026m09` |

El cron semanal `ensure-future-partitions(2)` mantiene el horizonte (+2 meses) y `drop-old-partitions` (mensual) evita que se vuelvan a acumular.

### 8.2 Rendimiento RLS InitPlan ✅
Migración `rls_initplan_wrap_user_approved`. `get_user_business_id()` ahora se evalúa **1 vez por query** (InitPlan) en vez de una por fila, en TODAS las políticas de `public`. Verificación:
- Política de ejemplo (`appointments_select`): `(business_id = ( SELECT get_user_business_id() ))` ✓
- Políticas sin wrapper restantes: **0** ✓
- `message_buffer` deduplicada: 6 → **3** políticas (advisor WARN `multiple_permissive_policies` resuelto) ✓

---

## 10. Auditoría del cuelgue del alta de tenants (2026-07-05)

**Síntoma:** "Crear tenant" se quedaba con el spinner infinito ("se queda trabado").

**Evidencia decisiva:** en los logs de Edge Functions **no aparece NINGÚN request** (`POST` ni `OPTIONS`) a `onboard-tenant` del intento — la petición **nunca salió del navegador**. En paralelo, la consola mostraba repetidamente:
```
@supabase/gotrue-js: Lock "lock:sb-…-auth-token" was not released within 5000ms.
```

**Causa raíz:** `supabase.functions.invoke()` llama internamente a `getSession()`, que espera el **navigator lock** de gotrue (el candado que sincroniza el token entre pestañas). Si ese lock queda huérfano — pestañas zombis del mismo dominio, doble montaje de React StrictMode en dev — `invoke()` se bloquea indefinidamente ANTES de enviar nada. No era un problema de parámetros ni del servidor.

**Descartado:** los parámetros de WhatsApp NO son el problema — `phone_number_id` y `whatsapp_token` **pueden ir vacíos** (la función inserta `''`, columnas NOT NULL cubiertas, editables después en el panel).

**Fix aplicado (front):**
- [src/services/adminService.js](../../src/services/adminService.js) reescrito: las 4 llamadas admin (`list`, `update`, `reset password`, `onboard`) usan ahora **`fetch` directo con `AbortController` (timeout 20–30s)** y un lector de token que no puede colgarse: intenta `getSession()` con guarda de 3s y cae a leer el token de `localStorage` directamente (sin pasar por el lock).
- [src/pages/AdminOnboarding.jsx](../../src/pages/AdminOnboarding.jsx) migrado al helper `adminOnboardTenant()`.
- Resultado: si algo va mal, el usuario ve un **error claro en ≤30s** — nunca más spinner infinito. Verificado: la app arranca sin errores de consola con el cambio.

**Higiene recomendada al usuario:** mantener UNA sola pestaña del dashboard abierta en dev (las pestañas zombis son las que dejan el lock huérfano; en producción StrictMode no duplica montajes).

---

## 9. Puntos de mejora restantes (backlog priorizado)

1. **Vault para `whatsapp_token`** (hoy texto plano en `businesses`) — deferido deliberadamente para no romper n8n; hacerlo en ventana coordinada.
2. ~~**Enforcement de límites de plan en INSERT**~~ ✅ **HECHO 2026-07-05** (migración `pricing_v2_limits_and_server_enforcement`): triggers `enforce_patient_limit` (INSERT + restore), `enforce_staff_limit` (INSERT + reactivación), `enforce_appointment_limit` (mensual, cancelados no cuentan) — todos respetan `limit_overrides` vía `get_effective_limit()`. `get_plan_limits` v2 devuelve `appointments_used`; `get_visible_patient_ids`/`staff_ids` corregidas (ignoraban overrides). Verificado con probe de rollback: paciente 51/50 rechazado, visibles=50 exacto, staff y turnos bloqueados por override (4/4 ✓). Front: `usePlanLimits` con booleanos reales + gates en Nuevo Cliente/Nuevo Turno. Precios v2 aplicados (Q999/Q1,999/Q3,999 — modelo en doc 01 §1-bis).
3. **Revocar grants de escritura** sobre `plans` a anon/authenticated (defensa en profundidad; RLS ya bloquea).
4. **`AdminOnboarding`**: leer planes de la tabla en vez del array hardcodeado.
5. **Actualizar `CLAUDE.md`** (mv_* ya no existen; documentar RPCs de stats).
6. Al migrar a WhatsApp Tech Provider (≥15 clientes): guardar también `waba_id` por negocio (columna nueva).
