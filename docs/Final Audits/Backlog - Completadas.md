# Backlog Maestro — Completadas

> Registro único de lo que está hecho y verificado en NovTurnIA.
> **Responsable:** **[IA]** = aplicado por el asistente vía MCP/API · **[TÚ]** = acción manual, ya hecha · **[MIXTO]** = ambos.
> **Hermano:** [Backlog - Pendientes.md](Backlog%20-%20Pendientes.md)

---

## 1. Seguridad y RLS

- [x] **2 hoyos CRÍTICOS de RLS cerrados** — auto-upgrade de plan (`businesses` UPDATE por columna, no por tabla) y escalación RBAC en el UPDATE de `staff_roles`/`staff_users` (exige `manage_roles`). *(El INSERT/DELETE de `staff_users` que quedaba abierto se cerró después en SEC-1, §12.)*
- [x] **SEC-1 · Escalación de privilegios en `staff_users`** — migración `sec1_sec2_staff_users_privilege_escalation_guard`. Los 4 verbos de `staff_users` y `staff_roles` exigen `manage_roles`; el INSERT además valida que `role_id` pertenezca al mismo negocio. Verificado **antes** de aplicar que la UI usa la Edge `manage-staff` con `service_role` (salta RLS), así que el endurecimiento no rompe la aplicación.
- [x] **SEC-2 · Trigger `guard_last_owner`** — misma migración. `trg_guard_last_owner` cubre DELETE y UPDATE (desactivación **y** cambio de rol). Probado con transacción y rollback: `PROTEGIDO - El negocio quedaria sin ningun administrador activo`.
- [x] **COD-5 · Gate `manage_roles` en INSERT/DELETE de `staff_roles`** — `staff_roles_insert` y `staff_roles_delete` declaradas **explícitas** con el gate, en vez de depender de la ausencia de política.
- [x] **Superficie `anon` cerrada** — `REVOKE ... FROM PUBLIC` (el hueco real era `PUBLIC`, del cual `anon` es miembro) en RPCs sensibles. Ejecutables por `anon` 24→3.
- [x] **Mínimo privilegio en 30+ funciones** — `authenticated` 41→33. Verificado hoy: los RPC de negocio (`record_usage`, `record_ai_usage`, `check_ai_budget`, `pipeline_touch`, `reactivate_bot`, `record_payment`, `run_dunning`, `check_rate_limit`) son **exclusivos de `service_role`**.
- [x] **`search_path` fijado en todas las funciones** — verificado en producción: **0 de 97 funciones `SECURITY DEFINER` sin `search_path`**. El advisor de `function_search_path_mutable` pasó de 12 a 0.
- [x] **Vistas con `security_invoker`** — `services_with_active_offer` y `v_service_cost` verificadas. Advisor `security_definer_view` eliminado.
- [x] **`reactivate_bot` reescrito** (uuid + esquema real; fallaba en runtime en 3 frentes). Fósiles dropeados: `get_my_business_id`, `suspend_tenant(int)`, `get_available_slots(int)`, `handle_new_staff_user`. Verificado: solo queda 1 firma de `get_available_slots`.
- [x] **InitPlan en 61 de 107 políticas** — `(SELECT get_user_business_id())` evita re-evaluar por fila. `message_buffer` deduplicada 6→3 políticas. *(Las 14 restantes se cerraron en INF-3/INF-4, §13 — salvo las 8 de finanzas, descartadas por medición.)*
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
- [x] **Límites de plan aplicados en servidor** — verificado: `trg_enforce_patient_limit` (+restore), `trg_enforce_staff_limit` (+reactivate) y `trg_enforce_appointment_limit`, con `get_effective_limit` y `ERRCODE P0001`. *(El TOCTOU se cerró después en INF-6, §13.)*

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
- [x] **Techo semanal de tokens** — `ai_usage_weekly` + `plans.ai_weekly_tokens` (verificado: 0 / 750,000 / 2,000,000) + `check_ai_budget`/`record_ai_usage` + `get_ai_usage` + `UsageBar` real. Reemplazó el uso indebido de `record_usage`. *(Fallaba abierto; cerrado en SEC-3, §14.)*
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

---

## 12. Sesión de flota de agentes — 2026-07-27

> Ejecutada con Fable como orquestador y agentes especializados. Cada ítem revisado en diff por el orquestador antes de integrar. Detalle vivo en [Backlog - Pendientes.md](Backlog%20-%20Pendientes.md).

**Seguridad y aislamiento**
- [x] **A1 (mitad DB) · RPC `bot_cancel_appointment`** — migración `20260728010000`, aplicada a producción. Valida que el turno pertenezca al negocio **y** al paciente antes de cancelar; `service_role`-only, `search_path` fijo. Probe cross-tenant: `PROTEGIDO`, con rollback verificado. ⚠️ El agujero **sigue abierto** hasta recablear los 3 nodos de n8n (ver Pendientes).
- [x] **Tests de regresión SEC-1/SEC-2** — 3 probes transaccionales reejecutables en `supabase/tests/regression/`, corridos contra producción con `RAISE EXCEPTION` de cierre: los 3 dan `PROTEGIDO`.
- [x] **Detector de asimetría de verbos** — `supabase/tests/security/verb_asymmetry_detector.sql`: consulta general sobre `pg_policies` que caza la clase de falla de SEC-1 (gate en un verbo, ausente en su hermano). **Resultado clave: `staff_users`/`staff_roles` ya NO aparecen** — la clase no se repite en ninguna otra tabla. Los 2 residuos quedaron clasificados (uno es el caso testigo de INF-12; el otro derivó en DEC-1).

**Edge Functions** *(el código nació en esta sesión; el despliegue a producción se completó después — ver §14)*
- [x] **SEC-3 · `check_ai_budget` falla CERRADO** — el `error` del RPC ya no se descarta; si el presupuesto no se puede verificar devuelve 503 `ai_budget_check_failed` en vez de gastar igual. Fuente única en `_shared/aiBudget.ts`.
- [x] **SEC-4 · Tokens de intentos fallidos** — `GeminiError` transporta los tokens acumulados y ambos handlers los descuentan vía `record_ai_usage` en la ruta de error (Google ya los cobró).
- [x] **EDGE-1/EDGE-2 · `_shared/fetchUpstream.ts`** — timeout duro por intento (`AbortSignal`) + presupuesto total de pared, y reintento **solo** en transitorios (429/5xx/red) con full jitter, respetando `Retry-After`. Aplicado a Meta Graph (10s, 3 intentos) y Gemini (20s, 2). 13 tests Deno.
- [x] **EDGE-9 (nuevo, descubierto en sesión) · `manage-staff` devolvía 403 a TODOS** — gateaba con `permissions?.manage_users`, llave que **no existe en ningún rol**; la real es `manage_roles`. Nadie podía crear/borrar/cambiar rol de staff desde el dashboard. Verificado contra la v9 desplegada y las 4 filas reales de `staff_roles`.

**Modelo de negocio**
- [x] **B1/B2/B7 · Medición de salientes** — migración `20260728020000`, aplicada a producción. `usage_counters` gana `messages_in`/`messages_out` (aditivo, `messages` retenida); `record_usage` recibe `p_direction` (default `'out'`, compatible con las llamadas de 4 args de n8n); `get_plan_limits` expone `messages_out`, `max_messages_out` y `messages_out_effective`. **El corte de cupo ahora lee solo salientes.** Verificado por el orquestador: la llamada de 4 args resuelve, PostgREST recargado.
- [x] **F1/F2/F3 · Tope del lado del dashboard** — barra de consumo de salientes (cupo/consumido/reinicio), aviso al ≥80% y bloqueo del composer de Conversaciones al agotarse el cupo. Los 3 estados verificados con Playwright. No se acopla al `UsageBar` de tokens del Centro IA: bolsas separadas.

**QA y frontend**
- [x] **Harness E2E — Fase A (base de T29/COD-7)** — Playwright con 6 viewports, fixture de auth exportable (owner/secretary), seed idempotente vía los RPCs del dashboard, scripts npm y job de CI. 12 tests en verde con storageState real.
- [x] **Tenant semilla `NovTurnIA QA`** — `business_id 0dcfe80e-331b-4a8d-9889-5b66732250cc`, creado por MCP replicando `onboard-tenant` (business + 2 roles con los permisos exactos + owner y secretary en `auth.users`). Poblado con 6 pacientes, 6 turnos en todos los estados, servicios, finanzas y 6 deals. ⚠️ Lección: al crear usuarios de Auth por SQL, los tokens de texto deben ir `''` y no `NULL`, o GoTrue rompe el login con 500 pese a un bcrypt válido.
- [x] **Responsive Fase 1 (T1–T5)** — shell móvil: `100dvh`, marco disuelto bajo `sm`, safe areas con `env()`, inputs a 16px y orbes ocultos. El render a 1280px no cambia.

---

## 13. Endurecimiento de base de datos — 2026-07-27 / 07-30

> 10 migraciones aditivas con rollback escrito al pie, aplicadas a producción sin branch ni PITR (free tier). Cada una verificada con probe transaccional cerrado por `RAISE EXCEPTION`. Archivos `20260728001251` → `20260730020000`.

- [x] **INF-2 · Superficie `anon` en RPCs** — revocadas `get_cash_sessions(int,int)`, `get_payment_plans(text,int,int)` y `user_has_permission(text)`. ⚠️ **Lección repetida**: el primer intento hacía `REVOKE ... FROM anon` y era un **no-op** — el permiso venía de `PUBLIC`, del cual `anon` es miembro. Se corrigió a `FROM PUBLIC` y ahí sí midió `anon=false`. **Las otras 3 se dejaron a propósito** (`get_user_business_id`, `is_business_active`, `has_feature`): están embebidas en 31/17/2 políticas `TO public` y revocarlas convierte un "0 filas" en un **error**. Cerrarlas exige reescribir esas ~50 políticas primero — sigue anotado como trabajo futuro en INF-12.
- [x] **INF-3 · El generador de particiones emitía políticas sin InitPlan** — ⚠️ **el backlog culpaba a la función equivocada**: no era `ensure_future_partitions` sino `create_monthly_partition`. Ahora emite `(SELECT public.get_user_business_id())`. Verificado corriendo `ensure_future_partitions(6)`: el fix **persiste** tras regenerar, que era la única prueba que valía.
- [x] **INF-4 · InitPlan en las políticas de partición** — 16 particiones de `history`/`audit_log` re-emitidas; medido **0** políticas de partición con el patrón viejo. Las 8 de finanzas quedan fuera a propósito: la propia prueba de carga (§2) demostró que con índice el InitPlan es irrelevante.
- [x] **DEC-1 · `history` endurecida a append-only** — la pregunta de diseño se resolvió por el lado estricto: se eliminaron las políticas de `INSERT` de `history` y de todas sus particiones, y el generador dejó de crearlas. Verificado hoy: **0 políticas INSERT** en `history*`. El log se puebla solo por trigger y `service_role`; ya no es alcanzable por REST autenticado.
- [x] **INF-5 · Índices de cobertura en 10 claves foráneas** — verificado que eran exactamente las 10 del backlog. Aditivo.
- [x] **INF-6 · TOCTOU en los 3 triggers de límite** — `pg_advisory_xact_lock` con llave por `(negocio, recurso)` —y además el mes en turnos, porque ese cupo es mensual— tomado **antes** del `count(*)`. Verificado: con cupo activo el lock se toma; las llaves de dos negocios distintos difieren (no se bloquean entre sí); el corte sigue disparando con su `HINT` intacto. Con cupo ilimitado (`NULL`) no se toma lock, que es lo correcto.
- [x] **INF-7 · Auditoría de precios** — `audit_services` y `audit_offers` con el cableado ya probado en `supplies`/`payment_methods`. Probe: un cambio de precio deja rastro en `audit_log` (158→159).
- [x] **INF-9 · `history` en la publicación de realtime** — al estar particionada hubo que activar además `publish_via_partition_root=true`: sin eso los eventos viajan con el nombre de la partición (`history_y2026m07`) y el cliente, suscrito a `history`, **no los recibe**. Verificado: en la publicación y `via_root=true`.
- [x] **INF-10 · `clean-message-buffer` cada 5 minutos** — verificado antes de tocarlo que el job es puramente `DELETE ... WHERE expires_at < NOW()`, así que espaciarlo no altera la lógica del bot.
- [x] **INF-13 · `create_patient_with_phone` sin validación de tenant** — ⚠️ **el backlog lo tenía subestimado como "defensa en profundidad"**: era **explotable**. Probado contra producción con rollback: un staff autenticado del negocio A llamó la RPC con el uuid del negocio B y **creó un paciente dentro del tenant ajeno** (es `SECURITY DEFINER`, salta la RLS). Fix: ownership-check interno con el patrón de `get_visible_patient_ids`. Post-fix: ataque `PROTEGIDO`, flujo legítimo `OK`, bot con `service_role` `OK`.

## 14. Edge Functions en producción — 2026-07-27 / 07-30

> Todo lo que la flota dejó escrito quedó **desplegado**. Versiones vivas verificadas: `manage-staff` v10 · `wa-human-reply` v7 · `ai-chat` v7 · `ai-insights` v7.

- [x] **SEC-3 · `check_ai_budget` ya no falla abierto** — el `error` del RPC dejó de descartarse; si el presupuesto no se puede verificar devuelve 503 `ai_budget_check_failed` en vez de gastar igual. Fuente única en `_shared/aiBudget.ts`, 12 tests Deno.
- [x] **SEC-4 · Tokens de intentos fallidos se descuentan** — `GeminiError` transporta los tokens acumulados por los reintentos y ambos handlers los registran vía `record_ai_usage` en la ruta de error. Google ya los cobró; ahora el techo también los ve.
- [x] **EDGE-1/EDGE-2 · Timeouts y reintentos hacia terceros** — `_shared/fetchUpstream.ts`: timeout duro por intento (`AbortSignal`) + presupuesto total de pared, y reintento **solo** en transitorios (429/5xx/red) con full jitter respetando `Retry-After`. Meta Graph 10s/3 intentos, Gemini 20s/2. Ortogonal al reintento por schema de SEC-4. 13 tests Deno.
- [x] **EDGE-5 · Validación de entorno al arrancar** — `_shared/requireEnv.ts` valida al cargar el módulo. `auth.ts` pasó de `Deno.env.get(...)!` —una aserción de TypeScript, **sin ningún efecto en runtime**— a un fallo explícito. Vivo en `wa-human-reply` v7.
- [x] **EDGE-6 · Fuga del error crudo de Meta al navegador** — el detalle del proveedor queda solo en los logs; al navegador va `code: 'WA_SEND_FAILED'`. Verificado que el frontend no consumía el campo `meta` y que el texto visible no cambia.
- [x] **EDGE-9 · `manage-staff` devolvía 403 a TODOS los usuarios** — descubierto por QA y verificado contra la v9 desplegada + las 4 filas reales de `staff_roles`: gateaba con `permissions?.manage_users`, llave que **no existe en ningún rol** (la real es `manage_roles`). Nadie podía crear, borrar ni cambiar el rol de staff desde el dashboard. Fix de una línea, desplegado en v10.
  ⚠️ **Consecuencia**: el check de `max_staff` de F-1 (§4) nunca se ejerció de verdad en producción — está en Pendientes re-verificarlo.

**Regresión que introduje yo al desplegar, y su corrección** — al transcribir los archivos a mano perdí las tildes de textos visibles ("Metodo no permitido", "La ventana de 24h cerro") en `ai-chat` y `wa-human-reply`. Corregido en v7 de ambas. Se verificó que **no rompía lógica**: el frontend discrimina por `code`, nunca por texto. Anotado como divergencia deliberada: `_shared/auth.ts` está desplegado sin las utilidades JWT (`createToken`/`verifyToken`/`getStaffSession`) porque ninguna función desplegada las importa.

## 15. Modelo de negocio — medición de salientes y paquetes

- [x] **B1 · `usage_counters` separa entrantes de salientes** — `messages_in`/`messages_out` (aditivo, `messages` retenida, backfill conservador `messages_out=messages`). **El corte de cupo ahora lee solo salientes.** ⚠️ El split real in/out no ocurre hasta que n8n recablee los 3 nodos `Uso - Registrar` — abierto en A5.
- [x] **B2 · `record_usage` recibe la dirección** — `p_direction text DEFAULT 'out'`. Verificado que las llamadas de **4 argumentos** de los nodos actuales de n8n siguen resolviendo al default sin romperse: eso es lo que permitió aplicarlo con el túnel abajo. Sigue exclusiva de `service_role`.
- [x] **B4 · `businesses.extra_messages`** — columna aditiva + reinicio mensual agregado al cron `reset-usage-ai-pause` (el **mismo** job que despausa, para que no exista una ventana con extras cargados y el negocio todavía pausado). **No hizo falta tocar ninguna función**: `get_plan_limits` y `record_usage` ya la leían de forma tolerante desde B1/B2/B7. Verificado: cargar 500 extras subió el cupo efectivo de 20,000 a 20,500. ➡️ Destraba el CTA "Comprar paquete" de F3.
- [x] **F6 · AdminPanel: las 25 features, no 9** — el panel de super-admin solo listaba **9** de las **25** llaves reales de `plans.features`; las otras 16 solo se podían activar tocando la base a mano. Entre las que faltaban estaban `stats_intelligence` y `business_intelligence`, o sea que **no se podía dar una prueba de Centro IA desde el panel**. Cotejado contra producción: 25 de 25, sin sobrantes.
  Además se marcan en ámbar las que hoy están en el catálogo **sin motor que las cumpla** (`reminders`, `auto_confirm`, `notification_email`, `gmail_integration`, `multi_branch`) y `ai_reasoning` con la nota de que Pro y Enterprise usan el mismo modelo. El toggle funciona igual —el flag existe y el frontend lo lee— pero el aviso evita prometerlas en una demo. Son los hallazgos de A4, A6 y PROD-11 traídos al lugar donde se toma la decisión.
- [x] **B7 · `get_plan_limits` expone el cupo efectivo** — devuelve `messages_in`, `messages_out`, `extra_messages`, `max_messages_out` y `messages_out_effective` (plan + extras − consumido), preservando todas las claves que ya consume el frontend.

## 16. Frontend móvil — 2026-07-30 / 07-31

> **Restricción dura de esta fase, fijada por el dueño:** el estilo de escritorio y tablet **no se toca**. Todo lo nuevo vive dentro de una media query de teléfono o de una variante `max-sm:`. Verificado en el CSS compilado, no solo en el código fuente.

- [x] **COD-4 · `RealtimeStatusBanner` montado** — ⚠️ **el diagnóstico del backlog se quedaba corto**: además de no estar montado, **`setRealtimeStatus` no se llamaba en ningún lado**. `useRealtime.js` tenía esa parte parada a propósito porque `CLOSED` se dispara tanto en una caída real como al desmontar por navegación. Resuelto separando los estados inequívocos (`CHANNEL_ERROR`/`TIMED_OUT` → caída) del ambiguo (`CLOSED` solo cuenta si el cierre no lo provocamos nosotros, vía `tearingDownRef`), y volviendo a `connected` al desmontar para que el banner no quede pegado.
- [x] **T6 · Superficie propia del cajón del sidebar en móvil** — el `<aside>` es `bg-transparent`, así que en teléfono el menú se deslizaba sobre el contenido y los dos textos se leían superpuestos. En escritorio esa transparencia es **deliberada** (el aside vive dentro del marco de vidrio). Solución: bloque "AJUSTES EXCLUSIVOS DE TELÉFONO" en `index.css` dentro de `@media (max-width: 767.98px)` — el punto exacto donde Tailwind activa `md:` y el aside deja de ser cajón. En el JSX **solo se agrega un nombre de clase**; ninguna clase existente se modifica. Medido en estilo computado: 375px → fondo `rgba(255,255,255,.92)` + blur + borde + sombra; 768px y 1280px → transparente, sin blur, sin borde, sin sombra, **idéntico al original**.
- [x] **T22 · Búsqueda que colapsa a lupa** — resuelto con `components/ui/SearchField.jsx` en vez del `<Toolbar>` monolítico que planteaba la auditoría: el markup expandido es **el mismo** que ya vivía inline en cada página, así que adoptarlo no cambia un pixel desde `sm`. Bajo `sm` colapsa a un botón redondo al tono de los demás controles; la X o Escape limpia el texto y vuelve a colapsar, de modo que nunca queda un filtro activo escondido detrás del icono; si el valor viene de fuera, un punto lo señala. *(La adopción página por página es T23, en Pendientes.)*
- [x] **Tira de acciones deslizable en móvil (Citas · Seguimiento · Finanzas · Estadísticas · Clientes)** — en teléfono la fila de acciones pasa de apilarse a una sola línea deslizable. ⚠️ **La causa en Finanzas no era la barra de submódulos**, que ya tenía `overflow-x-auto`: el contenedor padre es `flex-col items-start` bajo `lg`, así que la fila tomaba el ancho de su **contenido** y no el del viewport — por eso el scroll nunca llegaba a activarse y los últimos submódulos quedaban **inalcanzables**. `max-sm:w-full` la ancla al viewport. `[&>*]:shrink-0` es obligatorio: sin él los grupos se comprimen de 223 a 101px.
- [x] **🐛 Hallazgo de método: `max-sm:no-scrollbar` compila a nada, en silencio** — `no-scrollbar` es una clase propia definida **fuera** de `@layer utilities`, y Tailwind no genera variantes para clases que no conoce. No hay error, ni warning: simplemente no existe la regla. Reemplazado por `.mobile-strip` dentro del bloque `@media` de teléfono. **Aplica a cualquier variante sobre una clase propia** (`sm:glass-premium`, `lg:lg-orb`…).
- [x] **T17 · Variantes móviles de las 3 gráficas de Inteligencia** — las tarjetas de LTV, Retención y Predicción usaban un reparto fijo `w-[40%]/w-[60%]` y `w-[45%]/w-[55%]` **sin ninguna variante responsive**: a 375px la gráfica caía a ~135-147px y los nombres de la lista quedaban truncados a dos letras.
  · **LTV → solo ranking**: la barra se oculta bajo `sm` y la lista toma el ancho completo. No se pierde información — la lista ya trae monto, número de citas y última visita; la barra solo los grafica.
  · **Retención → apilado**: el medidor arriba a ancho completo con `h-[150px]` propio (necesario: al apilar deja de heredar alto y sin eso el `height="100%"` del `ResponsiveContainer` no resuelve) y las dos tarjetas abajo en fila.
  · **Predicción → apilado, el radar NO se oculta**: a diferencia del LTV, grafica los 7 días y la lista de abajo solo muestra el top 3 — es información que no está en ningún otro lado. Va a ancho completo con `h-[190px]`.
  Medido: el contenedor de gráfica pasa de ~147px a **327px** de ancho en teléfono. A 768 y 1280px la fila sigue en `row` con la gráfica en 306x208 y 297x208 — **idéntico a antes**.
- [x] **T27 · Modales con tope de alto y scroll interno** — ⚠️ **peor de lo que decía la auditoría**: los 4 modales de formulario (Nuevo/Editar Turno, Nuevo/Editar Cliente) no solo carecían de `max-h`, sino que llevaban `overflow-hidden`. Como el overlay es `fixed inset-0`, la página de atrás tampoco puede desplazarse: en un teléfono el contenido sobrante quedaba **cortado y fuera de alcance**, botón Guardar incluido. O sea que el formulario de Nuevo Turno **no se podía enviar** desde el teléfono.
  Medido con contenido de 14 campos a 375×812: antes la tarjeta medía 1,196px y el pie caía en y=940–1004, **fuera de pantalla**; ahora mide 690px (85dvh) y el pie queda en y=687–751, visible. El scroll se puso en el cuerpo del formulario y no en la tarjeta, para que Cancelar/Guardar queden siempre fijos abajo.
  **Control de no-regresión**: con contenido corto (5 campos) la tarjeta mide `343x512` **con y sin el fix — idéntico**. El tope solo entra en juego cuando el contenido no cabe, así que no cambia ninguna pantalla que hoy se vea bien. Por eso se aplicó sin acotar a `max-sm:`: no altera nada que hoy funcione, solo destraba lo que ya estaba roto.
- [x] **🐛 Nota de método: el HMR de Vite sirve CSS obsoleto** — durante la verificación de T1–T5 llevó a diagnosticar una regresión de tipografía que **no existía**, y a cambiar código que hubo que revertir. Si vas a medir estilos computados tras editar clases de Tailwind, **recargá la página** antes de creerle al número.

---

## 19. Modelo de negocio — cupos, oferta y cobranza (2026-08-01)

- [x] **B3 · Cupos v3 en producción** — `max_conversations` 1,050 / 3,000 / 6,750 · `max_patients` 70 / 200 / 450 · retención Pro 3→6 meses.
  ⚠️ **Esta migración BAJA cupos** (Pro 5,000→3,000, Enterprise 20,000→6,750, y le pone techo a `max_patients` de Enterprise que era ∞). Por eso **antes de aplicarla se midió el consumo real de los 3 negocios**: el máximo son **22 mensajes salientes** contra un cupo nuevo de 6,750, y el negocio con más pacientes tiene **6** contra 450. Nadie quedaba por encima, así que nadie perdió el bot. Verificado negocio por negocio después de aplicar. `limit_overrides` sigue siendo la vía de escape si alguien necesita más.
- [x] **F4 · Centro IA en el modal de Planes** — no aparecía **ni una fila** sobre el módulo, siendo el diferenciador que justifica el salto Básico→Pro: era invisible justo en la pantalla donde se decide la compra. Se agregó la sección con 9 filas (asistente de negocio, resumen y estrategia por cliente, reporte semanal, narrativa de KPIs, retención, narrativa financiera, generación de contenido) y el techo de tokens leído de `plans.ai_weekly_tokens`, mostrado en miles porque "750000" no le dice nada a nadie en una tabla de venta. "Centro IA" pasó además a encabezar los highlights de Pro.
- [x] **F5 · Mensajes adicionales visibles** — fila de paquetes y de aviso al 80% en la sección Conversaciones. Los paquetes existían en la base desde B4 y no se mencionaban en ningún lado: el cliente que se pasaba del cupo no sabía que tenía salida.
- [x] **F3b · El CTA "Comprar paquete" se habilita** — estuvo apagado con la leyenda "Pronto" mientras no existía `businesses.extra_messages`. Abre el modal de Planes, donde ahora vive la fila de mensajes adicionales. **No cobra**: no hay pasarela todavía (PROD-12) y la carga la hace el super-admin. Prometer un cobro que no existe sería peor que el botón apagado.
- [x] **F7 · AdminPanel: consumo de salientes y carga de paquetes** — barra de consumo con los entrantes al lado (aclarando que no consumen cupo) y campo para cargar el paquete.
  · `admin-list-businesses` **v10**: devolvía solo `messages`, el contador viejo **sin dirección**, pero el cupo se corta por salientes desde B1. Ahora incluye `messages_in`, `messages_out` y `extra_messages`.
  · `admin-update-business` **v11**: `extra_messages` agregado a la allowlist y al SELECT de vuelta. Sin eso el campo **se descartaba en silencio** — la columna solo la escribe `service_role`.
  · Probe transaccional: cargar 500 extras sube el cupo saliente efectivo de 6,750 a 7,250. Delta exacto 500, rollback verificado.
- [x] **B5 · `plan_expires_at` nunca queda NULL en un alta** — el alta de **pago** se creaba con `NULL` y el cron `run-dunning` vence por fecha: un cliente que pagaba **nunca entraba al ciclo de cobranza**, su plan no se vencía jamás y nadie le cobraba la renovación. Solo el trial tenía fecha, así que el bug afectaba exclusivamente a los que pagan.
  **Resuelto con trigger en la base, no solo en la Edge Function**, porque así cubre todas las vías de alta (Studio, seeds, migraciones futuras) y no solo la que hoy conocemos. Son compatibles: el trigger solo rellena si viene `NULL`. Probe: pago → +1 mes, trial → +14 días, fecha explícita → **no se pisa**.
  Los negocios existentes con `NULL` **no se tocaron a propósito**: cambiarle la fecha de cobranza a un cliente real es decisión comercial, no técnica. Eso es B5b.
  🐛 Salvedad conocida de `setMonth`/`interval '1 month'`: un alta el 31 de un mes cae al mes siguiente del corto (31-ene → 3-mar, medido). Se deja así — juega a favor del cliente y corregirlo desalinearía el alta de `record_payment`, que tiene el mismo comportamiento.

---

## 20. Resiliencia, linter y dos bugs que aparecieron solos (2026-08-01)

- [x] **RES-1 · `withRetry` v2 con full jitter y circuit breaker**
  · **Full jitter**: la v1 esperaba 400ms y 800ms **exactos**, así que tras una caída de Supabase todas las pestañas de todos los tenants reintentaban en el mismo milisegundo y volvían a tumbar al servidor que se estaba recuperando. Medido: 2,000 muestras dan **722 valores distintos** donde la v1 daba 1.
  · **Circuit breaker**: tras 5 fallos transitorios seguidos el circuito abre y las llamadas fallan de inmediato **sin tocar la red** por 10s; después deja pasar UNA sonda. Sin esto, con el backend caído cada lectura de cada pantalla gasta sus 3 intentos —el usuario espera varios segundos para ver el mismo error— mientras le sigue pegando al servidor. El estado es del módulo entero a propósito: el objetivo es proteger al backend, y todas las lecturas van al mismo backend.
  · Es la misma lógica que ya corre y está probada del lado del servidor en `_shared/fetchUpstream.ts` (EDGE-2): se porta, no se inventa.
  · **18 comprobaciones en verde** con `npm run verify:retry`. El proyecto no tiene runner de tests unitarios para `src/`, así que el script corre con `node` a secas.
  · El breaker se resetea en `resetServiceCaches()`: si quedó abierto por una caída, la sesión nueva no debe arrancar fallando rápido sin siquiera probar la red.
- [x] **COD-2 · ESLint** — config deliberadamente chica: cazar bugs, no imponer estilo sobre 200 archivos que ya funcionan. Quedan **0 errores y 148 warnings**.
  ⚠️ La primera corrida dio **2,043 problemas**, y casi todo era ruido mío: 40 `no-undef` en `scripts/*.mjs` (hueco de config — los `.mjs` no matcheaban el patrón y se quedaban sin globals de Node), los worktrees de `.claude/` de sesiones viejas lintándose como código del proyecto, y 48 avisos de `react-hooks/set-state-in-effect` (regla nueva y muy opinada de v7) sobre patrones que acá funcionan. Esas se bajaron a `warn` a propósito: como error bloquearían cualquier CI futuro por código que hoy anda bien.
  Los 3 errores reales que sí había se arreglaron: un escape innecesario en el regex de email, un `catch {}` vacío sin explicar, y un `catch (err) { throw err }` en `useAuth` que no hacía absolutamente nada.
- [x] **`npm run check:tw` · detector del bug que ESLint NO puede ver** — el caso `max-sm:no-scrollbar` vive dentro de un string de `className`, que para el linter es texto opaco. El script compara el código contra el **CSS compilado**: si Tailwind no generó la regla, la utilidad no existe.
  🐛 Costó dos intentos y los dos fallaron en la misma dirección — **inventar en vez de medir**. El primero adivinaba qué clases eran "propias" leyendo los selectores de `index.css`: 4 falsos positivos, marcaba `w-7` y `h-6` como propias solo porque aparecen dentro de la regla `button.w-7.h-7{…}` de T24. El segundo hacía match libre sobre la línea en vez de tokenizar por espacios: de `group-hover/ia:max-w-[90px]` sacaba `ia:max-w-[90px]`, 8 falsos más. Recién comparando contra el compilado y tokenizando por espacios el detector dice la verdad.
- [x] **🐛 Y encontró 2 bugs REALES que estaban vivos en producción:**
  1. **`hover:bg-navy-800` en 6 lugares — `navy-800` NO EXISTE** en la paleta (50/100/300/500/700/900). Esos 6 botones, incluidos el de `ErrorBoundary`, el de `ConfirmDialog` y dos del AdminPanel, **no tenían ningún hover**. Pasan a `navy-700`, el siguiente tono real; verificado que `.hover\:bg-navy-700:hover` ahora sí está en el CSS compilado.
  2. **`md:custom-scrollbar` en `ScheduleConfigModal`** — el mismo bug exacto que `max-sm:no-scrollbar`: `custom-scrollbar` está fuera de `@layer utilities`, así que la variante compilaba a nada y ese panel mostraba la barra por defecto del navegador.
- [x] **COD-3 · `console` en el bundle de producción** — ⚠️ **el backlog estaba mal planteado**: decía "30 archivos con `console.log/error/warn`". La cuenta real es **45 `console.error`, 1 `console.warn` (ya con guard) y CERO `console.log`**.
  Eso cambia el arreglo. `console.error` en producción **no es ruido**: es lo que deja diagnosticar cuando un cliente reporta algo raro. Borrarlo a mano en 45 lugares sería trabajo para quedar peor. Lo que sí conviene sacar es la familia informativa. Resuelto con una línea de `esbuild.pure` en `vite.config.js`, que cubre todo el bundle sin tocar ni un archivo de `src/` y sin depender de que alguien se acuerde del guard.
  Medido en el bundle: `console.log` **10 → 0** (venían de dependencias, ya que `src/` no tenía ninguno), `console.error` 68 y `console.warn` 19 **intactos**.
- [x] **T24b · Los 5 botones táctiles que el CSS no alcanzaba** — eran los 5 el **botón de cerrar de los cajones**, o sea el objetivo táctil más importante del teléfono. Llevan `overflow-hidden` para recortar sus glows al círculo, y eso también recortaba el pseudo-elemento de T24. Se resolvió sin trucos: en teléfono pasan a 40px con `max-sm:w-10 max-sm:h-10`, el mismo tamaño que el resto de controles móviles del sistema. Medido: 375px → 40×40 visual con ~39px de área sensible; 1280px → **28×28, sin cambios**.

---

## 21. Infraestructura y medición de INF-1 (2026-08-01)

- [x] **INF-8 · Topes por rol** — ⚠️ **el diagnóstico estaba a medias**. Decía "falta `statement_timeout` e `idle_in_transaction_session_timeout` por rol". Medido antes de tocar: `statement_timeout` **ya existía** donde importa (anon 3s, authenticated 8s, authenticator 8s + lock_timeout). Lo que faltaba de verdad era otra cosa:
  · **`idle_in_transaction_session_timeout` estaba en 0 — desactivado para todos.** Una transacción abierta y abandonada retenía locks y una conexión del pool indefinidamente. Ahora 60s (authenticated/service_role) y 30s (anon).
  · **`service_role` no tenía ningún límite**, y es justo el rol con el que entran el bot y las Edge Functions: heredaba el default de 2 minutos por consulta sobre un pool compartido, que es exactamente el modo de fallo que INF-8 quería evitar. Ahora 30s.
  **Los números salieron de medir, no de estimar** (`pg_stat_statements`, 4,443 consultas): pico máximo 10,075ms, cero consultas sobre 20s, y las 7 que pasan de 5s son **todas internas de Supabase** (decodificación WAL de realtime, listados de Studio) — ninguna de la aplicación. 30s es el triple del peor pico real.
  ⚠️ Los ajustes de rol se aplican al abrir la conexión; PostgREST mantiene pool, así que las abiertas siguen con los valores viejos hasta reciclarse. Se renuevan solas.
- [x] **INF-1 · El delta ya está medido y nombrado** — el ítem sigue abierto (cerrarlo necesita el CLI y la contraseña de la base), pero dejó de ser un número difuso. Ver [INF-1 - Delta de migraciones.md](INF-1%20-%20Delta%20de%20migraciones.md): **141 en producción contra 39 archivos, 21 coinciden, 120 sin contraparte**, listadas una por una y agrupadas por mes.
  El documento también aclara la otra dirección del delta, que nadie había mirado: **18 archivos del repo no existen en producción**. No son un error — son los `001_` a `023_` numerados a mano, de antes de que existiera el seguimiento de migraciones. Su contenido sí está aplicado, pero **no cuentan como respaldo**: no se pueden re-aplicar en orden.
  Y trae la receta concreta (3 comandos) más el argumento de por qué `db pull` a una línea base es lo correcto acá, en vez de reconstruir 120 migraciones históricas que no aportan nada frente a un baseline que sí reproduce el sistema.

---

## 17. Los 9 diagnósticos que resultaron falsos o mal atribuidos

> Registro deliberado. Al trabajar los ítems a fondo, **nueve** describían el síntoma correcto pero señalaban la causa equivocada, o describían un defecto que ya no existía. Sirve para calibrar cuánta fe tenerle al resto del backlog.

| Ítem | Lo que decía la auditoría | Lo que se midió |
|---|---|---|
| INF-13 | "defensa en profundidad, no explotable hoy" | **Explotable**: cross-tenant probado con transacción real y rollback |
| COD-4 | "el banner no está montado" | Además **`setRealtimeStatus` no se llamaba nunca** |
| INF-3 | "corregir `ensure_future_partitions`" | El generador real era **`create_monthly_partition`** |
| INF-2 | `REVOKE … FROM anon` | Es un **no-op**: el permiso venía de `PUBLIC` |
| Finanzas móvil | "la barra de tabs no scrollea" | El **padre** `flex-col items-start` le quitaba el ancho del viewport |
| T16 | "las gráficas renderizan con **0px**" | Nunca miden 0: el grid estira las tarjetas y de ahí sale el alto |
| T18 | "`grid-cols-7` da celdas de **49px**" | Ya tiene scroll horizontal con `min-w-[560px]`: son **80px** |
| T26 | "**18** grids sin colapso" | Son **2**, y uno es el calendario (T18) |
| T11 | "361 `z-10` y 11 valores sueltos sin escala" | La escalera **ya era coherente**; los 356 `z-10` son un solo modismo |
| T27 | "3 de 4 no tienen `max-h`" | Correcto pero **subestimado**: con `overflow-hidden` el contenido quedaba inalcanzable |

**Y los conteos envejecen en las dos direcciones:** COD-3 decía 20 archivos y son **30**; INF-12 hablaba de 107 políticas y son **116**; T21 decía 162 `title=` y son **226**; INF-1 decía 127 vs 27 y es **138 vs 36**.

**Lectura:** los diagnósticos *estructurales* aguantaron; lo que envejece son los números y las atribuciones de causa. **Tratá las cifras como orden de magnitud y, antes de "arreglar" algo, medí que siga roto.**

🐛 **Y cuidado con cómo se mide.** Al verificar T16 mi primera sonda reprodujo la tarjeta **sin el grid que la envuelve**, y ahí sí midió altura 0 — o sea, me confirmó el bug que estaba buscando. El `h-full` interno depende de que el grid estire la tarjeta. **Una sonda que no reproduce el contenedor real miente, y miente en la dirección de confirmar tu hipótesis.**

**La causa de fondo de todo esto es INF-1.** Mientras el repositorio esté ~100 migraciones detrás de producción, cualquier hallazgo derivado de leer archivos del repo puede describir un sistema que ya no existe — ya pasó una vez (§11, el falso diagnóstico de `get_stats_dashboard`, donde la migración "correctora" habría **sobrescrito la función buena**).

---

## 18. Frontend — fases 2 a 7 (2026-07-31)

- [x] **T7 · El sidebar es cajón hasta 1024px (opción C, decisión del dueño)** — a 768px el sidebar fijo se llevaba 272px de 768 (el 35% de la pantalla) y dejaba 496px al módulo. Se movieron **cinco** anclajes de `md` a `lg`, y el quinto es CSS, no JSX: `App.jsx` (`lg:ml-[272px]`), `Topbar.jsx` (hamburguesa), `Sidebar.jsx` (velo, aside y el `innerWidth < 1024` de `closeMobile`) y la media query de T6 en `index.css`, que pasó de 767.98 a 1023.98px.
  ⚠️ **Ese último es el que se olvida**: la superficie del cajón tiene que existir exactamente mientras el aside SEA cajón. Si el CSS se queda en 767.98 y el JSX se va a `lg`, entre 768 y 1023px el menú se desliza transparente sobre el contenido — el bug original de T6, reintroducido. El acoplamiento quedó escrito en el encabezado del bloque de `index.css`.
  Medido: 375px y 768px → cajón, margen 0, hamburguesa visible, superficie `.92` + blur. 1024px → fijo, margen 272px, hamburguesa oculta, superficie `rgba(0,0,0,0)` y blur `none`, **idéntico al escritorio original**.
- [x] **T8 y T9 · El acantilado de los 768px, resuelto de rebote** — no hizo falta tocar ningún ancho de lista. La causa era que **dos reglas `md:` disparaban a la vez**: el sidebar tomando 272px y la lista tomando 340px. Al mover solo el sidebar, queda una. Medido a 768px: el panel de detalle pasa de **124px a 396px** (3.2×) y el contenido útil de Re-agendación con el cajón abierto, de **24px a 296px** (12×). La opción C era la más barata y resultó ser también la que arreglaba el problema medido.
- [x] **T10 · Patrón maestro-detalle móvil** — ya estaba implementado en **todos** los módulos, no solo en Ofertas como decía la auditoría: Conversaciones, Servicios, Usuarios y las 5 secciones de Finanzas usan `${sel ? 'hidden md:flex' : 'flex'}`.
- [x] **T11 · Contrato de capas escrito en `index.css`** — ver §17 sobre por qué no se reescribieron los 356 `z-10`. Quedan documentados los 12 niveles reales y quién vive en cada uno.
- [x] **T12/T13 · Los flotantes salen por portal** — componente `ui/Popover.jsx`, adoptado en los desplegables de Filtros de Clientes, Actividad, Re-agendación y Finanzas.
  ⚠️ **Esto arregló una regresión que introduje yo.** Al volver la fila de acciones una tira deslizable le puse `max-sm:overflow-x-auto`, sin caer en que **poner `overflow-x` en algo distinto de `visible` obliga al navegador a calcular `overflow-y` como `auto`** — no se puede recortar un eje y dejar el otro libre. Los menús de Filtros son `absolute` dentro de esa fila, así que quedaron encerrados: medido, un menú de 220px desbordando 228px una tira de 40px. En cuatro módulos el filtro estaba roto en teléfono.
  La detección de borde se verificó en 5 posiciones de botón (arriba, medio, pegado abajo, borde izquierdo, borde derecho): en las 5 el panel queda dentro de pantalla, y con el botón abajo se abre hacia arriba.
- [x] **T14 · Medido y documentado, NO "arreglado"** — un `position: fixed` dentro de un ancestro con `backdrop-filter` se ancla a ese ancestro: medido, `300x200` en vez de `768x1024`. El shell tiene `backdrop-blur-xl`, así que todo `fixed` de adentro está anclado al marco. **Pero eso acá es deseable**: el marco lleva `safe-area-shell`, así que los cajones a pantalla completa heredan gratis el respeto por el notch. Portarlos los sacaría de esa protección. Se portan los flotantes, no los cajones — y quedó escrito para que nadie lo "corrija".
- [x] **T19/T20/T21 · Componente `ui/Tooltip.jsx`** — por portal, con detección de borde y comportamiento táctil (se abre al tocar, cierra afuera/Escape/scroll), detectado con `matchMedia('(hover: none)')` y no por ancho. Adoptado primero en los `title=` que más duelen: los avisos de **"disponible en Enterprise"**, que son de venta y que en teléfono **no se veían** — el `title` nativo no existe en táctil, así que el cliente veía un botón apagado sin ninguna explicación.
- [x] **T24 · Objetivos táctiles** — se agranda el **área**, no el botón: un `::after` invisible extiende la zona sensible y el círculo se sigue viendo igual, así el diseño no se mueve. Solo en vertical, porque estirar a lo ancho haría que dos botones vecinos se solapen y el de más abajo en el DOM se coma los toques del otro.
  **Alcance real, medido con `elementFromPoint`: 11 de los 16.** Los otros 5 llevan `overflow-hidden` en el propio botón y recortan el pseudo-elemento — 26px de área sensible contra 42px sin él, con el mismo tamaño visual de 28×28. Anotado como T24b, no tapado.
- [x] **T26 · AdminPanel** — el grid de horario pasa a 2 columnas en teléfono con "Duración turno" a ancho completo. A 3 columnas cada campo quedaba en ~93px y la etiqueta no entraba.
- [x] **T28 · Horizontal 812×375** — sin scroll horizontal, el shell mide exactamente 375 (`100dvh` cumple), el sidebar es cajón y le deja los 812 al contenido, y los modales topan en 319px **con scroll interno**. Sin T27 este caso habría sido el peor de todos.
- [x] **`ui/Modal.jsx`** — confirmado sin uso (sin import estático, sin `import()`, sin `lazy()`, sin referencia por string, sin `<Modal>`). Se conservó como primitiva de la casa y se le aplicó el patrón de T27, para que quien lo adopte no reintroduzca el modal recortado. Queda como COD-9 decidir si se adopta o se borra.
