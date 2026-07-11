# Infraestructura Supabase — Auditoría Oficial (2026-07-10/11)

> **Documento oficial y definitivo** — reemplaza a `03-infraestructura-supabase.md` (archivado en `docs/audit_performance/`). **Todo verificado en vivo por MCP** contra el proyecto `kwpaaqdkklwwfslhkqpb` en la fecha indicada: advisors, catálogo (`pg_catalog`), cron (`cron.job` + `job_run_details`), tamaños reales.
> Docs hermanos: [Modelo de Negocio.md](Modelo%20de%20Negocio.md) (límites/planes §8) · [Automatización Agente IA.md](Automatización%20Agente%20IA.md) (bot n8n) · [Frontend.md](Frontend.md) · [Auditoria Tecnica Multi-Tenant.md](Auditoria%20Tecnica%20Multi-Tenant.md) (RLS/seguridad profunda).

---

## 1. Resumen ejecutivo

| Área | Estado | Nota |
|---|---|---|
| Motor | ✅ | PostgreSQL **17.6** (aarch64), compute Micro (incluido en Pro), DB total **53 MB**, 19 conexiones activas |
| RLS | ✅ | **30/30 tablas** de `public` con RLS habilitado; 84 políticas; patrón InitPlan `(SELECT fn())` aplicado |
| Advisors seguridad | ✅ | **0 ERROR**. Solo WARNs conocidos y deliberados (§4) + HIBP pendiente [TÚ] |
| Advisors rendimiento | ✅ | Solo INFO `unused_index` (~25) — esperado con volumen ~0; ninguno accionable aún (§6) |
| Cron jobs | ✅ | **9 jobs activos, 0 fallos en 7 días**, todos `succeeded` en su última corrida (§5) |
| Particionado | ✅ | `history` y `audit_log` particionadas por mes: jul/ago/sep 2026 + default; crons de horizonte y limpieza operando |
| Edge Functions | ✅ | 5 ACTIVE: `onboard-tenant` v12, `manage-staff` v7, `admin-list-businesses` v8, `admin-update-business` v8, `wa-human-reply` v3 |
| Funciones SQL | ✅/🟡 | 59 en `public`, 50 SECURITY DEFINER — superficie endurecida en Aud.#1 (apéndice A.1); overloads duplicados por limpiar (§6.2) |
| Backups | ✅ | Diarios, retención 7 días (incluidos en Pro). PITR NO activado (correcto: cuesta $100/mes) |
| Metering | 🔴 | `usage_counters` = 0 filas — la infra de metering existe y funciona pero nadie la alimenta (H1, ver Modelo de Negocio §8) |

**Veredicto:** la infraestructura está **sana, limpia y sobredimensionada** para el volumen actual (2 negocios). No hay deuda de infraestructura bloqueante; la deuda real está en la capa de integración (bot↔metering) y está rastreada en el [Backlog](Backlog%20Maestro.md).

---

## 2. Inventario de tablas (en vivo, con RLS y políticas)

| Tabla | Tamaño | Filas | RLS | Políticas | Nota |
|---|---|---|---|---|---|
| `audit_log` (part. y2026m07/08/09 + default) | ~280 kB | 24 | ✅ | 2 c/u | Trigger `trigger_audit_log` en 10+ tablas |
| `history` (part. y2026m07/08/09 + default) | ~120 kB | 2 | ✅ | 2 c/u | Retención por plan (3/3/12 meses, cron diario) |
| `patients` / `patient_phones` | 128/72 kB | 2/2 | ✅ | 4/3 | Soft-delete (`deleted_at`); teléfono sin "+" (formato wa_id) |
| `appointments` | 80 kB | 0 | ✅ | 4 | Anti double-booking por constraint; triggers de límite |
| `expense_entries` / `income_entries` | 128/80 kB | 2/0 | ✅ | 3/3 | `category_id` FK → `finance_categories` (SET NULL) |
| `finance_categories` | 64 kB | 10 | ✅ | 4 | Nueva 2026-07-06; RLS clonada de supplies + gate dunning |
| `businesses` | 72 kB | 2 | ✅ | 2 | UPDATE por columnas (grant restrictivo tras Auditoría Técnica) |
| `staff_users` / `staff_roles` | 80/48 kB | 2/4 | ✅ | 4/2 | RBAC por JSONB `permissions` |
| `plans` | 48 kB | 3 | ✅ | 1 | Solo-lectura para clientes; ⚠️ precios aún v2 (pendiente UPDATE v3) |
| `notifications` | 96 kB | 2 | ✅ | 4 | Retención por cron |
| `message_buffer` | 80 kB | 0 | ✅ | 3 | Debounce del bot; cron limpia cada minuto |
| `services` / `supplies` / `service_supplies` / `offers` | 48-24 kB | 0 | ✅ | 4 c/u | ⚠️ negocio de prueba sin services (bloquea test E2E del bot) |
| `usage_counters` | 16 kB | **0** | ✅ | 1 | 🔴 vacía — H1 metering |
| `payments` | 24 kB | 0 | ✅ | **0** | Deny-all deliberado (solo service_role) |
| `api_rate_limits` | 40 kB | 1 | ✅ | **0** | Deny-all deliberado (solo service_role) |
| `app_super_admins` | 32 kB | 1 | ✅ | **0** | Deny-all deliberado (fuente de verdad del super-admin) |

**Patrón de las 3 tablas "sin políticas":** RLS habilitado + cero políticas = **denegar todo** a anon/authenticated; solo service_role (que bypasea RLS) las toca. Es hardening intencional, no un hueco — el advisor las lista como INFO, no como error.

## 3. Extensiones (9)

`pg_cron 1.6.4` (9 jobs) · `pg_trgm 1.6` + `unaccent 1.1` (búsqueda de pacientes `search_patients`) · `btree_gist 1.7` (constraint anti double-booking) · `pgcrypto` · `pg_stat_statements` (diagnóstico) · `supabase_vault 0.3.1` (disponible, sin uso — candidato futuro para `whatsapp_token`) · `uuid-ossp` · `plpgsql`.

## 4. Seguridad (advisors en vivo + estado)

- **0 ERROR.** El advisor de seguridad no reporta ningún error — se mantiene desde las correcciones de la Auditoría Técnica y Aud.#1/#2 (apéndice).
- **WARNs presentes y su lectura:**
  - `SECURITY DEFINER ejecutable por anon` ×4: `get_user_business_id`, `is_business_active`, `has_feature`, `user_has_permission` — **deliberado**: son los helpers que evalúan RLS; solo devuelven datos del propio caller (con JWT anon devuelven NULL/false). Documentado en Aud.#1.
  - `SECURITY DEFINER ejecutable por authenticated` ×~30: es la **superficie de API del frontend** (RPCs de stats/finanzas/validaciones) — intencional; el mínimo privilegio se aplicó en Aud.#1 (anon 24→3, authenticated 41→33).
  - `Leaked password protection (HIBP) disabled` — **pendiente [TÚ]**, 1 clic en Studio → Authentication → Policies. En backlog P1 desde 07-06.
- **Gap conocido en radar (P1):** `get_visible_patient_ids/staff_ids` confían en el `p_business_id` del parámetro (un authenticated podría pasar otro id y obtener UUIDs opacos ajenos). Fix: forzar `p_business_id := get_user_business_id()` dentro.
- **Suspensión con dientes:** `is_business_active()` en las políticas de escritura de 10 tablas de producto (verificado en `pg_policies`).

## 5. Cron jobs (9 — verificados con `job_run_details`, 0 fallos en 7 días)

| Job | Schedule | Última corrida | Status |
|---|---|---|---|
| `clean-message-buffer` | cada minuto | 2026-07-11 03:28 | ✅ succeeded |
| `clean-api-rate-limits` | 03:20 diario | 2026-07-11 | ✅ |
| `retain-notifications` | 03:25 diario | 2026-07-11 | ✅ |
| `retain-history` | 03:30 diario | 2026-07-10 | ✅ |
| `retain-audit-log` | 09:00 diario | 2026-07-10 | ✅ |
| `run-dunning` | 08:00 diario | 2026-07-10 | ✅ (sin efecto hasta setear `plan_expires_at` — H5) |
| `ensure-future-partitions` | domingos 03:00 | 2026-07-05 | ✅ |
| `drop-old-partitions` | día 1 03:15 | (aún sin primera corrida — creado post 1-jul) | pendiente natural |
| `reset-usage-ai-pause` | día 1 00:05 | 2026-07-01 | ✅ |

## 6. Rendimiento

### 6.1 Estado
Solo INFO `unused_index` (~25). Con 2 negocios y ~0 filas es **ruido esperado** — los índices compuestos calientes (`history`, `audit_log`, `appointments`) se diseñaron para el patrón de query, no para el volumen actual. **No borrar nada todavía**; re-evaluar con la prueba de carga sintética (backlog P2, Aud.#3 la dejó diseñada).

### 6.2 Única limpieza accionable: overloads duplicados
El advisor evidencia **firmas dobles** de 5 RPCs de stats: `get_patient_ltv`, `get_retention_rate`, `get_service_analytics`, `get_appointment_prediction`, `get_stats_dashboard` (versión vieja `p_months integer` y nueva `p_start_date/p_end_date`). El frontend usa las de fechas. **Recomendación [IA]:** verificar con grep qué firma llama `supabaseService.js` y dropear la obsoleta de cada una (5 `DROP FUNCTION` — evita ambigüedad futura de PostgREST, el mismo tipo de bug que ya mordió con `get_available_slots`).

### 6.3 Cobertura de índices de las queries calientes (verificada estructuralmente, Aud.#3 2026-07-06)

| Query caliente | Filtro/orden | Índice que la cubre | Veredicto |
|---|---|---|---|
| Calendario | `business_id=X AND date_start ∈ [a,b)` | `idx_appt_business_date (business_id, date_start DESC)` | ✅ prefijo+orden |
| Anti-doble-booking | overlap por rango | `appt_no_overlap` GIST `(business_id, tstzrange)` parcial | ✅ |
| Conversaciones | `biz+patient ORDER BY created_at DESC` | `idx_history_biz_patient_created` | ✅ calce exacto |
| Actividad (audit) | `biz ORDER BY created_at DESC` | `idx_audit_biz_created` | ✅ |
| Lista pacientes | `biz AND deleted_at IS NULL ORDER BY created_at DESC` | `idx_patients_business_active_created` parcial | ✅ |
| Búsqueda paciente | trigram/ILIKE | `idx_patients_name_trgm` GIN | ✅ |
| Finanzas | `biz ORDER BY occurred_at DESC` | `idx_income/expense_business_occurred` | ✅ |

Sin índices faltantes para el patrón de acceso actual. La prueba de carga con datos sintéticos (`EXPLAIN ANALYZE` en branch, 5×2,000 filas) queda cost-gated → backlog P2 (hoy, con tablas casi vacías, el planner elige seq scan y es lo correcto).

### 6.4 Capacidad
Micro (2-core/1GB, incluido) aguanta 10-30 tenants de este perfil. Señal para subir a Small (+$5): latencia sostenida en dashboard con ~10 tenants activos. DB 53 MB — el particionado + retenciones mantienen el crecimiento plano.

## 7. Edge Functions (5, todas ACTIVE, `verify_jwt: true`)

| Función | v | Rol |
|---|---|---|
| `onboard-tenant` | 12 | Alta atómica de tenant (negocio+roles+auth+staff, rollback total); auth dual super-admin |
| `admin-list-businesses` / `admin-update-business` | 8/8 | Panel super-admin (service_role server-side; el cliente jamás ve columnas sensibles) |
| `manage-staff` | 7 | CRUD de staff con permisos |
| `wa-human-reply` | 3 | Respuesta humana desde el dashboard → WhatsApp (usa `businesses.whatsapp_token`) |

## 8. Hallazgos y acciones (todo rastreado en [Backlog Maestro.md](Backlog%20Maestro.md))

| # | Sev | Hallazgo | Acción |
|---|---|---|---|
| I-1 | 🔴 | `usage_counters` vacía (= H1 del Modelo de Negocio): la infra de metering está lista pero sin productor | Cablear `record_usage` en n8n |
| I-2 | 🟠 | `plans` aún con precios v2 (Q999/1,000 msgs) — la v3 está decidida | `UPDATE plans` con confirmación + des-hardcodear `AdminOnboarding` |
| I-3 | 🟠 | `plan_expires_at` NULL en los 2 negocios → `run-dunning` corre pero nunca actúa (H5) | Setear vencimiento en alta/cobro + botón "Marcar pagado" |
| I-4 | 🟡 | 5 RPCs de stats con overload duplicado (firma vieja `p_months`) | 5 `DROP FUNCTION` tras verificar uso ([IA]) |
| I-5 | 🟡 | HIBP desactivado | 1 clic [TÚ] en Studio |
| I-6 | 🟡 | `get_visible_*_ids` confían en el parámetro | Forzar `get_user_business_id()` interno ([IA]) |
| I-7 | 🟡 | `supabase_vault` instalada sin uso; `whatsapp_token` en texto plano (decisión deliberada para no romper n8n) | Mantener en radar; migrar al pasar a Tech Provider |
| I-8 | 🟡 | Negocio de prueba sin `services` → bloquea el test E2E del bot | Sembrar 2-3 servicios ([IA], 1 min) |

---

## Apéndice — Referencia de las auditorías 2026-07-06 (absorbido del ex-doc 07)

### A.1 Mapa función → rol permitido (Aud.#1, migración `audit1_least_privilege_execute_grants`)
Resultado: ejecutables por `anon` **24 → 3** · por `authenticated` **41 → 33**. Advisor sin ERROR desde entonces.

| Grupo | Funciones | Rol final |
|---|---|---|
| RPCs de stats del frontend | `get_patient_stats`, `get_appointment_trend`, `get_patient_ltv`×2, `get_retention_rate`×2, `get_service_analytics`×2, `get_appointment_prediction`×2, `get_stats_dashboard`×2, `get_visible_patient_ids/staff_ids` | authenticated |
| RPCs solo-bot | `create_appointment`, `get_available_slots`, `get_patient_appointments`, `get_patient_profile`, `reactivate_bot` | **service_role** |
| Funciones de trigger | `enforce_*_limit`×3, `finance_guard`, `trigger_audit_log`, `trigger_set_updated_at`, `validate_appointment`, `prevent_mass_delete`, etc. | solo owner (trigger) |
| Helpers de RLS (quedan abiertos a propósito) | `get_user_business_id`, `is_business_active`, `has_feature`, `user_has_permission`, `get_effective_limit` | anon/auth — solo devuelven datos del propio caller |
| Mantenimiento | `record_usage`, `check_rate_limit`, `run_dunning`, `record_payment`, `create_monthly_partition`, `ensure_future_partitions`, `drop_old_partitions`, `apply_history_retention` | service_role |

### A.2 Migraciones clave de esa sesión
`harden_plans_revoke_write_grants` (plans solo-lectura) · `audit1_least_privilege_execute_grants` · `audit2a_dunning_foundation` (payments + record_payment + run_dunning + is_business_active active/trial) · `audit2b_rls_suspend_writes` (suspensión con dientes, RLS escritura en 9 tablas — hoy 10 con `finance_categories`).

### A.3 Verificaciones registradas
Dunning por impersonación: `active_escribe: true` / `suspended_bloqueado: true` ✓ · límites: bot crea paciente #51 en Básico ✓, dashboard bloqueado ✓, `get_visible_patient_ids` devuelve exactamente 50 ✓.
