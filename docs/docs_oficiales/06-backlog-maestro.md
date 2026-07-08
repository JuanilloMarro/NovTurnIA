# Backlog Maestro NovTurnIA — Completadas · Pendientes · Futuras · Plan de Auditorías

> **Fecha:** 2026-07-06 · Documento vivo. Marca `[x]` y anota fecha al completar.
> **Responsable:** **[IA]** = lo puede aplicar el asistente por MCP (DB/edge) · **[TÚ]** = requiere n8n/Vercel/Supabase Studio/Meta · **[MIXTO]** = ambos.
> **Estado del sistema (verificado hoy):** 1 negocio, 1 staff, 1 super-admin, 8 cron jobs, **0 errores** en el advisor de seguridad (quedan WARNs de hardening). Docs base: [00](00-runbook-alta-de-tenants.md)–[05](05-agente-ia-memoria-y-fixes-n8n.md) + [Auditoría Técnica](Auditoria%20Tecnica%20Multi-Tenant.md).

---

## 0. Cómo usar este documento
Cada ítem tiene: `[ ]` estado, **responsable**, **impacto** (🔴 alto / 🟠 medio / 🟡 bajo), y de dónde viene (doc). Trabaja de arriba hacia abajo dentro de cada bloque: **P0 → P1 → P2 → Futuras**. Las auditorías de hoy/mañana están al final (§6).

---

## 1. ✅ COMPLETADAS (registro de lo hecho en estas sesiones)

### Base de datos / Seguridad
- [x] 2 hoyos CRÍTICOS de RLS corregidos: auto-upgrade de plan (`businesses` UPDATE por columna) y escalación RBAC (`staff_roles`/`staff_users`). *(Auditoría Técnica)*
- [x] Superficie `anon` cerrada de verdad: `REVOKE ... FROM PUBLIC` (no solo anon) en RPCs sensibles + `create_appointment`/`get_available_slots`/`get_patient_appointments`. Verificado `anon=false`.
- [x] Vista `services_with_active_offer` → `security_invoker`; `search_path` fijado en 12 funciones (advisor ERROR eliminado).
- [x] `reactivate_bot` reescrito (uuid + esquema real); fósiles dropeados (`get_my_business_id`, `suspend_tenant(int)`, `get_available_slots(int)`, `handle_new_staff_user`).
- [x] RLS *InitPlan*: `(SELECT get_user_business_id())` en todas las políticas; `message_buffer` deduplicada 6→3.

### Infraestructura
- [x] Retención de conversaciones por plan (`history_retention_months`: 3/3/12) + cron diario `retain-history`.
- [x] Particionado: horizonte 6→2 meses, cron mensual `drop-old-partitions`, 16 particiones vacías eliminadas (history/audit → 4 c/u).
- [x] Índices compuestos calientes (history/audit/appointments) + 5 índices FK; 4 redundantes borrados.
- [x] 2 fugas de crecimiento tapadas: `clean-api-rate-limits`, `retain-notifications` (8 crons totales).

### Producto / Onboarding / Límites
- [x] `onboard-tenant` v11: auth dual (`app_super_admins` + secret), normalización de schedule/WhatsApp, permisos owner/secretary alineados a `usePermissions`.
- [x] Repo sincronizado con `admin-list-businesses` / `admin-update-business`.
- [x] Fix del alta "trabada": `adminService.js` con fetch directo + timeout (evita el lock huérfano de gotrue); 406 de super-admin silenciado (`maybeSingle`).
- [x] Precios v2 (Q999 / Q1,999 / Q3,999) + límites (50/150/∞ pac.) con enforcement real por triggers.
- [x] Límite = **solo visualización** para el bot (triggers eximen a service_role); `get_patient_profile` frugal creado.

### Documentación
- [x] Docs 00–05 + Auditoría Técnica + este backlog (06).

---

## 2. 🔴 PENDIENTES P0 — hacer primero (bloquean producción / cobro)

- [ ] **[TÚ] 🔴 Fix rate-limit en n8n** — nodo `DB - Request API Limit` usa key `anon` (revocada) → el bot se cae en cada mensaje al onboardear. Cambiar `apikey`+`Authorization` a service_role. *(doc 05 §1)*
- [ ] **[MIXTO] 🔴 Dunning 7/30 días automático** — hoy `plan_expires_at` no lo lee nada y ningún cron mueve `active→suspended→cancelled`. Crear tabla `payments`, botón "Marcar pagado" (extiende `plan_expires_at`), y cron diario que suspenda/cancele. *(doc 04 #1)*
- [ ] **[IA] 🔴 Suspensión con dientes (server-side)** — usar la huérfana `is_business_active()` en las políticas RLS de escritura → un negocio suspendido queda solo-lectura de verdad (hoy el bloqueo es solo visual). *(doc 04 #2)*
- [ ] **[TÚ] 🔴 Decisión metering** — `record_usage` nunca se llama → panel admin en 0 y `ai_paused` no corta. Cablear el nodo `record_usage` en n8n **o** ajustar el doc 01 para no depender de `ai_paused`. *(doc 05 §1 #4)*

## 3. 🟠 PENDIENTES P1 — siguientes (retención / consistencia / seguridad)

- [ ] **[IA] 🟠 Alerta de churn silencioso** — cron semanal: negocio sin turnos/mensajes en 7 días → `notifications`. *(doc 04 #11)*
- [ ] **[MIXTO] 🟠 Emails transaccionales** — Edge Function + Resend (gratis) sobre `notification_email`: bienvenida, aviso de pago, corte por límite. *(doc 04 #5)*
- [ ] **[TÚ] 🟠 Cablear `Tool - Perfil Paciente Enterprise`** en el Agente Enterprise (usa `get_patient_profile`, ya creado) + regla "solo si cliente recurrente". *(doc 05 §2.2)*
- [ ] **[IA] 🟠 Endurecer funciones SECURITY DEFINER expuestas** — el advisor marca 24 ejecutables por `anon` y 41 por `authenticated`. Revisar una por una y `REVOKE` las que no deban ser públicas (dejar solo las que el frontend/bot realmente llaman). *(advisor security)*
- [ ] **[TÚ] 🟠 Activar "Leaked password protection" (HIBP)** en Supabase Auth (Studio → Authentication → Policies). 1 clic. *(advisor security)*
- [ ] **[TÚ] 🟠 Trial de 14 días self-service** — `plan_status='trial'` + `plan_expires_at` en onboarding; el cron de dunning lo vence. *(doc 04 #3)*
- [ ] **[TÚ] 🟡 Alinear conteos del bot** — `Conversaciones - Contar` cuenta user+assistant (≈2×); gate de turnos usa `created_at` vs `date_start` del trigger; el bot ignora `limit_overrides`. *(doc 05 §1 #5-7)*

## 4. 🟡 PENDIENTES P2 — mejoras (cuando haya holgura)

- [ ] **[TÚ] 🟡 Vault para `whatsapp_token`** (hoy texto plano; diferido para no romper n8n). *(doc 03 §9.1)*
- [x] **[IA] 🟡 Revocar grants de escritura sobre `plans`** a anon/authenticated (RLS ya bloquea; defensa en profundidad). *(2026-07-06, migración `harden_plans_revoke_write_grants`)*
- [ ] **[IA] 🟡 `AdminOnboarding` lee planes de la tabla** en vez del array hardcodeado. *(doc 03 §9.4)*
- [x] **[IA] 🟡 Actualizar `CLAUDE.md`** — mención de `mv_*` inexistentes → corregida a RPCs de stats. *(2026-07-06)*
- [ ] **[IA] 🟡 Búsqueda global (Ctrl+K)** con `pg_trgm` ya instalado. *(doc 04 #8)*
- [ ] **[IA] 🟡 Histórico de consumo** en el panel admin (gráfico sobre `usage_counters`). *(doc 04 #12)*
- [ ] **[MIXTO] 🟡 Rate limiting por tenant** con `check_rate_limit` (clave `wa:{business_id}`). *(doc 04 #10)*
- [ ] **[TÚ] 🟡 Resiliencia frontend** — `withRetry`/backoff + circuit breaker; `cache:'no-store'` a wrapper opt-in. *(Auditoría §9)*
- [ ] **[TÚ] 🟡 Sentry en prod** — `VITE_SENTRY_DSN` en Vercel + sourcemaps ocultos. *(Auditoría §11)*

## 5. 🔮 FUTURAS — roadmap de producto (planificación, no urgente)

### Módulo IA del sistema (Enterprise, pull + cache-first) — *doc 05 §3*
- [ ] `ai_insights` (tabla base) + gate Enterprise.
- [ ] Resumen de seguimiento por paciente (on-demand).
- [ ] Estrategia por cliente (reactivar/upsell/recuperar) con borrador aprobable.
- [ ] Análisis de retención (batch semanal).
- [ ] Narrativa de KPIs (sobre RPCs de stats existentes).
- [ ] Digest semanal del negocio + email.
- [ ] Generación de contenido/ofertas.
- [ ] Chat de negocio en el dashboard (RAG sobre `ai_insights`).

### Otros
- [ ] Memoria semántica pgvector del bot (diferida por costo de tokens). *(doc 05 §2.3)*
- [ ] Stripe (T-03) al pasar ~5 clientes → dunning 100% automático. *(doc 04 #4)*
- [ ] Web Push para handoffs (secretaria sin dashboard abierto). *(doc 04 #6)*
- [ ] Storage: logos + imágenes de WhatsApp que hoy se pierden. *(doc 04 #13)*
- [ ] Export de datos por tenant (churn ordenado / backup lógico). *(doc 04 #9)*
- [ ] Migración a WhatsApp Tech Provider + `waba_id` por negocio (≥15 clientes). *(doc 02 §4)*

---

## 6. 🔍 PLAN DE AUDITORÍAS — sacarle el jugo a Fable 5

> Fable 5 rinde mejor con auditorías **acotadas y verificables** (una superficie por sesión, con evidencia por MCP), no "revisa todo". Estas son de una sesión cada una.

### HOY (fundacionales — cierran los huecos que ya destapamos)
1. **Auditoría de superficie SECURITY DEFINER** *(seguridad, 🔴)*. Revisar las 24+41 funciones que el advisor marca ejecutables por anon/authenticated: para cada una decidir quién debe llamarla (frontend authenticated / bot service_role / nadie) y `REVOKE` el resto. Entregable: migración + tabla "función → rol permitido". *(Yo la ejecuto por MCP.)*
2. **Auditoría de flujo de cobro end-to-end** *(producto, 🔴)*. Trazar `plan_status`/`plan_expires_at` desde el pago hasta el bloqueo (front `AccountStatusModal`, bot `¿Plan Activo?`, RLS). Entregable: diseño cerrado del dunning (tabla `payments` + cron + `is_business_active` en RLS) listo para implementar. *(Base ya en doc 04 #0-2.)*

### MAÑANA (profundidad — rendimiento y correctitud a escala)
3. **Auditoría de rendimiento con datos sintéticos** *(rendimiento, 🟠)*. Sembrar 5 negocios × ~2,000 turnos/pacientes en una branch de Supabase y correr `EXPLAIN ANALYZE` sobre las queries calientes (calendario, conversaciones, stats) para validar que los índices nuevos aguantan. Entregable: reporte de planes de ejecución + índices faltantes si los hay.
4. **Auditoría de resiliencia del bot (n8n)** *(resiliencia, 🟠)*. Revisar cada nodo sin `onError`/`continueOnFail` en rutas críticas (crear paciente/turno, WA send) y qué pasa si Supabase/Meta responden 4xx/5xx: hoy varias rutas cortan la conversación en silencio. Entregable: mapa de nodos frágiles + patrón de manejo (mensaje amable + handoff).
5. **Auditoría de consistencia límites bot↔dashboard** *(producto, 🟡)*. Confirmar que lo que "ve" el cliente (get_visible) y lo que el bot puede crear coinciden con el modelo de negocio en los 3 planes, incluidos `limit_overrides`. Entregable: matriz plan × límite × comportamiento esperado, con pruebas.

### Cadencia sugerida (semanal, recurrente)
- **Advisors de Supabase** (security + performance) — 5 min, cada lunes; que nunca vuelva a aparecer un ERROR.
- **Revisión de crons** — que los 8 jobs corran sin error (log de `cron.job_run_details`).
- **Backlog** — repasar este documento, mover completadas a §1 y re-priorizar.

---

## 7. Índice rápido de documentos
| Doc | Tema |
|---|---|
| [00](00-runbook-alta-de-tenants.md) | Runbook de alta de tenants (dashboard + plan B manual) |
| [01](01-modelo-de-negocio.md) | Modelo de negocio, precios v2, márgenes, break-even |
| [02](02-whatsapp-cloud-api.md) | WhatsApp Cloud API: multi-tenancy, plantillas, costos Meta |
| [03](03-infraestructura-supabase.md) | Infra Supabase: tablas, retención, particiones, RLS |
| [04](04-puntos-de-mejora.md) | 13 puntos de mejora + verificación dunning |
| [05](05-agente-ia-memoria-y-fixes-n8n.md) | Auditoría n8n, memoria frugal, roadmap IA |
| [Auditoría](Auditoria%20Tecnica%20Multi-Tenant.md) | Auditoría técnica multi-tenant + scorecard |
