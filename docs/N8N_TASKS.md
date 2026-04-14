# NovTurnAI — Tareas Pendientes n8n 
# claude --resume ccd8a1e5-d9ce-4072-8170-4919e9454c74

> Actualizado: 2026-04-13
> Prioridades: 🔴 Crítico · 🟠 Alto · 🟡 Medio · ⏭ Decisión tomada
> Completadas → ver historial al final del documento

---

## Resumen

| Prioridad | Tareas | Estado |
|-----------|--------|--------|
| 🔴 Crítico | 3 | Pendiente |
| 🟠 Alto | 3 | Pendiente |
| 🟡 Medio | 2 | Pendiente |
| ⏭ Decisión tomada | 4 | No aplica |

---

## 🔴 Críticos

---

### N-01 🔴 Get Business sin protección de resultado vacío

**Problema:** `Get Business` tiene `alwaysOutputData: true`. Si un número de WhatsApp no pertenece a ningún negocio registrado, devuelve `{}` vacío. En JavaScript `undefined !== null` evalúa `true`, por lo que el nodo **They pay?** pasa aunque no exista ningún negocio — la IA correría sin negocio válido y sin control de pago.

**Solución:** Agregar un nodo IF inmediatamente después de `Get Business`, antes de `They pay?`:

```
Condición TRUE (negocio existe):
={{ $('Get Business').first().json.id !== undefined && $('Get Business').first().json.id !== null }}

TRUE  → continúa a They pay?
FALSE → nodo WhatsApp: "Este número no está registrado." → STOP
```

**Esfuerzo:** Bajo (1 nodo IF + 1 nodo WhatsApp response)

---

### N-02 🔴 Tokens hardcodeados — Meta y Groq en texto plano

**Problema:** Tres tokens están expuestos en texto plano en el JSON del workflow:

| Nodo | Token | Tipo |
|------|-------|------|
| `HTTP Request Audio` | `Bearer EAAc5t4ma4t4...` | Meta/WhatsApp |
| `Transcribe Audio` | `Bearer gsk_mcg9Oek...` | Groq API |
| `Send Template Reminder` | `Bearer EAAc5t4ma4t4...` | Meta/WhatsApp (duplicado) |

Riesgos: cualquier persona con acceso al JSON tiene las credenciales. Billing de Groq y Meta compartido entre todos los clientes sin visibilidad por negocio.

**Solución corto plazo (MVP):** Mover a credenciales de n8n (`Credentials > HTTP Header Auth`) para que no aparezcan en el JSON exportado.

**Solución largo plazo (multi-tenant real):** Guardar tokens por negocio en Supabase (`businesses.meta_token`, `businesses.groq_token`) y leerlos dinámicamente con `$('Get Business').first().json.meta_token`.

**Esfuerzo:** Bajo para credenciales n8n · Alto para multi-tenant por negocio

---

### N-03 🔴 Loop batchSize sin guardar — aparece como None

**Problema:** El nodo `Loop Over Items` (splitInBatches) del flujo de cancelación automática tiene `"parameters": { "options": {} }` — sin batchSize definido. Comportamiento no garantizado: puede procesar 0 items, todos a la vez causando timeout, o saltarse batches.

**Solución:** Abrir el nodo en n8n → escribir `1` en el campo `Batch Size` → Ctrl+S.

**Esfuerzo:** Mínimo (30 segundos)
**Nota:** Es el único fix que requiere UI de n8n, no edición de JSON.

---

## 🟠 Altos

---

### N-04b 🟠 Error de AI Agent no se guarda en historial

**Problema:** Cuando Gemini falla, el usuario recibe la respuesta de `Response Error S/B/O` pero el nodo `Add History Response` no registra nada — solo está conectado al output exitoso del agente. La conversación queda con el mensaje del usuario sin respuesta del asistente:

```
U: quiero agendar
A: (sin registro — Gemini falló)
U: siguiente mensaje
```

En el siguiente mensaje el agente ve el historial incompleto y puede repetir preguntas o perder contexto de la conversación.

**Solución:** Conectar los 3 nodos `Response Error S/B/O` al nodo `Add History Response`, guardando el mensaje de error como respuesta del asistente.

**Esfuerzo:** Bajo (3 conexiones en n8n)

---

### N-04 🟠 Rate limiting — nodos existen pero están deshabilitados

**Problema:** Los nodos de rate limiting (`Supabase Request API LR`, nodo `If` de verificación, `Response API Limit Range`) ya están creados en el workflow pero tienen `"disabled": true`. La tabla `api_rate_limits` existe en Supabase. Un usuario puede enviar mensajes sin límite, generando costos de Gemini sin control.

**Solución:**
1. Habilitar los 3 nodos deshabilitados en n8n
2. Conectarlos al flujo principal: después del buffer y antes del AI Agent
3. Verificar que el nodo `If` evalúa correctamente el límite por `(phone, business_id, fecha)`
4. Verificar que `Response API Limit Range` responde al usuario cuando se supera el límite

**Esfuerzo:** Medio (requiere probar el flujo con el límite activo)

---

### N-05 🟠 Gmail OAuth2 — pendiente URL fija en Railway

**Problema:** La credencial Gmail OAuth2 requiere una URL de callback fija para la autorización. En desarrollo local la URL cambia. Hasta tener el VPS en Railway con dominio fijo, Gmail no puede autorizarse correctamente.

**Solución:** Una vez deployado en Railway:
1. Obtener la URL fija del dominio
2. Configurar la URL de callback en Google Cloud Console
3. Re-autorizar la credencial Gmail en n8n con la nueva URL

**Esfuerzo:** Bajo (configuración, no código)
**Bloqueado por:** Deploy en Railway

---

## 🟡 Medio

---

### N-07 🟡 Tipos de mensaje no reconocidos caen al path de texto

**Problema:** El switch `Message Type` solo maneja `text`, `audio`, `button` e `interactive`. Mensajes de imagen, video, documento, ubicación, sticker, etc. caen al fallback (output 0 = path de texto). En ese path `$messages[0].text.body` es `undefined`, por lo que el mensaje llega al buffer y al AI Agent como el string `"undefined"`.

El sistema no crashea — `esValido` o el AI Agent lo manejan — pero el usuario recibe una respuesta confusa en lugar de un mensaje claro.

**Solución:** Agregar una rama en `Message Type` para tipos no reconocidos:

```
Condición: ninguna de las anteriores (fallback explícito)
→ nodo WhatsApp: "Solo proceso mensajes de texto y audio por ahora 😊"
→ STOP
```

**Esfuerzo:** Bajo (1 rama en el switch + 1 nodo WhatsApp response)

---

### N-06 🟡 Billing Gemini/Groq compartido — sin visibilidad por cliente

**Problema:** Todos los negocios usan las mismas credenciales de Gemini y Groq. No es posible saber cuánto consume cada cliente ni cobrarles proporcionalmente al uso de IA.

**Solución cuando escale:** Crear credenciales separadas por cliente o instrumentar un contador de tokens por `business_id` en Supabase para facturación proporcional.

**Esfuerzo:** Alto
**Ventana:** Cuando haya 5+ clientes activos

---

## ⏭ Decisiones tomadas — no aplica

| Item | Decisión |
|------|----------|
| Recordatorios 24hs desactivados | WhatsApp cobra por templates. Confirmación manual por ahora. |
| Get Reminder Confirmation bug (patient_id = phone) | Flujo de recordatorios desactivado — irrelevante. |
| Emoji regex | Resuelto en v19 con rangos Unicode extendidos. |
| Separar tokens por negocio (multi-tenant billing) | Futuro, no urgente para MVP. |

---

## Historial de tareas completadas

### ✅ Multi-tenant — DB

| Task | Descripción |
|------|-------------|
| 5 columnas en `businesses` | `business_type`, `notification_email`, `custom_prompt`, `has_emergencias`, `plan_expires_at` |
| `business_id` en `message_buffer` | Columna agregada, evita mezcla de mensajes entre negocios |
| `business_id` en `patients` | Verificada y usada en Get Patient Data |
| Clínica Novium actualizada | `business_type=salud`, `plan=pro`, `has_emergencias=true`, `notification_email` configurado |

### ✅ Multi-tenant — n8n

| Task | Descripción |
|------|-------------|
| Revenue protection | `They pay?` verifica `plan`, `active` y `plan_expires_at` |
| Switch por sector | `salud → belleza → otro`. Fallback a "Servicio en configuración" |
| 3 Text Classifiers | Salud (4 cats), Belleza (5 cats + DOMICILIO), Otro (4 cats). Cada uno con Gemini |
| 3 AI Agents | Salud, Belleza, Otro. Prompts dinámicos con nombre, horario y `custom_prompt` desde Supabase |
| Second Switch por sector | Después de `Set History Format` rutea al agente correcto |
| Handoff controlado | URGENCIA, QUEJA, PIDE_HUMANO y DOMICILIO notifican via Gmail siempre |
| Gmail dinámico | `Send To` lee `notification_email` desde Supabase |
| Horario dinámico | 3 agentes leen `schedule_days`, `schedule_start`, `schedule_end` desde Supabase |

### ✅ Fixes técnicos — n8n

| Task | Descripción |
|------|-------------|
| Get Patient Data con `business_id` | `getAll` + filtro `business_id`, evita cruce de datos entre negocios |
| Create/Get/Delete Message Buffer con `business_id` | Los 3 nodos filtran por negocio |
| Error handling en 3 AI Agents | `continueErrorOutput` + `Response Error S/B/O` |
| Historial a 10 mensajes | `Limit maxItems` actualizado de 6 a 10 |
| Flujo cancelación multi-tenant | `Get Business F` getAll + `Loop Over Items` itera sobre todos los negocios activos |
| Get Appointments status corregido | De `active` a `scheduled` en flujo de cancelación |
| Get User condición vacía eliminada | Filtro limpio solo por phone |
| Delete a row con `business_id` | Evita borrar buffer de otro negocio |
| Emoji regex expandido | Cubre todos los rangos Unicode modernos |
