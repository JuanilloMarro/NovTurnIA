# Backlog Maestro — 🔲 PENDIENTES

> **Qué es este documento:** todo lo que sigue abierto en NovTurnIA, unificado desde `Backlog Maestro.md` (ahora un índice) y desde las secciones "pendiente" de `Infrastructure Evaluation.md`, `Auditoria Tecnica Multi-Tenant.md`, `Modelo de Negocio.md`, `Frontend.md`, `Infraestructura Supabase.md`, `Automatización Agente IA.md`, `improvements.md` y `Finanzas v2 - Evaluacion y Roadmap.md`. Cada ítem se **verificó contra el código/DB real** (2026-07-25) antes de listarse aquí — varios "pendientes" de esos documentos ya estaban implementados y se movieron a [Backlog Maestro - Completadas.md](Backlog%20Maestro%20-%20Completadas.md) en su lugar.
> **Responsable:** **[IA]** = lo puede aplicar el asistente por MCP/API · **[TÚ]** = requiere Vercel/Supabase Studio/Meta/UI manual · **[MIXTO]** = ambos.
> **Cómo usar:** trabajar de arriba hacia abajo dentro de cada bloque (P0→P1→P2→Futuras). Al completar un ítem, moverlo a Completadas.md con fecha y evidencia, no solo marcar `[x]` aquí.

---

## 0. 🔴 P0 — bloquean producción / cobro real

- [ ] **[TÚ] Credencial de WhatsApp no cubre el número sandbox** — los nodos `WA - Respuesta *` firman con la credencial fija "WhatsApp account", compartida por los 3 planes; Meta rechaza el envío desde el número de pruebas (`GraphMethodException 100/33`). Bloquea la prueba end-to-end de TODO lo aplicado hoy en n8n (ver Completadas §8). Fix: Meta Business Settings → System User → token permanente → pegarlo en n8n Credentials, o probar con un número real del WABA. *(Bot n8n - Puesta al Dia.md, hallazgo #3)*
- [ ] **[TÚ] Marcar pagado a los negocios reales** — las herramientas de dunning están listas (botón, RPC, cron) pero `plan_expires_at` sigue `NULL` en los 2 negocios de producción (verificado en vivo) → el ciclo de vencimiento no ha arrancado. 1 clic por negocio en AdminPanel. *(Modelo de Negocio §8 H5)*
- [ ] **[TÚ] Activar "Leaked password protection" (HIBP)** en Supabase Studio → Authentication → Policies. 1 clic, no verificable por SQL/MCP.

## 1. 🟠 P1 — siguientes (retención / consistencia / seguridad)

- [ ] **[MIXTO] Motor de recordatorios (H6)** — el workflow activo no tiene ningún `scheduleTrigger`; `reminders` (Pro/Ent) y `auto_confirm` (Ent) se venden en `plans.features` sin motor detrás. El workflow **inactivo** de abril 2026 tenía uno completo (recordatorio 24h/2h + confirmación) — es rescate, no obra nueva. Plan detallado: [Bot n8n - Puesta al Dia.md §3 Fase 4](Bot%20n8n%20-%20Puesta%20al%20Dia.md). Requiere decidir categoría de plantilla Meta (costo utility vs marketing) antes de escalar.
- [ ] **[TÚ] `custom_prompt` inyectado a todos los planes (H7)** — es feature Pro/Ent en `plans.features`, pero el bot lo usa aunque el negocio sea Básico (el front solo impide *editarlo*, no lo bloquea si la columna ya tiene valor). Fix: condición por tier en el nodo, o aceptar como está.
- [ ] **[TÚ] Redeploy de `onboard-tenant` tras cambios recientes de código** — el archivo fuente (`supabase/functions/onboard-tenant/index.ts`) tiene `view_pipeline` en OWNER/SECRETARY, pero no hay confirmación de que el último deploy (v15) sea posterior a ese cambio. Los tenants **existentes** ya lo tienen vía backfill; solo afecta a tenants nuevos. Verificar y redeployar si hace falta.
- [ ] **[MIXTO] Emails transaccionales** — Edge Function `send-email` + Resend (3,000/mes gratis) sobre `businesses.notification_email` (columna ya existe, sin función asociada). Disparadores: dunning, alta de tenant, corte por límite.
- [ ] **[TÚ] Error Workflow global en n8n** — no existe un workflow con *Error Trigger* que loguee excepciones no capturadas (tabla `bot_errors` o `notifications`). Hoy un fallo fuera de las ramas ya manejadas muere en silencio.
- [ ] **[TÚ] Sentry en producción** — `VITE_SENTRY_DSN` sigue sin configurarse en Vercel (código ya integrado, con redacción PII). Verificado: `vite.config.js` sigue con `sourcemap: false` — cambiar a `'hidden'` + subir a Sentry CLI post-build para que los stack traces sean legibles.
- [ ] **[TÚ] Preview deployments de Vercel apuntan a la DB de producción** — falta configurar una branch de Supabase para los previews.

## 2. 🟡 P2 — mejoras de calidad (cuando haya holgura)

- [ ] **[IA] `cache: 'no-store'` global** — verificado en `src/config/supabase.js:14`: sigue aplicado a *todas* las peticiones del cliente Supabase (anula HTTP cache incluso en lecturas idempotentes). Mover a un wrapper opt-in solo donde se necesite.
- [ ] **[IA] Sin ESLint configurado** — verificado: no existe `.eslintrc*` ni `eslint.config.*` en el repo.
- [ ] **[IA] 20 archivos con `console.log/error/warn` sin guard `import.meta.env.DEV`** — verificado en vivo (lista completa: `AppointmentDrawer`, `EditAppointmentModal`, `FollowUpList`, `NewAppointmentModal`, `ErrorBoundary`, `AjustesSection`, `NewPatientModal`, `MainChart`, `useAppointments`, `useAuth`, `useCashRegister`, `useFinance`, `useFinanceCategories`, `useOffers`, `usePatients`, `usePendingReminder`, `usePipeline`, `useReceivables`, `useServices`, `useStaffProduction`). Llegan a producción sin guard.
- [ ] **[IA] `RealtimeStatusBanner.jsx` sin activar** — el componente existe y el estado (`useAppStore.realtimeStatus`) está implementado, pero nunca se importa/monta (confirmado por el propio comentario `// T-11 (pendiente)` en `useRealtime.js`). Sin esto, una desconexión de Realtime es invisible para el usuario.
- [ ] **[IA] Circuit breaker completo** — `withRetry` (reintentos + backoff) ya está aplicado a las 4 lecturas calientes; falta el circuit breaker que corte por completo ante fallos sostenidos (mejora sobre lo ya hecho, no un hueco crítico).
- [ ] **[IA] Gate `manage_roles` en INSERT/DELETE de `staff_roles`/`staff_users`** — verificado en vivo: esas políticas solo acotan por `business_id`, sin exigir el permiso (la creación real pasa por Edge Function con `service_role`, así que es defensa en profundidad, no un hueco explotable hoy).
- [ ] **[IA] `create_patient_with_phone` sin validación interna de `business_id`** — depende solo del `GRANT`/RLS externo; agregar el chequeo dentro de la función es cinturón-y-tirantes.
- [ ] **[TÚ] Vault para `whatsapp_token`** — sigue en texto plano en `businesses` (decisión deliberada para no romper n8n mientras se usa Modelo B). Migrar cuando se pase a WhatsApp Tech Provider.
- [ ] **[IA] Auditoría asíncrona vía `pgmq`** — los triggers de `audit_log` siguen síncronos dentro de la transacción de negocio (aceptado por volumen actual; revisar si el tráfico crece).
- [ ] **[IA] Auditoría profunda de permisos por módulo** — verificar módulo por módulo que TODAS las acciones existentes (no solo las 6 cerradas en la Pesada #3) tengan su permiso correspondiente en `usePermissions`/`Users.jsx`/DB.
- [ ] **[IA/TÚ] Auditoría de consistencia visual** — repasar todos los módulos para que botones/paneles/degradados/sombreados sigan exactamente el mismo lenguaje glass. Cambio ancho, sesión dedicada.
- [ ] **[TÚ] Auditoría de rendimiento con datos sintéticos** — sembrar 5 negocios × ~2,000 turnos/pacientes en una branch de Supabase y correr `EXPLAIN ANALYZE` sobre las queries calientes para validar que los índices aguantan a escala (hoy con ~0 filas el planner no lo puede probar).
- [ ] **[IA] Rate limiting por tenant en n8n** — hoy el rate limit es por usuario+negocio (20 msg/h); falta una cuota agregada por tenant que aísle ráfagas de un negocio ruidoso del resto (reusar `check_rate_limit` con clave `wa:{business_id}`).
- [ ] **[IA] Observabilidad — correlation-id tenant↔request↔DB** — sin un identificador que hilvane cliente→request→tenant→consulta, diagnosticar "qué le pasó a un cliente a las 10:03" requiere ir tabla por tabla.

## 3. 🔮 Futuras — roadmap de producto

### Pipeline CRM
- [ ] **[IA] Granularidad fina del pipeline (v2)** — hoy el bot manda una sola bandera `activity`; las banderas por paso (`offered_services`, `offered_promo`, `slot_offered`) no se pueden emitir desde un `httpRequestTool` porque lo invoca el LLM, no el grafo del workflow. Camino propuesto: RPCs envoltorio (`bot_get_slots`, `bot_get_services`) que hagan el trabajo real **y** el `pipeline_touch` en una sola llamada, reapuntando los 8 tools existentes.
- [ ] **[IA] Reemplazar la heurística de Descubrimiento vs Negociación** — hoy el backfill separa las dos primeras etapas por número de mensajes (≥6 = negociación); en cuanto lleguen los `queried_slots` reales (requiere lo de arriba), borrar la aproximación.

### Centro IA / Módulo IA del sistema
- [ ] **[IA] Batch semanal automático** — `pg_cron` para generar `weekly_digest`/`retention` sin que el usuario tenga que pedirlo (hoy solo on-demand); notificación al dueño cuando esté listo.
- [ ] **[IA] Botón "Crear oferta"** que pre-llene el módulo Ofertas desde un insight `content_offer` (conexión directa, sin lógica nueva de negocio).

### Finanzas
- [ ] **[IA] `appointments.staff_id`** — permitiría asignar profesional al agendar (no solo al cobrar), prerequisito de una futura agenda multi-silla/multi-doctor. Deliberadamente diferido — la atribución de comisión hoy funciona bien vía `income_entries.staff_id`.
- [ ] Recibos y formalización de pagos: aviso automático de voucher antes de vencer la suscripción, recibo manual imprimible.

### Citas / Seguimiento
- [ ] Re-agendación automática de citas futuras al cancelarse un turno (prioriza clientes en espera para slots liberados).
- [ ] Filtros de período más específicos en Seguimiento — hoy ya tiene Hoy/7/15/30/60/90 días; se pidió aún más granularidad.

### UI grande
- [ ] **Modo oscuro** — implementarlo sin tocar nada del modo claro actual (o un panel general oscuro con los mismos colores). Cambio visual grande, sesión dedicada. Verificado: `tailwind.config.js` no tiene `darkMode` configurado, 0 clases `dark:` en `src/` — no hay trabajo previo que reutilizar.

### Infraestructura / Cobro
- [ ] **Stripe** (al pasar ~5 clientes) — Edge Function `stripe-webhook`: `invoice.paid` → INSERT `payments` + `record_payment` → dunning 100% automático. Verificado: 0 referencias a Stripe en el repo hoy.
- [ ] Migración a WhatsApp Tech Provider + `waba_id` por negocio (≥15 clientes) — no es deuda arquitectónica, es una decisión comercial de cuándo migrar (`businesses.phone_number_id`/`whatsapp_token` ya son compatibles con ambos modelos).
- [ ] Web Push para handoffs — Realtime ya emite el cambio de `human_takeover`; falta service worker + Push API (VAPID, $0 costo). Hoy la secretaria solo se entera con el dashboard abierto.
- [ ] Storage para: (a) logo del negocio, (b) imágenes que los pacientes mandan por WhatsApp — hoy el bot las ignora/pierde. Bucket por-tenant con RLS de Storage + mostrarlas en Conversaciones.
- [ ] Memoria semántica pgvector del bot — diferida por costo de tokens (1 llamada LLM destiladora/conversación); diseño preservado en [Automatización Agente IA.md §C.3](Automatización%20Agente%20IA.md).

### Calidad / proceso
- [ ] Testear el sistema de punta a punta (QA formal, click-through autenticado — ninguna auditoría hasta hoy lo pudo hacer por falta de credenciales de sesión).
- [ ] Versionado de la aplicación — delimitar metas y features por versión.

---

## Índice de documentos fuente

| Doc | Qué aportó a este archivo |
|---|---|
| [Backlog Maestro](Backlog%20Maestro.md) | Ahora un índice — apunta aquí y a Completadas.md |
| [Bot n8n - Puesta al Dia](Bot%20n8n%20-%20Puesta%20al%20Dia.md) | Motor de recordatorios (Fase 4), granularidad fina del pipeline |
| [Modelo de Negocio](Modelo%20de%20Negocio.md) | H6/H7 abiertos — **ya no contiene tareas**, solo auditoría/hallazgos |
| [Automatización Agente IA](Automatización%20Agente%20IA.md) | Batch semanal, botón crear oferta, memoria pgvector diferida |
| [Frontend](Frontend.md) | F-6 (Sentry), resiliencia, HIBP |
| [Auditoria Tecnica Multi-Tenant](Auditoria%20Tecnica%20Multi-Tenant.md) | Vault, gate INSERT/DELETE staff, pgmq, correlation-id, rendimiento sintético |
| [Infraestructura Supabase](Infraestructura%20Supabase.md) | Vault, WhatsApp Tech Provider |
| `improvements.md` / `Infrastructure Evaluation.md` (archivo) | Modo oscuro, consistencia visual, RBAC profundo, Stripe, QA formal, versionado |
| [Finanzas v2 - Roadmap](Finanzas%20v2%20-%20Evaluacion%20y%20Roadmap.md) | `appointments.staff_id`, recibos/vouchers |
