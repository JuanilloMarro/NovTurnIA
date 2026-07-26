# Bot n8n — Puesta al día con el dashboard (plan de implementación)

> **Fecha:** 2026-07-25 · **Método:** workflow **activo** `NovTurnAI` (id `1npQWgfgBBIwVuxX`, 143 nodos / 129 funcionales, `updatedAt 2026-07-25T18:53Z`) descargado en vivo por la API de n8n, cruzado contra el esquema **real** de Supabase (`kwpaaqdkklwwfslhkqpb`) leído por MCP: definiciones de funciones, RLS, grants, crons y conteos de filas.
> **Complementa** a [Automatización Agente IA.md](Automatización%20Agente%20IA.md) — aquel documento audita el bot *en sí mismo*; **este mide la distancia entre el bot y todo lo que el dashboard construyó después**, y da el plan para cerrarla.
> **Acceso nuevo (2026-07-25):** el MCP nativo de n8n (`/mcp-server/http`) quedó conectado. Requiere un token con audiencia `mcp-server-api` (la `N8N_API_KEY` normal NO sirve ahí); vive en `.env` como `N8N_MCP_TOKEN` y se referencia desde `.mcp.json` como `${N8N_MCP_TOKEN}` porque ese archivo está trackeado en git.

---

## ✅ ESTADO — Fases 0-3 APLICADAS en producción (2026-07-25)

Workflow `NovTurnAI` pasó de **143 → 151 nodos** por PUT a la API (`updatedAt 2026-07-25T19:29Z`), y se re-registró el webhook con un ciclo `deactivate`+`activate` por API (ya no hace falta el toggle manual del editor).

**Se reutilizó el lote de 12 cambios que estaba pausado** — se recuperó de `wf-put.json` en el scratchpad de la sesión (no estaba perdido, solo fuera del repo). Se auditó antes de aplicarlo: eliminaba `Turnos - Confirmed` y `Merge`, y se verificó que era **intencional y correcto** (la consolidación en una sola query por `date_start` + `status <> cancelled` deja el conteo **exactamente alineado** con el trigger `enforce_appointment_limit`). 0 referencias colgantes en el grafo final.

| Fase | Estado | Qué quedó |
|---|---|---|
| **0 — Estabilizar** | ✅ | `Modelo - Embedding Pro` 10 → **150** (tier Pro revivido) · `Historial - Obtener` limit 10 → **100** (el nodo Supabase no soporta `order`; se sube el fetch y el `Ordenar`+`Limitar` posterior corta bien) · **6 modelos Gemini** con `modelName` explícito · **18/19 nodos WA** con `onError: continueRegularOutput` (el 19º es el Trigger, no aplica) |
| **1 — Circuito de negocio** | ✅ | 3 nodos `Uso - Registrar {Basic\|Pro\|Enterprise}` → `record_usage` (con estimación real de tokens in/out) · gate `¿Plan Activo?` ahora exige `ai_paused !== true` · `Conversaciones - Contar` pasa a leer `usage_counters` en vez de contar filas de `history` · ambos gates honran `limit_overrides` |
| **2 — Pipeline CRM** | ✅ | 3 nodos `Pipeline - Actividad {plan}` → `pipeline_touch(activity)` con el micro-texto de la tarjeta (`p_summary` serializado con `JSON.stringify` para que comillas y saltos de línea del agente no rompan el body) |
| **3 — Contexto nuevo** | ✅ | 3 tools `Métodos de Pago {plan}` (select frugal: **`fee_pct` no viaja**) + regla de pagos en los 3 prompts · `Tool - Perfil Paciente Enterprise` (memoria del cliente) · reglas `SCHEDULE_CLOSED`/`SCHEDULE_DAILY_CAP` en los 3 agentes |
| **4 — Recordatorios** | 📋 Planteada | Requiere más análisis (plantillas Meta, categoría de costo). Detalle en §3 Fase 4 |

**Probe de verificación** (transacción + ROLLBACK, sin residuo — reconfirmado: `pipeline_events source=bot` sigue en 0, `usage_counters` en 0):

| Paso | Resultado real |
|---|---|
| `record_usage(biz, 350, 120, 1)` | `{messages: 1, tokens_total: 2295, max: 20000, limit_reached: false}` ✓ |
| `pipeline_touch(biz, pat, 'activity', …)` | `{stage: "scheduled", deal_id: "e4e7a42e-…"}` ✓ |
| Deal resultante | `last_ai_action` con el texto + `last_activity_at` sellado ✓ |
| Evento | 1 evento `source='bot'` ✓ |
| Tool de métodos de pago | `Efectivo (efectivo), Tarjeta, Transferencia, Otro` ✓ |

**Pendiente de prueba en vivo:** una conversación real por WhatsApp por cada plan. La de **Pro** es la que importa — hasta hoy moría en el classifier. Sigue bloqueada por el hallazgo #3 (credencial/token de Meta), que es tuyo.

---

## 0. El hallazgo de una línea

Se corrió una búsqueda literal de los 12 conceptos que el dashboard incorporó desde abril sobre el JSON completo del workflow activo:

| Concepto | ¿El bot lo menciona? |
|---|---|
| `ai_paused` · `record_usage` · `limit_overrides` · `get_effective_limit` | ❌ NO |
| `pipeline` (cualquier forma) · `get_patient_profile` | ❌ NO |
| `payment_method` · `voucher` · `price_rounding` | ❌ NO |
| `schedule_exception` · `max_appointments_per_day` · `is_rescheduled` | ❌ NO |

**Cero de doce.** El bot opera hoy con el modelo mental de abril: agenda, cancela y consulta turnos, y nada más. Todo lo que el sistema aprendió después — cobros, límites reales, pipeline, memoria del cliente, agenda con feriados — le es invisible.

La buena noticia: **la mayor parte del trabajo pesado ya está hecho en la DB**. Casi todos los gaps se cierran con nodos HTTP de una sola llamada, sin lógica nueva y sin gastar un solo token de LLM extra.

---

## 1. Estado verificado con datos reales

| Medición (SQL en vivo) | Valor | Lectura |
|---|---|---|
| `usage_counters` — filas / mensajes acumulados | 1 fila / **0 mensajes** | El metering nunca ha registrado nada |
| `businesses` con `ai_paused = true` | **0** | El corte automático jamás ha disparado |
| `pipeline_events` con `source = 'bot'` | **0** | El bot nunca ha tocado el pipeline |
| `pipeline_deals` | 2 | Todo viene del backfill/trigger, no del bot |
| Crons activos | 12 | Incluye `reset-usage-ai-pause` — esperando datos que no llegan |

---

## 2. Los 7 gaps, en orden de daño

### Gap 1 — 🔴 El circuito de medición y corte está roto de punta a punta

Este es el más caro y el más barato de arreglar a la vez. La cadena completa existe **menos un eslabón**:

```
record_usage()  ← existe, respeta limit_overrides.max_conversations,
                   pone ai_paused = true al superar, devuelve limit_reached
      ↑ NADIE LA LLAMA  ← el eslabón roto
usage_counters  ← 0 mensajes
ai_paused       ← 0 negocios
gate ¿Plan Activo?  ← NO lo consulta: aunque un admin pause manualmente, el bot sigue respondiendo
cron reset-usage-ai-pause  ← corre cada mes sobre datos vacíos
```

Consecuencias concretas hoy: el panel de admin muestra 0 consumo para todos los negocios; un negocio puede exceder su plan indefinidamente; el botón de pausar IA del dashboard **no pausa nada**; y no hay telemetría para sustentar los precios del Modelo de Negocio.

**Por qué el fix es desproporcionadamente bueno:** `record_usage` ya hace internamente la matemática de `limit_overrides` y devuelve `limit_reached`. Cablearla cierra el hallazgo **#6** y, de regalo, el **#12** (el bot pasa a honrar overrides sin leer `get_effective_limit`).

### Gap 2 — 🟠 Pipeline CRM: el backend lleva un día esperando al bot

`pipeline_touch` está desplegada, endurecida (`service_role` only) y es idempotente. Whitelist de banderas verificada en la definición real:

```
offered_services · offered_promo · queried_slots · slot_offered · reminder_sent
confirmed_by_user · survey_sent · review_requested · recovery_step · nps_score · activity
```

Busca-o-crea el deal abierto del paciente, prende la bandera, sella el timestamp `_at`, guarda el micro-texto de la tarjeta, registra el evento y recalcula la etapa — **todo en una llamada con un solo parámetro variable**. Mientras no se cablee, las dos primeras columnas del tablero siguen siendo una heurística del backfill (≥6 mensajes = negociación).

### Gap 3 — 🟠 Memoria del cliente: lista desde julio, nunca conectada

`get_patient_profile(business_id, patient_id)` existe desde 2026-07-06 y devuelve ~40-60 tokens:

```json
{ "visitas": 2, "no_shows": 0, "servicio_frecuente": "Corte",
  "ultima_visita": "2026-06-15T16:00:00+00:00", "prioridad": "media" }
```

El agente Enterprise trata a un cliente de 8 visitas igual que a uno nuevo. Es el diferenciador de plan más visible que hay y está a un nodo de distancia.

### Gap 4 — 🟠 Métodos de pago: contexto que el bot no tiene de dónde sacar (NUEVO)

Tabla `payment_methods` por negocio: `code, label, fee_pct, is_cash, active, sort_order`. RLS activa con políticas solo para `authenticated`, así que `anon` no ve nada — pero **`service_role` la lee sin fricción**, que es exactamente cómo entran los tools del bot.

Hoy, ante *"¿aceptan tarjeta?"* o *"¿puedo pagar con transferencia?"*, el agente no tiene fuente: o inventa (viola la regla "NUNCA inventar datos") o responde que no sabe. Es una pregunta de altísima frecuencia en el ciclo de venta.

> Nota de higiene detectada de paso: `payment_methods` tiene GRANTs de tabla completos para `anon` (SELECT/INSERT/UPDATE/DELETE). La RLS lo contiene, pero es defensa en profundidad floja y del mismo tipo que la Aud.#1. No bloquea nada de este plan.

### Gap 5 — 🟠 La agenda avanzada protege al bot, pero él no sabe explicarlo

Hallazgo con buenas y malas noticias.

**Buena:** `get_available_slots` **y** `validate_appointment` respetan `schedule_exceptions` y `max_appointments_per_day` (verificado en las definiciones), y el trigger `validate_appointment` **no exime al bot** — su propio comentario lo dice: *"aplica a bot y dashboard: un festivo/tope es regla de negocio, no límite de plan"*. O sea: **el bot no puede agendar en un feriado ni pasarse del cupo.** Cero riesgo de datos corruptos.

**Mala:** cuando el trigger rechaza, lanza excepciones con `HINT='SCHEDULE_CLOSED'` / `HINT='SCHEDULE_DAILY_CAP'`. El `Tool - Crear Cita` recibe un error crudo de Postgres y el prompt no tiene ninguna regla para interpretarlo. Pasa en carreras reales: dos clientes tomando el último slot, o el cupo diario llenándose entre la consulta y la confirmación. El agente improvisa justo en el peor momento.

### Gap 6 — 🟡 El motor de recordatorios existió y se perdió

El workflow **inactivo** (`4Ym9882L9BfSSzIX`, 154 nodos, `updatedAt 2026-04-23`) contiene un motor de recordatorios completo:

```
Schedule Trigger T (horas) → Get Appointments to Reminder T → Send Template Reminder → Update Reminder
Schedule Trigger F (horas) → Get Appointments to Reminder F → …
Schedule Trigger (5 días)  → Get Reminder Confirmation → Send Message Reminder Confirmation → Update Reminder Confirmation
```

Se quedó atrás en la migración a la versión ramificada por plan. `appointments.confirmed` (boolean) sigue existiendo para sostenerlo. Esto reclasifica el pendiente: **no es diseñar un motor desde cero, es rescatar y modernizar uno que ya funcionó.** Y es justo lo que alimentaría `reminder_sent` y `confirmed_by_user` del pipeline — hoy marcados a mano con checkbox porque no hay productor automático.

### Gap 7 — 🟡 Los hallazgos de la auditoría de julio siguen todos abiertos

Re-verificados uno por uno contra el workflow en vivo de hoy:

| # | Hallazgo | Verificación en vivo |
|---|---|---|
| 4 | `Modelo - Embedding Pro` con `maxOutputTokens: 10` | ✅ Confirmado — **el tier Pro entero degrada a handoff** |
| 5 | `Historial - Obtener` sin `order` | ✅ Confirmado — `parameters` no tiene sort; trae los 10 más viejos |
| 9 | Modelos Gemini sin `modelName` | ✅ Confirmado — 4 nodos en `(DEFAULT)`: Pro, Enterprise, Embedding Pro, Embedding Enterprise |
| 8 | `WA - Respuesta *` sin `onError` | ✅ Peor de lo documentado: **los 19 nodos WhatsApp** están en `onError=STOP` y `retryOnFail=false` |
| 10 | `Conversaciones - Contar` cuenta user+assistant y trae todo | ✅ Confirmado — `getAll` sobre `history`, sin filtro de `role`, sin límite |
| 11 | Gate de turnos por `created_at`, 2×1000 filas | ✅ Confirmado |

> El lote de 12 cambios que quedó en pausa vivía en un `wf-put.json` local que **ya no existe** en el repo. No se pierde nada: eran precisamente estos fixes, y la Fase 0 de abajo los reconstruye desde el documento de auditoría.

---

## 3. Plan de implementación

Cuatro fases, ordenadas para que cada una deje el sistema mejor aunque las siguientes se pospongan. **Ninguna añade una sola llamada a un LLM** — todo son nodos HTTP y ajustes de configuración, así que el costo por conversación no sube.

### Fase 0 — Estabilizar lo que ya está roto *(sin esto, medir es medir un bot averiado)*

| # | Cambio | Nodo | Detalle |
|---|---|---|---|
| 0.1 | `maxOutputTokens: 10 → 100` | `Modelo - Embedding Pro` | Desbloquea el tier Pro completo. **El cambio de mayor impacto por esfuerzo de todo el plan.** |
| 0.2 | Añadir `order: created_at.desc` | `Historial - Obtener` | El agente vuelve a ver los mensajes recientes. El `Ordenar` asc posterior ya endereza el formato |
| 0.3 | Fijar `modelName` explícito | 4 nodos Gemini | Agentes Pro/Ent → `models/gemini-2.5-flash`; classifiers → `models/gemini-2.5-flash-lite`. Congela costo y comportamiento ante upgrades de n8n |
| 0.4 | `retryOnFail: 2` + `onError: continueErrorOutput` | `WA - Respuesta Basic/Pro/Enterprise` | Rama de error → cadena `Notif - Error IA *` existente. Hoy si Meta rechaza, la ejecución muere sin persistir ni avisar |

**Verificación:** diff pre/post por API (patrón ya usado en los fixes de julio) + 1 conversación de prueba end-to-end por plan.

### Fase 1 — Cerrar el circuito de negocio *(2 cambios, valor desproporcionado)*

**1.1 — Registrar consumo.** Un nodo HTTP después de **cada** `Historial - Respuesta {Basic|Pro|Enterprise}` (3 nodos):

```
POST https://kwpaaqdkklwwfslhkqpb.supabase.co/rest/v1/rpc/record_usage
headers: service_role (idénticos a los demás nodos HTTP)
onError: continueRegularOutput          ← jamás debe romper la conversación
{
  "p_business_id": "{{ $('Negocio - Obtener').first().json.id }}",
  "p_messages": 1,
  "p_tokens_in": 0,
  "p_tokens_out": 0
}
```

Con `p_messages: 1` ya alimenta el panel de admin y arma el corte automático. Mapear tokens reales desde el nodo Agente es una mejora v2, no un requisito.

**1.2 — Respetar la pausa.** Extender la condición del gate `¿Plan Activo?` (el `business` ya está en memoria — **0 requests extra**):

```js
['active','trial'].includes(b.plan_status)
  && b.active === true
  && b.ai_paused !== true                    // ← NUEVO
  && (b.plan_expires_at === null || DateTime.fromISO(b.plan_expires_at) > DateTime.now())
```

La rama falsa ya existe y envía `WA - Negocio Inactivo`. Conviene diferenciar el texto cuando la causa es `ai_paused_reason = 'usage_limit'` ("alcanzaste el límite de conversaciones de tu plan") frente a plan vencido — dos mensajes distintos para dos problemas distintos.

**Cierra:** hallazgos #6 y #12. **Verificación:** poner `limit_overrides.max_conversations = 2` en el negocio de prueba → al 3er mensaje `ai_paused` pasa a `true` y el bot deja de responder con mensaje amable; quitar el override y confirmar que revive.

### Fase 2 — Cablear el Pipeline CRM

Nodos HTTP a `pipeline_touch`, todos con `onError: continueRegularOutput`. Body común (el patrón de resolución del `patient_id` es el mismo que ya usan `Historial - Obtener` y los `Handoff - *`):

```json
{ "p_business_id": "{{ $('Negocio - Obtener').first().json.id }}",
  "p_patient_id":  "{{ $if($('Paciente - Obtener Datos').isExecuted, $('Paciente - Obtener Datos').first().json.id, $('Paciente - Crear').first().json.id) }}",
  "p_flag": "<bandera>",
  "p_summary": "<micro-texto que se ve en la tarjeta>" }
```

| Punto de disparo | `p_flag` | Nota |
|---|---|---|
| Tras `Tool - Obtener Servicios *` | `offered_services` | 3 planes |
| Tras `Tool - Ofertas Activas Enterprise` | `offered_promo` | Solo Enterprise |
| Tras `Tool - Slots Disponibles *` | `slot_offered` | Prende `queried_slots` + sella `slot_offered_at` |
| Tras `Tool - Crear Cita *` | *(ninguna)* | **No hace falta**: el trigger `pipeline_sync_from_appointment` liga el deal solo |

> **Decisión de arquitectura:** los tools son `httpRequestTool` (los invoca el LLM, no el grafo), así que no admiten un nodo "después" en el flujo principal. Dos caminos: (a) un nodo `pipeline_touch` tras la respuesta del agente que mande `activity` con el resumen, más simple pero menos granular; (b) convertir cada tool en un sub-workflow que haga la llamada y devuelva el dato, granular pero mucho más invasivo. **Recomiendo (a) para v1** — el pipeline gana señal de actividad real inmediatamente, y la granularidad fina se evalúa después con datos en mano.

Las banderas `reminder_sent`, `survey_sent`, `review_requested`, `recovery_step` y `nps_score` **no tienen productor** hasta la Fase 3; hoy se marcan a mano desde el dashboard, que es justamente por lo que se les puso checkbox.

### Fase 3 — Contexto nuevo para el agente

**3.1 — Tool de métodos de pago** (los 3 planes, `httpRequestTool`):

```
GET .../rest/v1/payment_methods
    ?business_id=eq.{{ $('Negocio - Obtener').first().json.id }}
    &active=eq.true&select=label,is_cash&order=sort_order
```

`toolDescription`: *"Formas de pago que acepta el negocio. Llamar solo si el cliente pregunta cómo puede pagar."*
Nótese el `select` frugal: **`fee_pct` no viaja** — es información interna de márgenes, no del cliente. Respeta la regla P2 de la casa.

**3.2 — Tool de perfil del cliente** (solo Enterprise) — la especificación exacta ya está escrita en [Automatización Agente IA.md §C.2](Automatización%20Agente%20IA.md), incluida la regla anti-tokens del prompt: *"llamar solo si el cliente NO es nuevo, máximo 1 vez por conversación"*.

**3.3 — Reglas de prompt para los errores nuevos de agenda.** Añadir al bloque REGLAS de los 3 agentes:

```
- Si CreateAppt falla con SCHEDULE_CLOSED → "Ese día el negocio está cerrado. ¿Te va bien otro día?"
- Si CreateAppt falla con SCHEDULE_DAILY_CAP → "Ya se llenó la agenda de ese día. ¿Buscamos otro?"
- Si CreateAppt falla por horario ocupado → volver a GetDayAppts y ofrecer los slots que queden.
```

Tres líneas que convierten el peor momento de la conversación (el error justo al confirmar) en una recuperación natural.

### Fase 4 — Motor de recordatorios *(rescate, no obra nueva)*

**Construirlo como workflow SEPARADO**, no dentro del monolito de 143 nodos. Razones: dispara por `scheduleTrigger` (no comparte nada con el flujo de WhatsApp entrante), aísla el riesgo, y es exactamente el caso de uso para el que sirve el MCP nativo recién conectado (`create_workflow_from_code` con el SDK).

Alcance v1:
1. Cron cada hora → turnos de mañana en `scheduled` sin recordar → plantilla de WhatsApp → `pipeline_touch(reminder_sent)`.
2. Respuesta de confirmación del cliente → `appointments.confirmed = true` + `pipeline_touch(confirmed_by_user)`.
3. Reutilizar la estructura probada del workflow inactivo (`Get Appointments to Reminder T/F`, `Send Template Reminder`) modernizando plantillas y multi-tenancy.

⚠️ Las plantillas de marketing de Meta cuestan ~$0.0851 cada una; las de **utilidad** (recordatorio de cita) son mucho más baratas. Verificar la categoría de la plantilla antes de escalar — el margen del plan depende de eso.

---

## 4. Cómo aplicar los cambios (decisión técnica importante)

Hay dos vías y **no son intercambiables**:

| Vía | Cuándo usarla | Riesgo |
|---|---|---|
| **API REST** (`scripts/n8n-api.mjs`, PUT quirúrgico) | Fases 0-3: editar nodos puntuales del workflow de 143 nodos | Bajo, con diff pre/post. ⚠️ El PUT des-registra el webhook de producción: **hay que alternar el switch Active en el editor después** |
| **MCP nativo** (`create_workflow_from_code`) | Fase 4: workflow nuevo de recordatorios | Bajo — es un workflow nuevo, no toca lo existente |

**No usar `update_workflow` del MCP sobre el workflow principal.** Ese endpoint reconstruye el workflow desde código SDK; regenerar 143 nodos artesanales desde una descripción es exactamente cómo se pierden parámetros que nadie recordaba. Para lo existente, cirugía por API.

Recordatorios operativos: el PUT solo acepta `{name, nodes, connections, settings}` (cualquier otra clave falla), y la URL del túnel Cloudflare rota por sesión.

---

## 5. Verificación por fase

| Fase | Cómo se comprueba que quedó bien |
|---|---|
| 0 | Diff pre/post por API · 1 conversación end-to-end por plan (la de **Pro** es la que importa: hoy muere en el classifier) |
| 1 | `usage_counters` crece con cada respuesta · override `max_conversations = 2` → `ai_paused` en `true` al 3er mensaje y bot silenciado con mensaje amable · quitar override → revive |
| 2 | `SELECT count(*) FROM pipeline_events WHERE source='bot'` pasa de 0 · el tablero muestra el micro-texto real en las tarjetas |
| 3 | Preguntar *"¿aceptan tarjeta?"* → responde desde la tabla, sin inventar · cliente recurrente → el agente Enterprise menciona su servicio frecuente · forzar un `SCHEDULE_CLOSED` → respuesta amable, no error crudo |
| 4 | Recordatorio llega a un turno de prueba · `pipeline_deals.reminder_sent` en `true` con su timestamp · responder "sí" → `confirmed = true` |

Transversal: `cron.job_run_details` sin errores nuevos y advisors de Supabase en 0 ERROR tras cualquier cambio de DB (ninguna fase de este plan requiere migración nueva — todo el backend ya existe).

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| El PUT des-registra el webhook y el bot queda mudo sin que nadie lo note | Alternar Active en el editor **inmediatamente** después de cada PUT y mandar 1 mensaje de prueba. Aplicar en lote, no cambio por cambio |
| El túnel Cloudflare cae a mitad del lote | `getaddrinfo ENOTFOUND` = túnel muerto, **no** PUT a medias. Re-leer el workflow por API antes de seguir |
| Fase 1 corta el bot de un cliente real por un límite mal configurado | Probar con override en el negocio de prueba, nunca en producción. Revisar que los `max_conversations` de los 3 planes sean los del Modelo de Negocio v3 antes de activar |
| Los tools nuevos inflan el prompt y el costo | Ambos son *pull* (el LLM decide llamarlos) con `select` frugal y regla de "solo si pregunta". Sin uso, cuestan la descripción del tool: ~20 tokens |
| Fase 2 opción (a) da menos granularidad de la que el tablero promete | Aceptado a propósito para v1. Con `activity` real fluyendo se decide si vale la pena la opción (b) |

---

## 7. Resumen ejecutivo

- **El bot está 3 meses atrás del dashboard**: 0 de 12 conceptos nuevos conocidos.
- **Casi todo el backend ya existe** — es trabajo de cableado, no de construcción. Ninguna fase necesita migración de DB.
- **El tier Pro está roto ahora mismo** (`maxOutputTokens: 10`) y es un cambio de un número.
- **La medición de consumo nunca ha registrado nada** (0 mensajes), lo que deja al modelo de negocio sin sustento y al corte automático sin gatillo.
- **La agenda avanzada ya protege al bot** a nivel de DB — lo único que falta es enseñarle a explicar el rechazo.
- **El motor de recordatorios no hay que diseñarlo**, hay que rescatarlo del workflow de abril.
