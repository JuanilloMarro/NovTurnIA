# Backlog Maestro NovTurnIA — Sistema Oficial de Tareas

> **Rol de este documento (desde 2026-07-10):** es el **sistema de tasks del proyecto** — historial de lo completado, pendientes priorizados, y registro de fixes/bugs que vayamos encontrando. Marca `[x]` y anota fecha al completar; los bugs nuevos entran a §1.5 (si ya se corrigieron) o a P0/P1/P2 (si siguen abiertos).
> **Responsable:** **[IA]** = lo puede aplicar el asistente por MCP/API (DB/edge/n8n) · **[TÚ]** = requiere Vercel/Supabase Studio/Meta/UI manual · **[MIXTO]** = ambos.
> **Organización de docs (2026-07-11):** `docs/NovTurnIA Infraestructure/` = **CARPETA OFICIAL ÚNICA** — este backlog + las 6 auditorías/planificaciones por sector: [Modelo de Negocio](Modelo%20de%20Negocio.md), [WhatsApp Api](WhatsApp%20Api.md), [Automatización Agente IA](Automatización%20Agente%20IA.md), [Infraestructura Supabase](Infraestructura%20Supabase.md), [Frontend](Frontend.md), [Auditoria Tecnica Multi-Tenant](Auditoria%20Tecnica%20Multi-Tenant.md) · `docs/audit_performance/` = archivo histórico (00 runbook, 03 infra vieja, 08 spec categorías). La carpeta `docs_oficiales/` fue eliminada: 04 y 07 quedaron absorbidos en el backlog y en los apéndices de Infraestructura/Automatización.
> **Estado del sistema (verificado 2026-07-11):** 1 negocio real + 1 de prueba, 9 cron jobs 0 fallos/7d, 0 errores en el advisor de seguridad, scorecard global **8.1/10** (re-evaluación en Auditoría Técnica). **Todos los sectores quedaron auditados**: DB/multi-tenant ✅, infra ✅, negocio/límites ✅, bot n8n ✅, frontend ✅.

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

### Auditorías 2026-07-06 (Fable 5) — detalle absorbido en [Infraestructura Supabase — Apéndice](Infraestructura%20Supabase.md)
- [x] **Aud.#1 Superficie SECURITY DEFINER**: mínimo privilegio en 30+ funciones; ejecutables por anon **24→3**, por authenticated **41→33**. Tabla función→rol. *(migración `audit1_...`)*
- [x] **Aud.#2 Dunning end-to-end**: `payments` + `record_payment` + cron `run-dunning` (7/30) + `is_business_active`(active,trial) + **suspensión con dientes** (RLS write-gating 9 tablas). Verificado por impersonación (active escribe / suspended bloqueado). *(migraciones `audit2a_/audit2b_`)*
- [x] **Aud.#3 Cobertura de índices**: las 7 queries calientes cubiertas por prefijo+orden; sin índices faltantes (prueba de carga en branch → P2).
- [x] **Aud.#4 Resiliencia n8n**: mapa de ~7 nodos frágiles sin onError + patrón de manejo (documentado para aplicar en n8n).
- [x] **Aud.#5 Consistencia límites**: matriz plan×límite×comportamiento verificada; 3 inconsistencias menores → backlog.
- [x] `plans` solo-lectura para clientes; `CLAUDE.md` corregido (mv_* → RPCs).

### Submódulo Categorías Dinámicas de Finanzas (2026-07-06) — detalle en [doc 08](../audit_performance/08-submodulo-categorias-finanzas.md)
- [x] Tabla `finance_categories` (kind income/expense, RLS+triggers clonados de `supplies`, gate `is_business_active`) + `category_id` FK en `income_entries`/`expense_entries` (`ON DELETE SET NULL`) + seed inicial (7 egreso + 3 ingreso) por negocio. Verificado con 4 probes de rollback.
- [x] Permiso `manage_finance_categories` en toda la pila: `usePermissions`, checkbox en `Users.jsx`, backfill DB (owner=true/secretary=false verificado), `onboard-tenant` v12 redeployado.
- [x] Service layer (`getFinanceCategories`/CRUD) + hook `useFinanceCategories` (clon de `useServices`) + toasts `showCategory*Toast`.
- [x] Tab "Categorías" en Finanzas + `CategoriesSection.jsx` (panel dividido idéntico a Servicios: switch Ingreso/Egreso, buscador, Nuevo, form inline con color).
- [x] Integrado en `RecordExpenseModal`/`RecordIncomeModal` (dropdown dinámico, ya no hardcodeado) y en el display (`ExpenseSection`/`IncomeSection`/`FinanceDetailDrawer` con pill de color).
- [x] Verificación: 13 módulos compilan limpio (sin login), endpoints REST + joins embebidos responden 200. **Pendiente [TÚ]:** probar clic-a-clic autenticado (crear/editar/borrar categoría; registrar ingreso/egreso con categoría).

### Documentación
- [x] Docs 00–05 + 07 (auditorías) + 08 (categorías finanzas) + Auditoría Técnica + este backlog (06).
- [x] **Reorganización de docs (2026-07-10):** `docs_oficiales/` = solo investigaciones/auditorías + backlog; planificaciones (04, 05, 08) movidas a `docs/NovturnIA/`.

### Auditorías finales por sector (2026-07-10/11) — sistema 100% auditado
- [x] **Auditoría de infraestructura Supabase** (en vivo: advisors 0 ERROR, 30/30 tablas RLS, 9 crons 0 fallos, particiones, 5 edge functions) → [Infraestructura Supabase.md](Infraestructura%20Supabase.md); hallazgos I-1…I-8 integrados abajo.
- [x] **Auditoría de Frontend** (estática exhaustiva: 0 console.log, 0 XSS, lazy+ErrorBoundary+manualChunks OK; hallazgos F-1…F-8) → [Frontend.md](Frontend.md).
- [x] **Auditoría de límites/planes** (DB+front+bot, H1-H8) + **benchmarking Guatemala** + **pricing v3 decidido** → [Modelo de Negocio.md](Modelo%20de%20Negocio.md).
- [x] **Re-evaluación de la Auditoría Técnica**: scorecard 7.2 → **8.1/10**; los 3 hallazgos CRÍTICO/ALTO originales cerrados → [Auditoria Tecnica Multi-Tenant.md](Auditoria%20Tecnica%20Multi-Tenant.md) §Re-evaluación.
- [x] Reorganización final de docs: carpeta oficial única + doc 05 absorbido (Parte C de Automatización), 01/02/03 reemplazados por los oficiales.

### Fixes n8n en vivo (2026-07-10) — aplicados por API contra el workflow activo `NovTurnAI`
- [x] **[IA] 🔴 Rate-limit del bot reparado** — nodo `DB - Request API Limit` usaba la key `anon` (revocada) → 401 en cada mensaje. Cambiada a service_role vía PUT a la API de n8n; verificado con diff (solo ese nodo cambió de 143).
- [x] **[IA] 🔴 Gate "¿Teléfono Negocio Existe?" reconectado** — corría DESPUÉS de `Plan - Obtener` (no protegía nada): un `phone_number_id` no registrado tronaba con `invalid input syntax for type uuid: "undefined"` (ejecuciones #368/#369). Ahora: `Negocio - Obtener → ¿Existe? → Plan - Obtener`. Verificado con diff (solo 3 conexiones cambiaron, 0 nodos).
- [x] **[IA] Número sandbox de Meta registrado** — `phone_number_id 1073994989122190` (número de pruebas de la app) asignado a "Clínica Doc (Prueba Enterprise)" para pruebas end-to-end con WhatsApp real.
- [x] Verificado en ejecución #370: flujo completo OK hasta el agente (negocio→plan→gates→buffer→paciente creado→historial→Agente Enterprise responde).

---

## 2. 🔴 PENDIENTES P0 — hacer primero (bloquean producción / cobro)

- [x] **[IA] 🔴 Fix rate-limit en n8n** — ✅ HECHO 2026-07-10 por API (ver §1 "Fixes n8n en vivo"). *(doc 05 §1)*
- [ ] **[TÚ] 🔴 Credencial de WhatsApp en n8n no cubre el número sandbox** — los nodos `WA - Respuesta *` firman con la credencial fija "WhatsApp account" (`4OfxV7OuSSMmbwnp`), compartida por los 3 planes; Meta rechaza el envío desde el número de pruebas (`GraphMethodException 100/33`, ejecución #370). Además `businesses.whatsapp_token` **no se usa al enviar** (solo la credencial de n8n) → funciona en Modelo B (todos los números bajo tu WABA), pero hay que renovar/alinear el token de esa credencial en n8n → Settings → Credentials para probar con el sandbox, o probar con un número real del WABA.
- [~] **[MIXTO] 🔴 Dunning 7/30 días automático** — **DB LISTA** (2026-07-06, Aud.#2 — detalle en [Infraestructura Supabase](Infraestructura%20Supabase.md) Apéndice): tabla `payments`, `record_payment` (+1 mes, reactiva, quita ai_paused), cron `run-dunning`, `is_business_active` ampliada. **Falta [TÚ]:** botón "Marcar pagado" en AdminPanel → `admin-update-business` → `record_payment`. Opcional: aviso "vence en 3 días" vía `notifications`.
- [x] **[IA] 🔴 Suspensión con dientes (server-side)** — `is_business_active()` en RLS de escritura de 9 tablas; suspendido = solo-lectura. Verificado por impersonación. *(2026-07-06, migración `audit2b_rls_suspend_writes`)*
- [ ] **[TÚ] 🔴 Decisión metering** — `record_usage` nunca se llama → panel admin en 0 y `ai_paused` no corta. Cablear el nodo `record_usage` en n8n **o** ajustar el doc 01 para no depender de `ai_paused`. *(doc 09 §A.3 #6)*
- [ ] **[MIXTO] 🔴 Classifier Pro truncado** — `Modelo - Embedding Pro` con `maxOutputTokens: 10`; el JSON de clasificación necesita ~30 → todo mensaje del tier Pro degradaría a "Classifier Fallido"+handoff. Fix: subir a 100. **[IA] puede aplicarlo por API.** *(doc 09 §A.3 #4)*
- [ ] **[MIXTO] 🔴 Historial del bot pierde mensajes recientes** — `Historial - Obtener` `limit=10` sin `order` → trae los 10 más VIEJOS de la ventana de 3h. Fix: order `created_at desc`. **[IA] puede aplicarlo por API.** *(doc 09 §A.3 #5)*
- [ ] **[MIXTO] 🔴 El bot ignora `ai_paused`** — ni el corte automático ni el kill-switch del AdminPanel apagan la IA (0 menciones en el workflow activo; `¿Plan Activo?` no lo evalúa). Fix: condición extra en ese gate — el dato ya viene en `Negocio - Obtener`, 0 requests extra. **[IA] puede aplicarlo por API.** *(Modelo de Negocio §8 H2)*
- [ ] **[TÚ] 🔴 Recordatorios/auto_confirm se venden pero no existen** — el workflow activo no tiene ningún `scheduleTrigger`; `reminders` (Pro/Ent) y `auto_confirm` (Ent) están en `plans.features` sin motor detrás. Decidir: portar el flujo del workflow viejo inactivo o quitar los flags hasta implementarlos. *(Modelo de Negocio §8 H6)*
- [~] **[MIXTO] 🔴 Pricing v3 DECIDIDO (3 planes: Básico Q599·500 msgs / Pro Q1,999 / Ent Q3,999)** — falta aplicarlo: [IA] `UPDATE plans` (basic 999→599, max_conversations 1000→500) con tu confirmación + corregir el array hardcodeado de `AdminOnboarding.jsx` para que lea de la tabla `plans`. *(Modelo de Negocio §2 y §8.3)*

## 3. 🟠 PENDIENTES P1 — siguientes (retención / consistencia / seguridad)

- [ ] **[IA] 🟠 Alerta de churn silencioso** — cron semanal: negocio sin turnos nuevos ni mensajes en 7 días → fila en `notifications` (un cliente que dejó de usar el bot es un cancelado del mes siguiente).
- [ ] **[MIXTO] 🟠 Emails transaccionales** — Edge Function `send-email` + Resend (3,000/mes gratis) sobre `businesses.notification_email` (columna ya existe). Disparadores: dunning, alta de tenant, corte por límite (`ai_paused_reason='usage_limit'`).
- [ ] **[TÚ] 🟠 Cablear `Tool - Perfil Paciente Enterprise`** en el Agente Enterprise (usa `get_patient_profile`, ya creado) + regla "solo si cliente recurrente". *(doc 05 §2.2)*
- [x] **[IA] 🟠 Endurecer funciones SECURITY DEFINER expuestas** — mínimo privilegio aplicado; anon 24→3, cada función mapeada a su rol. *(2026-07-06, Aud.#1, migración `audit1_least_privilege_execute_grants`)*
- [ ] **[IA] 🟠 Ownership-check en `get_visible_patient_ids/staff_ids`** — forzar `p_business_id := get_user_business_id()` dentro de la función (hoy confían en el parámetro). *(Aud#1, gap menor — apéndice de Infraestructura Supabase.md)*
- [ ] **[TÚ] 🟠 Activar "Leaked password protection" (HIBP)** en Supabase Auth (Studio → Authentication → Policies). 1 clic. *(advisor security)*
- [ ] **[TÚ] 🟠 Trial de 14 días self-service** — `onboard-tenant` acepta `plan_status:'trial'` + `plan_expires_at = now()+14d` (enum y AdminPanel ya lo soportan); el cron `run-dunning` lo vence solo. Baja la fricción del primer cliente.
- [ ] **[TÚ] 🟠 Error Workflow global en n8n** — workflow con *Error Trigger* que loguee toda excepción no capturada (tabla `bot_errors` o `notifications`) + configurarlo como `errorWorkflow` del principal. Cierra "los errores mueren en silencio". *(Automatización §A.4)*
- [ ] **[TÚ] 🟡 Alinear conteos del bot** — `Conversaciones - Contar` cuenta user+assistant (≈2×) y arrastra todas las filas del mes (payload); gate de turnos usa `created_at` vs `date_start`; el bot ignora `limit_overrides`. *(doc 09 §A.3 #10-12)*
- [ ] **[MIXTO] 🟠 Blindar envío WA** — `WA - Respuesta *` sin `onError`: si Meta rechaza, no se guarda history ni hay handoff (visto en ejec #370). Conectar rama de error a Notif/Handoff existentes. *(doc 09 §A.3 #8)*
- [ ] **[MIXTO] 🟠 Fijar `modelName` en los 4 nodos Gemini sin él** (Pro/Enterprise agentes y classifiers) — hoy dependen del default de n8n. *(doc 09 §A.3 #9)*
- [ ] **[TÚ] 🟠 History guardado ≠ enviado en ramas especiales** — textos hardcodean "urgencia dental"/"doctor" para todos los rubros. Igualar al textBody real de cada WA. *(doc 09 §A.3 #7)*
- [ ] **[IA] 🟠 F-1: gate de staff en `Users.jsx`** — usar `canAddStaff` para deshabilitar el botón de crear (única brecha del gating UX de límites; hoy el error del trigger llega crudo). *(Frontend F-1)*
- [ ] **[IA] 🟠 F-8: mapear errores `PLAN_LIMIT_*`** — cuando el trigger rechaza (dos pestañas, carrera), mostrar mensaje de upgrade amable en vez del error crudo de Postgres. *(Frontend F-8)*
- [ ] **[IA] 🟡 I-8: sembrar 2-3 `services` en el negocio de prueba** — hoy el agente responde "No se encontraron servicios"; bloquea el test E2E del bot. *(Infra I-8)*

## 4. 🟡 PENDIENTES P2 — mejoras (cuando haya holgura)

- [ ] **[TÚ] 🟡 Vault para `whatsapp_token`** (hoy texto plano; diferido para no romper n8n). *(doc 03 §9.1)*
- [x] **[IA] 🟡 Revocar grants de escritura sobre `plans`** a anon/authenticated (RLS ya bloquea; defensa en profundidad). *(2026-07-06, migración `harden_plans_revoke_write_grants`)*
- [ ] **[IA] 🟡 `AdminOnboarding` lee planes de la tabla** en vez del array hardcodeado. *(doc 03 §9.4)*
- [x] **[IA] 🟡 Actualizar `CLAUDE.md`** — mención de `mv_*` inexistentes → corregida a RPCs de stats. *(2026-07-06)*
- [ ] **[IA] 🟡 Búsqueda global (Ctrl+K)** — RPC `search_global(q)` (pacientes+turnos+notas del tenant) con `pg_trgm` ya instalado + command-palette.
- [ ] **[IA] 🟡 Histórico de consumo** en el panel admin — gráfico de tendencia mensajes/tokens por mes sobre `usage_counters` (es la única serie histórica con la retención activa). Solo front. *(depende de H1)*
- [ ] **[MIXTO] 🟡 Rate limiting por tenant** — reusar `check_rate_limit` con clave `wa:{business_id}` desde el workflow (aislar ráfagas de un tenant para que no degrade a los demás).
- [ ] **[TÚ] 🟡 Resiliencia frontend** — `withRetry`/backoff + circuit breaker; `cache:'no-store'` a wrapper opt-in. *(Auditoría §9)*
- [ ] **[TÚ] 🟡 Sentry en prod** — `VITE_SENTRY_DSN` en Vercel + sourcemaps ocultos. *(Auditoría §11 / Frontend F-6)*
- [ ] **[IA] 🟡 I-4: dropear los 5 overloads viejos** de RPCs de stats (`get_patient_ltv`/`get_retention_rate`/`get_service_analytics`/`get_appointment_prediction`/`get_stats_dashboard` firma `p_months`) tras verificar uso — evita ambigüedad PostgREST. *(Infra I-4)*
- [ ] **[IA] 🟡 F-5: `ConfirmDialog` unificado** — reemplazar los 4 `window.confirm` nativos (AppointmentDrawer, FinanceDetailDrawer, PendingValidationDrawer, SuppliesSection) por el modal glass de CategoriesSection extraído a `ui/`. *(Frontend F-5)*
- [ ] **[IA] 🟡 F-2: variable equivocada en `Conversations.jsx:365`** (`patientsUsed` → `conversationsUsed`). *(Frontend F-2)*

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
- [ ] Memoria semántica pgvector del bot (diferida por costo de tokens; diseño preservado en [Automatización §C.3](Automatización%20Agente%20IA.md)).
- [ ] Stripe al pasar ~5 clientes — Edge Function `stripe-webhook`: `invoice.paid` → INSERT `payments` + `record_payment` → dunning 100% automático.
- [ ] Web Push para handoffs — Realtime ya emite el cambio de `human_takeover`; falta service worker + Push API (VAPID, $0). Hoy la secretaria solo se entera con el dashboard abierto.
- [ ] Storage (100 GB incluidos, sin uso): (a) logo del negocio, (b) imágenes que los pacientes mandan por WhatsApp — hoy el bot las ignora/pierde; bucket por-tenant con RLS de Storage + mostrarlas en Conversaciones.
- [ ] Export de datos por tenant — Edge Function que arma JSON/CSV (pacientes/turnos/finanzas) a bucket con URL firmada 24h; churn ordenado + backup lógico.
- [ ] Migración a WhatsApp Tech Provider + `waba_id` por negocio (≥15 clientes). *(WhatsApp Api §4)*

---

## 6. 🔍 PLAN DE AUDITORÍAS — sacarle el jugo a Fable 5

> Fable 5 rinde mejor con auditorías **acotadas y verificables** (una superficie por sesión, con evidencia por MCP), no "revisa todo". Estas son de una sesión cada una.

### HOY (fundacionales — cierran los huecos que ya destapamos)
1. **Auditoría de superficie SECURITY DEFINER** *(seguridad, 🔴)*. Revisar las 24+41 funciones que el advisor marca ejecutables por anon/authenticated: para cada una decidir quién debe llamarla (frontend authenticated / bot service_role / nadie) y `REVOKE` el resto. Entregable: migración + tabla "función → rol permitido". *(Yo la ejecuto por MCP.)*
2. **Auditoría de flujo de cobro end-to-end** *(producto, 🔴)*. Trazar `plan_status`/`plan_expires_at` desde el pago hasta el bloqueo (front `AccountStatusModal`, bot `¿Plan Activo?`, RLS). Entregable: diseño cerrado del dunning (tabla `payments` + cron + `is_business_active` en RLS) listo para implementar.

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

### docs/NovTurnIA Infraestructure/ — **CARPETA OFICIAL** (todo definitivo vive aquí)
| Doc | Tema |
|---|---|
| [Backlog Maestro](Backlog%20Maestro.md) | **Este documento** — sistema oficial de tareas/fixes/bugs |
| [Modelo de Negocio](Modelo%20de%20Negocio.md) | FINAL v3: precios 3 planes (Q599/1,999/3,999), costos, márgenes, benchmarking GT, auditoría de cumplimiento de límites (H1-H8) |
| [WhatsApp Api](WhatsApp%20Api.md) | WhatsApp Cloud API: multi-tenancy, plantillas, costos Meta, tenants |
| [Automatización Agente IA](Automatización%20Agente%20IA.md) | Auditoría del workflow n8n en vivo (A) + plan Módulo IA (B) + memoria del agente y fixes históricos (C) |
| [Infraestructura Supabase](Infraestructura%20Supabase.md) | Auditoría de infra en vivo: tablas/RLS, crons, particiones, advisors, edge functions (I-1…I-8) |
| [Frontend](Frontend.md) | Auditoría del frontend React: arquitectura, higiene, resiliencia (F-1…F-8) |
| [Auditoria Tecnica Multi-Tenant](Auditoria%20Tecnica%20Multi-Tenant.md) | Auditoría profunda RLS/seguridad + scorecard (re-evaluado 2026-07-11: **8.1/10**) |

### docs/audit_performance/ (archivo)
[00 runbook](../audit_performance/00-runbook-alta-de-tenants.md) · [03 infra vieja](../audit_performance/03-infraestructura-supabase.md) (superseded por Infraestructura Supabase.md) · [08 spec categorías](../audit_performance/08-submodulo-categorias-finanzas.md) (✅ implementado).

**Eliminados (contenido absorbido, 2026-07-10/11):** `01-modelo-de-negocio.md` → Modelo de Negocio.md · `02-whatsapp-cloud-api.md` → WhatsApp Api.md · `05-agente-ia-memoria-y-fixes-n8n.md` → Automatización Agente IA.md Parte C · `04-puntos-de-mejora.md` → sus 13 puntos viven como ítems de este backlog (P0-Futuras, con el "cómo" inline) · `07-auditorias-2026-07-06.md` → Apéndice de Infraestructura Supabase.md (función→rol, migraciones, verificaciones) + §6.3 (matriz de índices) + Automatización §A.4 (patrón de resiliencia y Error Workflow).
