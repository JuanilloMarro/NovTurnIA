# Backlog Maestro — Completadas

> Registro único de lo que está hecho y verificado en NovTurnIA.
> **Responsable:** **[IA]** = aplicado por el asistente vía MCP/API · **[TÚ]** = acción manual, ya hecha · **[MIXTO]** = ambos.
> **Hermano:** [Backlog - Pendientes.md](Backlog%20-%20Pendientes.md)

---

## 1. Seguridad y RLS

- [x] **2 hoyos CRÍTICOS de RLS cerrados** — auto-upgrade de plan (`businesses` UPDATE por columna, no por tabla) y escalación RBAC en el UPDATE de `staff_roles`/`staff_users` (exige `manage_roles`). *(El INSERT/DELETE de `staff_users` quedó abierto — ver SEC-1 en Pendientes.)*
- [x] **Superficie `anon` cerrada** — `REVOKE ... FROM PUBLIC` (el hueco real era `PUBLIC`, del cual `anon` es miembro) en RPCs sensibles. Ejecutables por `anon` 24→3.
- [x] **Mínimo privilegio en 30+ funciones** — `authenticated` 41→33. Verificado hoy: los RPC de negocio (`record_usage`, `record_ai_usage`, `check_ai_budget`, `pipeline_touch`, `reactivate_bot`, `record_payment`, `run_dunning`, `check_rate_limit`) son **exclusivos de `service_role`**.
- [x] **`search_path` fijado en todas las funciones** — verificado en producción: **0 de 97 funciones `SECURITY DEFINER` sin `search_path`**. El advisor de `function_search_path_mutable` pasó de 12 a 0.
- [x] **Vistas con `security_invoker`** — `services_with_active_offer` y `v_service_cost` verificadas. Advisor `security_definer_view` eliminado.
- [x] **`reactivate_bot` reescrito** (uuid + esquema real; fallaba en runtime en 3 frentes). Fósiles dropeados: `get_my_business_id`, `suspend_tenant(int)`, `get_available_slots(int)`, `handle_new_staff_user`. Verificado: solo queda 1 firma de `get_available_slots`.
- [x] **InitPlan en 61 de 107 políticas** — `(SELECT get_user_business_id())` evita re-evaluar por fila. `message_buffer` deduplicada 6→3 políticas. *(Faltan 14 — ver INF-3/INF-4.)*
- [x] **Grants de escritura sobre `plans` revocados** a anon/authenticated.
- [x] **Ownership-check en `get_visible_patient_ids`/`get_visible_staff_ids`** — si el caller tiene perfil de staff se fuerza SU negocio. Probe de impersonación: 0 fugas.
- [x] **Dunning end-to-end en DB** — `payments` + `record_payment` + cron `run-dunning` (7/30) + `is_business_active()` + suspensión con dientes (RLS de escritura en 10 tablas). *(Desconectado en el alta — ver B5.)*
- [x] **Advisor de seguridad en 0 ERROR** — verificado en producción: 0 errores, 57 warnings (50 de ellos por diseño: RPC `SECURITY DEFINER` con scope interno), 3 informativos.

## 2. Infraestructura Supabase

- [x] Retención de conversaciones por plan (`history_retention_months` 3/3/12) + cron `retain-history`.
- [x] Particionado mensual automatizado de `history` y `audit_log` + cron `drop-old-partitions`; 16 particiones vacías eliminadas.
- [x] Índices compuestos calientes — verificado: `idx_appt_business_date (business_id, date_start DESC)` y `appt_no_overlap` GiST parcial existen y se usan.
- [x] **12 crons activos con 99.995% de éxito** — verificado: 20,234 ejecuciones en 14 días, 1 fallo transitorio (`clean-message-buffer`, "job startup timeout").
- [x] Extensiones fuera de `public` — las 9 en `extensions`, `pg_catalog` o `vault`.
- [x] Storage: bucket `exports` privado.
- [x] **Prueba de carga sintética ejecutada** — 100,000 filas en esquema aislado, 4 escenarios medidos con `EXPLAIN ANALYZE` impersonando `authenticated`. Resultado: con índice el InitPlan es irrelevante (0.55 vs 2.48 ms); sin índice vale 7.7× (172 vs 1,319 ms); el índice pesa 69× más que el patrón de política. Esquema eliminado, producción verificada intacta. *(Auditoría Técnica §4)*

## 3. Producto, onboarding y pricing

- [x] `onboard-tenant` v11→v15 — auth dual, normalización de schedule/WhatsApp, permisos alineados a `usePermissions` (37 llaves reales), trial 14 días self-service, `view_pipeline` incluido.
- [x] Fix del alta trabada — `adminService.js` con fetch directo + `AbortController` + timeout (evita el navigator-lock huérfano de gotrue).
- [x] **Pricing v3 en producción** — verificado hoy: Básico Q599, Pro Q1,999, Enterprise Q3,999, descuento anual 16%. *(Los cupos siguen en los valores viejos — ver B3.)*
- [x] Botón "Marcar pagado" en AdminPanel → `record_payment`.
- [x] Alerta de churn silencioso — `check_silent_churn()` + cron semanal con dedupe.
- [x] `PlansModal.jsx` reescrito para leer `getPlans()` en vivo — sin precios hardcodeados. Verificado: 19 flags resueltos contra la fila real de `plans`.
- [x] Flags `stats_intelligence` (Centro IA, Pro+) y `business_intelligence` (BI, Enterprise) separados.
- [x] **Límites de plan aplicados en servidor** — verificado: `trg_enforce_patient_limit` (+restore), `trg_enforce_staff_limit` (+reactivate) y `trg_enforce_appointment_limit`, con `get_effective_limit` y `ERRCODE P0001`. *(Falta cerrar el TOCTOU — ver INF-6.)*

## 4. Frontend

- [x] **F-1 — límite de staff real**: el hueco no era un botón faltante sino que `manage-staff` (service_role, exento del trigger) no chequeaba `max_staff`. Fix en la Edge v8 + contador `X/Y` en `Users.jsx`.
- [x] **F-2 — texto de Conversaciones**: la comparación correcta era contra `maxPatients`.
- [x] **F-4 — resiliencia de red**: `utils/withRetry.js` (3 intentos, backoff exponencial, solo errores transitorios) aplicado a las 4 lecturas calientes. *(Falta jitter y circuit breaker — ver RES-1.)*
- [x] **F-5 — `ConfirmDialog` unificado**: 0 `window.confirm` reales en el código.
- [x] **F-8 — errores `PLAN_LIMIT_*` amables**: el HINT del trigger se mapea a mensaje de upgrade.
- [x] **RBAC completo (Pesada #3)** — 4 permisos nuevos (`manage_cash`, `pay_commission`, `manage_finance_settings`, `use_ai_hub`) con backfill + "Seleccionar/Quitar todos" por módulo. Verificado: 4 roles, 43 claves de permiso.
- [x] **`SAFE_DEFAULTS` en `usePlanLimits`** — bloquea features durante la carga; sin flash de contenido premium.

## 5. Finanzas v2

- [x] **DB (8 migraciones)** — `finance_settings` (meta mensual), `payment_methods` configurables con fee%, `payment_plans` + abonos, `staff_users.commission_pct` con snapshot al cobrar + `get_staff_production`, `cash_sessions` (caja diaria), stock de insumos con consumo por receta, gastos fijos recurrentes por cron, `get_finance_projection`, `get_finance_pack`.
- [x] **Frontend** — 9 submódulos (Resumen · Por confirmar · Ingresos · Egresos · Por cobrar · Caja · Producción · Inventario · Ajustes) con comparativas, meta con barra, proyección de cierre, margen real por servicio, export CSV.
- [x] **IA** — scope `finance_narrative` en Centro IA.
- [x] Verificado con 12/12 probes transaccionales con impersonación (stock, abonos, caja, comisiones, producción, proyección, aislamiento cross-tenant).
- [x] **Rediseño de Resumen** — collage con Meta del mes como 5º panel, `ProjectionGauge` SVG.
- [x] **Vouchers de pago** — `payment_vouchers` con código único, RPCs `create_voucher`/`redeem_voucher`/`cancel_voucher`, fusionado con el flujo de cobro de turnos (sin duplicar ingreso), restyle + export PDF tipo recibo.
- [x] **Categorías dinámicas** — `finance_categories` (income/expense, color) + permiso `manage_finance_categories`, integradas en modales y displays.
- [x] Política de redondeo de precios configurable (`price_rounding_increment`) + subtab "Precios".
- [x] **DELETE bloqueado en los libros** — `income_entries` y `expense_entries` usan soft-void, verificado en las políticas.

## 6. Centro IA

- [x] **Fundación** — `ai_insights`/`ai_chat_messages` con RLS + `has_feature`, `get_business_context_pack`, `get_at_risk_patients`. Verificado: **son las únicas 2 políticas de las 107 que gatean por feature en la base**.
- [x] **6 scopes de insights** — `patient_summary`, `patient_strategy`, `retention`, `kpi_narrative`, `weekly_digest`, `content_offer`. Edge `ai-insights` v6, cache-first, `responseSchema` por scope, `thinkingBudget: 0` (arregló un bug real: el thinking por defecto truncaba respuestas a 3-8 tokens).
- [x] **Chat de negocio** — Edge `ai-chat` v5: router de intents (flash-lite) → fetch determinista por RPC → respuesta (flash) → persiste.
- [x] **Frontend** — `AIHub.jsx` (`/ai`) + Asistente IA global en el Topbar + `PatientAIBlock` en la ficha del paciente.
- [x] **Techo semanal de tokens** — `ai_usage_weekly` + `plans.ai_weekly_tokens` (verificado: 0 / 750,000 / 2,000,000) + `check_ai_budget`/`record_ai_usage` + `get_ai_usage` + `UsageBar` real. Reemplazó el uso indebido de `record_usage`. *(Falla abierto — ver SEC-3.)*
- [x] **Contabilidad de tokens correcta** — `thoughtsTokenCount` se suma como salida (no subcontabiliza) y un modelo desconocido se cobra al más caro.
- [x] Bloqueo visual del chat al agotar el presupuesto — input y botón deshabilitados, barra refresca tras cada envío.

## 7. Bot n8n — puesta al día

Workflow activo `NovTurnAI`: **143 → 151 nodos**, aplicado por API con probes de rollback contra la DB real.

- [x] **Fase 0 — estabilización**: `Modelo - Embedding Pro` maxOutputTokens 10→150 (**el tier Pro entero degradaba a handoff**); `Historial - Obtener` limit 10→100 (traía los 10 mensajes más viejos, no los recientes); 6 modelos Gemini con `modelName` explícito; 18/19 nodos WhatsApp con `onError: continueRegularOutput` (antes 0).
- [x] **Fase 1 — circuito de negocio**: 3 nodos `Uso - Registrar {plan}` → `record_usage` (cierra H1); gate `¿Plan Activo?` exige `ai_paused !== true` (cierra H2); `Conversaciones - Contar` pasa de contar `history` (2× por doble-conteo) a leer `usage_counters`; `Turnos - Scheduled` alineado con el trigger; ambos gates honran `limit_overrides` (cierra H3).
- [x] **Fase 2 — Pipeline**: 3 nodos `Pipeline - Actividad {plan}` → `pipeline_touch`.
- [x] **Fase 3 — contexto**: 3 tools `Métodos de Pago` (select frugal, `fee_pct` no viaja al LLM) + regla de pagos en los 3 prompts; `Tool - Perfil Paciente Enterprise` cableado (estaba listo en DB y nunca conectado); reglas `SCHEDULE_CLOSED`/`SCHEDULE_DAILY_CAP` (el bot ya no recibe un error crudo de Postgres al chocar con un feriado o el cupo).
- [x] Textos de `history` en ramas especiales corregidos para no hardcodear vocabulario médico en un producto multi-rubro.
- [x] Rate-limit del bot reparado (key `anon`→`service_role`), gate de teléfono reconectado, número sandbox registrado.

## 8. Pipeline CRM

- [x] **DB** — `pipeline_deals` + `pipeline_events`, RPC `pipeline_touch` idempotente, `get_pipeline_board`/`get_pipeline_metrics` con ownership-check, trigger de sincronización con `appointments`, backfill de 90 días.
- [x] **Frontend** — tablero `/pipeline` con drag HTML5 nativo, 4 columnas con pasos granulares en popover al hover, health badge explícito por tarjeta, checkbox circular con respaldo real en DB.
- [x] **RBAC + gating** — permiso `view_pipeline`, feature flag `pipeline` (Pro+). Realtime activo sobre `pipeline_deals`.
- [x] **La ficha nace en Agendación desde que el bot ofrece algo** — el problema de fondo no era la lógica de etapas sino que **el bot nunca mandaba la bandera específica**: en 8 conversaciones reales solo se registró `activity` genérico. Solución: 3 RPCs envoltorio (`bot_offer_services`, `bot_offer_promos`, `bot_offer_slots`) que devuelven los mismos datos **y** sellan la bandera vía `pipeline_touch`. ⚠️ **Deben ir por POST**: PostgREST ejecuta GET en transacción de solo-lectura, así que por GET el tool respondía 200 con datos correctos y la bandera **nunca se guardaba, en silencio**.
- [x] **Ciclo de vida del deal corregido** — dos bugs encontrados probando con conversaciones reales: un deal ya ligado a cualquier turno nunca volvía a "Agendación"; y crear un segundo turno futuro cerraba el deal del turno **todavía vigente**. Ambas funciones ahora distinguen si el turno ligado ya se resolvió antes de cerrar.
- [x] **Señal fuerte reabre desde cualquier etapa** — incluida Recuperación, que al principio se excluyó por proteger la métrica de "recuperado" y se verificó que **no hacía falta**: `get_pipeline_metrics.recovered` se calcula con `appointments.is_rescheduled`, no con la etapa.
- [x] **Todos los pasos marcables a mano** — `confirmed_by_user` estaba huérfano (el bot no lo llama porque el motor de recordatorios no existe, y `set_pipeline_step` lo rechazaba). El checkbox ahora aparece por presencia de `stepId`, así la secretaria puede marcar cualquier paso cuando ella toma el rumbo del cliente.
- [x] **Columna final replanteada a "Feedback"** — "Fidelización" mide al CLIENTE en el tiempo, concepto distinto a Agendación→Cita programada→Recuperación (pasos de UN turno). Título visible únicamente; el `stage` interno sigue siendo `'loyalty'`, sin migración.
- [x] **Regla de paso a Feedback endurecida** — exige que el turno haya pasado **Y** los 3 checks marcados. `loyalty` se volvió "pegajoso" como `lost`. Se verificó que la protección hacía falta: **2 deals reales** ya estaban en Feedback sin los checks completos.
- [x] **La ficha dejó de navegar al hacer clic** — un mal tecleo mandaba a otro módulo. El popover tiene ahora footer con 3 botones explícitos (Chat/Perfil/Turno) con el patrón "pill blanco + texto que se expande en hover", gateados por permisos.

## 9. UX/UI por módulo

- [x] **Servicios** — paginación real + banner de modo edición.
- [x] **Ofertas** — paginación, modo edición, campo % de descuento, redondeo configurable, y layout de 3 columnas en una fila (Nombre 50% · % descuento 25% · Precio promocional 25%) con padding responsivo.
- [x] **Turnos → "Citas"** — renombrado en Sidebar, header y permisos.
- [x] **Seguimiento** — búsqueda por nombre/teléfono, paginación, períodos "Hoy" y "15 días", ventana de detalle por encima de los botones.
- [x] **Clientes** — GDPR eliminado, perfil reordenado (Centro IA → Notas → Turnos), últimos 5 turnos + "Ver más".
- [x] **Conversaciones** — basurero directo en vez de menú de 3 puntos, "ojito" de servicio/oferta en diálogo emergente (no navega y pierde el chat), panel de ficha a la altura del panel de chat.
- [x] **Stats** — Métricas vuelve al formato clásico (4 KPIs); los datos nuevos se movieron a Inteligencia.
- [x] **Topbar/Sidebar** — icono de usuario blanco con borde, footer con copyright.
- [x] **Panel de notificaciones responsive** — `fixed md:absolute`, `left-2 right-2` en móvil, `bg-white/90` opaco en teléfono contra `bg-white/30` en escritorio. **Es el patrón de referencia** para el resto del trabajo responsive.

## 10. Agenda avanzada y eliminación real

- [x] **Excepciones de horario** — `schedule_exceptions` (festivos, horario especial) + `get_available_slots` v2 + `validate_appointment` v2 + cupo diario (`max_appointments_per_day`).
- [x] **Eliminación real** — hard-delete de citas y borrado de mensajes individuales del historial, con política de DELETE en `history`.
- [x] **Búsqueda** — `search_patients` con ranking, unaccent y trigram (reemplaza el `%substring%` viejo) + `search_global` para Ctrl+K.
- [x] Export de datos por tenant (`export-tenant-data`) e histórico de consumo (`get_usage_history`).

## 11. Auditorías

- [x] **6 auditorías oficiales en esta carpeta**, todas verificadas contra el sistema real: [Modelo de Negocio](Modelo%20de%20Negocio.md) · [WhatsApp Api](WhatsApp%20Api.md) · [Límites de Tokens IA](Limites%20de%20Tokens%20IA.md) · [Infraestructura Supabase](Infraestructura%20Supabase.md) · [Frontend](Frontend.md) · [Auditoría Técnica Multi-Tenant](Auditoria%20Tecnica%20Multi-Tenant.md).
- [x] **Documentos contradictorios eliminados** — los que mantenían precios y diagnósticos obsoletos en paralelo generaban decisiones equivocadas. Todo el contenido vigente quedó absorbido; el histórico sigue en git.
- [x] **Modelo de negocio recalculado con el cobro por mensaje** — costo unitario Q0.135, cupos derivados de `pacientes × 15`, márgenes al 25% de techo de costo, escalera coherente y descuento anual de Básico retirado por dar utilidad negativa.
- [x] **Escalación de privilegios en `staff_users` descubierta y probada** — el backlog anterior la clasificaba como "defensa en profundidad, no explotable hoy". Se demostró lo contrario con transacciones reales y rollback.
- [x] **Diagnóstico erróneo corregido** — se había concluido que `get_stats_dashboard` no devolvía `patient_monthly_stats` ni `inquiry_conversion`, leyendo un archivo del repo 100 migraciones desactualizado. En producción **sí las devuelve**, con datos reales. La migración escrita para "arreglarlo" fue eliminada antes de aplicarse: habría sobrescrito la función buena.
