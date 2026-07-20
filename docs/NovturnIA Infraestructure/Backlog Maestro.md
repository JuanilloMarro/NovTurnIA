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

### Fixes aplicados 2026-07-11 (DB + Edge + Frontend) — todo verificado
- [x] **[IA] 🔴 PRICING v3 APLICADO EN DB** — `UPDATE plans`: basic Q999→**Q599**, max_conversations 1,000→**500**. Verificado en vivo: basic 599/500 · pro 1,999/5,000 · enterprise 3,999/20,000. *(migración `pricing_v3_basic_and_drop_unused_overloads`)*. Nota: `AdminOnboarding` NO requería cambio — solo hardcodea los ids de tier (basic/pro/enterprise), sin precios; el hallazgo F-3 estaba sobreestimado.
- [x] **[IA] 🟠 Límite de staff aplicado de verdad (F-1 corregido y resuelto)** — hallazgo re-auditado: NO existe botón de crear usuario en la UI (el hook `addUser` está huérfano); el hueco real era que `manage-staff` (service_role, exento del trigger) **no chequeaba `max_staff`**. Fix: check con `get_effective_limit` + conteo en la Edge (409 amable) → **redeploy v8 ACTIVE**. Extra: `Users.jsx` ahora muestra `X/Y usuarios del plan`.
- [x] **[IA] 🟠 F-8: errores `PLAN_LIMIT_*` amables** — `createPatient` y `createAppointment` en `supabaseService.js` mapean el HINT del trigger a mensajes de upgrade (cubre la carrera de dos pestañas).
- [x] **[IA] 🟠 I-6: ownership-check en `get_visible_patient_ids/staff_ids`** — si el caller autenticado tiene perfil de staff se fuerza SU negocio (service_role y super-admin conservan el parámetro). Verificado con probe de impersonación: pedir el negocio ajeno → **0 fugas**. *(migración `ownership_check_get_visible_ids`)*
- [x] **[IA] 🟡 I-4: 5 overloads duplicados dropeados** — corrección importante: el frontend llama `{p_business_id, p_end_date}` → resuelve a las firmas con `p_months DEFAULT` (no a las de fechas, como decía el doc); se droppearon las 4 firmas `p_start_date` + `get_stats_dashboard(2 args)` huérfanas. Queda exactamente 1 firma por función (verificado).
- [x] **[IA] 🟡 I-8: 3 servicios sembrados en el negocio de prueba** — Consulta General Q250/30min, Limpieza Dental Q350/30min, Extracción Q500/60min (el esquema exige duración múltiplo de 30; `blocks` es columna generada). Desbloquea el test E2E del bot.
- [x] **[IA] 🟡 F-2: texto de Conversaciones corregido** — la comparación correcta era contra `maxPatients` (el límite que sí recorta los chats visibles), no `maxConversations`; ahora avisa "(límite del plan)".
- [x] Verificación transversal: `npm run build` limpio (5.4s) + probes SQL de cada migración.

### Fixes aplicados 2026-07-11 — LOTE 2 (dunning operativo + resiliencia + UX)
- [x] **[IA] 🔴 Botón "Marcar pagado" en AdminPanel** — cierra el P0 de dunning: `admin-update-business` **v9** acepta `record_payment` → RPC `record_payment()` (inserta pago, extiende `plan_expires_at` +1 mes, reactiva plan, quita ai_paused) + botón verde en el header del detalle con toast del nuevo vencimiento. El ciclo 7/30 ya es operable de punta a punta. **[TÚ] 1 clic pendiente:** márcale pagado al negocio real para iniciar su ciclo (hoy su `plan_expires_at` es NULL = nunca vence).
- [x] **[IA] 🟠 Trial de 14 días self-service** — `onboard-tenant` **v13** acepta `trial: true` → `plan_status='trial'` + `plan_expires_at = now()+14d` (el cron `run-dunning` lo vence solo); checkbox "Trial de 14 días" en AdminOnboarding.
- [x] **[IA] 🟠 Alerta de churn silencioso** — `check_silent_churn()` + cron **`churn-silent-alert`** (lunes 08:30): negocio activo sin turnos nuevos ni mensajes en 7 días → notificación `churn_risk` (dedupe 7 días). Verificado agendado. *(migración `silent_churn_alert_cron` — ya son 10 crons)*
- [x] **[IA] 🟠 F-4: resiliencia de red (withRetry)** — nuevo `utils/withRetry.js` (3 intentos, backoff 400/800ms, SOLO transitorios: red caída/5xx/timeout; los 4xx/PGRST pasan directo) + adaptador `retryRead` en el service (supabase-js no lanza errores — los relanza para reintentar). Aplicado a las 4 lecturas calientes: calendario (`getAppointmentsByWeek`), pacientes (`getPatients`), finanzas (`getFinanceSummary`) y `getPlanLimits` (corre en todas las páginas). Solo lecturas — jamás escrituras.
- [x] **[IA] 🟡 F-5: `ConfirmDialog` unificado** — nuevo `ui/ConfirmDialog.jsx` (glass, portal, estados loading/danger); reemplazados los **4** `window.confirm` nativos: FinanceDetailDrawer (anular), PendingValidationDrawer (anular cobro), SuppliesSection (eliminar insumo), AppointmentDrawer (borrado permanente). 0 `window.confirm` en el código.
- [x] Verificación: `npm run build` limpio (6.8s); cron verificado en `cron.job`; edges v9/v13 ACTIVE.

### Fixes aplicados 2026-07-11 — LOTE 3 (features [IA]: búsqueda global, consumo, export)
- [x] **[IA] 🟡 Búsqueda global Ctrl+K** — RPC `search_global(q)` (pacientes reusando el ranking de `search_patients` —respeta visibilidad por plan—, servicios con precio/duración, turnos próximos con fecha en TZ del negocio; EXECUTE solo authenticated) + `CommandPalette.jsx` (glass, portal, debounce 250ms, navegación con flechas/Enter, grupos con íconos, gate `canViewPatients`) montado en el shell del tenant. Rutas: paciente → historial, turno → calendario, servicio → ajustes. **Probe con impersonación:** encuentra "Consulta General" ✓.
- [x] **[IA] 🟡 Histórico de consumo en AdminPanel** — RPC `get_usage_history(business_id)` (super-admin ve cualquier negocio, staff solo el suyo — probe: super-admin ve ✓, staff ajeno 0 filas ✓) + card "Consumo IA por mes" en tab Datos (barras CSS, últimos 12 períodos, mensaje claro mientras el metering H1 siga pendiente) + fecha de vencimiento del plan visible en la card "Plan actual".
- [x] **[IA] 🟡 Export de datos por tenant** — Edge Function **`export-tenant-data` v1** (solo super-admin): arma JSON completo del negocio (pacientes+teléfonos, turnos, servicios, finanzas, categorías, insumos — sin tokens/secretos), lo sube al bucket privado **`exports`** (creado) y devuelve **URL firmada de 24h**. Botón de descarga en el header del AdminPanel. Churn ordenado + backup lógico por-tenant.
- [x] Verificación: migración `search_global_usage_history_exports_bucket` + 2 probes de impersonación con rollback + bucket verificado + `npm run build` limpio (6s).

### Tareas PESADAS de improvments.md (2026-07-18) — análisis profundo, no-front
- [x] **[IA] 🔴 Auditoría RBAC completa + select-all (Pesada #3)** — investigación profunda: los módulos nuevos (Finanzas v2 + Centro IA) tenían **6 acciones que reusaban permisos ajenos** (caja→confirm_delivery, comisiones→manage_roles, métodos/meta→categorías, IA→stats). Fix en toda la pila: **4 permisos nuevos** (`manage_cash`, `pay_commission`, `manage_finance_settings`, `use_ai_hub`) con backfill (owner=true, secretary=false, verificado) + nuevo DEFAULT · `usePermissions` (4 flags) · gates recableados en `Finance.jsx` (Caja/Producción/Ajustes split categorías vs settings), `App.jsx` y `Sidebar.jsx` (ruta/nav `/ai`) · `onboard-tenant` **v15** redeployado · `Users.jsx`: checkboxes nuevos + grupo "Centro de IA" + **botón "Seleccionar/Quitar todos" por módulo**. *(migración `rbac_finance_v2_and_ai_hub_permissions`; build limpio)*
- [x] **[IA] 🔴 Agenda avanzada: festivos, horarios especiales y cupo diario (Pesada #1)** — la más delicada porque toca la lógica compartida bot+dashboard. Nueva tabla **`schedule_exceptions`** (por fecha: cerrado / horario especial, RLS+triggers+audit clonados de supplies) + columna **`businesses.max_appointments_per_day`** (grant de columna a authenticated). **`get_available_slots` v2** (el bot no ofrece slots en festivos ni sobre el cupo) y **`validate_appointment` v2** (rechaza en ambas vías con HINT `SCHEDULE_CLOSED`/`SCHEDULE_DAILY_CAP`) — festivos/cupo son regla de negocio, aplican a bot Y dashboard (a diferencia de los límites de plan). Front: `ScheduleConfigModal.jsx` (botón "Configurar" en Turnos, gated `manage_roles`) + mapeo de errores amables. **Verificado con probes de rollback** (festivo bloquea slots+insert, cupo bloquea 2ª cita) + advisor **0 ERROR**. *(migraciones `schedule_exceptions_and_daily_cap`, `get_available_slots_v2_and_validate_v2`, `grant_max_appointments_per_day_update`)*
- [x] **[IA] 🔴 Eliminación real: citas hard-delete + mensajes individuales (Pesada #4)** — investigación de integridad: encontré **2 bugs latentes**. (1) `notifications.appointment_id` era `NO ACTION` → borrar una cita con notificación **fallaba por FK**; cambiado a `ON DELETE SET NULL` (la notificación e `income_entries` sobreviven desvinculados — el dinero cobrado NO se pierde). (2) `history` **no tenía política DELETE** → "vaciar chat" se ejecutaba en silencio sin borrar nada, y no se podían eliminar mensajes; agregada `history_delete` (business + is_business_active). Front: `deleteHistoryMessage` + **botón de borrar por mensaje** en Conversaciones (hover, gated `delete_conversations`, optimista con rollback) + el purge de citas ahora **avisa si hay cobro registrado**. **Verificado con probe de rollback** (purge preserva notif+ingreso). *(migración `real_deletion_history_delete_policy_and_notif_fk`)*
- [x] **[IA] 🔴 Vouchers de pago con código único (Pesada #2)** — subsistema nuevo integrado con Finanzas v2. Tabla **`payment_vouchers`** (código base32 sin caracteres ambiguos, globalmente único, estados pending/redeemed/cancelled/expired, RLS+triggers+audit) + 3 RPCs SECURITY DEFINER: **`create_voucher`** (genera código único con reintento), **`redeem_voucher`** (lo redime el staff → crea `income_entry`: **abono `source='plan'`** si liga a un plan de "Por cobrar" —completándolo si llega a 0— o **ingreso `source='voucher'`** si es independiente; bloquea doble-cobro/vencidos), **`cancel_voucher`**. `income_entries.source` CHECK extendido con `'voucher'`. El paciente NUNCA se autentica (todo lo opera el negocio → sin acceso anon). Front: tab **Vouchers** en Finanzas + `VouchersSection.jsx` (listado con filtros, crear, **compartir por WhatsApp**, copiar código, redimir con método de pago; gated `record_income`). **Verificado con probe** (crear→redimir→ingreso confirmado, doble cobro bloqueado) + advisor **0 ERROR**. *(migraciones `payment_vouchers`, `voucher_rpcs_create_redeem_cancel`, `income_source_add_voucher`)*

### Fixes aplicados 2026-07-20 — LOTE 4 (UX profundo: Finanzas/Stats/Vouchers + módulos, `improvements.md` absorbido)
- [x] **[IA] 🟠 Finanzas → Resumen: collage rediseñado** — fila 1 pasa a compartir grid de 3 columnas con la fila de desgloses (Ingresos+Egresos | Utilidad+Margen | **Meta del mes** como 5to panel, 1/3 del ancho, con icono/objetivo/% integrados); fila 2 = Ingresos por método / Egresos por categoría / Servicios más rentables, ahora **siempre top 3** (se rellena con métodos/categorías/servicios configurados del negocio que aún no tuvieron movimiento, atenuados al 40% opacidad — mismo patrón que el viejo "análisis de servicios"); fila 3 = tendencia Ingresos vs Egresos con más altura + **`ProjectionGauge`** nuevo (velocímetro semicircular SVG con degradado rosa→ámbar→verde, reemplaza los números sueltos de "Proyección de cierre"). `FinanceSummary.jsx` reestructurado, `padTop3()` helper nuevo.
- [x] **[IA] 🟠 Estadísticas: Métricas vuelve a la versión clásica + Inteligencia reorganizada** — Métricas = 2 filas × 2 cols (4 KPIs + turnos por período/tasa de confirmación) sin los 4 datos nuevos; esos 4 (clientes nuevos, recurrentes, preguntaron-no-agendaron, curva nuevos-vs-recurrentes) se movieron a **Inteligencia** en 3 filas × 2 cols, reemplazando el panel de "análisis de servicios" (que ya vive en Finanzas) por la curva de clientes (`ClientsTrendChart` migrado de BarChart a AreaChart). Donut de confirmación: radio reducido (40%/56%) + leyenda con texto más grande, corregido un bug de hueco vacío (contenedor fijo de 110px vs panel `flex-1` real).
- [x] **[IA] 🔴 Vouchers v2 — fusión con cobro de turnos + restyle + PDF** — **fusión de flujo**: `submit_income_validation` ahora crea un voucher `pending` ligado al cobro (`income_id`/`appointment_id`/`service_name` nuevos en `payment_vouchers`); `confirm_income_validation` lo completa a `redeemed`; `void_income_entry` lo cancela; `redeem_voucher` detecta vouchers ligados y **confirma el cobro pendiente en vez de duplicar el ingreso** (probado: doble cobro bloqueado). `create_voucher` gana `p_service_name` para vouchers manuales. Front: `VouchersSection.jsx` reescrito (panel continuo sin división, doble-botón de filtro estilo Finanzas, búsqueda por código, fichas con icono del sistema, sin azul, botón **exportar PDF** en cobrados — ventana imprimible tipo recibo con cliente/servicio/monto/método/fechas), modal de creación con typeahead de paciente + selector de servicio. *(migraciones `voucher_fusion_appointment_flow`; probes de rollback verificados: fusión A/B/C + doble-cobro bloqueado)*
- [x] **[IA] 🟡 Servicios: paginación real + feedback de modo edición** — `getServices({page,pageSize})` retro-compatible (sin args = array completo para pickers; con args = `.range()`+count); `Settings.jsx` con estado de paginación local + botón "Cargar más" (40/tanda). Banner "Editando" ámbar + icono del botón guardar cambia de disquete (crear) a lápiz (editar).
- [x] **[IA] 🟠 Ofertas: paginación + modo edición + layout 2 columnas + % de descuento + redondeo configurable** — mismo patrón de paginación que Servicios (`getOffers({page,pageSize})`); banner "Editando" + icono lápiz; formulario redistribuido a 2 columnas (Nombre+%descuento, Inicio+Fin lado a lado) para no requerir scroll con el sidebar activo; nuevo campo **% de descuento** que calcula el precio promocional desde el precio del servicio (precio sigue editable a mano, con hint "≈X% de descuento" derivado). Nueva columna `businesses.price_rounding_increment` (0.01/0.05/0.10/0.25/0.50/1/5/10, grant de columna a authenticated) + subtab **"Precios"** en Finanzas → Ajustes para configurarlo por negocio. Deep-link `?offer=<id>` con fallback `getOfferById` si la oferta no está en la página cargada. *(migración `business_price_rounding_policy`)*
- [x] **[IA] 🟡 Turnos → "Citas"** — renombrado en Sidebar, header de Calendar.jsx y grupo de permisos en Users.jsx (solo el nombre del módulo; el vocabulario interno "turno" se conserva).
- [x] **[IA] 🟡 Seguimiento** — búsqueda por nombre/teléfono (filtra sobre lo cargado), paginación real con "Cargar más" (`getLostAppointments` con `.range()`+count), períodos "Hoy" y "15 días" agregados al selector.
- [x] **[IA] 🟡 Clientes: GDPR eliminado + perfil reordenado** — botón/modal de borrado GDPR Art.17 quitado por completo (UI + `gdprDeletePatient` + toast + icono, sin dejar código muerto); perfil del cliente reordenado a Centro IA → Notas → Turnos (antes Notas → IA → Turnos); fichas de Centro IA con el icono gris-con-borde del resto del sistema + resumen de estados de citas (metadata útil para la IA); listado de turnos limitado a los últimos 5 + botón "Ver N más". (La paginación del listado de clientes ya existía de antes — `usePatients` con `hasMore`/`loadMore`.)
- [x] **[IA] 🟡 Conversaciones** — menú de 3 puntos (vaciar/eliminar) reemplazado por un botón de basurero directo (se eliminó "vaciar chat" del todo); el botón "ojito" de servicio/oferta activo ahora abre un **diálogo emergente** con el detalle en vez de navegar a `/settings`/`/offers` (perdía el chat abierto); panel de "Ficha del cliente" estirado a la altura del panel de chat (`h-full`) y título de sección agrandado. (Eliminación de mensajes individuales y paginación del historial ya existían de una sesión previa.)
- [x] **[IA] 🟡 Topbar/Sidebar** — icono de usuario en el menú de sesión cambiado de círculo navy a blanco/gris con borde (mismo estilo que las fichas de listados); footer con copyright agregado bajo el nombre del negocio en el Sidebar.
- [x] Verificación: `npm run build` limpio en cada bloque; probes de rollback en las migraciones de DB; advisor de seguridad revisado (0 ERROR nuevo).
- **Revisados y confirmados YA implementados** (sin cambios, evita duplicar trabajo): paginación de Actividad (`getAuditLog` ya con `.range()`+"Cargar más"), select-all por módulo en Users.jsx (Pesada #3), festivos/cupo diario (Pesada #1), eliminación real de citas + mensajes (Pesada #4), vouchers base (Pesada #2).
- **Pendiente explícito, no atacado esta sesión** (requiere tocar muchos módulos o es visual grande): auditoría profunda de "todas las acciones disponibles por módulo" en RBAC (Usuarios), modo oscuro, auditoría de consistencia visual (botones/paneles/degradados) en todos los módulos. Texto "Prueba Enterprise"/botón azul en la sesión de usuario mencionados en `improvements.md` **no se encontraron** en el código actual — probablemente ya resueltos en una iteración anterior o referidos a una pantalla distinta (revisar con el usuario si persiste).
- **`docs/audit_performance/history improvements.md` absorbido (mismo lote):** era el spec histórico previo a `improvements.md`. Sus secciones marcadas **✅ por el propio doc** (Módulo de Finanzas, Módulo de Centro de IA, Módulo de Configuración IA, base de Módulo de Estadísticas — filtros de resumen/producción reubicados, submódulos ingresos/egresos/por-cobrar/caja/producción/ajustes con paginación y estilo unificado, fichas IA con icono gris-con-borde, badges de conversación WhatsApp) quedaron completadas en sesiones previas a esta (ver `finance-module.md`/`ai-center-insights.md` en memoria). Sus dos secciones **sin marcar** — "Gráficas NovTurnIA" (collage de Finanzas + reorganización de Estadísticas) y "vouchers cambios" (restyle + fusión con cobro) — son exactamente lo que quedó documentado arriba en este mismo LOTE 4. El ítem suelto de "Módulo de usuarios" (select-all + auditoría profunda de acciones) es el mismo que el punto de RBAC ya listado en §4 (P2) — no se duplica.

### Fixes n8n en vivo (2026-07-10) — aplicados por API contra el workflow activo `NovTurnAI`
- [x] **[IA] 🔴 Rate-limit del bot reparado** — nodo `DB - Request API Limit` usaba la key `anon` (revocada) → 401 en cada mensaje. Cambiada a service_role vía PUT a la API de n8n; verificado con diff (solo ese nodo cambió de 143).
- [x] **[IA] 🔴 Gate "¿Teléfono Negocio Existe?" reconectado** — corría DESPUÉS de `Plan - Obtener` (no protegía nada): un `phone_number_id` no registrado tronaba con `invalid input syntax for type uuid: "undefined"` (ejecuciones #368/#369). Ahora: `Negocio - Obtener → ¿Existe? → Plan - Obtener`. Verificado con diff (solo 3 conexiones cambiaron, 0 nodos).
- [x] **[IA] Número sandbox de Meta registrado** — `phone_number_id 1073994989122190` (número de pruebas de la app) asignado a "Clínica Doc (Prueba Enterprise)" para pruebas end-to-end con WhatsApp real.
- [x] Verificado en ejecución #370: flujo completo OK hasta el agente (negocio→plan→gates→buffer→paciente creado→historial→Agente Enterprise responde).

---

## 2. 🔴 PENDIENTES P0 — hacer primero (bloquean producción / cobro)

- [x] **[IA] 🔴 Fix rate-limit en n8n** — ✅ HECHO 2026-07-10 por API (ver §1 "Fixes n8n en vivo"). *(doc 05 §1)*
- [ ] **[TÚ] 🔴 Credencial de WhatsApp en n8n no cubre el número sandbox** — los nodos `WA - Respuesta *` firman con la credencial fija "WhatsApp account" (`4OfxV7OuSSMmbwnp`), compartida por los 3 planes; Meta rechaza el envío desde el número de pruebas (`GraphMethodException 100/33`, ejecución #370). Además `businesses.whatsapp_token` **no se usa al enviar** (solo la credencial de n8n) → funciona en Modelo B (todos los números bajo tu WABA), pero hay que renovar/alinear el token de esa credencial en n8n → Settings → Credentials para probar con el sandbox, o probar con un número real del WABA.
- [x] **[MIXTO] 🔴 Dunning 7/30 días automático — COMPLETO** ✅ 2026-07-11: DB (Aud.#2) + **botón "Marcar pagado"** en AdminPanel (`admin-update-business` v9 → `record_payment`). **[TÚ] queda 1 clic:** marcar pagado al negocio real para arrancar su ciclo. Opcional futuro: aviso "vence en 3 días" vía `notifications`.
- [x] **[IA] 🔴 Suspensión con dientes (server-side)** — `is_business_active()` en RLS de escritura de 9 tablas; suspendido = solo-lectura. Verificado por impersonación. *(2026-07-06, migración `audit2b_rls_suspend_writes`)*
- [ ] **[TÚ] 🔴 Decisión metering** — `record_usage` nunca se llama → panel admin en 0 y `ai_paused` no corta. Cablear el nodo `record_usage` en n8n **o** ajustar el doc 01 para no depender de `ai_paused`. *(doc 09 §A.3 #6)*
- [ ] **[MIXTO] 🔴 Classifier Pro truncado** — `Modelo - Embedding Pro` con `maxOutputTokens: 10`; el JSON de clasificación necesita ~30 → todo mensaje del tier Pro degradaría a "Classifier Fallido"+handoff. Fix: subir a 100. **[IA] puede aplicarlo por API.** *(doc 09 §A.3 #4)*
- [ ] **[MIXTO] 🔴 Historial del bot pierde mensajes recientes** — `Historial - Obtener` `limit=10` sin `order` → trae los 10 más VIEJOS de la ventana de 3h. Fix: order `created_at desc`. **[IA] puede aplicarlo por API.** *(doc 09 §A.3 #5)*
- [ ] **[MIXTO] 🔴 El bot ignora `ai_paused`** — ni el corte automático ni el kill-switch del AdminPanel apagan la IA (0 menciones en el workflow activo; `¿Plan Activo?` no lo evalúa). Fix: condición extra en ese gate — el dato ya viene en `Negocio - Obtener`, 0 requests extra. **[IA] puede aplicarlo por API.** *(Modelo de Negocio §8 H2)*
- [ ] **[TÚ] 🔴 Recordatorios/auto_confirm se venden pero no existen** — el workflow activo no tiene ningún `scheduleTrigger`; `reminders` (Pro/Ent) y `auto_confirm` (Ent) están en `plans.features` sin motor detrás. Decidir: portar el flujo del workflow viejo inactivo o quitar los flags hasta implementarlos. *(Modelo de Negocio §8 H6)*
- [x] **[IA] 🔴 Pricing v3 APLICADO** — ✅ 2026-07-11: `UPDATE plans` verificado (599/500); AdminOnboarding no requería cambio (solo tiers, sin precios). *(ver §1 "Fixes aplicados 2026-07-11")*

## 3. 🟠 PENDIENTES P1 — siguientes (retención / consistencia / seguridad)

- [x] **[IA] 🟠 Alerta de churn silencioso** — ✅ 2026-07-11: cron `churn-silent-alert` (lunes 08:30) + `check_silent_churn()` con dedupe. *(ver Lote 2)*
- [ ] **[MIXTO] 🟠 Emails transaccionales** — Edge Function `send-email` + Resend (3,000/mes gratis) sobre `businesses.notification_email` (columna ya existe). Disparadores: dunning, alta de tenant, corte por límite (`ai_paused_reason='usage_limit'`).
- [ ] **[TÚ] 🟠 Cablear `Tool - Perfil Paciente Enterprise`** en el Agente Enterprise (usa `get_patient_profile`, ya creado) + regla "solo si cliente recurrente". *(doc 05 §2.2)*
- [x] **[IA] 🟠 Endurecer funciones SECURITY DEFINER expuestas** — mínimo privilegio aplicado; anon 24→3, cada función mapeada a su rol. *(2026-07-06, Aud.#1, migración `audit1_least_privilege_execute_grants`)*
- [x] **[IA] 🟠 Ownership-check en `get_visible_patient_ids/staff_ids`** — ✅ 2026-07-11, probe de impersonación sin fugas. *(migración `ownership_check_get_visible_ids`)*
- [ ] **[TÚ] 🟠 Activar "Leaked password protection" (HIBP)** en Supabase Auth (Studio → Authentication → Policies). 1 clic. *(advisor security)*
- [x] **[IA] 🟠 Trial de 14 días self-service** — ✅ 2026-07-11: `onboard-tenant` v13 (`trial: true` → trial + vence a 14d) + checkbox en AdminOnboarding. *(ver Lote 2)*
- [ ] **[TÚ] 🟠 Error Workflow global en n8n** — workflow con *Error Trigger* que loguee toda excepción no capturada (tabla `bot_errors` o `notifications`) + configurarlo como `errorWorkflow` del principal. Cierra "los errores mueren en silencio". *(Automatización §A.4)*
- [ ] **[TÚ] 🟡 Alinear conteos del bot** — `Conversaciones - Contar` cuenta user+assistant (≈2×) y arrastra todas las filas del mes (payload); gate de turnos usa `created_at` vs `date_start`; el bot ignora `limit_overrides`. *(doc 09 §A.3 #10-12)*
- [ ] **[MIXTO] 🟠 Blindar envío WA** — `WA - Respuesta *` sin `onError`: si Meta rechaza, no se guarda history ni hay handoff (visto en ejec #370). Conectar rama de error a Notif/Handoff existentes. *(doc 09 §A.3 #8)*
- [ ] **[MIXTO] 🟠 Fijar `modelName` en los 4 nodos Gemini sin él** (Pro/Enterprise agentes y classifiers) — hoy dependen del default de n8n. *(doc 09 §A.3 #9)*
- [ ] **[TÚ] 🟠 History guardado ≠ enviado en ramas especiales** — textos hardcodean "urgencia dental"/"doctor" para todos los rubros. Igualar al textBody real de cada WA. *(doc 09 §A.3 #7)*
- [x] **[IA] 🟠 F-1 (re-auditado y resuelto)** — el hueco real era `manage-staff` sin check de límite (trigger exento por service_role) → check en la Edge + **redeploy v8** + contador `X/Y` en Users.jsx. ✅ 2026-07-11.
- [x] **[IA] 🟠 F-8: errores `PLAN_LIMIT_*` amables** en `createPatient`/`createAppointment`. ✅ 2026-07-11.
- [x] **[IA] 🟡 I-8: 3 servicios sembrados** en el negocio de prueba. ✅ 2026-07-11.

## 4. 🟡 PENDIENTES P2 — mejoras (cuando haya holgura)

- [ ] **[TÚ] 🟡 Vault para `whatsapp_token`** (hoy texto plano; diferido para no romper n8n). *(doc 03 §9.1)*
- [x] **[IA] 🟡 Revocar grants de escritura sobre `plans`** a anon/authenticated (RLS ya bloquea; defensa en profundidad). *(2026-07-06, migración `harden_plans_revoke_write_grants`)*
- [x] **[IA] 🟡 `AdminOnboarding` / planes hardcodeados** — re-auditado 2026-07-11: solo hardcodea los ids de tier (estables), sin precios ni límites → no hay desync posible con v3. Cerrado como N/A.
- [x] **[IA] 🟡 Actualizar `CLAUDE.md`** — mención de `mv_*` inexistentes → corregida a RPCs de stats. *(2026-07-06)*
- [x] **[IA] 🟡 Búsqueda global (Ctrl+K)** — ✅ 2026-07-11: RPC `search_global` + `CommandPalette.jsx`. *(ver Lote 3)*
- [x] **[IA] 🟡 Histórico de consumo** en el panel admin — ✅ 2026-07-11: RPC `get_usage_history` + card con barras en tab Datos (mostrará datos reales al cerrar H1). *(ver Lote 3)*
- [ ] **[MIXTO] 🟡 Rate limiting por tenant** — reusar `check_rate_limit` con clave `wa:{business_id}` desde el workflow (aislar ráfagas de un tenant para que no degrade a los demás).
- [x] **[IA] 🟡 Resiliencia frontend (withRetry)** — ✅ 2026-07-11: `utils/withRetry.js` + `retryRead` aplicado a las 4 lecturas calientes (solo transitorios, solo lecturas). Circuit breaker completo queda como mejora futura si el volumen lo pide. *(Auditoría §9 / Frontend F-4 — ver Lote 2)*
- [ ] **[TÚ] 🟡 Sentry en prod** — `VITE_SENTRY_DSN` en Vercel + sourcemaps ocultos. *(Auditoría §11 / Frontend F-6)*
- [x] **[IA] 🟡 I-4: 5 overloads duplicados dropeados** — ✅ 2026-07-11 (se droppearon las firmas `p_start_date` + `get_stats_dashboard(2 args)`: el front usa las de `p_months DEFAULT`). Queda 1 firma por función.
- [x] **[IA] 🟡 F-5: `ConfirmDialog` unificado** — ✅ 2026-07-11: `ui/ConfirmDialog.jsx` + los 4 `window.confirm` reemplazados. *(ver Lote 2)*
- [x] **[IA] 🟡 F-2: texto de Conversaciones** — ✅ 2026-07-11: la variable correcta era `maxPatients` (límite que recorta los chats visibles). *(Frontend F-2)*
- [ ] **[IA] 🟡 Auditoría profunda de permisos por módulo (`Usuarios`)** — verificar módulo por módulo que **todas** las acciones existentes tengan su permiso correspondiente en `usePermissions`/`Users.jsx`/DB (no solo las 6 que se cerraron en la Pesada #3). Investigación amplia, tocar con cuidado. *(`improvements.md`, absorbido 2026-07-20)*
- [ ] **[IA/TÚ] 🟡 Auditoría de consistencia visual** — repasar todos los módulos para que botones/paneles/degradados/sombreados sigan exactamente el mismo lenguaje (glass + glows + hover). Cambio ancho, hacerlo en una sesión dedicada. *(`improvements.md`)*

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

### UI grande / diferida (`improvements.md`, absorbido 2026-07-20)
- [ ] **Modo oscuro** — implementarlo como alternativa completa **sin tocar nada del modo claro actual** (o algún panel general oscuro con los mismos colores). Cambio visual grande, sesión dedicada.
- [ ] Re-agendación automática de citas futuras al cancelarse un turno (prioriza clientes en espera para slots liberados).
- [ ] Filtros de período más específicos en Seguimiento (más allá de Hoy/7/15/30/60/90 días).
- [ ] Testear el sistema de punta a punta (QA formal).
- [ ] Recibos y formalización de pagos: aviso de voucher antes de vencer la suscripción, recibo manual.
- [ ] Versionado de la aplicación — delimitar metas y features por versión.

### Otros
- [ ] Memoria semántica pgvector del bot (diferida por costo de tokens; diseño preservado en [Automatización §C.3](Automatización%20Agente%20IA.md)).
- [ ] Stripe al pasar ~5 clientes — Edge Function `stripe-webhook`: `invoice.paid` → INSERT `payments` + `record_payment` → dunning 100% automático.
- [ ] Web Push para handoffs — Realtime ya emite el cambio de `human_takeover`; falta service worker + Push API (VAPID, $0). Hoy la secretaria solo se entera con el dashboard abierto.
- [ ] Storage (100 GB incluidos, sin uso): (a) logo del negocio, (b) imágenes que los pacientes mandan por WhatsApp — hoy el bot las ignora/pierde; bucket por-tenant con RLS de Storage + mostrarlas en Conversaciones.
- [x] Export de datos por tenant — ✅ 2026-07-11: Edge `export-tenant-data` v1 + bucket `exports` + botón en AdminPanel. *(ver Lote 3)*
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

**Eliminado (contenido absorbido, 2026-07-20):** `NovTurnIA Infraestructure/improvements.md` → sus ítems por módulo viven en §1 "LOTE 4" (los ya implementados) y en §4/§5 (los que quedaron pendientes: auditoría RBAC profunda, consistencia visual, modo oscuro y el resto de features marcadas "futuro" en el doc original) · `audit_performance/history improvements.md` → secciones ✅ del propio doc ya completadas en sesiones previas (Finanzas, Centro IA, Configuración IA, base de Estadísticas); "Gráficas NovTurnIA" y "vouchers cambios" son el mismo LOTE 4 de arriba; "Módulo de usuarios" es el ítem de auditoría RBAC de §4.
