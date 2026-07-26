# Backlog Maestro — ✅ COMPLETADAS

> **Qué es este documento:** el registro único de todo lo que YA está hecho y verificado en NovTurnIA, consolidado desde `Backlog Maestro.md` (ahora un índice) y de las secciones "pendiente"/"tareas" que varios documentos de auditoría tenían desactualizadas — varias tareas que otros `.md` seguían listando como abiertas ya estaban resueltas en sesiones posteriores; quedaron verificadas contra el código/DB real antes de moverlas aquí (2026-07-25).
> **Hermano:** [Backlog Maestro - Pendientes.md](Backlog%20Maestro%20-%20Pendientes.md) — todo lo que sigue abierto, verificado.
> **Archivo histórico aparte (no duplicado aquí):** [Completed_Tasks.md](../audit_performance/Completed_Tasks.md) — 86 tareas de las sesiones de abril 2026 (pre-UUID, pre-Finanzas, pre-Pipeline). Es un log cerrado y ya 100% histórico; no se reprodujo línea por línea aquí para no inflar este documento — referirse a él para el detalle arqueológico de esa etapa.
> **Responsable:** **[IA]** = aplicado por el asistente vía MCP/API · **[TÚ]** = requería una acción manual tuya, ya hecha · **[MIXTO]** = ambos.

---

## 1. Seguridad y RLS (multi-tenant)

- [x] **2 hoyos CRÍTICOS de RLS corregidos**: auto-upgrade de plan (`businesses` UPDATE ahora por columna, no por tabla completa) y escalación RBAC (`staff_roles`/`staff_users` UPDATE exige `manage_roles` vía `user_has_permission()`). *(Auditoría Técnica Multi-Tenant §1-2)*
- [x] **Superficie `anon` cerrada de verdad**: `REVOKE ... FROM PUBLIC` (no solo `anon` — el hueco real era que varias funciones tenían EXECUTE a `PUBLIC`, del cual `anon` es miembro) en RPCs sensibles + `create_appointment`/`get_available_slots`/`get_patient_appointments`. Verificado `anon=false`.
- [x] **Aud.#1 — mínimo privilegio en 30+ funciones**: ejecutables por `anon` **24→3**, por `authenticated` **41→33**. Tabla función→rol documentada. *(migración `audit1_least_privilege_execute_grants`)*
- [x] **Vista `services_with_active_offer` → `security_invoker`**; `search_path` fijado en 12 funciones — advisor ERROR `security_definer_view` eliminado, `function_search_path_mutable` 12→0.
- [x] **`reactivate_bot` reescrito** (uuid + esquema real, antes fallaba en runtime en 3 frentes) — fósiles dropeados: `get_my_business_id`, `suspend_tenant(int)`, `get_available_slots(int)`, `handle_new_staff_user`. Verificado en vivo (2026-07-25): solo queda **1 firma** de `get_available_slots` en el catálogo — la limpieza de overloads quedó 100% completa.
- [x] **RLS *InitPlan***: `(SELECT get_user_business_id())` en todas las políticas (evita re-evaluar la función por fila); `message_buffer` deduplicada 6→3 políticas.
- [x] **Revocar grants de escritura sobre `plans`** a anon/authenticated — verificado en vivo (2026-07-25): `UPDATE` = `false` para ambos roles. *(migración `harden_plans_revoke_write_grants`)*
- [x] **Ownership-check en `get_visible_patient_ids`/`get_visible_staff_ids`** — si el caller autenticado tiene perfil de staff se fuerza SU negocio (service_role/super-admin conservan el parámetro). Probe de impersonación: pedir el negocio ajeno → 0 fugas. *(migración `ownership_check_get_visible_ids`)*
- [x] **Aud.#2 — Dunning end-to-end**: `payments` + `record_payment` + cron `run-dunning` (7/30) + `is_business_active()` (active/trial) + **suspensión con dientes** (RLS write-gating en 10 tablas, incluida `finance_categories`). Verificado por impersonación.
- [x] **Aud.#5 — Consistencia límites bot↔dashboard**: matriz plan×límite×comportamiento auditada (Modelo de Negocio §8); las inconsistencias encontradas (H1-H4, H8) quedaron cerradas — ver §7 abajo.

## 2. Infraestructura Supabase

- [x] Retención de conversaciones por plan (`history_retention_months`: 3/3/12) + cron diario `retain-history`.
- [x] Particionado: horizonte 6→2 meses, cron mensual `drop-old-partitions`, 16 particiones vacías eliminadas (history/audit → 4 c/u).
- [x] Índices compuestos calientes (history/audit/appointments) + 5 índices FK; 4 redundantes borrados.
- [x] Crons de limpieza: `clean-api-rate-limits`, `retain-notifications` (12 crons activos hoy, 0 fallos en 7 días verificado 2026-07-11).
- [x] **Aud.#3 — Cobertura de índices**: las 7 queries calientes (calendario, conversaciones, actividad, pacientes, búsqueda, finanzas) cubiertas por prefijo+orden; sin faltantes para el patrón de acceso actual.

## 3. Producto / Onboarding / Límites / Pricing

- [x] `onboard-tenant` v11→v15: auth dual (`app_super_admins`+secret), normalización schedule/WhatsApp, permisos owner/secretary alineados a `usePermissions` (37 llaves reales, no 15), trial 14 días self-service, `view_pipeline`/RBAC de Finanzas v2/Centro IA incluidos.
- [x] Repo sincronizado con `admin-list-businesses`/`admin-update-business` (drift front↔producción cerrado).
- [x] Fix del alta "trabada": `adminService.js` con fetch directo + `AbortController` + timeout (evita el navigator-lock huérfano de gotrue); 406 del super-admin silenciado (`maybeSingle`).
- [x] **Pricing v3 aplicado en producción**: Básico Q599/500 msgs · Pro Q1,999/5,000 · Enterprise Q3,999/20,000. `AdminOnboarding` no requería cambio (solo referencia tiers, sin precios — hallazgo re-auditado y cerrado N/A). *(migración `pricing_v3_basic_and_drop_unused_overloads`, que de paso dropeó 5 overloads duplicados de RPCs de stats)*
- [x] **Botón "Marcar pagado"** en AdminPanel (`admin-update-business` v9 → `record_payment`) — cierra el ciclo de dunning de punta a punta.
- [x] **Alerta de churn silencioso**: `check_silent_churn()` + cron `churn-silent-alert` (lunes, dedupe 7d).
- [x] `PlansModal.jsx` reescrito para leer `getPlans()` en vivo — ya no hardcodea precios/features obsoletos.
- [x] Flags `stats_intelligence` (Centro IA, Pro+) y `business_intelligence` (BI avanzado, Enterprise) separados correctamente tras detectar que uno gateaba ambas cosas a la vez.

## 4. Frontend (auditoría F-1…F-8)

- [x] **F-1 — límite de staff real**: el hueco no era un botón faltante sino que `manage-staff` (service_role, exento del trigger) no chequeaba `max_staff` — fix en la Edge (v8) + contador `X/Y usuarios del plan` en `Users.jsx`.
- [x] **F-2 — texto de Conversaciones corregido**: la comparación correcta era contra `maxPatients`, no `maxConversations`.
- [x] **F-3 — `AdminOnboarding` hardcodeado**: re-auditado y cerrado N/A (solo tiers, sin precios/límites — sin riesgo de desync).
- [x] **F-4 — resiliencia de red**: `utils/withRetry.js` (3 intentos, backoff exponencial, solo errores transitorios) + `retryRead`. Verificado en vivo (2026-07-25): usado en `supabaseService.js`. Aplicado a las 4 lecturas calientes (calendario, pacientes, finanzas, plan limits).
- [x] **F-5 — `ConfirmDialog` unificado**: los 4 `window.confirm` nativos reemplazados. Verificado en vivo: **0** `window.confirm` reales en el código (solo 1 mención en comentario).
- [x] **F-8 — errores `PLAN_LIMIT_*` amables**: `createPatient`/`createAppointment` mapean el HINT del trigger a mensaje de upgrade.
- [x] **Auditoría RBAC completa (Pesada #3)**: 4 permisos nuevos (`manage_cash`, `pay_commission`, `manage_finance_settings`, `use_ai_hub`) con backfill + botón "Seleccionar/Quitar todos" por módulo en `Users.jsx`.

## 5. Finanzas v2 — completo (2026-07-18)

Todo el roadmap de `Finanzas v2 - Evaluacion y Roadmap.md` quedó construido y en producción:
- [x] **DB (8 migraciones):** `finance_settings` (meta mensual), `payment_methods` (configurables por negocio, fee%), `payment_plans` + abonos (RPCs `record_plan_payment`/`get_payment_plans`/`cancel_payment_plan`), `staff_users.commission_pct` + snapshot de comisión al confirmar cobro (`income_staff_snapshot`) + `get_staff_production`, `cash_sessions` (caja diaria abrir/cerrar), stock de insumos + consumo automático vía receta, gastos fijos recurrentes materializados por cron, `get_finance_projection`, `get_finance_pack` (contexto IA).
- [x] **Frontend:** 9 submódulos (Resumen · Por confirmar · Ingresos · Egresos · Por cobrar · Caja · Producción · Inventario · Ajustes) con comparativas vs período anterior, meta con barra, proyección de cierre, margen real por servicio, export CSV.
- [x] **IA:** scope `finance_narrative` en Centro IA.
- [x] Verificado: 12/12 probes transaccionales con impersonación (stock, abonos, caja, comisiones, producción, proyección, aislamiento cross-tenant).
- [x] **Rediseño visual (Lote 4, 2026-07-20)**: collage de Resumen (Meta del mes como 5º panel, top-3 siempre relleno atenuado, `ProjectionGauge` velocímetro SVG reemplaza números sueltos).
- [x] **Vouchers de pago (Pesada #2 + v2)**: tabla `payment_vouchers` con código único, RPCs `create_voucher`/`redeem_voucher`/`cancel_voucher`; fusionado con el flujo de cobro de turnos (`submit_income_validation` crea voucher `pending` ligado, `confirm_income_validation` lo redime — sin duplicar ingreso); restyle + export PDF tipo recibo.
- [x] **Categorías Dinámicas de Finanzas** (`08-submodulo-categorias-finanzas.md`): tabla `finance_categories` (income/expense, color), permiso `manage_finance_categories`, integrado en modales de registro y en los displays.
- [x] Política de redondeo de precios configurable (`price_rounding_increment`) + subtab "Precios" en Ajustes.

**Pendiente consciente (no bloqueante, documentado en el propio roadmap):** `appointments.staff_id` — hoy la atribución de comisión ocurre al cobrar (`income_entries.staff_id`), no al agendar; asignar staff en el turno mismo es el prerequisito de una futura agenda multi-profesional. Ver Pendientes.md.

## 6. Centro IA / Módulo IA del sistema (Enterprise→Pro)

> El `Backlog Maestro.md` viejo listaba esto como una sección de checkboxes **sin marcar** (`ai_insights`, resumen por paciente, estrategia, retención, narrativa KPIs, chat de negocio) — estaba desactualizado: **todo lo de abajo ya está implementado y en producción** desde 2026-07-14/18, documentado en detalle en [Automatización Agente IA.md §B.5-B.6](Automatización%20Agente%20IA.md).

- [x] **Fundación**: tablas `ai_insights`/`ai_chat_messages` (RLS + `has_feature`) + RPC `get_business_context_pack` + `get_at_risk_patients`.
- [x] **Los 6 scopes de insights** (no solo uno): `patient_summary`, `patient_strategy`, `retention`, `kpi_narrative`, `weekly_digest`, `content_offer` — Edge Function `ai-insights` v6, cache-first, `responseSchema` exacto por scope, `thinkingBudget:0` (fix de un bug real: el thinking por defecto truncaba las respuestas a 3-8 tokens).
- [x] **Chat de negocio**: Edge Function `ai-chat` v5 — router de intents (flash-lite) → fetch determinista por RPC → respuesta (flash) → persiste en `ai_chat_messages`.
- [x] **Frontend**: `AIHub.jsx` (ruta `/ai`) + Asistente IA global en el Topbar (acciones contextuales por módulo) + `PatientAIBlock` en la ficha del paciente.
- [x] **Límite semanal REAL de tokens** (`Limit Tokens.md`, 2026-07-18): tabla `ai_usage_weekly` + `plans.ai_weekly_tokens` (Pro 750K/sem, Enterprise 2M/sem) + RPCs `check_ai_budget`/`record_ai_usage` (429 duro al agotar) + `get_ai_usage` (authenticated) + `UsageBar` real en el front (ya no `percent={42}` hardcodeado). Reemplazó el uso indebido de `record_usage` (que es exclusivo del contador mensual del bot de WhatsApp).
- [x] `stats_intelligence` desbloqueado para Pro (antes solo Enterprise).

**Pendiente real (no cosmético):** batch semanal automático (`pg_cron` para `weekly_digest`/`retention`, hoy solo on-demand) y botón "Crear oferta" desde un insight `content_offer`. Ver Pendientes.md.

## 7. Modelo de Negocio — auditoría de límites (H1-H8)

De los 8 hallazgos de la auditoría de cumplimiento (`Modelo de Negocio.md §8`), verificados en vivo 2026-07-25:

| # | Hallazgo | Estado |
|---|---|---|
| H1 | Metering muerto (`record_usage` nunca se llamaba) | ✅ **Cerrado 2026-07-25** — 3 nodos `Uso - Registrar {plan}` cableados en n8n (ver §8) |
| H2 | Bot ignoraba `ai_paused` | ✅ **Cerrado 2026-07-25** — gate `¿Plan Activo?` ahora lo exige |
| H3 | Gates del bot medían distinto que la DB (turnos por `created_at`, conversaciones 2×, sin `limit_overrides`) | ✅ **Cerrado 2026-07-25** — ver §8 |
| H4 | Límite de staff no aplicado en la única vía de creación | ✅ Cerrado 2026-07-11 (= F-1) |
| H5 | `plan_expires_at` NULL → dunning inoperante | 🟢 Herramientas listas (botón "Marcar pagado" + trial con vencimiento) — falta 1 clic en negocios reales, ver Pendientes.md |
| H8 | Comparación incorrecta en Conversaciones (`patientsUsed` vs `maxConversations`) | ✅ Cerrado 2026-07-11 (= F-2) |

**Quedan abiertos H6 (recordatorios/auto_confirm sin motor) y H7 (custom_prompt en todos los planes)** — ver Pendientes.md.

## 8. Bot n8n — puesta al día con el dashboard (2026-07-25)

Plan completo y evidencia en [Bot n8n - Puesta al Dia.md](Bot%20n8n%20-%20Puesta%20al%20Dia.md). Workflow activo `NovTurnAI`: **143 → 151 nodos**, aplicado por API con probes de rollback contra la DB real.

- [x] **Fase 0 — estabilización**: `Modelo - Embedding Pro` maxOutputTokens 10→150 (**el tier Pro entero estaba degradando a handoff** — ahora funcional); `Historial - Obtener` limit 10→100 (traía los 10 mensajes más VIEJOS de la ventana, no los recientes); 6 modelos Gemini con `modelName` explícito (antes 4 sin fijar, dependían del default de n8n); 18/19 nodos WhatsApp con `onError: continueRegularOutput` (antes 0).
- [x] **Fase 1 — circuito de negocio**: 3 nodos `Uso - Registrar {Basic|Pro|Enterprise}` → `record_usage` (cierra H1); gate `¿Plan Activo?` exige `ai_paused !== true` (cierra H2); `Conversaciones - Contar` pasa de contar filas de `history` (2× por doble-conteo user+assistant) a leer `usage_counters`; `Turnos - Scheduled` consolidado a una query por `date_start`+`status<>cancelled` (alineado con el trigger `enforce_appointment_limit`); ambos gates honran `limit_overrides` (cierra H3).
- [x] **Fase 2 — Pipeline CRM**: 3 nodos `Pipeline - Actividad {plan}` → `pipeline_touch(activity)` con el micro-texto real de cada respuesta del agente.
- [x] **Fase 3 — contexto nuevo**: 3 tools `Métodos de Pago {plan}` → lee `payment_methods` real (select frugal, `fee_pct` no viaja al LLM) + regla de pagos en los 3 prompts; `Tool - Perfil Paciente Enterprise` cableado (`get_patient_profile`, listo en DB desde julio, nunca conectado); reglas `SCHEDULE_CLOSED`/`SCHEDULE_DAILY_CAP` en los 3 agentes (el bot ya no recibe un error crudo de Postgres al chocar con un feriado o el cupo diario).
- [x] Textos de `history` en ramas especiales (`Historial - Urgencia`/`Queja`) corregidos para no hardcodear vocabulario médico ("dental"/"doctor") en un producto multi-rubro.
- [x] Verificado con probes de rollback contra la DB real: `record_usage`, `pipeline_touch` y el tool de métodos de pago devuelven exactamente lo esperado. Webhook re-registrado por API (`deactivate`+`activate`) sin necesitar el toggle manual del editor.
- [x] **Fixes previos (2026-07-10)**: rate-limit del bot reparado (key `anon`→`service_role`), gate de teléfono reconectado, número sandbox de Meta registrado.

**Pendiente real:** credencial de WhatsApp para probar end-to-end (bloqueado en Meta, es tuyo), motor de recordatorios (Fase 4, planteada no ejecutada), granularidad fina del pipeline (hoy manda `activity` genérico, no banderas por paso). Ver Pendientes.md.

## 9. Pipeline CRM (Lote 5, 2026-07-24/25)

- [x] **Rediseño de enfoque de la columna final + navegación del popover (2026-07-26)** — "Fidelización" media al CLIENTE en el tiempo, un concepto distinto a Agendación→Cita programada→Recuperación (que son pasos/estados de UN turno) — se renombró a **"Feedback"** (título visible únicamente; el `stage` interno sigue siendo `'loyalty'` en la DB, sin migración) para que coincida con lo que la columna ya hacía de verdad: encuesta/NPS/reseña post-turno. Ícono de columna `Repeat`→`MessageSquareHeart`. Además, la ficha completa **dejó de navegar al hacer clic** (un mal tecleo mandaba a otro módulo sin querer); ahora el popover de pasos tiene un footer con **3 botones explícitos** (Chat/Perfil/Turno, mismo patrón "pill blanco + texto que se expande en hover" que usa `AppointmentDrawer`, gateados por `canViewConversations`/`canViewPatients`); "Turno" reusa el deep-link `/followup?apt=` (sin filtrar por estado, sirve para cualquier turno) para los 4 estados, no solo Recuperación. Se quitó también el tooltip nativo del navegador que tapaba el popover al pasar el mouse.
- [x] **Regla de paso a Feedback endurecida (2026-07-26)** — antes bastaba con que la fecha del turno pasara para que "Cita programada" se moviera solo a Feedback; ahora exige **ambas condiciones** (decisión del usuario, tras señalar que 2 de los 3 pasos de esa columna — Recordatorio enviado, Confirmado por el cliente — son señales de *antes* de la visita, no de que ya ocurrió): el turno debe haber pasado **Y** los 3 checks de "Cita programada" deben estar marcados. `loyalty` se volvió "pegajoso" igual que `lost` — un recompute posterior nunca regresa un deal ya en Feedback a Cita programada, aunque se desmarque un check. Se verificó que esta protección hacía falta de verdad: **2 deals reales** ya estaban en Feedback sin los 2 checks humanos completos (nunca se les puso `reminder_sent`/`confirmed_by_user`) — sin el candado, la próxima vez que algo los tocara los habría regresado. Verificado con 5 probes de rollback (turno pasado sin checks se queda en scheduled, turno pasado + ambos checks pasa a loyalty, loyalty resiste desmarcar un check y re-evaluar, turno futuro con checks no adelanta el paso, no_show/recovery sin cambios) + confirmado que los 2 deals reales siguen intactos.
- [x] **La ficha nace en Agendación desde que el bot ofrece algo (2026-07-26, definitivo)** — el problema de fondo NO era la lógica de etapas sino que **el bot nunca mandaba la bandera específica de cada paso**: en 8 conversaciones reales solo se registró `activity` genérico, cero `offered_services`/`offered_promo`/`queried_slots` (el nodo `Pipeline - Actividad` corre *después* de que el agente respondió, y los tools son `httpRequestTool` que invoca el LLM, no el grafo). Solución: **3 RPCs envoltorio** (`bot_offer_services`, `bot_offer_promos`, `bot_offer_slots`) que devuelven exactamente los mismos datos que los tools de antes **y además** sellan la bandera correcta vía `pipeline_touch`; los 7 tools del workflow ahora apuntan ahí. ⚠️ **Deben ir por POST, no GET**: PostgREST ejecuta las peticiones GET en transacción de solo-lectura, así que por GET el tool respondía 200 con los datos correctos pero la bandera **nunca se guardaba, en silencio** (verificado en vivo con ambos métodos). Los headers (`apikey`/`Authorization`) se conservan intactos — el Body se *suma*, no reemplaza (una edición manual que los perdió produjo "No API key found in request"). Además: una **señal fuerte** (ofrecer servicios/promos/horarios) ahora cierra el deal viejo y abre uno fresco en Agendación **desde cualquier etapa** — incluida Recuperación, que al principio se excluyó para no perder la narrativa de "recuperado" y se verificó que **no hacía falta**: `get_pipeline_metrics.recovered` se calcula con `appointments.is_rescheduled`, no con la etapa del deal. Verificado con 10 probes de rollback sobre datos reales (recuperación→discovery→negotiation, cliente nuevo, cliente con turno futuro que no se huerfana, `activity` que no reabre) + prueba HTTP end-to-end de las 3 RPCs.
- [x] **Fix del ciclo de vida del deal (2026-07-26)** — probando con conversaciones reales del bot se encontraron 2 bugs en `pipeline_touch`/`pipeline_sync_from_appointment`: (1) un deal que **ya había estado ligado a cualquier turno** nunca podía volver a mostrarse en "Agendación" — una vez resuelto el ciclo (turno completado = fidelización), una conversación nueva se quedaba pegada en la etapa vieja hasta que el turno nuevo existiera de verdad, saltándose por completo el proceso de negociación visible. (2) al crear un segundo turno futuro para un cliente que ya tenía uno vigente, el mecanismo de "cerrar viejo + abrir nuevo" cerraba el deal del turno **todavía vigente**, dejándolo sin tarjeta en el tablero aunque el turno real siguiera activo. Fix: ambas funciones ahora distinguen si el turno ligado ya se **resolvió** (pasado y completado, o cancelado/no-show) antes de cerrar — si sigue vigente y futuro, nunca se cierra (se re-apunta el mismo deal al turno más reciente en su lugar). Recuperación se dejó **intacta a propósito** (la narrativa de "recuperado" solo se cierra cuando el turno nuevo existe de verdad, como se validó con Cristian). Verificado con 4 probes de rollback: fidelización-resuelta reabre en discovery ✓, recovery no se toca por conversación ✓, turno futuro no se toca por conversación ✓, segundo turno no huerfana al primero ✓.
- [x] **Todos los pasos no-automáticos, marcables a mano (2026-07-25)** — `confirmed_by_user` estaba huérfano (nadie podía marcarlo: el bot no lo llama porque el motor de recordatorios no existe, y `set_pipeline_step` lo rechazaba). Extendido `set_pipeline_step` para aceptar `offered_services`/`offered_promo`/`queried_slots`/`confirmed_by_user` además de los que ya tenía; en el frontend el checkbox ahora aparece por presencia de `stepId` (no por `source`), así la secretaria puede marcar cualquier paso —incluidos los normalmente automáticos— cuando ella toma el rumbo del cliente en persona. `nps_score` y `__scheduled` quedan sin checkbox a propósito (puntaje 1-5 el uno, se deriva de la realidad el otro).

- [x] **DB**: `pipeline_deals` + `pipeline_events`, RPC `pipeline_touch` (contrato de n8n, idempotente), `get_pipeline_board`/`get_pipeline_metrics` con ownership-check, trigger de sincronización con `appointments`, backfill de 90 días. 2 bugs de sintaxis/grants encontrados y corregidos en el propio deploy.
- [x] **Frontend**: tablero `/pipeline` con drag HTML5 nativo, 4 columnas generales con pasos granulares en popover al hover, health badge explícito por tarjeta (En curso/Detenido/Se cayó/Logrado), checkbox circular para los pasos humanos (con respaldo real en DB vía `set_pipeline_step`).
- [x] **RBAC + gating**: permiso `view_pipeline`, feature flag `pipeline` (Pro+).
- [x] **Deep-link Recuperación → Seguimiento**: clic en una tarjeta de la columna Recuperación abre el turno específico en el módulo de Seguimiento (`?apt=<id>`), en vez del perfil del cliente genérico.

## 10. UX/UI por módulo (Lote 4, 2026-07-20)

- [x] **Servicios**: paginación real ("Cargar más") + banner de modo edición (icono disquete→lápiz).
- [x] **Ofertas**: paginación + modo edición + layout 2 columnas sin scroll + campo % de descuento + redondeo configurable.
- [x] **Turnos → "Citas"**: renombrado en Sidebar/header/permisos.
- [x] **Seguimiento**: búsqueda por nombre/teléfono, paginación real, períodos "Hoy" y "15 días" agregados, ventana de detalle del turno por encima de los botones de acción.
- [x] **Clientes**: GDPR eliminado por completo (UI + función + toast), perfil reordenado (Centro IA → Notas → Turnos), fichas de IA con icono estándar del sistema, últimos 5 turnos + botón "Ver más".
- [x] **Conversaciones**: menú de 3 puntos reemplazado por basurero directo, "ojito" de servicio/oferta abre diálogo emergente (no navega y pierde el chat), panel de ficha del cliente a la altura del panel de chat.
- [x] **Stats**: Métricas vuelve al formato clásico (4 KPIs), los 4 datos nuevos se movieron a Inteligencia (3 filas).
- [x] **Topbar/Sidebar**: icono de usuario blanco/gris con borde, footer con copyright.
- [x] Paginación de Actividad — ya existía de una sesión previa (`getAuditLog` con `.range()`).

## 11. Auditorías completas por sector — scorecard

Sistema evaluado end-to-end en 4 rondas: **4.9 → 6.3 → 7.2 → 8.1/10** (Auditoría Técnica Multi-Tenant, re-evaluación 2026-07-11). Los 3 hallazgos CRÍTICO/ALTO originales (auto-upgrade de plan, escalación RBAC, superficie `anon`) están cerrados y verificados. Documentos oficiales por sector: [Infraestructura Supabase](Infraestructura%20Supabase.md) · [Frontend](Frontend.md) · [Modelo de Negocio](Modelo%20de%20Negocio.md) · [Automatización Agente IA](Automatización%20Agente%20IA.md) · [Auditoria Tecnica Multi-Tenant](Auditoria%20Tecnica%20Multi-Tenant.md) · [Bot n8n - Puesta al Dia](Bot%20n8n%20-%20Puesta%20al%20Dia.md).
