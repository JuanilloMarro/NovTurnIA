# Backlog Maestro — Pendientes

> Todo lo que sigue **abierto** en NovTurnIA, consolidado desde las 6 auditorías de esta carpeta. Cada ítem trae el documento de origen entre paréntesis.
> **Responsable:** **[IA]** = aplicable por el asistente vía MCP/API · **[TÚ]** = requiere Vercel/Supabase Studio/Meta/n8n manual · **[MIXTO]** = ambos.
> **Hermano:** [Backlog - Completadas.md](Backlog%20-%20Completadas.md) — todo lo cerrado y verificado vive allá.
> **Regla de este archivo:** si un ítem está hecho, **no aparece acá**. Se mueve a Completadas con su evidencia. Nada de casillas `[x]` sueltas.

**Última reconciliación contra producción: 2026-07-31.** En esa pasada se movieron a Completadas 24 ítems que seguían figurando como pendientes: SEC-1, SEC-2, SEC-3, SEC-4, DEC-1, COD-4, COD-5, T1–T5, T6, T22, B1, B2, B4, B7, INF-2, INF-3, INF-4, INF-5, INF-6, INF-7, INF-9, INF-10, INF-13, EDGE-1, EDGE-2, EDGE-5, EDGE-6 y EDGE-9.

---

## 🚧 Bloqueos vigentes — qué NO puede avanzar y por qué

| # | Qué está trabado | Causa | Quién lo destraba |
|---|---|---|---|
| 1 | **Todo n8n** (A1 recableado · A3 · A5 · A9 · A7) | El túnel de Cloudflare está apagado; la instancia es inalcanzable. El diff de A1+A3+A9 está **preparado y verificado** (10 nodos, 16 cambios, `payload.json` + `pre.json` de rollback), esperando túnel | **[TÚ]** — levantar el túnel |
| 2 | **A2 · rotar el `service_role`** | ⛔ **Orden obligatorio**: la clave vieja está embebida en 20 nodos que hoy no se pueden editar. Rotar ahora deja el bot muerto cuando vuelva el túnel. Secuencia correcta: túnel arriba → migrar los 20 nodos a credencial *Header Auth* → **recién ahí** rotar | **[TÚ]**, en ese orden |
| 3 | **INF-1 · paridad de migraciones** | **138** en producción contra **36** archivos en el repo. Sin branch ni PITR (free tier), el repositorio es la única red de seguridad que existe | **[TÚ]** — CLI de Supabase + contraseña de DB |
| 4 | **VER-1 · smoke test de `wa-human-reply` v7** | La ventana de 24h de WhatsApp está cerrada (hace falta que un cliente escriba primero) | **[TÚ]**, cuando se abra |
| 5 | **OPS-1 · credencial de WhatsApp sandbox** | Los nodos `WA - Respuesta *` firman con una credencial que Meta rechaza (`GraphMethodException 100/33`). Impide la prueba end-to-end del bot tras cualquier cambio | **[TÚ]** |
| 6 | **EDGE-4 · allowlist de CORS** | Falta el origen exacto de Vercel | **[TÚ]** — pasarme el dominio |
| 7 | **T7 · T8 · T9 · T10 — el acantilado de los 768px** | Arreglarlo exige mover anclas de `md:` a `lg:`, o sea **cambiar el layout de tablet**. Choca de frente con "no me toques el estilo actual" | **[TÚ]** — decisión pendiente, ver P4 |

**Nota sobre el tenant de QA:** `NovTurnIA QA` (`0dcfe80e-…`) quedó con plan **Enterprise** y `plan_status='active'` para poder recorrer los módulos premium. Si querés que expire solo, volvelo a `basic`/`trial`.

---

## ⚠️ Cómo leer estas auditorías

Al trabajar los ítems a fondo aparecieron **4 diagnósticos equivocados**, todos en la misma dirección: el texto describía el síntoma correcto pero señalaba la causa equivocada.

| Ítem | Lo que decía el backlog | Lo que era en realidad |
|---|---|---|
| INF-13 | "defensa en profundidad, no explotable" | **Explotable**: cross-tenant probado con transacción real |
| COD-4 | "el banner no está montado" | Además **`setRealtimeStatus` no se llamaba nunca** |
| INF-3 | "corregir `ensure_future_partitions`" | El generador real era **`create_monthly_partition`** |
| Finanzas móvil | "la barra de tabs no scrollea" | El **padre** `flex-col items-start` le quitaba el ancho del viewport |

**Y en la pasada de frontend del 2026-07-31 aparecieron 3 más, todos en la misma dirección: el ítem describía un defecto que ya no existe.**

| Ítem | Lo que decía el backlog | Lo que se midió |
|---|---|---|
| T16 | "las gráficas renderizan con **0px**" | Nunca miden 0: el grid estira las tarjetas y de ahí sale el alto |
| T18 | "`grid-cols-7` da celdas de **49px**" | Ya tiene scroll horizontal con `min-w-[560px]`: son **80px** |
| T26 | "**18** grids sin colapso" | Son **2**, y uno es el calendario (T18) |
| T27 | "3 de 4 no tienen `max-h`" | Correcto, pero **subestimado**: con `overflow-hidden` el contenido quedaba inalcanzable |

Y los conteos envejecen en ambas direcciones: COD-3 decía 20 archivos y son **30**; INF-12 hablaba de 107 políticas y son **116**; T21 decía 162 `title=` y son **226**. Los diagnósticos *estructurales* aguantaron; **tratá los números como orden de magnitud, y antes de "arreglar" algo, medí que siga roto.**

**La causa de fondo es INF-1.** Mientras el repositorio esté ~100 migraciones detrás de producción, cualquier hallazgo derivado de leer archivos del repo puede describir un sistema que ya no existe — ya pasó una vez (Completadas §11, el falso diagnóstico de `get_stats_dashboard`, donde la migración "correctora" habría **sobrescrito la función buena**). Cerrar INF-1 es lo que vuelve confiable el método, no solo la reproducibilidad.

---

## P0 — Bloqueantes y vulnerabilidades abiertas

- [ ] **[MIXTO] INF-1 · Reproducibilidad: 138 migraciones en producción contra 36 en el repositorio** — el modelo comercial, Finanzas v2, vouchers, agenda avanzada, Centro IA y los triggers de límite no existen en el código. Un restore desde el repositorio produce **un sistema distinto**. Las 10 migraciones de las sesiones de endurecimiento sí están versionadas; el resto del delta sigue abierto. *(Infraestructura §2 I1)*
- [ ] **[IA] A1 · Cancelación de turnos sin aislamiento de tenant** — los 3 nodos `Tool - Cancelar Cita` hacen `PATCH /rest/v1/appointments?id=eq.{{ $fromAI('appointment_id') }}` con `service_role` (salta la RLS) y **sin filtro de `business_id`**; el UUID lo decide el LLM. Los otros 17 tools sí acotan: es la única excepción. **La mitad de DB ya está cerrada** (RPC `bot_cancel_appointment` aplicada y probada, ver Completadas §12); **el agujero sigue abierto** hasta recablear los 3 nodos. ⛔ Bloqueo 1. *(Automatización IA §4.1)*
- [ ] **[TÚ] A2 · `service_role` en texto plano en 20 nodos** — las claves viajan en `jsonHeaders` dentro del JSON del workflow, no en el almacén de credenciales de n8n. Cualquiera con acceso al editor o a la API obtiene una llave que ignora toda la RLS. ⛔ Bloqueo 2 — respetar el orden.
- [ ] **[TÚ] VER-1 · Smoke test de `wa-human-reply` v7** — enviar un mensaje desde Conversaciones y confirmar que llega. Es la única función donde el `requireEnv` nuevo (EDGE-5) podría fallar **al arrancar** si faltara un secret. Rollback si falla: redesplegar v6. Las otras 3 (`manage-staff` v10, `ai-chat` v7, `ai-insights` v7) sí se pueden probar sin esperar ventana. ⛔ Bloqueo 4.
- [ ] **[TÚ] VER-2 · Re-verificar el límite de `max_staff` tras el fix de EDGE-9** — **derivado**: como `manage-staff` devolvía 403 a todo el mundo, el check de `max_staff` de F-1 (Completadas §4) **nunca se ejerció de verdad en producción**. Con la v10 desplegada hay que confirmar a mano que al llegar al tope el alta se rechaza con mensaje amable.
- [ ] **[TÚ] OPS-1 · Credencial de WhatsApp no cubre el número sandbox** — `GraphMethodException 100/33`. ⛔ Bloqueo 5.
- [ ] **[TÚ] OPS-2 · Activar protección de contraseñas filtradas (HIBP)** — ⛔ **Bloqueado por plan** (verificado en Studio): "Prevent use of leaked passwords" exige plan **Pro** y **Custom SMTP** configurado. Se desbloquea si el proyecto sube a Pro (el SMTP puede salir de PROD-11/Resend). Mitigación disponible en free, misma pantalla: subir la longitud mínima de contraseña y exigir clases de caracteres.

---

## P1 — Modelo de negocio: sin esto el costo por cliente no está acotado

*(Modelo de Negocio §8-12)*

> ~~N1 · Consolidar la respuesta del bot a un mensaje por turno~~ — **retirada**: la auditoría de n8n verificó recorriendo el grafo que **ninguna ruta encadena dos envíos**. El bot ya envía un solo mensaje por turno; la palanca de ahorro del 50-66% no existe.

**Bloque 1 — medir bien y gastar poco** *(la mitad de DB está cerrada: B1/B2/B7 en Completadas §15; lo que falta es todo de n8n)*

- [ ] **[IA] A5 · Medir tokens reales, no estimados** — `record_usage` calcula `(historial + mensaje + 1200) / 4` en vez de leer el `usageMetadata` de Gemini. Subcuenta ~450 tokens por mensaje (el prompt de sistema son 3,008 caracteres y solo se computan 1,200) y **omite por completo** los tokens de las llamadas a herramientas. El margen del modelo de negocio se calcula hoy con datos sesgados a la baja. **Incluye recablear los 3 nodos `Uso - Registrar` para pasar `p_direction`** y que el split in/out de B1 empiece a poblarse de verdad. ⛔ Bloqueo 1.
- [ ] **[IA] A3 · `maxOutputTokens` explícito en los 3 agentes** — hoy queda el default del proveedor y con `maxIterations: 10` un turno puede encadenar 10 llamadas sin tope de longitud. 400 basta para WhatsApp. ⛔ Bloqueo 1.
- [ ] **[IA] A9 · Bajar la ventana de contexto** — `Historial - Obtener` trae 100 mensajes en cada turno; con 10 iteraciones, el peor caso son 10 llamadas con 100 mensajes cada una. Es el verdadero motor del costo de tokens. Bajar a 20 mensajes y `maxIterations` a 5. ⛔ Bloqueo 1.
- [ ] **[TÚ] N3 · El gate del bot debe leer el cupo de salientes** — la DB ya lo expone (`messages_out_effective`, B7); falta que el nodo de gate lo consulte. ⛔ Bloqueo 1.

**Bloque 2 — cargar la escalera**
- [ ] **[IA] B3 · Cupos nuevos en `plans`** — propuesta: `max_conversations` 1,050 / 3,000 / 6,750 · `max_patients` 70 / 200 / 450 · `history_retention_months` Pro 3→6. Medido en producción hoy: **500 / 5,000 / 20,000** y **50 / 150 / ∞**, retención 3/3/12.
  ⚠️ **Ojo antes de aplicar: esto BAJA cupos, no los sube.** Pro pasaría de 5,000 a 3,000 mensajes y Enterprise de 20,000 a 6,750. Si un cliente real ya está consumiendo por encima del cupo nuevo, **le cortás el bot el día que apliques la migración**. Antes de tocar: medir el consumo real de cada negocio activo y, si hace falta, dejarlos con `limit_overrides` o cargar `extra_messages` (B4). No es una migración inocua.

**Bloque 3 — cerrar el tope del lado del dashboard** *(F1/F2/F3 cerrados — Completadas §12)*
- [ ] **[IA] F3b · Habilitar el CTA "Comprar paquete"** — hoy está deshabilitado con la leyenda "Pronto" porque esperaba `businesses.extra_messages`. **B4 ya existe y está verificada** (cargar 500 extras subió el cupo efectivo de 20,000 a 20,500), así que el bloqueo desapareció: falta cablear el botón a la carga de paquetes.

**Bloque 4 — cobranza**
- [ ] **[IA] B5 · `plan_expires_at` en el alta de pago** — `onboard-tenant/index.ts:197` lo crea `NULL` para toda alta que no sea trial, y el cron vence por fecha. Se resuelve junto con RES-2. Estado real: de los 3 negocios, *Clínica Doc* sigue en `NULL` (nunca entró al ciclo de cobranza), *x* ya tiene fecha, y el de QA está en `NULL` a propósito.
- [ ] **[TÚ] B5b · Marcar pagado a los negocios existentes** — 1 clic por negocio en AdminPanel.

**Bloque 5 — que la oferta se pueda vender**
- [ ] **[IA] F4 · `PlansModal`: agregar el módulo Centro IA** — verificado: no aparece **ninguna** fila sobre Centro IA, chat, reportes ni límite de tokens. Es el diferenciador que justifica el salto Básico→Pro y hoy es **invisible al vender**.
- [ ] **[IA] F5 · `PlansModal`: fila de mensajes adicionales** con su precio.
- [ ] **[IA] F6 · AdminPanel: agregar `stats_intelligence` y `business_intelligence` a `FEATURE_DEFS`** — hoy solo cubre 9 de ~17 flags; no se puede dar una prueba de Centro IA sin tocar la base a mano.
- [ ] **[IA] F7 · AdminPanel: consumo de salientes + carga de paquetes.**

---

## P2 — Infraestructura y base de datos

*(Infraestructura Supabase §8 · Auditoría Técnica §6)*

- [ ] **[IA] INF-8 · `statement_timeout` e `idle_in_transaction_session_timeout` por rol** — el riesgo de saturación no está en Supavisor sino en el pool de PostgREST, **único y compartido entre tenants**. SQL en *(Auditoría Técnica §3.1)*.
- [ ] **[TÚ] INF-11 · Migrar `whatsapp_token` a Supabase Vault** — texto plano en 1 de 2 negocios; `supabase_vault` está instalado y sin usar.
- [ ] **[IA] INF-12 · Gate `has_feature()` en políticas de escritura premium** — solo 2 de **116** políticas lo usan, ambas de Centro IA. El resto de módulos premium se gatea únicamente en el frontend. **Caso testigo confirmado** por el detector de asimetría (`supabase/tests/security/verb_asymmetry_detector.sql`): `ai_chat_messages` tiene `has_feature` en SELECT pero no en DELETE. No es escalación (el DELETE conserva `business_id = get_user_business_id() AND staff_user_id = auth.uid()` — solo borra filas propias), pero es exactamente el fix de INF-12 cuando se trabaje. **Incluye la deuda que dejó INF-2**: cerrar `get_user_business_id`, `is_business_active` y `has_feature` a `anon` exige reescribir antes las ~50 políticas `TO public` que las tienen embebidas.
- [ ] **[IA] INF-14 · Auditoría asíncrona vía `pgmq`** — los triggers de `audit_log` siguen síncronos dentro de la transacción de negocio. Aceptado por volumen actual.

---

## P3 — Edge Functions

*(Auditoría Técnica §5)*

- [ ] **[IA] EDGE-3 · Sin idempotencia en el envío de WhatsApp** — un reintento del cliente tras un corte de red duplica el mensaje al paciente. Blueprint de deduplicación por contenido en ventana de 60s.
- [ ] **[IA] EDGE-4 · `Access-Control-Allow-Origin: *` en las 8 funciones**, incluidas `admin-update-business` y `export-tenant-data`. Con `verify_jwt` no es bypass, pero un comodín sobre un endpoint que exporta los datos completos de un tenant no pasa revisión. ⛔ Bloqueo 6 — falta el origen exacto de Vercel.
- [ ] **[IA] EDGE-5b · Propagar `requireEnv` al resto de funciones** — cerrado y desplegado en `wa-human-reply` v7 (Completadas §14); las demás siguen con `Deno.env.get(...)!`, que es una aserción de TypeScript **sin efecto en runtime**. Trabajo mecánico, aprovechar el próximo deploy de cada una.
- [ ] **[TÚ] EDGE-7 · `auth-login` y `create-appointment` están en el repositorio y no desplegadas** — o es código muerto (y se borra) o es un deploy pendiente. Decidir cuál.
- [ ] **[TÚ] EDGE-8 · Verificar/redeployar `onboard-tenant`** — confirmar que el deploy v15 es posterior al cambio que agregó `view_pipeline` a OWNER/SECRETARY. Solo afecta tenants nuevos.

---

## P4 — Frontend responsive

*(Frontend §4 — 30 tareas T1–T30. Cerradas: T1–T5 y T6 y T22 → Completadas §12 y §16)*

> **Restricción dura del dueño, vigente para todo lo que sigue:**
> *"si cambiaras estilos asegurate que se apliquen solo en telefono no en dimensiones mas grandes… la idea es que no me toques el estilo del actual"*.
> En la práctica: cada regla nueva va dentro de `@media (max-width: 767.98px)` / `(max-width: 639.98px)` o de una variante `max-sm:`, y **se verifica en el CSS compilado**, no en el fuente. Ver el bloque "AJUSTES EXCLUSIVOS DE TELÉFONO" en `index.css` como patrón de referencia.

### ⏸️ Decisión pendiente — el acantilado de los 768px (T7 · T8 · T9 · T10)

El problema está **medido**: entre 767px y 768px el panel de detalle pasa de 701px a **58px**, porque dos reglas `md:` disparan a la vez; el drawer de Seguimiento deja **22px de contenido** a 768px; y el sidebar se lleva 272px de una pantalla de 768.

Arreglarlo **requiere mover anclas de `md:` a `lg:`**, y eso cambia cómo se ve el sistema en tablet — exactamente lo que pediste no tocar. No lo puedo resolver sin que elijas:

- **(A) Autorizar el cambio en tablet.** Es el arreglo real y el más limpio. Tablet pasa a comportarse como móvil entre 768 y 1023px (sidebar en cajón, listas a ancho completo).
- **(B) Dejar tablet como está** y aceptar que entre 768 y 1023px los módulos maestro-detalle queden apretados. Cero riesgo, cero mejora ahí.
- **(C) Camino intermedio**: solo el sidebar pasa a `lg` (T7) y las listas se quedan. Recupera 272px, que es la mayor parte del daño, tocando una sola cosa.

Mi recomendación es **(C)**: el sidebar es el que se come la pantalla, y es un cambio acotado y reversible.

- [ ] **[TÚ] Elegir A / B / C** — hasta entonces T7, T8, T9 y T10 quedan congelados.
- [ ] **[IA] T7 · Mover el sidebar de `md` a `lg`** — a 768px se lleva 272px de la pantalla. ⏸️
- [ ] **[IA] T8 · Mover los anchos de lista de `md:` a `lg:`** — el acantilado medido. ⏸️
- [ ] **[IA] T9 · Drawer de Seguimiento a pantalla completa bajo `lg`** — `sm:pr-[440px]` deja 22px de contenido a 768px. ⏸️
- [ ] **[IA] T10 · Patrón maestro-detalle móvil** (solo lista **o** solo detalle) en Servicios, Finanzas y Conversaciones — Ofertas ya lo tiene. ⏸️

### Fase 6 — componentes del sistema *(en curso, sin bloqueos)*

- [ ] **[IA] T23 · Búsqueda colapsable — queda solo AdminPanel** — ⚠️ **la auditoría decía "adoptar en las 9 páginas" y eso era un error de diagnóstico**: de los 9 buscadores, solo **5 tenían el problema**. El síntoma real es `w-full` en móvil, que se lleva la fila entera y empuja los botones de acción a una segunda línea. Los buscadores que ya viven como `flex-1` dentro de un panel de lista angosto (**Ofertas, Servicios, Conversaciones**) ya comparten fila con sus botones: colapsarlos dejaría una fila casi vacía, o sea **peor**. Y el de **Historial de paciente** está dentro de un `hidden lg:flex`: por debajo de 1024px no existe.
  **Cerrado en:** Clientes, Re-agendación, Actividad, Seguimiento (`ui/SearchField`) e Ingresos · Egresos · Por cobrar (el colapso se agregó a `LedgerSearch` en `financeUi.jsx`, **no** se cambió por `SearchField`: Finanzas tiene su propio estilo de campo más chico y sustituirlo habría cambiado el aspecto en escritorio).
  **Falta:** AdminPanel (pantalla de super-admin, no la ve el cliente — prioridad baja).
- [ ] **[IA] T19 · Componente `<Tooltip>`** por portal, lenguaje glass, detección de borde.
- [ ] **[IA] T20 · Comportamiento táctil del tooltip.**
- [ ] **[IA] T21 · Reemplazar los `title=""` nativos** — invisibles en táctil, no estilizables. Depende de T19. Re-medido: **226** ocurrencias de `title=` (la auditoría decía 160 y luego 162 — la cifra se quedó muy corta).

### Fase 4 — contrato de capas

- [ ] **[IA] T11 · Tokens de z-index en `index.css`** — hoy hay ~359 `z-10` y 11 valores distintos sin escala.
- [ ] **[IA] T12 · Regla del portal** — 332 `backdrop-blur` crean contextos de apilamiento y 369 `overflow-hidden` recortan; solo 20 archivos usan `createPortal`. Un menú `z-[200]` dentro de una tarjeta **nunca** supera a otra tarjeta.
- [ ] **[IA] T13 · Migrar los flotantes que aún viven dentro de tarjetas.**
- [ ] **[IA] T14 · Revisar los `position: fixed` dentro de tarjetas con `backdrop-blur`** — se anclan a la tarjeta, no a la pantalla.

### Fase 5 — gráficas

- [ ] ~~**T15 · Hook `useChartHeight()`**~~ · ~~**T16 · Sustituir los 7 altos porcentuales por píxeles**~~ — **RETIRADOS 2026-07-31, el diagnóstico era falso.** T16 afirmaba que "al pasar a una columna el padre resuelve a `auto` y las gráficas renderizan con **0px**". **Medido en navegador y no ocurre**: los 7 `ResponsiveContainer` porcentuales cuelgan de contenedores con alto resuelto — `ChartPanel` lleva `style={{minHeight:320}}` y las `Card` de Inteligencia `min-h-[300px]`, y como ambas viven en un `grid`, los items **se estiran** y de ahí sale el alto definido contra el que resuelve el `height="100%"`. Sonda a 375 / 768 / 1280px: el contenedor de gráfica mide `327x150`, `306x208` y `297x208` — nunca 0.
  🐛 **Cómo se produjo el falso positivo, por si vuelve a pasar**: mi primera sonda reprodujo la tarjeta **sin** el grid que la envuelve y ahí sí midió altura 0. El `h-full` interno depende de que el grid estire la tarjeta. **Una sonda que no reproduce el contenedor real miente**, y miente en la dirección de confirmar el bug que estás buscando. Si T15/T16 vuelven a aparecer en una auditoría, exigí la medición **con el grid puesto**.
- [x] ~~**[IA] T17 · Variantes móviles de gráfica**~~ — **CERRADO 2026-07-31**, ver Completadas §16.
- [ ] **[IA] T18 · Calendario mensual en móvil como agenda vertical** — ⚠️ **cifra desactualizada y el problema ya está mitigado**: la auditoría decía "celdas de 49px", pero `CalendarMonth.jsx` ya lleva `overflow-x-auto md:overflow-x-hidden` + `min-w-[560px] md:min-w-0`, o sea que en teléfono el mes mide 560px y se desliza en horizontal: **80px por celda, no 49**. Funciona. Pasar a agenda vertical sigue siendo mejor UX (se ve el mes entero sin deslizar) pero **ya no es un defecto, es una mejora de producto** — y toca el módulo más usado del sistema, así que conviene decidirlo mirando un diseño, no aplicarlo de corrido.

### Fase 7 — detalle fino

- [ ] **[IA] T24 · Objetivos táctiles a 44px en móvil** — re-medido: **218** elementos con alto `h-5`…`h-9`. Tarea real pero grande y delicada: subir alturas cambia el ritmo vertical de barras y tarjetas. Hacerla módulo por módulo, mirando el resultado, no de corrido.
- [ ] **[IA] T25 · Escalón tipográfico móvil** — re-medido: **110** usos bajo 10px (10 de 7px, 22 de 8px, 78 de 9px); la cifra vieja de 108 era correcta.
  ⚠️ **No aplicar un override global en el bloque de teléfono**, aunque sea tentador (`.text-\[7px\]{font-size:10px}`): varios de esos 7px viven dentro de círculos de 14px (`w-3.5 h-3.5`, los pasos numerados del Pipeline) y subirlos los desborda. Es una pasada caso por caso con revisión visual — buen candidato para una sesión dedicada junto a T30.
- [ ] **[IA] T26 · Grids con variante responsive** — ⚠️ **cifra falsa**: la auditoría decía 18 sin colapso. Medidos hoy, los grids que arrancan en 3+ columnas sin variante son **2**: `CalendarMonth.jsx` (el `grid-cols-7` del mes, que es T18 y ya tiene scroll horizontal) y `AdminPanel.jsx:583` (`grid-cols-3`, pantalla de super-admin que el cliente no ve). Los `grid-cols-2` sin variante son deliberados: a 375px dan columnas de ~165px, que es el tamaño correcto para las tarjetas de KPI. **Queda solo AdminPanel:583**, prioridad baja.
- [x] ~~**[IA] T27 · Modales con `max-h-[85dvh]` y scroll interno**~~ — **CERRADO 2026-07-31**, ver Completadas §16.
- [ ] **[IA] T28 · Probar en horizontal a 812×375.**
- [ ] **[TÚ] T29 · Recorrer los 9 módulos autenticados a 375/414/768/834/1024px** — requiere sesión real; ninguna auditoría lo ha podido hacer. El harness de Playwright y el tenant semilla ya existen (Completadas §12); falta completar `SEED_*` en `.env.test` y crear el negocio semilla vía `/admin/new-tenant`.
- [ ] **[IA] T30 · Auditoría de consistencia visual** — repasar que botones, paneles y degradados sigan el mismo lenguaje glass. Sesión dedicada.
- [ ] **[IA] T31 · Correr `tests/e2e/responsive-fase1-shell.spec.js`** — quedó escrito y **nunca ejecutado** (el agente murió por límite de gasto antes de capturar los screenshots por viewport). La verificación de T1–T5 se hizo a mano en navegador; el spec sigue sin correr.

---

## P5 — Resiliencia y observabilidad

- [ ] **[IA] RES-1 · `withRetry` v2 con full jitter y circuit breaker** — el actual usa backoff determinista (400/800ms): tras una caída, **todas** las pestañas de **todos** los tenants reintentan en el mismo instante. La lógica ya existe escrita y probada del lado del servidor en `_shared/fetchUpstream.ts` (EDGE-2) — es portarla al cliente, no inventarla. *(Auditoría Técnica §2.5)*
- [ ] **[IA] RES-2 · Onboarding atómico** — 4 escrituras secuenciales con compensación que solo borra `businesses` y está silenciada con `.catch(() => {})`. Si falla el paso 4 queda un usuario en `auth.users` sin `staff_users`: **login exitoso, dashboard vacío, y el email bloqueado para reintentar**. RPC `provision_tenant` lista *(Auditoría Técnica §2.4)*.
- [ ] **[IA] OBS-1 · Correlation id extremo a extremo** — `set_request_context` + header en el cliente + tag en Sentry con hash de tenant (**no** el uuid). Diseño en *(Auditoría Técnica §3.2)*.
- [ ] **[TÚ] OBS-2 · Sentry en producción** — `VITE_SENTRY_DSN` sin configurar en Vercel; `vite.config.js` sigue con `sourcemap: false` (cambiar a `'hidden'` + subir a Sentry CLI).
- [ ] **[MIXTO] OBS-3 · Métricas SaaS (MRR, churn, LTV, CAC)** — sin instrumentar. Hoy no se puede responder "¿cuánto facturo este mes?" sin contar negocios a mano.
- [ ] **[TÚ] RES-3 · Error Workflow global en n8n** — no existe un workflow con Error Trigger; un fallo fuera de las ramas manejadas muere en silencio.
- [ ] **[IA] RES-4 · Rate limiting por tenant en n8n** — hoy es por usuario+negocio (20 msg/h); falta cuota agregada que aísle ráfagas de un tenant ruidoso.
- [ ] **[TÚ] RES-5 · Preview deployments de Vercel apuntan a la DB de producción** — configurar una branch de Supabase. Conecta con INF-1: sin migraciones versionadas no se puede levantar una branch con el modelo real. (Y branching exige plan Pro.)

---

## P6 — Calidad de código

- [ ] **[IA] COD-1 · `cache: 'no-store'` global** — `src/config/supabase.js:14` lo aplica a *todas* las peticiones, anulando el HTTP cache incluso en lecturas idempotentes. **Revisado y NO aplicado, a propósito**: invertir el default (cacheable por defecto, `no-store` opt-in) introduce riesgo real de lecturas rancias sobre datos clínicos, porque PostgREST no emite `Cache-Control` y el navegador cachea por heurística — que es justo el motivo por el que se agregó. Sobre `POST/PATCH/DELETE` la bandera no hace nada, así que el único efecto es en GET. Cerrarlo bien exige decidir **caso por caso** qué lecturas toleran staleness y medir el beneficio: es un trade-off de producto, no un bug.
- [ ] **[IA] COD-2 · Sin ESLint configurado** — no existe `.eslintrc*` ni `eslint.config.*`. *(Habría cazado el `max-sm:no-scrollbar` que compilaba a nada, si se le suma un plugin de Tailwind.)*
- [ ] **[IA] COD-3 · 30 archivos con `console.log/error/warn` sin guard `import.meta.env.DEV`** — llegan a producción; solo 1 archivo usa el guard.
- [ ] **[IA] COD-6 · Auditoría profunda de permisos por módulo** — verificar que **todas** las acciones tengan permiso en `usePermissions`/`Users.jsx`/DB, no solo las 6 cerradas en la Pesada #3. EDGE-9 (una llave de permiso que no existía en ningún rol) es la prueba de que esta clase de fallo estaba sin barrer.
- [ ] **[TÚ] COD-7 · Testear el sistema de punta a punta** — QA formal con click-through autenticado. Harness Fase A listo (Playwright 6 viewports, fixture de auth en `tests/fixtures/auth.js`, seed idempotente en `scripts/seed-test-tenant.mjs`, login-smoke 6/6 en verde). ⏸️ Bloqueado en: crear el negocio semilla vía `/admin/new-tenant` (super-admin, humano) y completar `SEED_*` en `.env.test`.
- [ ] **[TÚ] COD-8 · Versionado de la aplicación** — delimitar metas y features por versión.

---

## P7 — Producto y roadmap

**Bot / IA** *(detalle en [Automatización IA - n8n](Automatizacion%20IA%20-%20n8n.md))*
- [ ] **[MIXTO] A4 · Motor de recordatorios (H6)** — confirmado en el workflow activo: **cero `scheduleTrigger`**, el único disparador es `Trigger - WhatsApp`. `reminders` (Pro/Ent) y `auto_confirm` (Ent) **se venden sin motor**. El workflow inactivo de abril tenía uno completo: es rescate, no obra nueva. **Son 2 de los 15 mensajes del presupuesto del modelo de negocio.**
- [ ] **[IA] A7 · 92 de 151 nodos sin `onError`** — incluidos `Historial - Obtener`, `Buffer - Obtener`, `Paciente - Crear` y `Audio - Transcribir`. Si fallan, la ejecución muere y **el cliente nunca recibe respuesta**, sin traza. Los 18 de WhatsApp sí están protegidos. ⛔ Bloqueo 1.
- [ ] **[TÚ] A8 · Workflow de error global** — sin Error Trigger, los fallos de esos 92 nodos no llegan a ninguna tabla ni alerta.
- [ ] **[TÚ] A6 · Pro y Enterprise usan el mismo modelo** (`gemini-2.5-flash`) — la feature `ai_reasoning` vende una escalera de tres niveles que en el bot son dos.
- [ ] **[TÚ] A10 · `custom_prompt` inyectado a los 3 agentes** — confirmado: aparece en `Agente - Basic`, `Pro` y `Enterprise`. Es feature Pro/Ent; el frontend impide editarlo, pero si la columna trae valor el bot lo usa.
- [ ] **[IA] PROD-3 · Batch semanal automático de Centro IA** — `pg_cron` para `weekly_digest`/`retention`, hoy solo on-demand.
- [ ] **[IA] PROD-4 · Botón "Crear oferta"** que pre-llene el módulo Ofertas desde un insight `content_offer`.
- [ ] **[IA] PROD-5 · Techo de tokens para el bot** — `usage_counters` ya acumula `tokens_in`/`tokens_out` (verificado: 17 mensajes → 9,071 tokens), pero **nada corta por tokens** y el consumo no se muestra en ninguna pantalla.
- [ ] **[IA] PROD-6 · Reemplazar la heurística Descubrimiento vs Negociación** — el backfill separa las dos primeras etapas por número de mensajes (≥6); con las banderas reales ya disponibles, borrar la aproximación.
- [ ] **[IA] PROD-7 · Memoria semántica pgvector del bot** — diferida por costo de tokens; diseño preservado.

**Finanzas y citas**
- [ ] **[IA] PROD-8 · `appointments.staff_id`** — permitiría asignar profesional al agendar, prerequisito de una agenda multi-silla. La atribución de comisión hoy funciona vía `income_entries.staff_id`.
- [ ] **[IA] PROD-9 · Re-agendación automática al cancelarse un turno** — priorizar clientes en espera para slots liberados.
- [ ] **[IA] PROD-10 · Filtros de período más granulares en Seguimiento.**

**Infraestructura y cobro**
- [ ] **[MIXTO] PROD-11 · Emails transaccionales** — Edge Function `send-email` + Resend sobre `businesses.notification_email` (la columna existe, sin función asociada). Habilita `notification_email`/`gmail_integration`, hoy vendidas sin motor. Disparadores: dunning, alta de tenant, corte por límite. **También destraba OPS-2**, que exige Custom SMTP.
- [ ] **[TÚ] PROD-12 · Stripe** (al pasar ~5 clientes) — `invoice.paid` → `record_payment` → dunning automático. Al conectarlo entra la comisión de pasarela al margen.
- [ ] **[TÚ] PROD-13 · Migración a WhatsApp Tech Provider + `waba_id` por negocio** (≥15 clientes) — decisión comercial, no deuda técnica. **Cambia la estructura de márgenes**: bajo Modelo A el costo de mensajes deja de ser tuyo.
- [ ] **[TÚ] PROD-14 · Web Push para handoffs** — Realtime ya emite el cambio de `human_takeover`; falta service worker + Push API.
- [ ] **[TÚ] PROD-15 · Storage para logo del negocio e imágenes de pacientes** — hoy el bot las ignora. Bucket por tenant con RLS.

**UI grande**
- [ ] **[IA] PROD-16 · Modo oscuro** — `tailwind.config.js` no tiene `darkMode` y hay 0 clases `dark:`. Sin trabajo previo que reutilizar. Sesión dedicada.
