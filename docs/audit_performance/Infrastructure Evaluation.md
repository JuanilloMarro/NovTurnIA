# NovTurnAI — Evaluación de Estado

> Versión: 1.4 · Fecha: 2026-06-30
> Escala 0–10 · 🔴 Bloqueante · 🟠 Importante · 🟡 Deseable · ✅ Resuelto
> **v1.4:** auditoría de los módulos nuevos (Finanzas, búsqueda de pacientes, RBAC granular). Ver [§1.10 Auditoría de módulos nuevos](#110-auditoría-de-módulos-nuevos-2026-06-30).

---

## Resumen Ejecutivo

| Área                        | Puntaje  | Tendencia |
|-----------------------------|----------|-----------|
| Base de datos (Supabase)    | 9.8/10   | = Módulo Finanzas auditado (RLS business-scoped OK, DELETE bloqueado en ledgers); RPCs nuevos hardened (anon revocado) |
| Dashboard React + Vite      | 9.2/10   | ↑ RBAC granular (31 flags), flujo validación de ingresos en 2 pasos, búsqueda de pacientes con ranking |
| Bot / N8N Workflow          | 9.5/10   | Estable   |
| Infraestructura / Despliegue| 8.0/10   | Estable   |
| Producto / SaaS             | 8.7/10   | Estable   |
| Resiliencia                 | 7.2/10   | Estable   |
| Modelo de negocio           | 6.5/10   | ↑ Plans + costos definidos, falta Stripe |
| **PROMEDIO GLOBAL**         | **8.9/10** |         |

**Estado:** Apto para producción con clientes controlados. Auditoría completa — 12 bugs corregidos. Para cobro automático falta Stripe (T-03).

---

## 1. Base de Datos (Supabase) — 9.8/10

> Auditoría vía Supabase MCP (advisors security + performance, pg_policies, pg_proc, pg_triggers, cron.job). BD-01 a BD-04, BD-06 a BD-08 resueltos. Migración 018 arregló leak cross-business en tablas core.

### Puntaje desglosado

| Sub-área                       | Puntaje | Notas |
|--------------------------------|---------|-------|
| 1.1 Estructura y normalización | 9.5     | UUID multi-tabla, particiones mensuales |
| 1.2 Seguridad RLS              | 9.8     | ↑ `USING(true)` eliminado en appointments/patients/services/staff_users — ahora `business_id = get_user_business_id()` |
| 1.3 SECURITY DEFINER hygiene   | 9.0     | RPCs admin/triggers sin acceso desde cliente; RPCs nuevos de Finanzas/búsqueda con `anon` revocado (F-01). Pendiente F-03: 12 funciones viejas sin `search_path` |
| 1.4 Rendimiento e índices      | 9.8     | Índice `notifications.appointment_id` creado |
| 1.5 Integridad y triggers      | 9.5     | EXCLUDE constraint anti-doble-booking, audit + notify + validate |
| 1.6 Automatización (pg_cron)   | 9.5     | Jobs duplicados y stale eliminados |
| 1.7 Edge Functions             | 9.0     | Ambas con `verify_jwt`, `manage-staff` v3 con rollback atómico |
| 1.8 Auth hardening             | 8.5     | HIBP leaked-password protection deshabilitado (toggle manual) |
| 1.9 Extensions schema          | 9.5     | `btree_gist` y `pg_trgm` movidas a `extensions` schema |

---

### 1.1 Tablas (`public`) — 17 lógicas + 16 particiones

| Tabla              | RLS | Filas | Función |
|--------------------|-----|-------|---------|
| `businesses`       | ✅  | 4     | Tenant raíz (UUID PK) |
| `plans`            | ✅  | 4     | Tiers free/starter/pro/enterprise |
| `staff_roles`      | ✅  | 8     | Permisos granulares (31 flags) por rol — +10 acciones granulares (Ofertas, vaciar/eliminar chat, responder, borrar turno, etc.) |
| `staff_users`      | ✅  | 7     | Usuarios del dashboard |
| `patients`         | ✅  | 29    | Pacientes (soft delete vía `deleted_at`) |
| `patient_phones`   | ✅  | 24    | Teléfonos N:1 paciente |
| `services`         | ✅  | 20    | Catálogo servicios + duración |
| `offers`           | ✅  | —     | Ofertas/promos 1:1 con servicios (dynamic_pricing) |
| `supplies`         | ✅  | —     | 🆕 Catálogo de insumos (costo unitario) — Finanzas |
| `service_supplies` | ✅  | —     | 🆕 Receta/BOM: insumos por servicio — Finanzas |
| `income_entries`   | ✅  | —     | 🆕 Libro de ingresos (snapshot inmutable, DELETE bloqueado) — Finanzas |
| `expense_entries`  | ✅  | —     | 🆕 Libro de egresos (snapshot inmutable, DELETE bloqueado) — Finanzas |
| `appointments`     | ✅  | 29    | Turnos (EXCLUDE constraint anti-doble-booking) |
| `notifications`    | ✅  | 27    | Bell del dashboard |
| `message_buffer`   | ✅  | 0     | Cola N8N entre mensajes WhatsApp |
| `api_rate_limits`  | ✅  | 39    | Sliding-window de `check_rate_limit()` — acceso solo vía SECURITY DEFINER |
| `history`          | ✅  | 0     | Padre particionado mensual (24 + 112 filas en 2026m03/m04) |
| `audit_log`        | ✅  | 0     | Padre particionado mensual (104 + 346 filas en 2026m03/m04) |

Particiones creadas hasta `2026m10` + `_default`. Job semanal `ensure_future_partitions(6)` mantiene 6 meses adelantados.

---

### 1.2 RLS Policies — patrón unificado `business_id = get_user_business_id()`

| Tabla              | SELECT | INSERT | UPDATE | DELETE | Notas |
|--------------------|:------:|:------:|:------:|:------:|-------|
| `appointments`     | ✅ | ✅ | ✅ | — | DELETE bloqueado, se usa soft-cancel |
| `patients`         | ✅ | ✅ | ✅ | ✅ | DELETE solo para GDPR Art. 17 |
| `patient_phones`   | ✅ | ✅ | ✅ | — | |
| `services`         | ✅ | ✅ | ✅ | ✅ | |
| `offers`           | ✅ | ✅ | ✅ | ✅ | Vista `services_with_active_offer` con `WHERE business_id = get_user_business_id()` |
| `supplies`         | ✅ | ✅ | ✅ | ✅ | 🆕 Catálogo — DELETE permitido |
| `service_supplies` | ✅ | ✅ | ✅ | ✅ | 🆕 BOM — DELETE permitido |
| `income_entries`   | ✅ | ✅ | ✅ | — | 🆕 DELETE bloqueado (soft-void `status`); `WITH CHECK = get_user_business_id()` |
| `expense_entries`  | ✅ | ✅ | ✅ | — | 🆕 DELETE bloqueado (soft-void `status`) |
| `staff_users`      | ✅ | ✅ | ✅ | — | DELETE vía Edge Function |
| `staff_roles`      | ✅ | — | ✅ | — | INSERT/DELETE bloqueados (catálogo fijo) |
| `notifications`    | ✅ | ✅ | ✅ | ✅ | |
| `message_buffer`   | ✅ | ✅ | — | ✅ | UPDATE no necesario |
| `history` (todas)  | ✅ | ✅ | — | — | Append-only |
| `audit_log` (todas)| ✅ | ✅ | — | — | Append-only + retención 90d |
| `businesses`       | ✅ | — | ✅ | — | INSERT vía Edge Function `onboard-tenant` |
| `plans`            | ✅ | — | — | — | Lectura pública (catálogo) |
| `api_rate_limits`  | ✅ | ✅ | ✅ | ✅ | Solo accesible vía `check_rate_limit()` — `REVOKE ALL` para `anon`/`authenticated` |

---

### 1.3 RPCs (PL/pgSQL en `public`)

#### Helpers RLS (uso interno, OK como SECURITY DEFINER)
| Función | Propósito |
|---------|-----------|
| `get_user_business_id()` | Devuelve `business_id` del JWT — pivote de toda la RLS |
| `get_my_business_id()` | Idem, alias usado por algunas RPCs |
| `is_business_active()` | Gate de suspensión/cancelación de plan |

#### Lecturas de dashboard
| Función | Propósito |
|---------|-----------|
| `get_stats_dashboard(month_start, month_end)` | KPIs en 1 round-trip (3→1) |
| `get_appointment_trend(biz, granularity, start, end)` | Gráfico tendencia agrupada |
| `get_business_stats()`, `get_patient_stats()` | Agregados generales |
| `get_available_slots(biz, date, duration)` | Slots libres del calendario |
| `get_patient_appointments(biz, patient)` | Historial de un paciente |
| `get_plan_limits(biz)` | Límites + uso vivo (`patients_used`, `staff_used`) |

#### Escrituras transaccionales
| Función | Propósito |
|---------|-----------|
| `create_patient_with_phone(biz, name, phone)` | Paciente + teléfono atómico |
| `create_appointment(biz, patient, service, start, end)` | Cita validada |
| `reactivate_bot(patient_id)` | Quita `human_takeover` |
| `suspend_tenant(biz, status, reason)` | Ciclo de vida del cliente |
| `check_rate_limit(key, window)` | Sliding-window de N8N/staff |

#### 🆕 Finanzas y búsqueda (`SECURITY DEFINER`, scope `get_user_business_id()`, `anon` revocado, `search_path` fijo)
| Función | Propósito |
|---------|-----------|
| `submit_income_validation(appt, amount, method, notes)` | Cobra un turno → ingreso `pending` (atómico, `FOR UPDATE`, snapshot nombre+costo) |
| `confirm_income_validation(id)` | Valida el ingreso `pending → confirmed` (recién ahí cuenta en KPIs) |
| `void_income_entry(id, reason)` / `void_expense_entry(id, reason)` | Soft-void (anula `pending` o `confirmed`) |
| `get_pending_validations()` | Cola "Por confirmar" con joins cliente/turno/servicio |
| `get_finance_summary(start, end, gran)` / `get_finance_trend(...)` | KPIs + serie temporal (solo cuentan `status='confirmed'`) |
| `search_patients(q, limit)` | Typeahead con ranking, `unaccent`, trigram y teléfono |
| `v_service_cost` (vista) | Σ BOM por servicio — `security_invoker = on` (respeta RLS del caller) |

#### Mantenimiento (solo invocables por `service_role`)
| Función | Propósito |
|---------|-----------|
| `create_monthly_partition(parent, date)` | Crea partición de un mes |
| `ensure_future_partitions(months_ahead)` | Mantiene N meses adelantados |
| `prevent_mass_delete()` | Trigger anti-borrado masivo (>50 filas) |
| `validate_appointment()` | Trigger BEFORE — valida fechas/servicio |
| `trigger_set_updated_at()` | Auto `updated_at` |
| `trigger_audit_log()`, `handle_audit_log()` | Escribe en `audit_log` particionado |
| `trigger_add_notification()`, `handle_new_staff_user()` | Notificaciones + alta de staff |

---

### 1.4 Índices y rendimiento

- ✅ Índices en todos los `business_id` (multi-tabla) — pivote RLS
- ✅ Índices `name_trgm` (pg_trgm) en `patients` para búsqueda fuzzy
- ✅ EXCLUDE GIST anti-doble-booking en `appointments` (requiere `btree_gist`)
- ✅ `notifications.appointment_id` — índice `idx_notifications_appointment_id` creado
- ✅ `btree_gist` y `pg_trgm` movidas a `extensions` schema
- ℹ️ ~25 índices "unused" reportados — son particiones futuras vacías (m05–m10), comportamiento esperado

---

### 1.5 Triggers activos

| Tabla         | Triggers |
|---------------|----------|
| `appointments`| `audit_appointments` (I/U/D), `notify_new_appointment` (I), `prevent_mass_cancel` (U), `validate_appointment` (BEFORE I/U), `set_updated_at` |
| `patients`    | `audit_patients` (I/U/D), `notify_patient_events` (I/U), `set_updated_at` |
| `staff_roles` | `trg_audit_staff_roles` (U) — audit trail de cambios de permisos, `set_updated_at` |
| `staff_users` | `set_updated_at` |
| `businesses`, `services` | `set_updated_at` |

---

### 1.6 pg_cron jobs

| Job | Schedule | Estado |
|-----|----------|--------|
| `clean-message-buffer` | `* * * * *` | ✅ |
| `retain-audit-log` | `0 9 * * *` | ✅ borra >90 días |
| `ensure-future-partitions` | `0 3 * * 0` | ✅ |

---

### 1.7 Edge Functions

| Slug | Versión | `verify_jwt` | Rol |
|------|:-------:|:------------:|-----|
| `manage-staff`   | v3 | ✅ | Alta/edit/baja staff con rollback atómico (Auth user + DB row) |
| `onboard-tenant` | v1 | ✅ | Crea `business` + primer `staff_user` |

---

### 1.8 Auth hardening

- ✅ Password mínimo 8 caracteres (T-27)
- ✅ JWT con `business_id` claim usado por todas las RLS
- 🟠 HIBP leaked-password protection deshabilitado — activar en Auth → Policies (1 toggle, pendiente manual)

---

### 1.10 Auditoría de módulos nuevos (2026-06-30)

> Inspección vía Supabase MCP de lo agregado desde v1.3: **Finanzas** (4 tablas + RPCs + flujo de validación en 2 pasos), **búsqueda de pacientes** (`search_patients`) y **RBAC granular**. Advisors security: 93 hallazgos (42 `authenticated_security_definer` — por diseño; 36 `anon_security_definer`; 12 `search_path_mutable`; 1 view ERROR; 1 HIBP).

#### Verificado ✅
- ✅ **RLS de las 4 tablas de Finanzas correcta**: SELECT/INSERT(`WITH CHECK`)/UPDATE todas con `business_id = get_user_business_id()`. Sin `USING(true)`, sin leak cross-tenant.
- ✅ **Ledgers append-only**: `income_entries` / `expense_entries` sin policy DELETE → DELETE denegado por RLS (solo soft-void vía `status`). Idempotencia por índice único parcial `uq_income_appointment_active` (un ingreso pending/confirmed por turno).
- ✅ **RPCs nuevos**: `SECURITY DEFINER` + `search_path` fijo + scope forzado por `get_user_business_id()`. KPIs cuentan solo `status='confirmed'` → el cobro `pending` no infla ingresos hasta validarse.
- ✅ **Backfill RBAC**: 10 permisos nuevos sembrados en `staff_roles`; admin (`manage_roles`) conserva todo; los no-admin preservan su comportamiento previo (cada clave hereda del permiso que antes la cubría).
- ✅ `unaccent` en schema `extensions`; índice GIN trigram `idx_patients_display_trgm`.

#### Hallazgos
| ID | Sev | Hallazgo | Estado |
|----|-----|----------|--------|
| F-01 | 🟠 | 4 RPCs nuevos (`search_patients`, `submit_income_validation`, `confirm_income_validation`, `get_pending_validations`) eran ejecutables por `anon` (vía `PUBLIC`) — inconsistente con el hardening de finanzas | ✅ **Corregido**: `REVOKE … FROM PUBLIC` + `GRANT … TO authenticated, service_role` (ahora `anon_exec=false`) |
| F-02 | 🟡 | Advisor ERROR `security_definer_view` en `services_with_active_offer` | ℹ️ **No es leak**: la vista filtra `WHERE s.business_id = get_user_business_id()` en su cuerpo. Opcional `ALTER VIEW … SET (security_invoker = on)` para silenciar el advisor |
| F-03 | 🟡 | 12 funciones viejas (`get_stats_dashboard`, `get_service_analytics`, `get_patient_ltv`, `get_appointment_trend`, triggers de offers/plans…) sin `SET search_path` | Pendiente — **pre-existente**, no de los módulos nuevos. Hardening recomendado |
| F-04 | ℹ️ | `rls_enabled_no_policy` en `api_rate_limits` | Intencional (deny-all + acceso solo vía `check_rate_limit()`) |
| F-05 | 🟠 | **Índice trigram duplicado** en `patients`: `idx_patients_display_trgm` (creado para `search_patients`) era idéntico al `idx_patients_name_trgm` preexistente | ✅ **Corregido**: `DROP INDEX idx_patients_display_trgm` (el viejo ya cubre la búsqueda) |
| F-06 | ℹ️ | FKs sin índice de cobertura en `income_entries`/`expense_entries` (`patient_id`, `service_id`, `supply_id`, `created_by`) | Diferido — tablas casi vacías; los índices `(business_id, occurred_at/status)` y `appointment_id` ya cubren las queries reales. Agregar al crecer el volumen |
| F-07 | 🟡 | `multiple_permissive_policies` en `message_buffer` (policies duplicadas `buffer_*` + `message_buffer_*`) | Pendiente — **pre-existente**, consolidar policies |

> **Veredicto:** sin bugs funcionales ni leaks de RLS en lo nuevo. Los 2 items accionables introducidos por los cambios recientes (F-01 grants, F-05 índice duplicado) quedaron corregidos. F-02/F-03/F-06/F-07 son pre-existentes o diferidos y no representan exposición de datos ni problema a la escala actual.
>
> Advisors performance: 0 índices duplicados restantes tras F-05; el resto son `unused_index` (esperado en tablas nuevas/particiones futuras vacías).

---

### Pendientes de la BD para deploy

| ID    | Severidad | Acción | Estado |
|-------|-----------|--------|--------|
| BD-05 | 🟠 | Activar HIBP leaked-password protection en Auth → Policies (toggle manual en dashboard) | Pendiente |
| BD-06 | 🟡 | F-03: agregar `SET search_path` a las 12 funciones viejas sin él (hardening) | Pendiente |

**Veredicto BD:** Apta para producción. Solo queda BD-05 — toggle manual en el dashboard de Supabase.

---

## 2. Dashboard React + Vite — 9.1/10

> Auditoría exhaustiva completada 2026-05-04. 12 bugs corregidos (críticos, altos y medios). Pendientes restantes son solo de calidad/DX.

### Estado actual

| Sub-área                  | Puntaje | Estado |
|---------------------------|---------|--------|
| Arquitectura de componentes | 9.3   | ✅ |
| Seguridad RBAC            | 9.5     | ✅ |
| Estado global (Zustand)   | 8.0     | ✅ |
| Experiencia de usuario    | 9.0     | ↑ Bugs MEDIUM corregidos |
| Corrección en runtime     | 9.2     | ↑ Crashes y leaks corregidos |

### Hechos clave
- Separación limpia: Pages → Hooks → Service
- Lazy loading en todas las rutas
- 31 permisos granulares por usuario — **gating funcional**: el checkbox en Usuarios muestra/oculta el botón de acción real (no solo visual)
- Plan enforcement: gate en UI al alcanzar límite de pacientes/staff
- `useModalFocus` con focus trap + Escape (WCAG 2.1)
- Validación teléfono Guatemala (+502, 8 dígitos)
- Paginación en Conversations y PatientHistory
- 🆕 Finanzas: flujo de cobro en 2 pasos (turno → `pending` "Por confirmar" → `confirmed`), KPIs solo sobre confirmados
- 🆕 Búsqueda de pacientes desde el 1er carácter (RPC con ranking/unaccent/trigram/teléfono); reemplaza el viejo `ilike %substring%`
- 🆕 FeatureLock con blur uniforme (backdrop-filter, sin corte de bordes) en todos los módulos gated

### Bugs corregidos (2026-05-04)
- ✅ `KanbanBoard.jsx` — revert optimista usaba prop `appointments` en vez del snapshot pre-update (estado se perdía)
- ✅ `AppointmentStatusChart.jsx` — `data.some()` crasheaba si `data` era null/undefined
- ✅ `PatientDrawer.jsx` — sort por `date_start` crasheaba si algún turno tenía `date_start: null`
- ✅ `usePlanLimits.js` — `setIsLoading(false)` corría después de unmount; ahora usa flag `mounted`
- ✅ `getServiceAnalytics` — defensa frontend contra data cross-business en chart de servicios
- ✅ `StatsIntelligence` — gráficos de IA nunca cargaban por parámetro RPC inexistente (`p_start_date`)
- ✅ `MainChart` — navegación por semana congelaba (mismo year/month como deps; agregado `selectedDay`)
- ✅ `ServiceTreemap` — fondo verde de Recharts sangraba; reemplazado con barras custom HTML/CSS

### Bugs MEDIUM corregidos (2026-05-04)
- ✅ `EditAppointmentModal.jsx` — ahora abre con la fecha real del turno en vez de la fecha de hoy
- ✅ `NewAppointmentModal.jsx` — `getServices()` ahora tiene flag `cancelled` para evitar setState post-unmount
- ✅ `Patients.jsx` — si el paciente del URL param no está en la página actual, se hace fetch directo por ID (`getPatientById`)
- ✅ `supabaseService.js` — nueva función `getPatientById` para fetch directo por UUID

### Bugs corregidos (2026-06-30)
- ✅ `search_patients` (RPC) — `RETURNS TABLE … text` vs `patients.display_name varchar(100)` → error `structure of query does not match function result type` en **cada** llamada (tragado por el `catch` del modal → "no salía nada"). Fix: `::text` explícito.
- ✅ `BusinessSettings.jsx` — cambiar el horario no actualizaba el calendario de Turnos: `handleSave` persistía en DB pero no refrescaba el store `businessHours` (Zustand). Fix: `setBusinessHours()` tras guardar (entero→`"HH:MM"`).
- ✅ `BusinessSettings.jsx` — el correo era obligatorio y **bloqueaba** guardar el horario (dependencia cruzada). Fix: correo opcional (solo valida formato si hay valor).
- ✅ `FollowUp.jsx` — en el fondo del `FeatureLock`, el drawer de detalle se posicionaba contra un ancestro distinto al de la lista y la encimaba. Fix: contenedor `relative` compartido.
- ✅ `PatientHistory.jsx` — única página no responsive (dos columnas con `min-w-[300px]` sin stackear). Fix: lista oculta en móvil + conversación full-width + botón volver.

### Pendientes de calidad
- 🟠 `cache: 'no-store'` aplicado al cliente Supabase globalmente — anula HTTP cache en Storage y Auth innecesariamente. Mover a wrapper opt-in solo donde se necesite.
- 🟠 `sourcemap: false` en `vite.config.js` — stack traces en Sentry son ilegibles sin sourcemaps
- 🟡 26 `console.log/error/warn` en 18 archivos llegan a producción sin guard `import.meta.env.DEV`
- 🟡 `key={location.pathname}` en `<Suspense>` fuerza remount en cada navegación — fetch redundante
- 🟡 Sin ESLint configurado
- 🟡 Dark mode pendiente (reversión completa; light mode intacto)

---

## 3. Bot / N8N Workflow — 9.5/10

### Estado actual

| Sub-área                  | Puntaje | Estado |
|---------------------------|---------|--------|
| Seguridad de credenciales | 8.0     | 🟢 |
| Manejo de errores         | 8.0     | 🟠 |
| Message buffering         | 10.0    | ✅ |
| Enrutamiento y flujo      | 9.0     | ✅ |
| Optimización de tokens IA | 9.5     | ✅ |

### Hechos clave
- N8N en Railway/Elestio, aislado del dashboard
- `message_buffer` con RLS SELECT + INSERT + DELETE
- Rate limiting habilitado: `Supabase Request API LR` + `Limit` + `Response API Limit Range`
- Truncado de historial (250 chars) + Flash-Lite pre-agente
- `human_takeover` funcional
- Validación anti-spam / insultos / emojis
- Sort historial por `created_at` (no por `id`)
- WhatsApp $0: usa solo ventana de 24hrs (cliente escribe primero, sin recordatorios salientes)

### Pendientes
- 🔴 Sin logging estructurado de fallos del bot hacia Supabase — errores técnicos mueren silenciosamente
- 🟠 Nodos `Add History` (×12) sin `onError` — fallos no manejados explícitamente

---

## 4. Infraestructura / Despliegue — 8.0/10

### Estado actual

| Sub-área                  | Puntaje | Estado |
|---------------------------|---------|--------|
| Secrets management        | 9.0     | ✅ |
| Hosting / CI-CD           | 8.0     | ✅ |
| Build / bundling          | 8.0     | ✅ |
| CSP / cabeceras           | 7.0     | 🟡 |
| Sourcemaps producción     | 5.0     | 🟠 |

### Hechos clave
- Vercel Free con headers de seguridad y CSP
- `manualChunks` (react / supabase / charts / sentry) + lazy routes
- Todas las credenciales como env vars, `.env` en `.gitignore`
- Sentry integrado en código (`main.jsx`) con redacción PII

### Pendientes
- 🟠 **`VITE_SENTRY_DSN` no configurado en Vercel prod** — código listo, falta la env var (5 min)
- 🟠 **Sourcemaps** — cambiar a `sourcemap: 'hidden'` + upload via Sentry CLI post-build
- 🟠 **Preview deployments apuntan a DB de producción** — configurar branch DB de Supabase en Vercel
- 🟡 CSP permite `'unsafe-inline'` en `script-src` y `style-src` (requerido por Vite/Tailwind)
- 🟡 `index.html` con cambios sin commit (preconnect Supabase + normalización tildes)

---

## 5. Producto / SaaS — 8.7/10

### Estado actual

| Sub-área                    | Puntaje | Estado |
|-----------------------------|---------|--------|
| Multi-tenancy               | 9.5     | ✅ |
| Escalabilidad nuevos clientes | 6.0   | 🟠 |
| Observabilidad por tenant   | 5.0     | 🟠 |
| Ciclo de vida del cliente   | 5.0     | 🟠 |

### Hechos clave
- `business_id` UUID en todas las queries + RLS — no enumerable en URL
- Plan enforcement completo (tabla `plans` + RPC + hook + gate UI)
- GDPR: `gdprDeletePatient` — borrado permanente Art. 17
- Onboarding actualmente manual

### Pendientes
- 🟠 Sin forma de detectar errores silenciosos por tenant
- 🟠 Onboarding sin flujo automatizado — quién crea el `business` y el primer `staff_user` en DB
- 🟠 Ciclo de vida: sin lógica de suspensión, reactivación ni offboarding automático

---

## 6. Resiliencia — 7.2/10

### Estado actual

| Sub-área              | Puntaje | Estado |
|-----------------------|---------|--------|
| Fallbacks             | 6.0     | 🟠 |
| Reintentos / timeouts | 5.0     | 🟠 |
| Picos de carga        | 9.0     | ✅ |
| Realtime disconnect   | 2.0     | 🟠 |
| Error propagation     | 8.0     | ✅ |

### Hechos clave
- `ErrorBoundary` activo
- Errores originales de Supabase preservados con código
- Rate limiting en `createStaffUser` (sliding-window 3/min)
- Cache de pacientes (1 min) y stats (5 min) en Zustand

### Pendientes
- 🟠 Sin banner de reconexión Realtime (código listo en `RealtimeStatusBanner.jsx` — sin activar)
- 🟠 Sin retry automático en fallos de Supabase o N8N

---

## 7. Modelo de Negocio — 6.5/10

### 7.1 Estructura de planes (definida en `PlansModal.jsx`)

| Plan       | Precio  | IA Model            | Usuarios | Mensajes/mes | Clientes |
|------------|---------|---------------------|----------|--------------|----------|
| Básico     | Q499    | Gemini 2.5 Flash Lite | 1      | 500          | 100      |
| Pro        | Q999    | Gemini 2.5 Flash    | 5        | 2,500        | 500      |
| Enterprise | Q1,999  | Gemini 2.5 Pro      | ∞        | Ilimitados   | ∞        |

### 7.2 Costos fijos mensuales (independientes del # clientes)

| Concepto       | Costo USD | Costo Q (a 7.65) |
|----------------|-----------|------------------|
| Supabase Pro   | $25       | Q191             |
| Elestio Pro N8N| $14       | Q107             |
| Vercel Pro     | $20       | Q153             |
| **TOTAL FIJO** | **$59**   | **~Q450**        |

### 7.3 Costo IA por cliente individual

| Plan       | Modelo Gemini       | $/cliente/mes | Q/cliente |
|------------|---------------------|---------------|-----------|
| Básico     | Flash Lite          | $0.006–0.009  | Q0.05–0.07|
| Pro        | Flash               | $0.020–0.031  | Q0.15–0.24|
| Enterprise | Pro                 | $0.084–0.127  | Q0.64–0.97|

### 7.4 Unit economics — margen por 1 cliente

| Plan       | Ingreso | Costo (fijo+IA) | Margen Q | Margen % |
|------------|---------|-----------------|----------|----------|
| Básico     | Q499    | ~Q450           | **Q49**  | **~10%** ⚠️ |
| Pro        | Q999    | ~Q450           | **Q549** | **~55%** ✅ |
| Enterprise | Q1,999  | ~Q451           | **Q1,548**| **~77%** ✅ |

> **Tu hipótesis "1 cliente cubre la mensualidad" es correcta sólo desde Pro hacia arriba.**
> Con 1 cliente Básico, el margen de Q49 lo come fácilmente: Stripe fee (~Q20) + 1 hora de soporte + 1 reembolso ocasional.

### 7.5 Escenarios de break-even y escala

| Cantidad clientes        | Ingreso mensual | Costo total | Margen | Margen % |
|--------------------------|-----------------|-------------|--------|----------|
| 1 Básico                 | Q499            | Q450        | Q49    | 10%      |
| 1 Pro                    | Q999            | Q450        | Q549   | 55%      |
| 5 Básico + 5 Pro         | Q7,490          | Q452        | Q7,038 | 94%      |
| 10 Pro                   | Q9,990          | Q452        | Q9,538 | 95%      |
| 100 Pro                  | Q99,900         | Q474        | Q99,426| 99%      |
| 1 Enterprise             | Q1,999          | Q451        | Q1,548 | 77%      |

### 7.6 Riesgos de costo NO contemplados en el Excel

| Riesgo | Impacto estimado |
|--------|------------------|
| 🔴 **WhatsApp templates salientes** (Enterprise dice "confirmaciones automáticas") | $0.03–0.13 por mensaje template fuera de ventana 24h. 100 confirmaciones/día = **$90–390/mes** por cliente Enterprise |
| 🟠 Stripe fees (3.4% + Q3 por txn) | Pro: ~Q37/mes; Enterprise: ~Q71/mes |
| 🟠 Soporte humano (no facturado) | 1h/cliente/mes ≈ Q50–100 de costo oportunidad |
| 🟠 Email transaccional (Resend) | $0 hasta 3K/mes; $20/mes después |
| 🟡 Dominio + SSL | ~$15/año (despreciable) |
| 🟡 Backups offsite extra | Supabase PITR add-on $10/mes (cuando crezca el data) |

### 7.7 Recomendaciones al modelo de negocio

#### 🔴 Prioridad alta

1. **Subir Básico a Q599 o reducir features.** ✅
   El margen del 10% es insostenible. Propuesta:
   - **Opción A**: Subir a Q599 → margen 25% (más cómodo)
   - **Opción B**: Mantener Q499 pero quitar "Sincronización con Calendarios" e "Integración de Modulos a la Medida" (ambas requieren trabajo custom) ✅

2. **Replantear "Confirmaciones automáticas" en Enterprise.**
   Si implica mensajes salientes WhatsApp fuera de 24h, **destruye el margen** (puede costar $90–390/mes/cliente). Opciones:
   - Limitar a X confirmaciones/mes incluidas, cobrar el resto como overage
   - Usar SMS Twilio o email en vez de WhatsApp template
   - Restringir a confirmaciones DENTRO de la ventana 24h (cuando el cliente ya escribió)

3. **"Página Web" en Enterprise — sacar como add-on.** ✅
   Una web custom no es un feature de SaaS, es un proyecto. Cobrar setup fee Q3,000–5,000 separado o usar template estándar.

4. **Implementar T-03 Stripe.** Sin esto, el cobro manual limita escalabilidad real a ~10 clientes.

#### 🟠 Prioridad media

5. **Agregar plan TRIAL 14 días** del Pro completo. Reduce fricción de venta — estándar SaaS. Sin tarjeta para empezar (hooks: T-03 ya lo permite cuando esté).

6. **Onboarding fee opcional para Enterprise** (Q2,500–5,000 una vez). Cubre setup técnico + capacitación + customización. Mejora cashflow inicial. ✅

7. **Anual con descuento**: 10 meses al precio de 12 (16% off). Mejora retention y LTV. ✅

8. **Naming consistente de modelos IA**: ✅
   - "Gemini 2.5 Flash Pro" no existe — es "Gemini 2.5 Pro" (sin "Flash")
   - Considerar ocultar el nombre técnico al cliente final ("IA Estándar / Avanzada / Premium") ✅

#### 🟡 Mejoras estratégicas

9. **Analizar competencia local**:
   - Calendly: $10–20 USD = Q76–153 → tu Básico (Q499) está 3x arriba
   - Setmore: $0–12 USD = Q0–92 → idem
   - **Diferenciador**: WhatsApp en español + IA contextual + multi-tenant. Justifica el premium, pero comunícalo claro.

10. **Métricas a trackear desde día 1**:
    - MRR (Monthly Recurring Revenue)
    - Churn rate (% cancela/mes) — debajo del 5% mensual es bueno
    - LTV (Lifetime Value) — mínimo 3x CAC
    - CAC (Customer Acquisition Cost)

11. **Caso "1000 clientes" del Excel está sobreestimado en mensajes** (50–75K tokens/cliente/mes). Asegúrate de medir tokens reales en producción para ajustar tier de modelo.

### Pendientes (resumen)
- 🔴 **T-03 Stripe** — sin pagos automáticos, cobro manual limita escalabilidad
- 🔴 Recalcular costo de "Confirmaciones automáticas" Enterprise con escenario WhatsApp template
- 🟠 Definir trial 14 días + plan anual con descuento
- 🟡 Métricas SaaS (MRR/churn/LTV/CAC) sin instrumentar

---

## Checklist de Deployment

### Listo hoy
- [x] RLS en todas las tablas + `business_id` UUID
- [x] Plan enforcement (tabla + RPC + hook + gate UI)
- [x] Particionamiento `history` y `audit_log`
- [x] Lazy routes + chunks separados
- [x] Sentry integrado en código con redacción PII
- [x] ErrorBoundary, focus trap, paginación, rate limit
- [x] Edge Function `manage-staff` con rollback atómico
- [x] N8N con buffer + RLS + rate limiting tokens + WhatsApp $0

### Antes de prod abierta (🟠)
- [ ] Set `VITE_SENTRY_DSN` en Vercel prod — 5 min
- [ ] Sourcemaps `hidden` + upload a Sentry — 30 min
- [ ] Acotar `cache: 'no-store'` a wrapper opt-in — 1h
- [ ] Branch DB Supabase para Vercel previews — 30 min
- [ ] Commit `index.html` pendiente — 5 min

### Post-launch primer mes (🟡)
- [ ] T-03 Stripe (desbloquea cobro automático)
- [ ] T-11 Banner Realtime (código listo)
- [ ] Wrap `console.*` con `import.meta.env.DEV`
- [ ] ESLint config mínima
- [ ] Cleanup scripts SQL stale
- [ ] T-33 Dark mode
- [ ] Logging estructurado de errores del bot hacia Supabase

---

## Porcentaje global

- **~86%** para operar como negocio autónomo
- **~95%** para uso interno o clientes de confianza
- **~68%** para lanzamiento público con cobro automático (falta Stripe)

Camino más corto al 100%: DSN Sentry → sourcemaps → no-store opt-in → commit index.html → branch DB preview **(≈3h)** → T-03 Stripe **(~1 semana)**.
