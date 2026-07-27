# Backlog Maestro — Pendientes

> Todo lo abierto en NovTurnIA, consolidado desde las 6 auditorías de esta carpeta. Cada ítem trae el documento de origen entre paréntesis.
> **Responsable:** **[IA]** = aplicable por el asistente vía MCP/API · **[TÚ]** = requiere Vercel/Supabase Studio/Meta/n8n manual · **[MIXTO]** = ambos.
> **Hermano:** [Backlog - Completadas.md](Backlog%20-%20Completadas.md)
> **Falta consolidar:** la auditoría de Automatización IA (n8n) aún no está en esta carpeta.

---

## P0 — Vulnerabilidades probadas y fugas de costo

- [ ] **[IA] SEC-1 · Escalación de privilegios en `staff_users`** — las políticas de INSERT y DELETE solo validan `business_id`, sin gate de permiso. **Probado en producción con rollback:** un miembro con `manage_roles = false` puede (a) insertar una fila asignando rol owner a una segunda cuenta que controle, y (b) borrar al dueño del negocio, dejándolo fuera de su propio tenant. SQL listo en *(Auditoría Técnica §2.2)*.
- [ ] **[IA] SEC-2 · Trigger `guard_last_owner`** — impedir que un tenant quede sin ningún administrador. La RLS no puede expresar el invariante. *(Auditoría Técnica §2.2)*
- [ ] **[IA] SEC-3 · `check_ai_budget` falla abierto** — `const { data: budget } = await rpc(...)` descarta el `error`; si el RPC falla, `budget` es `null` y la Edge Function **gasta igual**. El techo de tokens se apaga solo ante cualquier fallo de DB. *(Límites de Tokens T1)*
- [ ] **[IA] SEC-4 · Tokens de intentos fallidos nunca se descuentan** — `callGeminiJSON` reintenta 2 veces acumulando tokens y luego lanza; ningún caller llama `record_ai_usage` en la ruta de error. Google ya cobró. *(Límites de Tokens T2)*
- [ ] **[IA] INF-1 · Reproducibilidad: 127 migraciones en producción contra 27 en el repositorio** — el modelo comercial, Finanzas v2, vouchers, agenda avanzada, Centro IA y los triggers de límite no existen en el código. Un restore desde repositorio produce un sistema distinto. *(Infraestructura §2 I1)*
- [ ] **[TÚ] OPS-1 · Credencial de WhatsApp no cubre el número sandbox** — los nodos `WA - Respuesta *` firman con una credencial que Meta rechaza (`GraphMethodException 100/33`). Bloquea la prueba end-to-end de todo lo aplicado en n8n.
- [ ] **[TÚ] OPS-2 · Activar protección de contraseñas filtradas (HIBP)** — Studio → Authentication → Policies. Un clic.
- [ ] **[IA] A1 · Cancelación de turnos sin aislamiento de tenant** — los 3 nodos `Tool - Cancelar Cita` hacen `PATCH /rest/v1/appointments?id=eq.{{ $fromAI('appointment_id') }}` con `service_role` (salta la RLS) y **sin filtro de `business_id`**; el UUID lo decide el LLM. Los otros 17 tools sí acotan: es la única excepción. RPC `bot_cancel_appointment` lista en *(Automatización IA §4.1)*.
- [ ] **[TÚ] A2 · `service_role` en texto plano en 20 nodos** — las claves viajan en `jsonHeaders` dentro del JSON del workflow, no en el almacén de credenciales de n8n. Cualquiera con acceso al editor o a la API obtiene una llave que ignora toda la RLS. Migrar a credencial *Header Auth* **y rotar la clave** después.

---

## P1 — Modelo de negocio: sin esto el costo por cliente no está acotado

Bloques 1 a 3 son obligatorios para que la escalera de precios se cumpla. *(Modelo de Negocio §8-12)*

**Bloque 1 — medir bien y gastar poco**

> ~~N1 · Consolidar la respuesta del bot a un mensaje por turno~~ — **retirada**: la auditoría de n8n verificó recorriendo el grafo que **ninguna ruta encadena dos envíos**. El bot ya envía un solo mensaje por turno; la palanca de ahorro del 50-66% no existe.

- [ ] **[IA] B1 · Separar entrantes de salientes en `usage_counters`** (`messages_in`/`messages_out`) y que el corte lea solo salientes. Hoy hay un único contador `messages` sin dirección — verificado en el esquema real.
- [ ] **[IA] B2 · `record_usage` debe recibir la dirección del mensaje.**
- [ ] **[IA] A3 · `maxOutputTokens` explícito en los 3 agentes** — hoy queda el default del proveedor y con `maxIterations: 10` un turno puede encadenar 10 llamadas sin tope de longitud. 400 basta para WhatsApp.
- [ ] **[IA] A9 · Bajar la ventana de contexto** — `Historial - Obtener` trae 100 mensajes en cada turno; con 10 iteraciones, el peor caso son 10 llamadas con 100 mensajes cada una. Es el verdadero motor del costo de tokens. Bajar a 20 mensajes y `maxIterations` a 5.
- [ ] **[IA] A5 · Medir tokens reales, no estimados** — `record_usage` calcula `(historial + mensaje + 1200) / 4` en vez de leer el `usageMetadata` de Gemini. Subcuenta ~450 tokens por mensaje (el prompt de sistema son 3,008 caracteres y solo se computan 1,200) y **omite por completo** los tokens de las llamadas a herramientas. El margen del modelo de negocio se calcula hoy con datos sesgados a la baja.

**Bloque 2 — cargar la escalera**
- [ ] **[IA] B3 · Cupos nuevos en `plans`** — `max_conversations` 1,050 / 3,000 / 6,750 · `max_patients` 70 / 200 / 450 · `history_retention_months` Pro 3→6. Verificado en producción: hoy siguen en 500/5,000/20,000 y 50/150/∞.
- [ ] **[IA] B4 · `businesses.extra_messages`** — se suma al cupo, se reinicia con el ciclo. Sin esto no se venden los paquetes de Q350/1,000.
- [ ] **[IA] B7 · `get_plan_limits` debe devolver `messages_out` y el cupo efectivo** (plan + extras − consumido).
- [ ] **[TÚ] N3 · El gate del bot debe leer el cupo de salientes.**

**Bloque 3 — cerrar el tope del lado del dashboard**
- [ ] **[IA] F1 · Bloquear el composer de Conversaciones al agotarse el cupo** — verificado: `wa-human-reply` no registra consumo ni consulta el límite. Cada respuesta del staff cuesta Q0.104, no descuenta cupo y no aparece en el contador.
- [ ] **[IA] F2 · Barra de consumo de mensajes salientes** con cupo, consumido y fecha de reinicio.
- [ ] **[IA] F3 · Aviso al 80% del cupo** con opción de comprar paquete.

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

- [ ] **[IA] INF-2 · `REVOKE EXECUTE ... FROM anon` en 6 funciones** — `get_cash_sessions(int,int)`, `get_payment_plans(text,int,int)`, `get_user_business_id()`, `has_feature()`, `is_business_active()`, `user_has_permission()`. Verificado que hoy devuelven 0 filas sin JWT, pero son superficie innecesaria y las dos de finanzas son overloads nuevos que nacieron con permiso para PUBLIC.
- [ ] **[IA] INF-3 · Corregir `ensure_future_partitions` para emitir políticas con InitPlan** — **hacer esto ANTES que INF-4**: cada mes el generador añade 2 políticas con el patrón viejo, así que corregir las existentes sin tocar el generador es trabajo que se deshace en 30 días.
- [ ] **[IA] INF-4 · InitPlan en las 14 políticas restantes** — prioridad real: las **6 de particiones** `history`/`audit_log` (crecen sin techo). Las 8 de finanzas son higiene: medido que con índice el InitPlan no aporta nada.
- [ ] **[IA] INF-5 · Índices de cobertura en 10 claves foráneas** — `ai_chat_messages.staff_user_id`, `ai_insights.generated_by`, `cash_sessions.opened_by/closed_by`, `income_entries.staff_id`, `payment_plans.patient_id/created_by`, `payment_vouchers.patient_id/redeemed_income_id`, `pipeline_events.patient_id`. Medido que el índice pesa 69× más que el patrón de política.
- [ ] **[IA] INF-6 · TOCTOU en los 3 triggers de límite** — `SELECT count(*)` y comparar no es atómico; dos INSERT concurrentes superan el cupo. Fix con `pg_advisory_xact_lock` por `(tenant, período)`, SQL listo en *(Auditoría Técnica §2.3)*.
- [ ] **[IA] INF-7 · Trigger de auditoría en `services` y `offers`** — las dos tablas donde vive el precio no dejan rastro, mientras `supplies` y `payment_methods` sí.
- [ ] **[IA] INF-8 · `statement_timeout` e `idle_in_transaction_session_timeout` por rol** — el riesgo de saturación no está en Supavisor sino en el pool de PostgREST, único y compartido entre tenants. SQL en *(Auditoría Técnica §3.1)*.
- [ ] **[IA] INF-9 · Agregar `history` a la publicación de realtime** — los mensajes entrantes de WhatsApp no llegan en vivo a Conversaciones.
- [ ] **[IA] INF-10 · `clean-message-buffer` cada 5 minutos** en vez de cada minuto — 20,160 de las 20,234 ejecuciones de 14 días son de este job sobre una tabla vacía.
- [ ] **[TÚ] INF-11 · Migrar `whatsapp_token` a Supabase Vault** — texto plano en 1 de 2 negocios; `supabase_vault` está instalado y sin usar.
- [ ] **[IA] INF-12 · Gate `has_feature()` en políticas de escritura premium** — solo 2 de 107 lo usan, ambas de Centro IA. El resto de módulos premium se gatea únicamente en el frontend.
- [ ] **[IA] INF-13 · `create_patient_with_phone` sin validación interna de `business_id`** — depende solo del GRANT/RLS externo.
- [ ] **[IA] INF-14 · Auditoría asíncrona vía `pgmq`** — los triggers de `audit_log` siguen síncronos en la transacción de negocio. Aceptado por volumen actual.

---

## P3 — Edge Functions

*(Auditoría Técnica §5)*

- [ ] **[IA] EDGE-1 · Cero timeouts en llamadas a terceros** — ni el `fetch` a Meta Graph (`wa-human-reply:121`) ni el de Gemini (`_shared/gemini.ts:33`) declaran `AbortSignal`. Un upstream colgado retiene la invocación hasta el límite de pared; bajo carga agota la concurrencia y el handoff humano deja de funcionar para todos los tenants. Blueprint `fetchUpstream` listo.
- [ ] **[IA] EDGE-2 · Cero reintentos hacia terceros** — un 503 transitorio de Meta pierde el mensaje del staff definitivamente. El bucle de `callGeminiJSON` reintenta solo por JSON que no calza el schema, nunca por fallo HTTP.
- [ ] **[IA] EDGE-3 · Sin idempotencia en el envío de WhatsApp** — un reintento del cliente tras un corte de red duplica el mensaje al paciente. Blueprint de deduplicación por contenido en ventana de 60s.
- [ ] **[IA] EDGE-4 · `Access-Control-Allow-Origin: *` en las 8 funciones**, incluidas `admin-update-business` y `export-tenant-data`. Con `verify_jwt` no es bypass, pero un comodín sobre un endpoint que exporta datos completos de un tenant no pasa revisión.
- [ ] **[IA] EDGE-5 · Variables de entorno sin validación de arranque** — 21 `Deno.env.get`, solo 1 valida ausencia. Si falta `SUPABASE_SERVICE_ROLE_KEY` tras un redeploy, la función devuelve 401 opacos en runtime en vez de fallar al desplegar. Blueprint `requireEnv` listo.
- [ ] **[IA] EDGE-6 · `wa-human-reply` devuelve el error crudo de Meta al navegador** (`meta: errBody?.error`) — expone identificadores internos y trazas del proveedor.
- [ ] **[TÚ] EDGE-7 · `auth-login` y `create-appointment` están en el repositorio y no desplegadas** — o es código muerto o un deploy pendiente.
- [ ] **[TÚ] EDGE-8 · Verificar/redeployar `onboard-tenant`** — confirmar que el deploy v15 es posterior al cambio que agregó `view_pipeline` a OWNER/SECRETARY. Solo afecta tenants nuevos.

---

## P4 — Frontend responsive

*(Frontend §4 — 30 tareas T1–T30, resumidas aquí por fase)*

**Fase 1 — shell (4 archivos, cierra 4 hallazgos)**
- [ ] **[IA] T1 · `h-[100dvh]` en lugar de `h-screen`** — `100vh` incluye la barra del navegador móvil: el borde inferior queda cortado sin scroll posible. 10 usos, cero `dvh`.
- [ ] **[IA] T2 · Disolver el marco en móvil** — `p-0 sm:p-4 lg:p-6`, esquinas y borde solo desde `sm`.
- [ ] **[IA] T3 · Safe areas** — `viewport-fit=cover` está activo y **no se usa `env(safe-area-inset-*)` en ningún lado**: contenido bajo la muesca y la barra de gestos.
- [ ] **[IA] T4 · Inputs a 16px en móvil** — verificado en vivo: los campos están a 13px sin `maximum-scale`, así que Safari iOS hace zoom al enfocar y descuadra el layout.
- [ ] **[IA] T5 · Ocultar los orbes decorativos bajo `sm`** — 500px que desbordan el viewport.

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
- [ ] **[IA] COD-5 · Gate `manage_roles` en INSERT/DELETE de `staff_roles`** — hoy no tienen política (denegado por defecto, correcto), pero conviene declararlas explícitas al cerrar SEC-1.
- [ ] **[IA] COD-6 · Auditoría profunda de permisos por módulo** — verificar que todas las acciones tengan permiso en `usePermissions`/`Users.jsx`/DB, no solo las 6 cerradas en la Pesada #3.
- [ ] **[TÚ] COD-7 · Testear el sistema de punta a punta** — QA formal con click-through autenticado.
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
