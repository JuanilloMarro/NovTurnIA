# Automatización IA (n8n) — Auditoría

> Workflow `NovTurnAI` (`1npQWgfgBBIwVuxX`), **activo**, **151 nodos**, descargado por API y analizado nodo por nodo: tipos, conexiones, headers, filtros, modelos y recorrido del grafo. Se inspeccionó también el workflow inactivo `4Ym9882L9BfSSzIX` (154 nodos).
> Absorbe los documentos previos `Automatización Agente IA.md` y `Bot n8n - Puesta al Dia.md`.
> Complementa a [Auditoría Técnica Multi-Tenant](Auditoria%20Tecnica%20Multi-Tenant.md) y [Modelo de Negocio](Modelo%20de%20Negocio.md).

---

## 1. Resumen

| Área | Estado |
|---|---|
| Aislamiento multi-tenant de los tools | 🔴 **17 de 20 correctos; los 3 de cancelación escriben sin filtro de negocio** |
| Gestión de credenciales | 🔴 `service_role` en texto plano en 20 nodos |
| Separación de presupuestos IA | ✅ El bot no toca `ai_usage_weekly` — la bolsa del Centro IA queda limpia |
| Mensajes salientes por turno | ✅ **Uno solo** — verificado recorriendo el grafo |
| Medición de tokens | ⚠️ Estimada por longitud de texto, no real; subcuenta |
| Techo de tokens del bot | 🔴 `maxOutputTokens` sin fijar en los 3 agentes |
| Escalera de modelos por plan | ⚠️ Pro y Enterprise usan **el mismo modelo** |
| Motor de recordatorios | 🔴 Cero `scheduleTrigger` en el activo — pero **existe completo en el workflow inactivo** (§6) |
| Manejo de errores | ⚠️ 92 de 151 nodos sin `onError`; sin workflow de error global |

**Composición:** 42 Supabase · 20 httpRequestTool · 18 WhatsApp · 11 Set · 10 httpRequest · 9 If · 6 Gemini · 4 Switch · 3 Agent · 3 TextClassifier · 14 notas.

---

## 2. Hallazgos

| # | Sev | Hallazgo |
|---|---|---|
| **A1** | 🔴 | **Cancelación de turnos sin aislamiento de tenant.** Los 3 nodos `Tool - Cancelar Cita {Basic\|Pro\|Enterprise}` hacen `PATCH /rest/v1/appointments?id=eq.{{ $fromAI('appointment_id') }}` con clave `service_role` — **que salta la RLS** — y el único filtro es un UUID **que decide el LLM**. No hay `business_id`. Los otros 17 tools sí acotan por negocio: es la única excepción. Un cliente que induzca al modelo a usar otro UUID cancela un turno de **cualquier otro negocio de la plataforma**. Mitiga que un UUID v4 no se adivina, pero cualquier filtración (captura de pantalla, ticket de soporte, export) lo vuelve explotable |
| **A2** | 🔴 | **`service_role` en texto plano en 20 nodos.** Las claves viajan en `jsonHeaders` dentro del JSON del workflow, no en el almacén de credenciales de n8n. Cualquiera con acceso al editor —o a la API, que devuelve el workflow completo— obtiene una llave que ignora toda la RLS del sistema |
| **A3** | 🔴 | **Sin techo de salida en los agentes.** `Modelo - Basic/Pro/Enterprise` no fijan `maxOutputTokens` (queda el default del proveedor). Con `maxIterations: 10` por agente, un turno puede encadenar hasta 10 llamadas al modelo sin tope de longitud. Los únicos con techo son los de embedding (150) |
| **A4** | 🔴 | **El motor de recordatorios no está en producción.** El workflow activo tiene cero `scheduleTrigger`: su único disparador es `Trigger - WhatsApp`. `reminders` (Pro/Ent) y `auto_confirm` (Ent) se venden en `plans.features` sin nada detrás, y son **2 de los 15 mensajes** del presupuesto del modelo de negocio. **Buena noticia:** el motor completo sigue vivo en el workflow inactivo `4Ym9882L9BfSSzIX` — es rescate, no obra nueva (§6) |
| **A5** | 🟠 | **La medición de tokens es una estimación, no el dato real.** `record_usage` calcula `p_tokens_in = (historial + mensaje + 1200) / 4` y `p_tokens_out = salida / 4`, en vez de leer el `usageMetadata` que devuelve Gemini. Dos consecuencias: (a) el prompt de sistema son 3,008 caracteres (~750 tokens) y solo se computan 1,200 caracteres (~300) → **subcuenta ~450 tokens por mensaje**; (b) los tokens que consumen las llamadas a herramientas dentro del bucle del agente **no se cuentan en absoluto** |
| **A6** | 🟠 | **Pro y Enterprise usan el mismo modelo** (`gemini-2.5-flash`). La feature `ai_reasoning` vende una escalera de tres niveles (standard/advanced/premium) que en el bot son solo dos |
| **A7** | 🟠 | **92 de 151 nodos sin `onError` explícito** — incluidos `Historial - Obtener`, `Buffer - Obtener`, `Paciente - Crear` y `Audio - Transcribir`. Si cualquiera falla, la ejecución muere y **el cliente nunca recibe respuesta**, sin traza. Los 18 nodos de WhatsApp sí están protegidos con `continueRegularOutput` |
| **A8** | 🟠 | **Sin workflow de error global.** No hay Error Trigger, así que los fallos de los 92 nodos anteriores no llegan a ninguna tabla ni alerta |
| **A9** | 🟠 | **Ventana de contexto de 100 mensajes.** `Historial - Obtener` trae `limit: 100` en cada turno. Combinado con `maxIterations: 10`, el peor caso de un solo turno son 10 llamadas con 100 mensajes de historial cada una. Es el verdadero motor del costo de tokens |
| **A10** | 🟡 | **`custom_prompt` se inyecta en los 3 agentes**, Básico incluido. Es feature Pro/Enterprise: el frontend impide *editarlo*, pero si la columna trae valor el bot lo usa igual |

---

## 3. Lo que está bien

- **Aislamiento correcto en 17 de 20 tools** — `create_appointment`, `get_patient_appointments`, `get_patient_profile`, `payment_methods`, `bot_offer_*` y slots pasan `p_business_id` desde el nodo `Negocio - Obtener`, nunca desde el LLM.
- **Un solo mensaje saliente por ruta** — verificado recorriendo el grafo de conexiones: ninguna ruta encadena dos envíos a WhatsApp. El costo por turno es un mensaje, no tres.
- **Los 18 nodos de WhatsApp con `onError: continueRegularOutput`** — un fallo de envío no tumba la ejecución.
- **Separación de bolsas de IA respetada** — cero referencias a `check_ai_budget`, `record_ai_usage`, `get_ai_usage` o `ai_usage_weekly`. El bot no consume el presupuesto del Centro IA.
- **`modelName` explícito en los 6 modelos** — ninguno depende del default de n8n.
- **Los 3 `bot_offer_*` van por POST** — el fallo silencioso de PostgREST (GET ejecuta en transacción de solo lectura y descarta la escritura) está corregido.
- **Gates de plan cableados** — `record_usage` ×3, `pipeline_touch` ×3, lectura de `usage_counters` y `check_rate_limit`.

---

## 4. Remediación

### 4.1 A1 — Cancelación acotada al tenant

Sustituir el `PATCH` directo por una RPC que valide pertenencia en el servidor:

```sql
CREATE OR REPLACE FUNCTION public.bot_cancel_appointment(
  p_business_id uuid, p_patient_id uuid, p_appointment_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row appointments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM appointments
   WHERE id = p_appointment_id
     AND business_id = p_business_id      -- aislamiento real
     AND patient_id  = p_patient_id;      -- y además, del propio paciente

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turno no encontrado para este cliente.');
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'already_cancelled', true);
  END IF;

  UPDATE appointments SET status = 'cancelled', cancelled_at = now()
   WHERE id = p_appointment_id;

  RETURN jsonb_build_object('ok', true, 'id', p_appointment_id);
END $$;

REVOKE ALL ON FUNCTION public.bot_cancel_appointment(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_cancel_appointment(uuid,uuid,uuid) TO service_role;
```

En los 3 nodos: `POST /rest/v1/rpc/bot_cancel_appointment` con `p_business_id` y `p_patient_id` tomados del flujo (no del LLM) y solo `p_appointment_id` desde `$fromAI`. Aunque el modelo invente un UUID, la RPC no encuentra fila y no escribe nada.

### 4.2 A2 — Credenciales al almacén de n8n

Crear una credencial *Header Auth* con la `service_role` y referenciarla desde los 20 nodos (`authentication: predefinedCredentialType`), eliminando `jsonHeaders`. Rotar la clave después, porque la actual ya estuvo en texto plano en cada export del workflow.

### 4.3 A3 + A9 — Acotar el gasto de tokens

- `maxOutputTokens` explícito en los 3 agentes: **400** basta para una respuesta de WhatsApp y evita respuestas desbocadas.
- Bajar `Historial - Obtener` de 100 a **20 mensajes**. Una conversación de agendamiento no necesita más, y el costo por turno cae proporcionalmente.
- Bajar `maxIterations` de 10 a **5**: con los tools actuales, 5 pasos cubren el flujo completo de agendar.

### 4.4 A5 — Medir tokens reales

El nodo de Gemini expone `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`). Pasar esos valores a `record_usage` en lugar de la estimación por longitud, sumando `thoughtsTokenCount` como salida (se factura así). Sin esto, la telemetría de costo del modelo de negocio arrastra un sesgo a la baja.

### 4.5 A7 + A8 — Errores visibles

- `onError: continueRegularOutput` en los nodos de lectura no críticos (`Historial - Obtener`, `Buffer - Obtener`, `Perfil`), para que una lectura fallida degrade en vez de matar la conversación.
- Workflow separado con **Error Trigger** que inserte en una tabla `bot_errors` (o en `notifications`) el nombre del nodo, el `business_id` y el mensaje.

---

## 5. Correcciones a auditorías previas

Dos afirmaciones de documentos anteriores quedan corregidas por esta auditoría:

**El bot ya envía un solo mensaje por turno.** El modelo de negocio listaba «consolidar la respuesta del bot a un mensaje por turno» como la palanca de costo más grande, con un ahorro estimado de 50-66%. **Esa palanca no existe**: el recorrido del grafo confirma que ninguna ruta encadena dos envíos. El costo por turno ya es de un mensaje. La tarea se retira del backlog.

**La medición de tokens del bot es estimada, no real.** Se había documentado que `usage_counters` acumula tokens del bot —lo cual es cierto—, pero son una heurística por longitud de texto que subcuenta el prompt de sistema y omite por completo las llamadas a herramientas. Los 534 tokens/mensaje medidos en producción son un piso, no el consumo real.

---

## 6. El motor de recordatorios existe — está en un workflow inactivo

**Verificado en vivo por API.** La instancia tiene dos workflows:

| Estado | ID | Nodos | `scheduleTrigger` |
|---|---|---|---|
| **Activo** | `1npQWgfgBBIwVuxX` | 151 | ninguno |
| **Inactivo** | `4Ym9882L9BfSSzIX` | 154 | **3** |

El inactivo conserva el motor completo, con sus cadenas intactas:

```
Schedule Trigger T (cada hora)
  └─ Get Business T → Get Appointments to Reminder T → Send Template Reminder → Update Reminder

Schedule Trigger F (cada hora)
  └─ Get Business F → Loop Over Items → Get Appointments to Reminder F → Update Cancel Appointment

Schedule Trigger (cada 5 días)
  └─ Get many rows → … → Get Reminder Confirmation → Send Message Reminder Confirmation
                                                    → Update Reminder Confirmation
```

**Esto reclasifica A4: no es diseñar un motor, es rescatar uno que ya funcionó.** Se quedó atrás en la migración a la versión ramificada por plan. `appointments.confirmed` sigue existiendo para sostenerlo, y es exactamente lo que alimentaría `reminder_sent` y `confirmed_by_user` del pipeline — hoy marcados a mano porque no hay productor automático.

**Alcance de v1 al rescatarlo:**

1. Cron horario → turnos de mañana en `scheduled` sin recordar → plantilla → `pipeline_touch(reminder_sent)`.
2. Respuesta de confirmación del cliente → `appointments.confirmed = true` + `pipeline_touch(confirmed_by_user)`.
3. Reutilizar `Get Appointments to Reminder T/F` y `Send Template Reminder`, modernizando plantillas y multi-tenancy.

**Construirlo como workflow SEPARADO**, no dentro del monolito de 151 nodos: dispara por cron, no comparte nada con el flujo de WhatsApp entrante, y aísla el riesgo.

⚠️ **Verificar la categoría de la plantilla en Meta antes de escalar.** Una plantilla de *utilidad* cuesta Q0.104; una de *marketing*, Q0.681 — 6.5× más. El margen del plan depende de esa clasificación.

---

## 7. Hallazgos menores heredados, aún abiertos

De la auditoría de julio, tras cerrarse #1-#12: quedan cinco de diseño, ninguno bloqueante.

| # | Hallazgo |
|---|---|
| **A11** | **Una queja con groserías se responde como mensaje inválido.** El filtro `esValido` incluye lista de palabrotas → responde "solo puedo ayudarte con la gestión de turnos" a un cliente enojado, en vez de rutearlo a QUEJA/handoff. Propuesta: quitar las palabrotas del filtro (dejar solo emoji-only) y dejar que el clasificador las rutee — una queja con groserías **es** una queja |
| **A12** | **`¿Teléfono Negocio Existe?` rama FALSE sin conexión** — un número no registrado muere sin log. No responder es correcto; que nadie se entere, no |
| **A13** | **El prompt referencia los tools por alias** (`GetServices`, `GetDayAppts`, `CreateAppt`, `GetUserAppt`, `UpdateAppt`) que no coinciden con los nombres reales de los nodos. Funciona porque el LLM mapea por descripción, pero es frágil ante cualquier renombrado |
| **A14** | **Al superar el límite de turnos o conversaciones, el mensaje del cliente no se guarda en `history`** — el dueño ve la notificación pero no qué pidió el cliente |
| **A15** | **El rate limit real es 20 msg/h** por usuario+negocio (bloquea del 21º; condición `> 20`). La documentación previa decía 10. Este documento es la fuente de verdad; decidir si 20 es el valor deseado |

---

## 8. Operación del workflow — reglas aprendidas

Reglas de trabajo que costaron incidentes reales y conviene no volver a descubrir:

| Regla | Por qué |
|---|---|
| **El PUT des-registra el webhook de producción** | Tras cada PUT hay que alternar Active (o hacer `deactivate`+`activate` por API) y mandar un mensaje de prueba. Si no, el bot queda mudo sin que nadie lo note |
| **El PUT solo acepta `{name, nodes, connections, settings}`** | Cualquier otra clave hace fallar la petición completa |
| **Aplicar en lote, no cambio por cambio** | Cada PUT es un ciclo de riesgo sobre el webhook |
| **No usar `update_workflow` del MCP sobre el workflow principal** | Ese endpoint reconstruye el workflow desde código SDK: regenerar 151 nodos artesanales desde una descripción es cómo se pierden parámetros que nadie recordaba. Para lo existente, cirugía por API con diff pre/post |
| **La URL del túnel Cloudflare rota por sesión** | `getaddrinfo ENOTFOUND` significa túnel muerto, **no** PUT a medias. Re-leer el workflow por API antes de continuar |
| **Los headers y el body son secciones independientes** | Agregar un Body no reemplaza los Headers. Una edición manual que los perdió produjo "No API key found in request" |
| **Las RPC que escriben deben ir por POST** | PostgREST ejecuta GET en transacción de solo lectura: por GET el tool responde 200 con los datos correctos y la escritura **se descarta en silencio** |
| **Probar límites con override en el negocio de prueba** | Nunca en producción: un `max_conversations` mal puesto corta el bot de un cliente real |

---

## 9. Prioridad

| # | Acción | Impacto |
|---|---|---|
| **1** | A1 · RPC `bot_cancel_appointment` con filtro de negocio y paciente | **Seguridad — cross-tenant** |
| **2** | A2 · Credenciales al almacén de n8n + rotar la `service_role` | **Seguridad — llave maestra expuesta** |
| **3** | A3 · `maxOutputTokens` en los 3 agentes | **Costo — gasto sin techo** |
| **4** | A9 · Historial 100→20, `maxIterations` 10→5 | **Costo — principal motor de tokens** |
| **5** | A5 · Tokens reales desde `usageMetadata` | **Telemetría — el margen se calcula con datos sesgados** |
| **6** | A7/A8 · `onError` + workflow de error global | **Resiliencia — hoy los fallos son invisibles** |
| **7** | A4 · Rescatar el motor de recordatorios del workflow inactivo `4Ym9882L9BfSSzIX` (§6) | **Producto — feature vendida sin motor** |
| **8** | A6 · Diferenciar el modelo de Enterprise | **Producto — escalera de 3 niveles con 2 modelos** |
| **9** | A10 · `custom_prompt` solo en Pro/Enterprise | **Producto — feature filtrada al plan Básico** |
| **10** | A11 · Sacar las groserías del filtro `esValido` y dejar que el clasificador rutee | **Producto — una queja legítima recibe respuesta incoherente** |
| **11** | A12-A15 · Menores de diseño (§7) | Calidad |
