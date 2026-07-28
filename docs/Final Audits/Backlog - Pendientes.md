# Backlog Maestro — Pendientes

> Todo lo abierto en NovTurnIA, consolidado desde las 6 auditorías de esta carpeta. Cada ítem trae el documento de origen entre paréntesis.
> **Responsable:** **[IA]** = aplicable por el asistente vía MCP/API · **[TÚ]** = requiere Vercel/Supabase Studio/Meta/n8n manual · **[MIXTO]** = ambos.
> **Hermano:** [Backlog - Completadas.md](Backlog%20-%20Completadas.md)
> **Nota:** la auditoría de Automatización IA (n8n) ya está consolidada en esta carpeta ([Automatizacion IA - n8n.md](Automatizacion%20IA%20-%20n8n.md)).

---

## ⚠️ Estado al cierre de la sesión de flota (2026-07-27)

**Bloqueantes que requieren tu mano — nada avanza sin esto:**

| # | Qué | Por qué está trabado |
|---|---|---|
| 1 | **Redeploy de 4 Edge Functions**: `manage-staff`, `ai-chat`, `ai-insights`, `wa-human-reply` | El código de SEC-3, SEC-4, EDGE-1, EDGE-2 y **EDGE-9** está en el repo y verificado con tests, pero **producción sigue corriendo la versión vieja**. En particular EDGE-9: hoy nadie puede gestionar staff desde el dashboard |
| 2 | **PUT del workflow de n8n** (A1 recableado + A3 + A9) | Preparado y verificado (10 nodos, 16 cambios, `payload.json` + `pre.json` de rollback listos). **Bloqueado por el gate de permisos del harness** sobre la escritura a producción: requiere que el humano autorice el comando o lo ejecute él |
| 3 | **INF-1 · paridad de migraciones** | Sigue siendo la única red de seguridad en free tier. Las 3 migraciones nuevas de esta sesión SÍ están versionadas; el resto del delta (127 vs ~29) sigue abierto. Necesita el CLI de Supabase |
| 4 | **OPS-1 · credencial de WhatsApp sandbox** | Impide la prueba end-to-end del bot tras cualquier PUT |

**Interrumpido por límite de gasto de la cuenta** (los agentes murieron a mitad de trabajo; nada quedó a medias en producción):

- **DEC-1 + INF-2 + INF-13** — el agente alcanzó a dejar un veredicto útil sobre INF-2 antes de morir: revocar de `anon` solo `get_cash_sessions`, `get_payment_plans` y `user_has_permission`; **dejar** `get_user_business_id`, `has_feature` e `is_business_active`, que están embebidas en políticas `TO public` y revocarlas podría romper caminos anon. Ninguna migración fue aplicada.
- **EDGE-3/4/5/6** — no alcanzó a escribir código.
- **Responsive T1–T5** — rescatado e integrado por el orquestador (commit `8f935ff`); solo quedó sin correr su spec de Playwright.

**Nota sobre el tenant de QA:** `NovTurnIA QA` (`0dcfe80e-…`) quedó con plan **Enterprise** y `plan_status='active'` (lo subí para poder recorrer los módulos premium). Si querés que expire solo, volvelo a `basic`/`trial`.

---

## P0 — Vulnerabilidades probadas y fugas de costo

- [x] ~~**[IA] SEC-1 · Escalación de privilegios en `staff_users`**~~ — **CERRADO** (migración `sec1_sec2_staff_users_privilege_escalation_guard`). Los 4 verbos de `staff_users` y `staff_roles` exigen `manage_roles`; el INSERT además valida que `role_id` pertenezca al mismo negocio. Verificado antes de aplicar que la UI usa la Edge Function `manage-staff` con `service_role` (salta RLS), así que el endurecimiento no afecta la aplicación.
- [x] ~~**[IA] SEC-2 · Trigger `guard_last_owner`**~~ — **CERRADO** en la misma migración. `trg_guard_last_owner` cubre DELETE y UPDATE (desactivación y cambio de rol). Probado con transacción y rollback: `PROTEGIDO - El negocio quedaria sin ningun administrador activo`. ⚠️ Pendiente menor de UX: el HINT `LAST_OWNER_GUARD` todavía no se mapea a mensaje amable en el frontend (el mismo tratamiento que ya tienen los `PLAN_LIMIT_*`).
- [ ] **[IA] SEC-3 · `check_ai_budget` falla abierto** — `const { data: budget } = await rpc(...)` descarta el `error`; si el RPC falla, `budget` es `null` y la Edge Function **gasta igual**. El techo de tokens se apaga solo ante cualquier fallo de DB. *(Límites de Tokens T1)* **Avance 2026-07-27:** fix listo y en el árbol (`_shared/aiBudget.ts`, fail-closed con 503 `ai_budget_check_failed`), 12 tests Deno en verde. ⚠️ No protege producción hasta redeployar `ai-chat` y `ai-insights` (humano).
- [ ] **[IA] SEC-4 · Tokens de intentos fallidos nunca se descuentan** — `callGeminiJSON` reintenta 2 veces acumulando tokens y luego lanza; ningún caller llama `record_ai_usage` en la ruta de error. Google ya cobró. *(Límites de Tokens T2)* **Avance 2026-07-27:** fix listo y en el árbol (`GeminiError` transporta tokens de intentos fallidos; ambos handlers los descuentan en la ruta de error). Mismo deploy pendiente que SEC-3.
- [ ] **[IA] INF-1 · Reproducibilidad: 127 migraciones en producción contra 27 en el repositorio** — el modelo comercial, Finanzas v2, vouchers, agenda avanzada, Centro IA y los triggers de límite no existen en el código. Un restore desde repositorio produce un sistema distinto. *(Infraestructura §2 I1)*
- [ ] **[TÚ] OPS-1 · Credencial de WhatsApp no cubre el número sandbox** — los nodos `WA - Respuesta *` firman con una credencial que Meta rechaza (`GraphMethodException 100/33`). Bloquea la prueba end-to-end de todo lo aplicado en n8n.
- [ ] **[TÚ] OPS-2 · Activar protección de contraseñas filtradas (HIBP)** — ⛔ **Bloqueado por plan** (verificado en Studio 2026-07-27): "Prevent use of leaked passwords" exige plan **Pro** y **Custom SMTP** configurado. Se desbloquea si el proyecto sube a Pro (el SMTP puede salir de PROD-11/Resend). Mitigación disponible en free, misma pantalla: subir la longitud mínima de contraseña y exigir clases de caracteres.
- [ ] **[IA] A1 · Cancelación de turnos sin aislamiento de tenant** — los 3 nodos `Tool - Cancelar Cita` hacen `PATCH /rest/v1/appointments?id=eq.{{ $fromAI('appointment_id') }}` con `service_role` (salta la RLS) y **sin filtro de `business_id`**; el UUID lo decide el LLM. Los otros 17 tools sí acotan: es la única excepción. RPC `bot_cancel_appointment` lista en *(Automatización IA §4.1)*. **Avance 2026-07-27:** la RPC ya está creada y aplicada en producción (migración `20260728010000_a1_bot_cancel_appointment`, probe cross-tenant PROTEGIDO con rollback verificado). El recableado de los 3 nodos está **preparado y verificado** (túnel arriba, `payload.json` + `transform.mjs` determinista + `pre.json` de rollback en el scratchpad; 10 nodos, 16 cambios, workflow sin mutar). ⛔ **Bloqueado por el gate de permisos del harness sobre el PUT a producción** — requiere que el humano autorice el comando por el sistema de permisos, o lo aplique él. Verificación post-PUT por logs de ejecución (OPS-1 impide el mensaje de prueba por sandbox).
- [ ] **[TÚ] A2 · `service_role` en texto plano en 20 nodos** — las claves viajan en `jsonHeaders` dentro del JSON del workflow, no en el almacén de credenciales de n8n. Cualquiera con acceso al editor o a la API obtiene una llave que ignora toda la RLS. Migrar a credencial *Header Auth* **y rotar la clave** después.
- [ ] **[MIXTO] EDGE-9 · `manage-staff` devuelve 403 a TODOS los usuarios en producción** — descubierto por QA 2026-07-27 y verificado contra la v9 desplegada + las 4 filas reales de `staff_roles`: el gate chequea `permissions?.manage_users`, llave que **no existe en ningún rol** (la real es `manage_roles`, usada por `usePermissions.js`, `Users.jsx`, `onboard-tenant` y las políticas de SEC-1). Efecto: nadie puede crear/borrar/cambiar rol de staff desde el dashboard. **Avance:** fix de una línea aplicado en el repo (`manage-staff/index.ts`); falta redeploy (humano). Nota: esto implica que el check de `max_staff` de F-1 (Completadas §4) nunca se ejerció de verdad en producción — re-verificarlo tras el deploy.

---

## P1 — Modelo de negocio: sin esto el costo por cliente no está acotado

Bloques 1 a 3 son obligatorios para que la escalera de precios se cumpla. *(Modelo de Negocio §8-12)*

**Bloque 1 — medir bien y gastar poco**

> ~~N1 · Consolidar la respuesta del bot a un mensaje por turno~~ — **retirada**: la auditoría de n8n verificó recorriendo el grafo que **ninguna ruta encadena dos envíos**. El bot ya envía un solo mensaje por turno; la palanca de ahorro del 50-66% no existe.

- [ ] **[IA] B1 · Separar entrantes de salientes en `usage_counters`** (`messages_in`/`messages_out`) y que el corte lea solo salientes. Hoy hay un único contador `messages` sin dirección — verificado en el esquema real. **Avance 2026-07-27:** columnas `messages_in`/`messages_out` agregadas (aditivo, backfill conservador `messages_out=messages`), corte lee solo salientes. Migración `20260728020000_b1_b2_b7_outbound_metering` aplicada a producción + verificada por el orquestador (probe 4-arg resuelve, PostgREST recargado). ⚠️ El split real in/out no ocurre hasta que n8n recablee los 3 nodos `Uso - Registrar` (pendiente, ver A5).
- [ ] **[IA] B2 · `record_usage` debe recibir la dirección del mensaje.** **Avance 2026-07-27:** `p_direction text DEFAULT 'out'` agregado. Firma vieja de 4 args reemplazada por la de 5; verificado que las llamadas de 4 args (nodos n8n actuales) resuelven al default `out` sin romperse. Sigue exclusiva de `service_role`.
- [ ] **[IA] A3 · `maxOutputTokens` explícito en los 3 agentes** — hoy queda el default del proveedor y con `maxIterations: 10` un turno puede encadenar 10 llamadas sin tope de longitud. 400 basta para WhatsApp.
- [ ] **[IA] A9 · Bajar la ventana de contexto** — `Historial - Obtener` trae 100 mensajes en cada turno; con 10 iteraciones, el peor caso son 10 llamadas con 100 mensajes cada una. Es el verdadero motor del costo de tokens. Bajar a 20 mensajes y `maxIterations` a 5.
- [ ] **[IA] A5 · Medir tokens reales, no estimados** — `record_usage` calcula `(historial + mensaje + 1200) / 4` en vez de leer el `usageMetadata` de Gemini. Subcuenta ~450 tokens por mensaje (el prompt de sistema son 3,008 caracteres y solo se computan 1,200) y **omite por completo** los tokens de las llamadas a herramientas. El margen del modelo de negocio se calcula hoy con datos sesgados a la baja.

**Bloque 2 — cargar la escalera**
- [ ] **[IA] B3 · Cupos nuevos en `plans`** — `max_conversations` 1,050 / 3,000 / 6,750 · `max_patients` 70 / 200 / 450 · `history_retention_months` Pro 3→6. Verificado en producción: hoy siguen en 500/5,000/20,000 y 50/150/∞.
- [ ] **[IA] B4 · `businesses.extra_messages`** — se suma al cupo, se reinicia con el ciclo. Sin esto no se venden los paquetes de Q350/1,000.
- [ ] **[IA] B7 · `get_plan_limits` debe devolver `messages_out` y el cupo efectivo** (plan + extras − consumido). **Avance 2026-07-27:** devuelve `messages_in`, `messages_out`, `extra_messages`, `max_messages_out` y `messages_out_effective`; preserva todas las claves que ya consume el frontend. El término de extras (B4) se lee tolerante (coalesce 0) hasta que exista `businesses.extra_messages`.
- [ ] **[TÚ] N3 · El gate del bot debe leer el cupo de salientes.**

**Bloque 3 — cerrar el tope del lado del dashboard**
- [x] ~~**[IA] F1 · Bloquear el composer de Conversaciones al agotarse el cupo**~~ — **CERRADO 2026-07-27** (commit `2685fbc`). Composer (textarea + botón Enviar) deshabilitado cuando `messages_out_effective <= 0`, con guarda de defensa en profundidad en `handleSend`. Verificado con Playwright (`OUTBOUND_STATE=blocked`). ⚠️ Riesgo residual: el bloqueo es del lado del dashboard; `wa-human-reply` todavía **no registra el consumo del staff ni consulta el límite** — pendiente en A5/Bloque 1 (recableado n8n).
- [x] ~~**[IA] F2 · Barra de consumo de mensajes salientes**~~ — **CERRADO 2026-07-27**. `OutboundUsageBar` con cupo (`max_messages_out`), consumido (`messages_out`) y fecha de reinicio (1º del mes siguiente). Lee B7, no se acopla al UsageBar de tokens de IA. Verificado (lee 90 salientes, no 290 in+out).
- [x] ~~**[IA] F3 · Aviso al 80% del cupo**~~ — **CERRADO 2026-07-27**. Banner al ≥80% con CTA "Comprar paquete". ⚠️ El CTA queda deshabilitado ("Pronto") hasta que exista `businesses.extra_messages` (B4).

**Bloque 4 — cobranza**
- [ ] **[IA] B5 · `plan_expires_at` en el alta de pago** — `onboard-tenant/index.ts:197` lo crea `NULL` para toda alta que no sea trial, y el cron vence por fecha. Verificado: los 2 negocios de producción tienen NULL y nunca han entrado al ciclo. Se resuelve junto con RES-2.
- [ ] **[TÚ] B5b · Marcar pagado a los 2 negocios existentes** — 1 clic por negocio en AdminPanel.

**Bloque 5 — que la oferta se pueda vender**
- [ ] **[IA] F4 · `PlansModal`: agregar el módulo Centro IA** — verificado: no aparece **ninguna** fila sobre Centro IA, chat, reportes ni límite de tokens. Es el diferenciador que justifica el salto Básico→Pro y es invisible al vender.
- [ ] **[IA] F5 · `PlansModal`: fila de mensajes adicionales** con su precio.
- [ ] **[IA] F6 · AdminPanel: agregar `stats_intelligence` y `business_intelligence` a `FEATURE_DEFS`** — hoy solo cubre 9 de ~17 flags; no se puede dar una prueba de Centro IA sin tocar la base.
- [ ] **[IA] F7 · AdminPanel: consumo de salientes + carga de paquetes.**

---

## P2 — Infraestructura y base de datos

*(Infraestructura Supabase §8 · Auditoría Técnica §6)*

- [x] ~~**[IA] INF-2 · `REVOKE EXECUTE ... FROM anon` en 6 funciones**~~ — **CERRADO PARCIAL 2026-07-27** (migración `20260728040000`): revocadas 3 (`get_cash_sessions(int,int)`, `get_payment_plans(text,int,int)`, `user_has_permission(text)`). Verificado `anon=false`, `authenticated=true`, `service_role=true`. ⚠️ Ojo: el `REVOKE ... FROM anon` es un **no-op** — el permiso venía de `PUBLIC` (misma lección de Completadas §1); se corrigió a `FROM PUBLIC`. **Las otras 3 se dejan a propósito**: `get_user_business_id`, `is_business_active` y `has_feature` están embebidas en 31/17/2 políticas `TO public`; revocarlas convierte un "0 filas" en un **error**. Cerrarlas exige reescribir esas ~50 políticas primero.
- [x] ~~**[IA] INF-3 · Corregir `ensure_future_partitions` para emitir políticas con InitPlan**~~ — **CERRADO 2026-07-27** (migración `20260728030000`). El generador real era `create_monthly_partition`: ahora emite `(SELECT public.get_user_business_id())` y ya no crea política INSERT para las particiones de `history` (DEC-1). Verificado corriendo `ensure_future_partitions(6)`: el fix **persiste** tras regenerar.
- [x] ~~**[IA] INF-4 · InitPlan en las 14 políticas restantes**~~ — **CERRADA la parte prioritaria** (las de particiones `history`/`audit_log`, que crecen sin techo): 16 particiones re-emitidas con InitPlan; medido 0 políticas de partición con el patrón viejo. Quedan las 8 de finanzas, que la propia auditoría clasifica como higiene (con índice el InitPlan no aporta).
- [x] ~~**[IA] INF-5 · Índices de cobertura en 10 claves foráneas**~~ — **CERRADO 2026-07-27** (migración `20260728070000`). Verificado que eran exactamente las 10 del backlog; los 10 índices creados (aditivo).
- [ ] **[IA] INF-6 · TOCTOU en los 3 triggers de límite** — `SELECT count(*)` y comparar no es atómico; dos INSERT concurrentes superan el cupo. Fix con `pg_advisory_xact_lock` por `(tenant, período)`, SQL listo en *(Auditoría Técnica §2.3)*.
- [x] ~~**[IA] INF-7 · Trigger de auditoría en `services` y `offers`**~~ — **CERRADO 2026-07-27**. `audit_services` y `audit_offers` con el mismo cableado ya probado en `supplies`/`payment_methods`. Verificado con probe transaccional: un cambio de precio en `services` deja rastro en `audit_log` (158→159).
- [ ] **[IA] INF-8 · `statement_timeout` e `idle_in_transaction_session_timeout` por rol** — el riesgo de saturación no está en Supavisor sino en el pool de PostgREST, único y compartido entre tenants. SQL en *(Auditoría Técnica §3.1)*.
- [x] ~~**[IA] INF-9 · Agregar `history` a la publicación de realtime**~~ — **CERRADO 2026-07-27** (migración `20260728060000`). Como `history` está particionada, hubo que activar además `publish_via_partition_root=true`: sin eso los eventos viajarían con el nombre de la partición (`history_y2026m07`) y el cliente, suscrito a `history`, no los recibiría. Verificado: `history` en la publicación y `via_root=true`.
- [x] ~~**[IA] INF-10 · `clean-message-buffer` cada 5 minutos**~~ — **CERRADO 2026-07-27**. Verificado que el job es puramente de limpieza (`DELETE ... WHERE expires_at < NOW()`), así que espaciarlo no altera la lógica del bot. Schedule ahora `*/5 * * * *`.
- [ ] **[TÚ] INF-11 · Migrar `whatsapp_token` a Supabase Vault** — texto plano en 1 de 2 negocios; `supabase_vault` está instalado y sin usar.
- [ ] **[IA] INF-12 · Gate `has_feature()` en políticas de escritura premium** — solo 2 de 107 lo usan, ambas de Centro IA. El resto de módulos premium se gatea únicamente en el frontend. **Caso testigo confirmado 2026-07-27** por el detector de asimetría (`supabase/tests/security/verb_asymmetry_detector.sql`): `ai_chat_messages` tiene `has_feature` en SELECT pero no en DELETE. No es escalación (el DELETE conserva `business_id = get_user_business_id() AND staff_user_id = auth.uid()` — solo borra filas propias), pero es exactamente el fix de INF-12 cuando se trabaje.
- [ ] **[TÚ] DEC-1 · Confirmar intención: ¿el cliente debe poder `INSERT` directo en `history` vía REST?** — El detector de asimetría halló que `history` tiene `is_business_active` en DELETE pero no en INSERT. Dirección correcta para un log append-only (registra aunque el negocio esté suspendido, no se puede borrar), pero `history_insert` es alcanzable por REST autenticado acotado al propio tenant. Pregunta de diseño, no deuda: si `history` debe poblarse solo por triggers, es material para endurecimiento futuro; si el INSERT directo es intencional, queda como está. Escalado por `seguridad-rls`, sin acción tomada.
- [x] ~~**[IA] INF-13 · `create_patient_with_phone` sin validación interna de `business_id`**~~ — **CERRADO 2026-07-27** (migración `20260728050000`). ⚠️ **El diagnóstico del backlog estaba corto**: no era defensa en profundidad, era **explotable**. Probado contra producción con rollback: un staff autenticado del negocio A llamó la RPC con el uuid del negocio B y **creó un paciente dentro del tenant ajeno** (la función es `SECURITY DEFINER` y salta la RLS). Fix: ownership-check interno con el patrón de `get_visible_patient_ids`. Verificado post-fix: ataque `PROTEGIDO`, flujo legítimo `OK`, bot con `service_role` `OK` (sin regresión).
- [ ] **[IA] INF-14 · Auditoría asíncrona vía `pgmq`** — los triggers de `audit_log` siguen síncronos en la transacción de negocio. Aceptado por volumen actual.

---

## P3 — Edge Functions

*(Auditoría Técnica §5)*

- [ ] **[IA] EDGE-1 · Cero timeouts en llamadas a terceros** — ni el `fetch` a Meta Graph (`wa-human-reply:121`) ni el de Gemini (`_shared/gemini.ts:33`) declaran `AbortSignal`. Un upstream colgado retiene la invocación hasta el límite de pared; bajo carga agota la concurrencia y el handoff humano deja de funcionar para todos los tenants. Blueprint `fetchUpstream` listo. **Avance 2026-07-27:** `_shared/fetchUpstream.ts` creado (timeout duro por intento + presupuesto total), aplicado a Meta (10s) y Gemini (20s); 13 tests Deno en verde. ⚠️ No protege producción hasta redeploy de `wa-human-reply` + `ai-chat`/`ai-insights` (humano).
- [ ] **[IA] EDGE-2 · Cero reintentos hacia terceros** — un 503 transitorio de Meta pierde el mensaje del staff definitivamente. El bucle de `callGeminiJSON` reintenta solo por JSON que no calza el schema, nunca por fallo HTTP. **Avance 2026-07-27:** reintento con full jitter solo en transitorios (429/5xx/red), respeta `Retry-After`, en el mismo `fetchUpstream`. Ortogonal al reintento por schema de SEC-4. Mismo deploy pendiente que EDGE-1.
- [ ] **[IA] EDGE-3 · Sin idempotencia en el envío de WhatsApp** — un reintento del cliente tras un corte de red duplica el mensaje al paciente. Blueprint de deduplicación por contenido en ventana de 60s.
- [ ] **[IA] EDGE-4 · `Access-Control-Allow-Origin: *` en las 8 funciones**, incluidas `admin-update-business` y `export-tenant-data`. Con `verify_jwt` no es bypass, pero un comodín sobre un endpoint que exporta datos completos de un tenant no pasa revisión.
- [ ] **[IA] EDGE-5 · Variables de entorno sin validación de arranque** — 21 `Deno.env.get`, solo 1 valida ausencia. Si falta `SUPABASE_SERVICE_ROLE_KEY` tras un redeploy, la función devuelve 401 opacos en runtime en vez de fallar al desplegar. Blueprint `requireEnv` listo.
- [ ] **[IA] EDGE-6 · `wa-human-reply` devuelve el error crudo de Meta al navegador** (`meta: errBody?.error`) — expone identificadores internos y trazas del proveedor.
- [ ] **[TÚ] EDGE-7 · `auth-login` y `create-appointment` están en el repositorio y no desplegadas** — o es código muerto o un deploy pendiente.
- [ ] **[TÚ] EDGE-8 · Verificar/redeployar `onboard-tenant`** — confirmar que el deploy v15 es posterior al cambio que agregó `view_pipeline` a OWNER/SECRETARY. Solo afecta tenants nuevos.

---

## P4 — Frontend responsive

*(Frontend §4 — 30 tareas T1–T30, resumidas aquí por fase)*

**Fase 1 — shell (4 archivos, cierra 4 hallazgos)** — ✅ **CERRADA 2026-07-27** (commit `8f935ff`)
- [x] ~~**[IA] T1 · `h-[100dvh]` en lugar de `h-screen`**~~ — **CERRADO**. 0 usos de `h-screen` restantes en `src/`.
- [x] ~~**[IA] T2 · Disolver el marco en móvil**~~ — **CERRADO**. `rounded-none sm:rounded-[24px] lg:rounded-[32px]`; borde y sombra solo desde `sm`.
- [x] ~~**[IA] T3 · Safe areas**~~ — **CERRADO**. Clases `.safe-area-shell` / `.safe-area-card` / `.safe-area-card-lg` en `index.css` con `env(safe-area-inset-*)` y `max()` contra el gutter de diseño (así el render a 1280px queda idéntico).
- [x] ~~**[IA] T4 · Inputs a 16px en móvil**~~ — **CERRADO**. `text-[16px] sm:text-[13px]` en los campos de Login y AdminPanel.
- [x] ~~**[IA] T5 · Ocultar los orbes decorativos bajo `sm`**~~ — **CERRADO**. `hidden sm:block` en los orbes de 500/400px.
> Verificación: `npm run build` limpio. ⚠️ Queda pendiente correr `tests/e2e/responsive-fase1-shell.spec.js` (el spec quedó escrito; el agente murió por límite de gasto antes de ejecutarlo y capturar screenshots).

**Fase 2 — navegación (2 archivos)**
- [ ] **[IA] T6 · Superficie propia del sidebar en móvil** — el `<aside>` es `bg-transparent`: en móvil se desliza sobre el contenido sin fondo propio.
- [ ] **[IA] T7 · Mover el sidebar de `md` a `lg`** — a 768px se lleva 272px de la pantalla.

**Fase 3 — maestro-detalle (el acantilado medido)**
- [ ] **[IA] T8 · Mover los anchos de lista de `md:` a `lg:`** — medido: el panel de detalle pasa de 701px a **58px** entre 767 y 768px, porque dos reglas `md:` disparan a la vez.
- [ ] **[IA] T9 · Drawer de Seguimiento a pantalla completa bajo `lg`** — `sm:pr-[440px]` deja **22px de contenido** a 768px.
- [ ] **[IA] T10 · Patrón maestro-detalle móvil** (solo lista **o** solo detalle) en Servicios, Finanzas y Conversaciones — Ofertas ya lo tiene.

**Fase 4 — contrato de capas**
- [ ] **[IA] T11 · Tokens de z-index en `index.css`** — hoy hay 361 `z-10` y 11 valores distintos sin escala.
- [ ] **[IA] T12 · Regla del portal** — 332 `backdrop-blur` crean contextos de apilamiento y 369 `overflow-hidden` recortan; solo 20 archivos usan `createPortal`. Un menú `z-[200]` dentro de una tarjeta nunca supera a otra tarjeta.
- [ ] **[IA] T13 · Migrar los flotantes que aún viven dentro de tarjetas.**
- [ ] **[IA] T14 · Revisar los `position: fixed` dentro de tarjetas con `backdrop-blur`** — se anclan a la tarjeta, no a la pantalla.

**Fase 5 — gráficas**
- [ ] **[IA] T15 · Hook `useChartHeight()`** (200/260/320 px por breakpoint).
- [ ] **[IA] T16 · Sustituir los 7 altos porcentuales por píxeles** — al pasar a una columna el padre resuelve a `auto` y las gráficas renderizan con 0px.
- [ ] **[IA] T17 · Variantes móviles de gráfica** — radar→lista, donut→barra apilada, LTV→solo ranking.
- [ ] **[IA] T18 · Calendario mensual en móvil como agenda vertical** — `grid-cols-7` da celdas de 49px.

**Fase 6 — componentes del sistema**
- [ ] **[IA] T19 · Componente `<Tooltip>`** por portal, lenguaje glass, detección de borde.
- [ ] **[IA] T20 · Comportamiento táctil del tooltip.**
- [ ] **[IA] T21 · Reemplazar los 160 `title=""` nativos** — invisibles en táctil, no estilizables.
- [ ] **[IA] T22 · Componente `<Toolbar>`** con búsqueda que colapsa a lupa y filtros a botón con contador.
- [ ] **[IA] T23 · Adoptar `<Toolbar>` en las 9 páginas** — hoy **0 de 9** buscadores colapsan.

**Fase 7 — detalle fino**
- [ ] **[IA] T24 · Objetivos táctiles a 44px en móvil** — 128 controles por debajo del mínimo.
- [ ] **[IA] T25 · Escalón tipográfico móvil** — 108 usos bajo 10px.
- [ ] **[IA] T26 · Grids con variante responsive** — 18 sin colapso.
- [ ] **[IA] T27 · Modales con `max-h-[85dvh]` y scroll interno** — 3 de 4 revisados no lo tienen.
- [ ] **[IA] T28 · Probar en horizontal a 812×375.**
- [ ] **[TÚ] T29 · Recorrer los 9 módulos autenticados a 375/414/768/834/1024px** — requiere credenciales de sesión; ninguna auditoría lo ha podido hacer.
- [ ] **[IA/TÚ] T30 · Auditoría de consistencia visual** — repasar que botones, paneles y degradados sigan el mismo lenguaje glass. Sesión dedicada.

---

## P5 — Resiliencia y observabilidad

- [ ] **[IA] RES-1 · `withRetry` v2 con full jitter y circuit breaker** — el actual usa backoff determinista (400/800ms): tras una caída, todas las pestañas de todos los tenants reintentan en el mismo instante. Blueprint listo *(Auditoría Técnica §2.5)*.
- [ ] **[IA] RES-2 · Onboarding atómico** — 4 escrituras secuenciales con compensación que solo borra `businesses` y está silenciada con `.catch(() => {})`. Si falla el paso 4, queda un usuario en `auth.users` sin `staff_users`: login exitoso, dashboard vacío, email bloqueado para reintentos. RPC `provision_tenant` lista *(Auditoría Técnica §2.4)*.
- [ ] **[IA] OBS-1 · Correlation id extremo a extremo** — `set_request_context` + header en el cliente + tag en Sentry con hash de tenant (no el uuid). Diseño en *(Auditoría Técnica §3.2)*.
- [ ] **[TÚ] OBS-2 · Sentry en producción** — `VITE_SENTRY_DSN` sin configurar en Vercel; `vite.config.js` sigue con `sourcemap: false` (cambiar a `'hidden'` + subir a Sentry CLI).
- [ ] **[MIXTO] OBS-3 · Métricas SaaS (MRR, churn, LTV, CAC)** — sin instrumentar. Hoy no se puede responder "¿cuánto facturo este mes?" sin contar negocios a mano.
- [ ] **[TÚ] RES-3 · Error Workflow global en n8n** — no existe un workflow con Error Trigger; un fallo fuera de las ramas manejadas muere en silencio.
- [ ] **[IA] RES-4 · Rate limiting por tenant en n8n** — hoy es por usuario+negocio (20 msg/h); falta cuota agregada que aísle ráfagas de un tenant ruidoso.
- [ ] **[TÚ] RES-5 · Preview deployments de Vercel apuntan a la DB de producción** — configurar una branch de Supabase. Conecta con INF-1: sin migraciones versionadas no se puede levantar una branch con el modelo real.

---

## P6 — Calidad de código

- [ ] **[IA] COD-1 · `cache: 'no-store'` global** — `src/config/supabase.js:14` lo aplica a *todas* las peticiones, anulando el HTTP cache incluso en lecturas idempotentes. Mover a un wrapper opt-in.
- [ ] **[IA] COD-2 · Sin ESLint configurado** — no existe `.eslintrc*` ni `eslint.config.*`.
- [ ] **[IA] COD-3 · 20 archivos con `console.log/error/warn` sin guard `import.meta.env.DEV`** — llegan a producción.
- [ ] **[IA] COD-4 · `RealtimeStatusBanner.jsx` sin montar** — el componente y el estado existen, nunca se importa. Una desconexión de Realtime es invisible para el usuario.
- [x] ~~**[IA] COD-5 · Gate `manage_roles` en INSERT/DELETE de `staff_roles`**~~ — **CERRADO** junto con SEC-1: `staff_roles_insert` y `staff_roles_delete` declaradas explícitas con el gate, en vez de depender de la ausencia de política.
- [ ] **[IA] COD-6 · Auditoría profunda de permisos por módulo** — verificar que todas las acciones tengan permiso en `usePermissions`/`Users.jsx`/DB, no solo las 6 cerradas en la Pesada #3.
- [ ] **[TÚ] COD-7 · Testear el sistema de punta a punta** — QA formal con click-through autenticado. **Avance 2026-07-27:** harness Fase A listo (Playwright 6 viewports, fixture de auth exportable en `tests/fixtures/auth.js`, seed idempotente en `scripts/seed-test-tenant.mjs`, login-smoke 6/6 en verde). ⏸️ Bloqueado en: crear el negocio semilla vía `/admin/new-tenant` (super-admin, humano) y completar `SEED_*` en `.env.test`.
- [ ] **[TÚ] COD-8 · Versionado de la aplicación** — delimitar metas y features por versión.

---

## P7 — Producto y roadmap

**Bot / IA** *(detalle en [Automatización IA - n8n](Automatizacion%20IA%20-%20n8n.md))*
- [ ] **[MIXTO] A4 · Motor de recordatorios (H6)** — confirmado en el workflow activo: **cero `scheduleTrigger`**, el único disparador es `Trigger - WhatsApp`. `reminders` (Pro/Ent) y `auto_confirm` (Ent) se venden sin motor. El workflow inactivo de abril tenía uno completo: es rescate, no obra nueva. **Son 2 de los 15 mensajes del presupuesto del modelo de negocio.**
- [ ] **[TÚ] A10 · `custom_prompt` inyectado a los 3 agentes** — confirmado: aparece en `Agente - Basic`, `Pro` y `Enterprise`. Es feature Pro/Ent; el frontend impide editarlo pero si la columna trae valor el bot lo usa.
- [ ] **[IA] A7 · 92 de 151 nodos sin `onError`** — incluidos `Historial - Obtener`, `Buffer - Obtener`, `Paciente - Crear` y `Audio - Transcribir`. Si fallan, la ejecución muere y **el cliente nunca recibe respuesta**, sin traza. Los 18 de WhatsApp sí están protegidos.
- [ ] **[TÚ] A8 · Workflow de error global** — sin Error Trigger, los fallos de esos 92 nodos no llegan a ninguna tabla ni alerta.
- [ ] **[TÚ] A6 · Pro y Enterprise usan el mismo modelo** (`gemini-2.5-flash`) — la feature `ai_reasoning` vende una escalera de tres niveles que en el bot son dos.
- [ ] **[IA] PROD-3 · Batch semanal automático de Centro IA** — `pg_cron` para `weekly_digest`/`retention`, hoy solo on-demand.
- [ ] **[IA] PROD-4 · Botón "Crear oferta"** que pre-llene el módulo Ofertas desde un insight `content_offer`.
- [ ] **[IA] PROD-5 · Techo de tokens para el bot** — `usage_counters` ya acumula `tokens_in`/`tokens_out` (verificado: 17 mensajes → 9,071 tokens), pero nada corta por tokens y el consumo no se muestra en ninguna pantalla.
- [ ] **[IA] PROD-6 · Reemplazar la heurística Descubrimiento vs Negociación** — el backfill separa las dos primeras etapas por número de mensajes (≥6); con las banderas reales ya disponibles, borrar la aproximación.
- [ ] **[IA] PROD-7 · Memoria semántica pgvector del bot** — diferida por costo de tokens; diseño preservado.

**Finanzas y citas**
- [ ] **[IA] PROD-8 · `appointments.staff_id`** — permitiría asignar profesional al agendar, prerequisito de una agenda multi-silla. La atribución de comisión hoy funciona vía `income_entries.staff_id`.
- [ ] **[IA] PROD-9 · Re-agendación automática al cancelarse un turno** — priorizar clientes en espera para slots liberados.
- [ ] **[IA] PROD-10 · Filtros de período más granulares en Seguimiento.**

**Infraestructura y cobro**
- [ ] **[MIXTO] PROD-11 · Emails transaccionales** — Edge Function `send-email` + Resend sobre `businesses.notification_email` (la columna existe, sin función asociada). Habilita `notification_email`/`gmail_integration`, hoy vendidas sin motor. Disparadores: dunning, alta de tenant, corte por límite.
- [ ] **[TÚ] PROD-12 · Stripe** (al pasar ~5 clientes) — `invoice.paid` → `record_payment` → dunning automático. Al conectarlo entra la comisión de pasarela al margen.
- [ ] **[TÚ] PROD-13 · Migración a WhatsApp Tech Provider + `waba_id` por negocio** (≥15 clientes) — decisión comercial, no deuda técnica. **Cambia la estructura de márgenes**: bajo Modelo A el costo de mensajes deja de ser tuyo.
- [ ] **[TÚ] PROD-14 · Web Push para handoffs** — Realtime ya emite el cambio de `human_takeover`; falta service worker + Push API.
- [ ] **[TÚ] PROD-15 · Storage para logo del negocio e imágenes de pacientes** — hoy el bot las ignora. Bucket por tenant con RLS.

**UI grande**
- [ ] **[IA] PROD-16 · Modo oscuro** — `tailwind.config.js` no tiene `darkMode` y hay 0 clases `dark:`. Sin trabajo previo que reutilizar. Sesión dedicada.
