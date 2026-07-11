# Módulo IA de NovTurnIA — Auditoría del bot n8n (en vivo) + Plan del Módulo IA del sistema

> **Fecha:** 2026-07-10 · **Fuente:** workflow **activo** `NovTurnAI` (id `1npQWgfgBBIwVuxX`, 143 nodos / 129 sin stickies) leído **en vivo por la API de n8n** (no un export viejo), cruzado con el esquema real de Supabase (`kwpaaqdkklwwfslhkqpb`) y con **3 ejecuciones reales** (#368–#370) inspeccionadas nodo por nodo.
> **Absorbe y reemplaza** al histórico `05-agente-ia-memoria-y-fixes-n8n.md` (2026-07-06, eliminado — auditaba un export viejo con ramas Salud/Belleza/Otro; todo su contenido vigente vive aquí en la **Parte C**). El workflow actual rama por **plan: Basic / Pro / Enterprise**.
> Estructura: **Parte A** = auditoría completa (positivos + hallazgos + fixes) · **Parte B** = plan exhaustivo para Sonnet del **Módulo IA dentro de NovTurnIA** (workflows, backend, frontend/chat, todo con optimización de tokens) · **Parte C** = memoria del agente + estado de los fixes históricos.

---

# PARTE A — AUDITORÍA COMPLETA DEL WORKFLOW (2026-07-10)

## A.0 Método y alcance

- Workflow bajado por `GET /api/v1/workflows/1npQWgfgBBIwVuxX` (versión activa, `updatedAt 2026-07-10`).
- Ejecuciones reales leídas por `GET /api/v1/executions/{id}?includeData=true`: #368/#369 (error `invalid uuid: "undefined"`), #370 (flujo completo hasta el envío WA).
- Se analizaron: los 129 nodos funcionales, el grafo completo de conexiones (main + ai_tool + ai_languageModel), parámetros de cada nodo (prompts, filtros, headers, condiciones) y flags de resiliencia (`onError`/`retryOnFail`/`alwaysOutputData`).
- **Fixes ya aplicados hoy por API** (verificados con diff completo pre/post — nada más cambió):
  1. ✅ `DB - Request API Limit`: key `anon` (revocada) → **service_role**. El bot ya no muere 401 en cada mensaje.
  2. ✅ Gate `Flow - ¿Teléfono Negocio Existe?` **reconectado** a su lugar correcto: `Negocio - Obtener → ¿Existe? → Plan - Obtener` (antes corría después de `Plan - Obtener` y no protegía nada → causa exacta de #368/#369).
  3. ✅ `phone_number_id` sandbox de Meta (`1073994989122190`) registrado en "Clínica Doc (Prueba Enterprise)" para pruebas end-to-end.

## A.1 Arquitectura real del flujo (etapas)

```
Trigger - WhatsApp (webhook único de la app)
  → Negocio - Obtener            (businesses WHERE phone_number_id = metadata.phone_number_id)  ← multi-tenant
  → ¿Teléfono Negocio Existe?    (gate: número no registrado muere aquí — fix de hoy)
  → Plan - Obtener               (plans WHERE id = business.plan_id)
  → Turnos Scheduled+Confirmed → Merge → Contar → ¿Superó límite?   (gate turnos/mes)
  → Conversaciones - Contar → ¿Conversaciones Ok?                    (gate conversaciones/mes)
  → ¿Plan Activo?                (active|trial + active=true + plan_expires_at vigente)
  → ¿Tiene Mensaje? → Tipo de Mensaje (texto | audio→Groq Whisper | otro→error amable)
  → Buffer (Crear → Espera 3s → Obtener ventana 11s → Ordenar/Agregar → Campos)   ← debounce de ráfagas
  → DB - Request API Limit → ¿API Limit Ok?   (rate limit por usuario+negocio: bloquea del msg 21/h en adelante)
  → ¿Buffer Ok? (isLast + esValido) → Buffer - Eliminar
  → Saludo Simple (REGEX, 0 tokens) → respuesta directa | continúa
  → Paciente - Buscar/Crear (+ teléfono) → ¿Handoff Activo? (human_takeover → guarda y silencio)
  → Historial - Guardar Mensaje Usuario
  → Classifier por Plan → Classifier Basic|Pro|Enterprise   (CITAS / URGENCIA / QUEJA / PIDE_HUMANO / +DOMICILIO en Basic)
      ramas especiales → WA respuesta predefinida → history → notifications → human_takeover=true
  → CITAS: Historial - Obtener (3h, 10 msgs) → Ordenar → Limitar → Agregar → Formatear ("U:/A:" ≤200 chars)
  → Agente por Plan → Agente Basic|Pro|Enterprise (Gemini + 5-6 tools HTTP)
  → WA - Respuesta → Historial - Respuesta
  (error del agente → WA - Error → Notif error_ia → human_takeover → history)
```

**Tools por agente** (httpRequestTool, todos con service_role): Slots Disponibles (`get_available_slots`), Obtener Servicios (`services?select=id,name,duration_minutes,price`), Citas del Paciente (`get_patient_appointments`), Cancelar Cita (PATCH `appointments`), Crear Cita (`create_appointment`). Enterprise suma **Ofertas Activas** (`offers?select=name,description,promo_price,starts_at,ends_at,services(name,price)` con ventana de vigencia).

**Modelos:** Agentes = Gemini (Basic fija `gemini-2.5-flash-lite`; Pro/Enterprise usan el default del nodo — ver hallazgo #9). Classifiers = Gemini con `maxOutputTokens` 10 (Pro) / 150 (Enterprise) / sin cap (Basic, flash-lite). Audio = Groq Whisper.

## A.2 ✅ Puntos positivos (con evidencia — para que Sonnet los CONSERVE)

Esta sección importa tanto como los bugs: define el **estilo de la casa** que cualquier cambio futuro debe respetar.

| # | Qué está bien | Evidencia | Por qué importa |
|---|---|---|---|
| P1 | **Multi-tenant correcto** por `metadata.phone_number_id` | `Negocio - Obtener` filtra `businesses.phone_number_id = trigger.metadata.phone_number_id` | Patrón oficial de Meta para apps multi-número; escala a N negocios con un solo webhook |
| P2 | **Frugalidad de tokens en tools**: select explícito de columnas | services: `select=id,name,duration_minutes,price` · offers: `select=name,description,promo_price,starts_at,ends_at,services(name,price)` | Nunca viaja la tabla entera al contexto del LLM — regla de oro del proyecto |
| P3 | **Historial compacto**: ventana 3h, máx 10 msgs, formato `U:/A:` truncado a 200 chars/msg | `Historial - Obtener` (3h) + `Limitar` (10, lastItems) + `Formatear` (`substring(0,200)`) | ≤ ~600 tokens de historial por llamada, con techo duro |
| P4 | **Gates de negocio ANTES de gastar LLM** | Orden real del grafo: plan→turnos→conversaciones→activo→rate-limit **antes** de classifier/agente | Un negocio vencido o un usuario spameando cuesta **0 tokens** |
| P5 | **Saludo simple por REGEX** (0 tokens) | `Buffer - Campos.saludoSimple` regex `^(hola|hi|hey|buenas...)$` → respuesta template | El caso más frecuente de todos no toca ningún modelo |
| P6 | **Debounce de ráfagas** (buffer 3s/ventana 11s + `isLast`) | `Buffer - Crear/Espera/Obtener/Campos` + `¿Buffer Ok?` | 4 mensajes seguidos = **1** llamada al LLM, no 4; dedupe por `message_id` |
| P7 | **Escalera de modelos por plan** | Basic=flash-lite; Pro/Ent=flash; classifier siempre barato | El costo IA acompaña el precio del plan |
| P8 | **Resiliencia LLM bien pensada** | Classifiers: `retryOnFail×2 + continueErrorOutput` → rama "Classifier Fallido" (mensaje amable+handoff). Agentes: `retry×3 + continueErrorOutput` → WA Error + Notif `error_ia` + `human_takeover` + history | Un fallo de Gemini/Groq NUNCA deja al cliente sin respuesta; el dashboard se entera |
| P9 | **Handoff coherente en todas las ramas especiales** | URGENCIA/QUEJA/PIDE_HUMANO/DOMICILIO/errores → WA predefinido + history (role assistant) + notification tipada + `human_takeover=true` | La IA se aparta sola; `¿Handoff Activo?` bloquea el siguiente mensaje |
| P10 | **`alwaysOutputData` en lookups legítimamente vacíos** | `Paciente - Buscar Teléfono`, `Negocio - Obtener`, `Turnos - *`, `Conversaciones - Contar` | Un "no encontrado" no es un crash, es una rama |
| P11 | **Prompts de agente compactos y deterministas** | systemMessage ~500 tokens con pasos P1→P3 numerados, `STOP` explícitos, "1 tool/paso", "NUNCA inventar datos" | Menos iteraciones del agente = menos tokens; comportamiento reproducible |
| P12 | **Todo el acceso a datos vía service_role + RPCs endurecidas** | Tools y rate-limit (tras fix de hoy) usan service_role; `create_appointment`/`get_available_slots`/`get_patient_appointments` ya no son ejecutables por anon (Aud#1, apéndice de Infraestructura Supabase.md) | Superficie pública cerrada sin romper al bot |

## A.3 🔴🟠🟡 Hallazgos (todos, priorizados, con fix propuesto)

| # | Sev | Hallazgo | Estado |
|---|---|---|---|
| 1 | 🔴 | Rate-limit con key anon revocada → bot muerto | ✅ **CORREGIDO HOY** (API) |
| 2 | 🔴 | Gate de teléfono corría tarde → crash `uuid: undefined` con número no registrado | ✅ **CORREGIDO HOY** (API) |
| 3 | 🔴 | Credencial WhatsApp única no cubre el número sandbox → envío falla (`GraphMethodException 100/33`, ejec #370) | ✏️ **[TÚ]** abierto |
| 4 | 🔴 | `Modelo - Embedding Pro` (LLM del Classifier Pro) con `maxOutputTokens: 10` — el JSON de clasificación necesita ~30 tokens → **truncamiento** → todo mensaje Pro caería a "Classifier Fallido"+handoff | ✏️ abierto |
| 5 | 🔴 | `Historial - Obtener` con `limit=10` **sin `order`** → PostgREST devuelve los 10 más VIEJOS de la ventana de 3h; conversaciones largas pierden los mensajes recientes | ✏️ abierto |
| 6 | 🔴 | `record_usage` no se llama en ningún nodo → `usage_counters`=0, panel admin vacío, corte `ai_paused` nunca dispara | ✏️ decisión (heredado doc 05 #4) |
| 7 | 🟠 | Textos guardados en `history` hardcodean rubro/rol: "urgencia **dental**", "notificado al **doctor**" — para TODOS los planes/rubros; además **lo guardado ≠ lo enviado** (WA - Emergencia envía texto genérico) | ✏️ abierto |
| 8 | 🟠 | `WA - Respuesta *` sin `onError` → si Meta rechaza el envío (como en #370), la ejecución muere: **no** se guarda la respuesta en history, **no** hay notificación ni handoff | ✏️ abierto |
| 9 | 🟠 | `Modelo - Pro`, `Modelo - Enterprise`, `Modelo - Embedding Pro/Enterprise` **sin `modelName` explícito** → usan el default del nodo n8n; un upgrade de n8n puede cambiar modelo (y costo) silenciosamente | ✏️ abierto |
| 10 | 🟠 | `Conversaciones - Contar` cuenta filas `history` del mes **user+assistant** (≈2× por intercambio → límite efectivo ≈ mitad del plan) y además `getAll` **sin límite trae todas las filas con contenido** en cada mensaje entrante (payload creciente: a 5k msgs/mes son 5k filas por mensaje) | ✏️ abierto (heredado #5 doc 05 + agravante de payload) |
| 11 | 🟠 | Gate de turnos: filtra por `created_at` del mes; el trigger DB cuenta por `date_start` → "turnos del mes" significa distinto en bot vs dashboard. Además trae hasta 2×1000 filas completas solo para contar | ✏️ abierto (heredado #6) |
| 12 | 🟡 | Bot ignora `limit_overrides` (lee `plans` crudo; el dashboard usa `get_effective_limit`) | ✏️ abierto (heredado #7) |
| 13 | 🟡 | Mensaje con groserías → `esValido=false` → "Lo siento, solo puedo ayudarte con la gestión de turnos" — un cliente enojado (queja legítima con palabrotas) recibe respuesta incoherente en vez de ir a QUEJA/handoff | ✏️ diseño a revisar |
| 14 | 🟡 | `¿Teléfono Negocio Existe?` rama FALSE sin conexión → número no registrado muere sin log (correcto no responder, pero nadie se entera) | opcional |
| 15 | 🟡 | Rate limit real = **20 msg/h** (bloquea del 21º; condición `> 20`) — la memoria/docs decían 10. Documentado aquí como fuente de verdad | documentado |
| 16 | 🟡 | El prompt referencia tools por alias (`GetServices`, `GetDayAppts`, `CreateAppt`, `GetUserAppt`, `UpdateAppt`) que **no coinciden** con los nombres reales de los nodos (`Tool - Obtener Servicios Basic`...). Funciona porque el LLM mapea por descripción, pero es frágil | opcional |
| 17 | 🟡 | Al superar límite de turnos/conversaciones, el mensaje del cliente **no se guarda** en history → el dueño ve la notificación pero no qué pidió el cliente | opcional |

### Detalle y fix de cada hallazgo abierto

**#3 — Credencial WhatsApp (bloqueante para probar el sandbox).** Los 18 nodos WA usan la credencial fija `WhatsApp account` (`4OfxV7OuSSMmbwnp`) con `phoneNumberId` dinámico del negocio. Meta rechaza porque el token de esa credencial no tiene permiso sobre el número de pruebas (`15551377038`, WABA sandbox distinto) o expiró (tokens de quick-start duran 24h). **Nota estructural:** `businesses.whatsapp_token` (columna por tenant) **no se usa para enviar** — solo la credencial de n8n. En Modelo B (todos los números bajo TU WABA) una credencial única con token permanente de System User es correcto; la columna queda para el edge `wa-human-reply` y la migración futura a Tech Provider. **Fix [TÚ]:** Meta Business Settings → System User → generar token permanente con `whatsapp_business_messaging` sobre la app → pegarlo en n8n → Credentials → "WhatsApp account". Para el sandbox: usar el token temporal de la página API Setup (24h) o probar con un número real del WABA.

**#4 — Classifier Pro truncado (`maxOutputTokens: 10`).** El systemPromptTemplate exige responder `{"CITAS": true, "URGENCIA": false, ...}` (~30 tokens con 4 categorías). Con cap de 10, Gemini corta el JSON → parse error → `continueErrorOutput` → rama 4 = "Classifier Fallido" → mensaje "me está tomando más de lo esperado" + handoff. **Efecto: el tier Pro entero degrada a handoff en el primer mensaje.** (No verificado en vivo — el negocio de prueba es Enterprise — pero la aritmética es determinista.) **Fix:** nodo `Modelo - Embedding Pro` → `maxOutputTokens: 100` (igualar a Enterprise, que con 150 va sobrado; 100 basta). 30 segundos en la UI o lo aplico por API.

**#5 — Historial trae los 10 más viejos.** `Historial - Obtener` = `getAll history limit=10 WHERE patient_id & created_at >= now-3h & business_id` **sin order** → PostgREST sin `order` devuelve orden físico (id asc) → los 10 PRIMEROS de la ventana. El `Ordenar→Limitar(lastItems 10)` posterior reordena esos mismos 10 viejos. Si una conversación activa supera 10 mensajes en 3h, el agente deja de ver lo último que dijo el cliente (respuestas incoherentes difíciles de reproducir). **Fix:** en el nodo, añadir order `created_at desc` (o quitar `limit=10` del fetch y dejar que `Limitar` corte local — menos eficiente). Con `desc` en el fetch, el `Ordenar` asc posterior ya lo endereza para el formato.

**#6 — Metering muerto (decisión de producto).** Sin `record_usage`, el corte automático `ai_paused` del modelo de negocio (doc 01) no puede disparar y el panel admin muestra 0. **Fix recomendado:** 1 nodo HTTP tras cada `Historial - Respuesta *` → `POST /rest/v1/rpc/record_usage` `{p_business_id, p_messages: 1, p_tokens_in: 0, p_tokens_out: 0}` (headers service_role, `onError: continueRegularOutput` para que jamás rompa el flujo). Con `p_messages:1` ya alimenta panel y corte; mapear tokens reales del nodo Agente es opcional v2. **Alternativa:** declarar el gate por `history` como el mecanismo oficial y corregir doc 01. El Módulo IA (Parte B) SÍ cablea `record_usage` desde el día 1 — no hereden esta deuda.

**#7 — History dice "dental/doctor" para todos.** `Historial - Urgencia` guarda "🚨 …urgencia dental… notificado al doctor…" aunque el negocio sea barbería, y aunque `WA - Emergencia` haya ENVIADO otro texto (genérico). El chat del dashboard muestra algo que el cliente nunca recibió. **Fix:** igualar el `content` guardado al texto realmente enviado (copiar el textBody de cada nodo WA correspondiente); sacar "dental/doctor" → "urgencia"/"al responsable" (los WA ya lo hacen bien).

**#8 — Envío WA sin red de seguridad.** Visto en #370: el agente respondió, Meta rechazó, y la ejecución murió sin persistir nada. **Fix:** en los 3 `WA - Respuesta *`: `onError: continueErrorOutput` y conectar la rama de error a los `Notif - Error IA *` existentes (reutilizar la cadena Notif→Handoff→Historial Handoff). Opcional: mover `Historial - Respuesta *` ANTES del envío (la respuesta del agente vale la pena persistirla aunque Meta falle).

**#9 — Modelos sin fijar.** `Modelo - Pro/Enterprise` (agentes) y `Embedding Pro/Enterprise` (classifiers) no declaran `modelName`. **Fix:** fijar explícito: agentes Pro/Ent → `models/gemini-2.5-flash` (o el que decidas por costo), classifiers → `models/gemini-2.5-flash-lite`. Congela costo y comportamiento.

**#10 — Conteo de conversaciones: doble y pesado.** (a) Cuenta user+assistant → "5,000 conversaciones" del plan se agotan en ~2,500 intercambios. (b) `getAll` sin límite arrastra todas las filas del mes con `content` completo EN CADA MENSAJE. **Fix (a):** filtro `role=eq.user` en el nodo. **Fix (b):** cambiarlo por HTTP Request `GET /rest/v1/history?select=id&business_id=eq.X&created_at=gte.Y&role=eq.user` con headers `Prefer: count=exact` + `Range: 0-0` y leer `content-range` (1 fila de payload), o mejor: RPC `count_monthly_messages(business_id)` (1 número). Misma decisión sobre qué significa "conversación" debe reflejarse en doc 01.

**#11 — Gate de turnos:** alinear filtro a `date_start >= startOf month` (igual que el trigger DB `enforce_appointment_limit`) y contar con `Prefer: count=exact` en vez de traer 2×1000 filas. 

**#12 — `limit_overrides`:** si algún negocio tiene override, el bot no lo ve. Fix barato: `Flow - ¿Superó límite?` / `¿Conversaciones Ok?` comparan contra `{{ business.limit_overrides?.max_appointments ?? plan.max_appointments ?? 999999 }}` (business ya está cargado — 0 requests extra).

**#13 — Groserías → "mensaje inválido":** decisión de producto. Sugerencia: quitar la lista de palabrotas de `esValido` (dejar solo el filtro emoji-only) y dejar que el classifier las rutee (una queja con groserías ES una QUEJA). Riesgo bajo: el classifier ya maneja lenguaje hostil.

**#15 — Rate limit:** el valor operativo real es **20/h por usuario+negocio** (`Number($json) > 20` → bloquea a partir del mensaje 21 dentro de la hora). Si 10 era la intención, cambiar la condición a `> 10`; si 20 es correcto, este doc es la fuente de verdad (la memoria previa quedó actualizada).

## A.4 Matriz de resiliencia (nodos SIN manejo de error en ruta crítica)

Con manejo correcto hoy: classifiers (retry+error branch), agentes (retry+error branch), historial de escrituras (`continueRegularOutput`), lookups (`alwaysOutputData`), `Buffer - Crear` (continue).

**Sin `onError` (fallo = ejecución muerta, cliente sin respuesta):** `Plan - Obtener`, `Turnos - Scheduled/Confirmed`, `DB - Request API Limit`, `Buffer - Obtener/Eliminar`, `Paciente - Crear`, `Paciente - Crear Teléfono`, `Historial - Obtener`, **los 18 nodos WA**, `Audio - Descargar/Transcribir`, todos los `Notif - *` y `Handoff - *`. Prioridad de blindaje: (1) `WA - Respuesta *` (hallazgo #8), (2) `Paciente - Crear/Teléfono` (falla = conversación muerta sin aviso), (3) `Audio - *` (un audio corrupto mata el flujo; mejor rama a "no pude escuchar tu audio 🙏").

**Patrón de manejo recomendado (de la Aud.#4 2026-07-06, sigue vigente):**
1. Nodos de datos críticos (`Negocio/Plan/Buffer/Paciente`): `onError: continueRegularOutput` + rama que envía un WA amable ("Estamos con un problema técnico, intento de nuevo en un momento 🙏") y registra `notifications` tipo `error_ia`.
2. `WA - Respuesta *`: `retryOnFail` (2 intentos) + `onError` hacia la cadena Notif→Handoff existente (hallazgo #8).
3. **Error Workflow global de n8n** (aún no existe): workflow con *Error Trigger* que loguee cualquier excepción no capturada a una tabla `bot_errors` (o `notifications`) + aviso — cierra el punto "los errores mueren en silencio". Configurarlo en Settings del workflow (`errorWorkflow`).

## A.5 Checklist de fixes en n8n (orden recomendado)

1. ✏️ **[TÚ] #3** Token permanente de System User en la credencial WhatsApp *(bloquea toda prueba end-to-end)*.
2. ✏️ **#4** `Modelo - Embedding Pro` → `maxOutputTokens: 100` *(desbloquea el tier Pro)*.
3. ✏️ **#5** `Historial - Obtener` → order `created_at desc`.
4. ✏️ **#8** `onError` en `WA - Respuesta *` → rama a Notif/Handoff existentes.
5. ✏️ **#9** Fijar `modelName` en los 4 nodos Gemini sin él.
6. ✏️ **#6** Decisión metering → cablear `record_usage` (recomendado) o corregir doc 01.
7. ✏️ **#7, #10, #11, #12, #13** en ese orden.
8. (Los ✅ #1/#2 ya están aplicados y verificados por API.)

> Los fixes #4, #5, #9 y el rewire de #8 los puedo aplicar **por API** igual que los de hoy (con diff de verificación); #3 y #6 requieren tu decisión/acceso a Meta.

---

# PARTE B — PLAN: DEL CHAT DE WHATSAPP A LA IA DE NOVTURNIA (spec para Sonnet)

## B.0 Visión y principios no negociables

**Qué es:** hoy la IA solo vive en WhatsApp respondiendo pacientes. El Módulo IA le da inteligencia al **sistema**: el dueño/staff, desde el dashboard, obtiene resúmenes, estrategias, análisis de retención, narrativa de KPIs y un **chat de negocio** que responde preguntas sobre SUS datos. Es un producto **Enterprise** (gate por feature flags existentes `stats_intelligence`/`content_gen`).

**Principios (heredados del bot — ver A.2, son ley):**
1. **Pull, no push:** tokens solo cuando el usuario pide (botón) o en batch acotado (1×/semana). Nunca "IA ambiental".
2. **Cache-first:** todo resultado se persiste en `ai_insights`; VER un insight = 0 tokens. Solo "Generar/Regenerar" gasta.
3. **Contexto compacto:** la IA recibe **agregados y columnas puntuales** (RPCs existentes), jamás tablas crudas. Presupuesto por llamada: ≤ ~1,200 tokens de input.
4. **Modelo por tarea:** `gemini-2.5-flash-lite` para resumir/clasificar/rutear; `gemini-2.5-flash` solo para narrativa/estrategia/chat. **Siempre `modelName` explícito y `maxOutputTokens` calibrado** (lección del hallazgo #4).
5. **Metering desde el día 1:** cada llamada registra `record_usage(p_business_id, p_messages:0, p_tokens_in, p_tokens_out)` — este módulo no hereda el hallazgo #6.
6. **Salida estructurada:** los prompts piden JSON con schema fijo; la UI renderiza campos, no markdown libre.

## B.1 Backend

### B.1.1 DB (1 migración: `ai_module_foundation`)

```sql
-- Resultados cacheados de IA (la UI SIEMPRE lee de aquí)
CREATE TABLE public.ai_insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  scope        text NOT NULL CHECK (scope IN ('patient_summary','patient_strategy','retention','kpi_narrative','weekly_digest','content_offer','chat')),
  ref_id       uuid,                          -- patient_id para scopes de paciente; NULL para los de negocio
  content      jsonb NOT NULL,                -- salida estructurada del modelo (schema por scope, ver B.2)
  model        text NOT NULL,
  tokens_in    integer NOT NULL DEFAULT 0,
  tokens_out   integer NOT NULL DEFAULT 0,
  generated_by uuid,                          -- staff_users.id que pulsó "Generar" (NULL = batch)
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_insights_biz_scope ON public.ai_insights (business_id, scope, generated_at DESC);
CREATE INDEX idx_ai_insights_ref ON public.ai_insights (ref_id) WHERE ref_id IS NOT NULL;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_insights_select ON public.ai_insights FOR SELECT
  USING (business_id = (SELECT get_user_business_id()) AND (SELECT has_feature('stats_intelligence')));
-- Escritura SOLO service_role (las Edge Functions escriben) → sin políticas de INSERT/UPDATE/DELETE para authenticated.
GRANT SELECT ON public.ai_insights TO authenticated; GRANT ALL ON public.ai_insights TO service_role;

-- Chat de negocio (historial del módulo chat del dashboard)
CREATE TABLE public.ai_chat_messages (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id   uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL,                 -- cada staff tiene SU hilo
  role          text NOT NULL CHECK (role IN ('user','assistant')),
  content       text NOT NULL,
  tokens_in     integer NOT NULL DEFAULT 0,
  tokens_out    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_chat_biz_staff ON public.ai_chat_messages (business_id, staff_user_id, created_at DESC);
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_chat_select ON public.ai_chat_messages FOR SELECT
  USING (business_id = (SELECT get_user_business_id()) AND staff_user_id = (SELECT auth.uid()));
GRANT SELECT ON public.ai_chat_messages TO authenticated; GRANT ALL ON public.ai_chat_messages TO service_role;
-- Retención: añadir DELETE de >30 días al cron diario existente (patrón retain-history).
```

- **Permiso RBAC nuevo:** `use_ai_module` — seguir [[rbac-permissions]] al pie: `usePermissions.js` (`canUseAIModule`), checkbox en `Users.jsx` (grupo nuevo "IA"), backfill `staff_roles` (owner=true/resto=false) + DEFAULT, `onboard-tenant` (+redeploy).
- **Contexto compacto — 1 RPC nueva** (las demás ya existen):

```sql
-- Empaqueta TODO el contexto de negocio en un solo JSON compacto (~300-500 tokens).
CREATE OR REPLACE FUNCTION public.get_business_context_pack(p_business_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'negocio',   (SELECT jsonb_build_object('nombre', name, 'horario', schedule_days || ' ' || schedule_start || '-' || schedule_end) FROM businesses WHERE id = p_business_id),
    'kpis',      (SELECT get_stats_dashboard(p_business_id)),          -- ya agregado
    'finanzas',  (SELECT get_finance_summary(p_business_id, date_trunc('month', now())::date, now()::date)),
    'retencion', (SELECT get_retention_rate(p_business_id)),
    'top_servicios', (SELECT jsonb_agg(jsonb_build_object('s', service_name, 'n', total)) FROM (
        SELECT service_name, count(*) total FROM appointments
        WHERE business_id = p_business_id AND date_start >= now() - interval '30 days'
          AND status IN ('confirmed','completed')
        GROUP BY 1 ORDER BY 2 DESC LIMIT 5) t)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.get_business_context_pack(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_context_pack(uuid) TO service_role;
```
*(Ajustar firmas de las RPCs internas a las reales al implementar — verificar con MCP antes; si `get_finance_summary` pide otros parámetros, adaptar.)*

### B.1.2 Edge Functions (Deno, patrón `admin-*`/`onboard-tenant` existente)

**`ai-insights`** (on-demand, POST): body `{ scope, ref_id? , regenerate?: boolean }`.
1. Auth: JWT del staff (patrón `_shared/auth.ts`) → `staff_users` → `business_id` del caller (JAMÁS del body) + permiso `use_ai_module` + `has_feature('stats_intelligence')`.
2. Si `!regenerate` y existe insight del scope (< 24h para negocio, < 7 días para paciente) → devolver cache (0 tokens).
3. Rate limit: `check_rate_limit('ai:'+business_id, hora)` → máx 30 generaciones/h por negocio.
4. Armar contexto según scope (B.2): `get_business_context_pack` o `get_patient_profile` + extras puntuales.
5. Llamar Gemini (`generativelanguage.googleapis.com`, key en secret `GEMINI_API_KEY`) con `responseMimeType: application/json` + schema del scope + `maxOutputTokens` del scope.
6. INSERT `ai_insights` (con tokens del `usageMetadata` de la respuesta) + `record_usage(business_id, 0, tokens_in, tokens_out)` → devolver el insight.

**`ai-chat`** (POST): body `{ message }`. Mismo auth/gates que arriba.
1. Guardar msg user en `ai_chat_messages`.
2. **Router de intents (flash-lite, `maxOutputTokens: 60`):** clasifica la pregunta a una de: `kpis | finanzas | retencion | pacientes | servicios | agenda | general` + extrae entidades (nombre de paciente, rango de fechas). Prompt ~150 tokens.
3. **Fetch determinista según intent** (0 tokens): kpis→`get_stats_dashboard` · finanzas→`get_finance_summary` · retención→`get_retention_rate` · paciente→`search_patients(nombre)`+`get_patient_profile` · servicios→`get_service_analytics` · agenda→query puntual de appointments próximos (select columnas mínimas) · general→`get_business_context_pack`.
4. **Respuesta final (flash, `maxOutputTokens: 400`):** system compacto ("Eres el analista de {negocio}. Responde en español, conciso, con números concretos. Si el dato no está en DATOS, dilo.") + `DATOS: {json del paso 3}` + últimas **6** filas del hilo (truncadas a 300 chars) + pregunta. Input típico ≤ 1,200 tokens.
5. Guardar respuesta + `record_usage`. Devolver `{ answer }`.
- **Nunca** darle al LLM un tool de SQL libre: el router+allowlist de RPCs ES la seguridad (mismo espíritu que los tools del bot).

**Batch semanal** (digest + retención): reusar el patrón cron→Edge existente. `pg_cron` job `ai-weekly-digest` (lunes 07:00) → `net.http_post` a `ai-insights` interno (secret compartido, como onboard-tenant) por cada negocio Enterprise activo → genera `weekly_digest` y `retention` → INSERT en `notifications` (type `ai_digest`) para que el dueño lo vea al entrar. Alternativa n8n `scheduleTrigger` si prefieres verlo ahí — misma Edge Function, no duplicar lógica.

## B.2 Los 7 workflows, exhaustivos (contexto exacto · prompt · salida · UI · costo)

> Formato de cada uno: **Disparo → Contexto (qué viaja, cuántos tokens) → Prompt esqueleto → Salida JSON → Dónde se guarda/lee → Costo.**
> Todos los prompts en español, con "Responde SOLO el JSON del schema" (los schemas van como `responseSchema` de Gemini, no en el prompt — ahorra tokens y garantiza parseo).

### 1) Resumen de seguimiento por paciente (`patient_summary`, on-demand)
- **Disparo:** botón "Resumen IA" en la ficha del paciente (PatientDrawer).
- **Contexto (~350 tokens):** `get_patient_profile(biz, patient)` (visitas, no_shows, servicio_frecuente, ultima_visita, prioridad — ya existe, 0 LLM) + últimos 15 mensajes de `history` (solo `role,content`, truncados a 150 chars) + próximas citas (`get_patient_appointments`).
- **Prompt:** "Eres asistente clínico/comercial de {negocio}. Con PERFIL, CHAT y CITAS, resume la situación de este cliente para el dueño."
- **Salida:** `{ resumen: string(≤400), estado: 'activo'|'en_riesgo'|'inactivo'|'nuevo', siguiente_accion: string(≤200) }` · `maxOutputTokens: 250` · flash-lite.
- **UI:** card en la ficha; muestra `generated_at` + botón Regenerar.
- **Costo:** ~$0.0001/clic. Cache 7 días.

### 2) Estrategia por cliente (`patient_strategy`, on-demand)
- **Contexto:** el del #1 + ofertas activas del negocio (select frugal del bot) + precio de sus 3 servicios más usados.
- **Prompt:** "Propón UNA acción comercial concreta según prioridad ({alta: fidelizar/upsell, media: recurrencia, en_riesgo: reactivar}) y redacta el borrador de WhatsApp (≤300 chars, tono cercano guatemalteco)."
- **Salida:** `{ accion: string, razon: string(≤150), borrador_whatsapp: string(≤300) }` · `maxOutputTokens: 300` · **flash** (calidad de copy).
- **UI:** card con botón **"Copiar borrador"** — el dueño lo envía él mismo (el sistema NUNCA envía marketing solo; plantillas marketing cuestan $0.0851 — doc 02).
- **Costo:** ~$0.0004/clic.

### 3) Análisis de retención (`retention`, batch semanal + on-demand)
- **Contexto (~500 tokens):** SQL determinista previa (0 LLM): pacientes con `ultima_visita > 45 días` y `visitas ≥ 2` (máx 15, solo `display_name, visitas, servicio_frecuente, dias_sin_venir`) + `get_retention_rate`.
- **Prompt:** "Prioriza a quién contactar esta semana y por qué. Máximo 5."
- **Salida:** `{ tasa_retencion: number, prioridades: [{nombre, razon(≤100), sugerencia(≤150)}], insight_general: string(≤200) }` · `maxOutputTokens: 500` · flash.
- **UI:** sección "Retención" del módulo; batch deja notificación "Tu análisis semanal está listo".
- **Costo:** ~$0.0005/negocio/semana.

### 4) Narrativa de KPIs (`kpi_narrative`, on-demand desde Stats)
- **Contexto:** `get_business_context_pack` (§B.1.1) — TODO ya agregado, ~400 tokens.
- **Prompt:** "Explica en lenguaje de dueño de negocio el PORQUÉ detrás de estos números del mes y da 3 recomendaciones accionables."
- **Salida:** `{ titular: string(≤100), analisis: string(≤500), recomendaciones: [string(≤150)] x3 }` · `maxOutputTokens: 450` · flash.
- **UI:** botón "✨ Explicar con IA" arriba de Stats → card colapsable. Cache 24h.

### 5) Digest semanal (`weekly_digest`, batch lunes)
- **Contexto:** context pack con rango semana anterior + comparativa vs semana previa (2 llamadas a las mismas RPCs con fechas distintas, el diff lo calcula SQL/JS, no el LLM).
- **Salida:** `{ semana: string, resumen: string(≤400), wins: [string]≤3, alertas: [string]≤3, foco_siguiente_semana: string(≤150) }` · flash-lite basta.
- **UI:** card fija arriba del módulo IA + notificación; correo opcional vía la mejora de emails del Backlog (P1) cuando exista.

### 6) Contenido / ofertas (`content_offer`, on-demand)
- **Contexto:** `get_service_analytics` (servicios flojos por día) + ofertas activas + días valle de la semana (SQL sobre appointments, agregado).
- **Prompt:** "Sugiere 1-2 promos para llenar los días/horarios flojos y redacta el copy de cada una (WhatsApp status/story, ≤280 chars)."
- **Salida:** `{ promos: [{servicio, descuento_sugerido, dias, copy}] }` · flash.
- **UI:** en el módulo IA + botón "Crear oferta" que pre-llena el formulario del módulo Ofertas existente (conexión directa, sin magia).

### 7) Chat de negocio (el **módulo de chat** — `ai-chat`, B.1.2)
- Ya especificado arriba (router intents → fetch determinista → respuesta). Es la pieza central de UI (B.3).
- **Ejemplos de preguntas que debe resolver:** "¿cómo vamos este mes vs el pasado?" (kpis), "¿quién no ha vuelto?" (retención), "¿cuánto gasté en insumos?" (finanzas), "¿qué le pasa a María López?" (paciente), "¿qué día me conviene meter una promo?" (servicios).
- **Costo:** ~$0.0005-0.001/pregunta. Presupuesto sugerido: 500 preguntas/mes Enterprise (gate suave con `usage_counters`, corte con mensaje amable).

## B.3 Frontend (plan detallado)

### B.3.1 Estructura
```
src/pages/Intelligence.jsx          ← página del módulo (ruta /ia, lazy como las demás)
src/components/AI/
  AIChatPanel.jsx                   ← chat (centro del módulo)
  InsightCard.jsx                   ← card genérica de insight (por scope: icono, título, contenido estructurado, generated_at, botón Regenerar)
  RetentionSection.jsx              ← lista de prioridades (#3)
  DigestCard.jsx                    ← digest semanal (#5)
  PatientAIBlock.jsx                ← bloque para la ficha del paciente (#1 + #2)
src/hooks/useAIInsights.js          ← { insights, loading, generate(scope, refId, regenerate), reload }
src/hooks/useAIChat.js              ← { messages, sending, send(text), reload }
src/services/supabaseService.js     ← getAIInsights(scope, refId?), getAIChatMessages(), invokeAIInsights(...), invokeAIChat(...)  (fetch directo a Edge Functions con JWT — patrón adminService)
```

### B.3.2 Gating y navegación
- Item "IA" en el sidebar (icono `Sparkles`), visible solo si `has_feature('stats_intelligence')` (plan) **y** `canUseAIModule` (RBAC). Ruta `/ia` redirige como `/stats` si falta permiso.
- Para planes sin la feature: mostrar el item con candado (patrón `FeatureLock` ya existente en Finanzas) → upsell a Enterprise.

### B.3.3 Layout de `Intelligence.jsx` (mismo lenguaje glass del sistema)
- **Desktop:** 2 columnas. Izquierda (60%): `AIChatPanel` — burbujas estilo Conversaciones, input abajo (`glass-input`), estados: vacío ("Pregúntame sobre tu negocio…" + 4 chips de preguntas sugeridas que disparan `send`), enviando (dots), error (toast + reintento). Derecha (40%, scroll): `DigestCard` + `InsightCard` de kpi_narrative/retention/content_offer con sus botones Generar/Regenerar.
- **Móvil:** tabs internos "Chat" | "Insights" (patrón de tabs de Finanzas).
- **Ficha de paciente:** `PatientAIBlock` bajo las notas — 2 botones ("Resumen IA", "Estrategia") → drawer/card con el resultado; "Copiar borrador" en estrategia.
- Clases: `bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md`, pills `rounded-full`, glows de esquina `rgba(64,98,200,0.05)` — clonar de `CategoriesSection`/`Settings`.
- Toasts: `showSuccessToast`/`showErrorToast` existentes (no hace falta familia nueva).

### B.3.4 Reglas de UX-tokens
- El módulo **abre leyendo cache** (`ai_insights` vía SELECT — 0 tokens, instantáneo).
- Cada card muestra "Generado hace X" y el botón Regenerar pide confirmación si < 1h.
- El chat NO se auto-regenera ni hace preguntas de seguimiento solo.
- Deshabilitar botones mientras `sending` (evitar doble gasto).

## B.4 Seguridad y costos

- **Grants:** `get_business_context_pack` y toda RPC nueva → solo `service_role` (REVOKE PUBLIC/anon/authenticated — patrón Aud#1). Las Edge Functions derivan `business_id` del JWT, jamás del body.
- **RLS:** `ai_insights`/`ai_chat_messages` solo SELECT para authenticated (escritura exclusiva service_role). El SELECT de insights exige `has_feature('stats_intelligence')` → si el negocio baja de plan, deja de ver hasta el histórico (decisión deliberada, coherente con FeatureLock).
- **Presupuesto/corte:** `record_usage` en cada llamada; `ai_paused` del negocio también pausa el módulo (checar en la Edge). Rate limit `ai:{business_id}` 30/h.
- **Retención:** `ai_chat_messages` 30 días (cron); `ai_insights` conservar últimos 10 por scope (DELETE en la misma Edge al insertar).
- **Costos estimados** (rate card Gemini vigente al implementar — verificar): flash-lite ≈ $0.10/M in · $0.40/M out; flash ≈ $0.30/M in · $2.50/M out. Escenario Enterprise intensivo (100 preguntas chat + 50 resúmenes + 4 digests + 4 retenciones/mes) ≈ **< $0.50/mes por negocio** vs plan de Q3,999 — margen absoluto.

## B.5 Orden de implementación para Sonnet + verificación

**Fase 1 — Fundación (1 sesión):** migración `ai_module_foundation` (tablas+RLS+RPC context pack+grants) → probes de rollback (SELECT con impersonación authenticated: propio sí / ajeno no / sin feature no) → permiso `use_ai_module` en toda la pila (patrón doc 08 §2) → redeploy `onboard-tenant`.
**Fase 2 — `ai-insights` + primer scope (1 sesión):** Edge Function con `kpi_narrative` (el más simple: context pack ya agregado) → botón en Stats → cache/regenerate/metering verificados con curl (JWT real) antes de UI.
**Fase 3 — Chat (1-2 sesiones):** `ai-chat` (router+allowlist) → `Intelligence.jsx` + `AIChatPanel` + hooks → probar las 5 preguntas ejemplo de B.2.7 contra datos del negocio de prueba.
**Fase 4 — Resto de scopes + batch (1-2 sesiones):** patient_summary/strategy en la ficha, retention+digest+cron, content_offer→Ofertas.
**Verificación transversal:** cada fase termina con (a) probe SQL de RLS, (b) curl a la Edge con y sin permiso/feature (403 esperado), (c) `usage_counters` incrementando, (d) preview del front compilando + snapshot.

**Qué NO hacer (deuda conocida que este módulo no debe heredar):** memoria semántica pgvector (diferida — Parte C §C.3), envío automático de mensajes de marketing, darle al LLM acceso SQL libre, prompts sin `responseSchema`, modelos sin `modelName` fijo.

---

# PARTE C — MEMORIA DEL AGENTE Y ESTADO DE FIXES HISTÓRICOS (absorbido del doc 05, actualizado 2026-07-10)

## C.1 Estado de los 7 fixes del doc 05 (auditoría 2026-07-06) a hoy

| # doc05 | Qué | Estado 2026-07-10 |
|---|---|---|
| 1 | `check_rate_limit` con key anon revocada → bot muerto 401 | ✅ **HECHO** (2026-07-10, por API — ver A.0) |
| 2 | Triggers `enforce_*_limit` rompían al bot (paciente #51) | ✅ **HECHO** (2026-07-06, migración `limits_visualization_only_and_profile_and_revokes`: `IF auth.uid() IS NULL THEN RETURN NEW`) — límites = visualización para el bot, cap duro solo dashboard |
| 3 | RPCs de agenda ejecutables por `anon` (key pública) | ✅ **HECHO** (2026-07-06): `REVOKE ... FROM PUBLIC, anon` en `create_appointment`/`get_available_slots`/`get_patient_appointments`; verificado anon=false |
| 4 | `record_usage` nunca se llama → metering muerto, `ai_paused` no corta | ❌ **PENDIENTE** — hoy es el hallazgo **A.3 #6** (y doc Modelo de Negocio H1/H2: el bot además ignora `ai_paused`) |
| 5 | Conteo de conversaciones cuenta filas user+assistant (≈2×) | ❌ **PENDIENTE** — hoy es **A.3 #10** |
| 6 | Gate de turnos usa `created_at` vs `date_start` del trigger | ❌ **PENDIENTE** — hoy es **A.3 #11** |
| 7 | El bot ignora `limit_overrides` | ❌ **PENDIENTE** — hoy es **A.3 #12** |

Migración DB registrada: `limits_visualization_only_and_profile_and_revokes` (triggers eximen bot + revokes + `get_patient_profile`). Verificada con probes de rollback: bot crea paciente #51 en Básico ✓; dashboard bloqueado ✓; 4 RPCs anon=false/service_role=true ✓.

## C.2 Memoria frugal del agente — `get_patient_profile` (✅ DB lista · ❌ falta cablear el tool)

**Por qué este diseño:** la memoria semántica (pgvector + LLM destilador) se difirió por costo de tokens — una llamada destiladora por conversación ≈ duplica el costo IA. En su lugar: perfil **determinista por SQL, 0 tokens de escritura**, ~40-60 tokens de lectura.

**✅ Implementado en DB (2026-07-06):** `get_patient_profile(p_business_id uuid, p_patient_id uuid)` — SECURITY DEFINER, EXECUTE solo service_role. Salida compacta:
```json
{ "visitas": 2, "no_shows": 0, "servicio_frecuente": "Corte", "ultima_visita": "2026-06-15T16:00:00+00:00", "prioridad": "media" }
```
`prioridad`: `alta` (≥5 visitas) / `media` (≥2) / `nueva`. Usa el índice existente `idx_appt_patient`.

**❌ PENDIENTE de aplicar en n8n (solo agente Enterprise):**
1. Nuevo nodo `Tool - Perfil Paciente Enterprise` (`httpRequestTool`) conectado por `ai_tool` SOLO al `Agente - Enterprise`:
   - `GET https://kwpaaqdkklwwfslhkqpb.supabase.co/rest/v1/rpc/get_patient_profile?p_business_id={{ $('Negocio - Obtener').first().json.id }}&p_patient_id={{ $if($('Paciente - Obtener Datos').isExecuted, $('Paciente - Obtener Datos').first().json.id, $('Paciente - Crear').first().json.id) }}`
   - Headers service_role (idénticos a los demás tools).
   - `toolDescription`: "Perfil del cliente recurrente: visitas, servicio frecuente, última visita, prioridad. Llamar SOLO si el cliente ya es conocido, para personalizar."
2. Regla anti-tokens en el systemMessage del Agente Enterprise: "Llama GetPerfil **solo** si el cliente NO es nuevo; máximo 1 vez por conversación."
3. Uso esperado: personalizar ("veo que sueles venir por {servicio_frecuente}") y priorizar ofertas a `prioridad='alta'`.

> Este mismo RPC es el bloque de contexto barato que reutiliza el Módulo IA del dashboard (Parte B §B.2.1-2.3).

## C.3 Memoria semántica pgvector — DIFERIDA (diseño preservado para el futuro)

Retomar solo cuando el volumen Enterprise justifique el costo (1 llamada LLM destiladora/conversación + ~150 tokens/mensaje de inyección):
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE patient_memories ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  content text, embedding vector(768), created_at timestamptz DEFAULT now() );
CREATE INDEX ON patient_memories USING hnsw (embedding vector_cosine_ops);
-- RPC match_patient_memories(business_id, patient_id, query_embedding, k) → top-k por <=>
```
n8n: (escritor) tras la conversación, LLM destila 0-3 hechos → embedding (`text-embedding-004`) → insert; (lector) tool que embebe la consulta y trae top-k.

---

## Apéndice — Estado de datos de prueba (para retomar el testing en vivo)
- Negocio de prueba: **"Clínica Doc (Prueba Enterprise)"** `5eeec815-6335-48eb-a1ed-f90e75d50e4c`, `phone_number_id 1073994989122190` (sandbox Meta), plan Enterprise.
- Paciente de prueba creado por la ejecución #370: `b1e53557-...` (tel `50247989357`, "Juan Diego").
- ⚠️ El negocio de prueba **no tiene `services`** → el agente responde "No se encontraron servicios disponibles". Sembrar 2-3 servicios antes de la próxima prueba end-to-end.
- Bloqueante actual de la prueba completa: hallazgo **#3** (credencial WhatsApp vs sandbox).
