# 🚀 PROMPT DE ARQUITECTURA & PLAN CONCEPTUAL: MÓDULO "PIPEDRIVE IA" EN NOVTURNIA

---

## ⚠️ INSTRUCCIÓN FUNDAMENTAL PARA LA IA RECEPTORA / AGENTE DE DESARROLLO

> **Estimado Agente de IA / Arquitecto de Software:**
> 
> Este documento contiene **la propuesta conceptual e idea inicial** redactada para el diseño e implementación de un tablero tipo **Pipedrive / Kanban Interactivo e Inteligente** en la plataforma **NovTurnIA**.
> 
> **📌 ESTO NO ES UN PLAN DE EJECUCIÓN DEFINITIVO NI UNA ESPECIFICACIÓN FINAL.** Es la base conceptual estructurada de la idea.
> 
> ### **Tu objetivo principal es:**
> 1. **Evaluar y Auditar vía MCPs:** Utiliza tus herramientas de contexto (MCPs de base de datos, inspección de código del repositorio, APIs y componentes frontend existentes) para entender la arquitectura actual de NovTurnIA.
> 2. **Cuestionar y Super-Mejorar:** Desafía este borrador inicial. Identifica cuellos de botella, casos de borde (*edge cases*), manejo de concurrencia y propón mejoras sustanciales.
> 3. **Adaptar a Estándares Top del Mercado:** Basándote en soluciones líderes (**Pipedrive**, **HubSpot**, **GoHighLevel**), eleva la propuesta técnica para crear la mejor experiencia de usuario posible centrada en automatización con IA.
> 4. **Generar el Plan Técnico Definitivo:** Construye el diseño de base de datos final, los esquemas de eventos para **n8n**, los endpoints de backend y la hoja de ruta de desarrollo frontend.

---

## 🎯 1. Visión General del Negocio & Propuesta de Valor

El objetivo es evolucionar el módulo de gestión de pacientes/clientes y la sección de seguimiento actual (lista estática) hacia un **Módulo de Pipedrive / Embudos Kanban Dinámico**.

La propuesta de valor clave para los clientes de nuestro SaaS es **la visibilidad en tiempo real de la gestión del Agente de IA**:
* **Transparencia Total:** El dueño del negocio debe ver cómo las tarjetas de los clientes se mueven automáticamente de columna en columna a medida que el flujo de automatización en **n8n** interactúa con ellos por WhatsApp o Chat.
* **Trazabilidad de Acciones de IA:** El tablero debe mostrar en tiempo real qué ha hecho la IA (si ofreció servicios, si mostró promociones, si consultó disponibilidad en la agenda o si recuperó a un paciente que canceló).
* **Indicador de Engage:** No solo muestra el estado de la cita, sino el **nivel de interés / temperatura del lead** y sugiere la acción idónea (automatizada o de intervención humana).

---

## 🏛️ 2. Inspiración & Benchmarking de la Estructura

Tomamos las mejores características de las herramientas CRM más potentes del mercado:
* **Pipedrive:** Claridad visual de tratos por columna, etiquetas de inactividad (*rotting*) y acciones rápidas directamente desde cada tarjeta.
* **HubSpot:** Automatización nativa de estados de clientes impulsada por eventos (Webhooks/Booleanos) y cálculo de scoring automático.
* **GoHighLevel:** Enfoque en pipelines conversacionales para canales como WhatsApp, donde cada paso del embudo responde al estado directo de la conversación con el bot.

---

## 📋 3. Propuesta Detallada de Pipeline (Columnas, Triggers & Acciones)

Se propone un embudo estructurado en **5 Etapas Inteligentes**, donde **n8n** enviará eventos (Webhooks / WebSockets) para actualizar los booleanos de estado y mover las tarjetas en tiempo real:

[ 1. Descubrimiento ] ➔ [ 2. Negociación/Slots ] ➔ [ 3. Cita & Pre-Atención ] ➔ [ 4. Recuperación ] ➔ [ 5. Fidelización/LTV ]


---

### 🟢 Columna 1: Descubrimiento & Nutrición
* **Objetivo:** Captar el interés inicial, calificar la intención y resolver consultas antes de presionar por la reserva.
* **Triggers de n8n / Banderas Booleanas:**
  * `offered_services: true` (Se le envió la lista de servicios/tarifas).
  * `offered_promo: true` (Se le presentó una oferta o promoción activa).
  * `user_intent: "INFORMATIONAL"`
* **Sub-estados / Tags Visuales:**
  * `[ 🏷️ Interesado en Promo ]`
  * `[ ⏱️ Esperando Respuesta ]`
* **Acción Automatizada de la IA:** Responde dudas sobre precios, beneficios, ubicaciones o especialistas. Si el cliente no responde en 2 horas, n8n gatilla un micro-seguimiento suave (*"¿Te quedó alguna duda sobre el tratamiento?"*).

---

### 🟡 Columna 2: Negociación & Selección de Slots
* **Objetivo:** Facilitar la elección de fechas y horarios sin fricción, convirtiendo el interés en un compromiso de reserva.
* **Triggers de n8n / Banderas Booleanas:**
  * `queried_slots: true` (Se le enviaron opciones de fecha/hora).
  * `slot_offered_timestamp: "YYYY-MM-DDTHH:mm:ss"`
  * `slot_selection_pending: true`
* **Sub-estados / Tags Visuales:**
  * `[ 📅 Slot Propuesto ]` (Muestra la fecha/hora sugerida: ej. *Vie 25 Jul, 10:00 AM*).
  * `[ ⚠️ Indeciso / Cambio de Fecha ]` (El usuario solicitó cambio de fecha más de 2 veces).
* **Acción Automatizada de la IA:** Consulta disponibilidad en la agenda del negocio y propone opciones. Si detecta que el usuario no elige slot tras recibir opciones, activa un temporizador en n8n de 12 horas (*"Hola [Nombre], se nos está ocupando el espacio del viernes a las 10 AM, ¿te lo aparto?"*).

---

### 🔵 Columna 3: Cita Programada & Pre-Atención (Confirmación)
* **Objetivo:** Confirmar la asistencia y reducir la tasa de ausentismo (*No-Show*) mediante seguimiento pre-cita.
* **Triggers de n8n / Banderas Booleanas:**
  * `appointment_status: "SCHEDULED"`
  * `confirmation_reminder_sent: true`
  * `confirmed_by_user: true | false`
* **Sub-estados / Tags Visuales:**
  * `[ ✅ Confirmado ]`
  * `[ ❓ Sin Confirmar (Recordatorio enviado) ]`
  * `[ 🚗 Indicaciones / Preparación Enviada ]`
* **Acción Automatizada de la IA:** 24h y 2h antes de la cita, n8n envía un recordatorio interactivo con botones (Confirmar / Reagendar / Cancelar). La IA procesa la respuesta e interactúa actualizando la tarjeta al instante.

---

### 🔴 Columna 4: Recuperación & Re-agendamiento (Pacientes Perdidos)
* **Objetivo:** Re-enganchar automáticamente a pacientes que cancelaron o no asistieron (*Conecta directamente con la sección actual de Seguimiento*).
* **Triggers de n8n / Banderas Booleanas:**
  * `appointment_status: "NO_SHOW" | "CANCELLED"`
  * `recovery_campaign_step: 1 | 2 | 3`
* **Sub-estados / Tags Visuales:**
  * `[ ❌ No asistió ]`
  * `[ 🤖 IA Intentando Recuperar ]`
  * `[ 📩 Oferta de Re-agendamiento Enviada ]`
* **Acción Automatizada de la IA:** Inicia una secuencia de re-contacto inteligente de 3 pasos:
  1. **A las 2 horas:** *"Lamentamos no haberte visto hoy, ¿surgió algún inconveniente? Podemos reagendarte."*
  2. **A las 48 horas:** *"Te reservamos un cupo prioritario para esta semana."*
  3. **A los 7 días:** Envío de incentivo especial por retorno.

---

### 💜 Columna 5: Fidelización & Recurrencia Post-Servicio
* **Objetivo:** Garantizar la satisfacción, solicitar reseñas y aumentar el valor de vida del cliente (*LTV*).
* **Triggers de n8n / Banderas Booleanas:**
  * `appointment_status: "COMPLETED"`
  * `nps_score: 1-5`
  * `next_control_due_date: "YYYY-MM-DD"`
* **Sub-estados / Tags Visuales:**
  * `[ ⭐ Encuesta Enviada ]`
  * `[ 🔁 Control Programado para 30 días ]`
* **Acción Automatizada de la IA:**
  * Envía encuesta de satisfacción post-atención. Si la valoración es 5/5 ⭐, solicita reseña positiva en Google Maps.
  * Programa recordatorio para la siguiente cita periódica o control de seguimiento.

---

## 💳 4. Diseño Conceptual Detallado de la Tarjeta (Card Kanban)

Cada tarjeta en el tablero visual debe hacer transparente la labor de la IA para el usuario del negocio:

+-------------------------------------------------------------+
| 👤 Cristian Siguenza                         [ 🤖 IA Activa ]|
| 📱 +502 4031 9928                                           |
|                                                             |
| ⚙️ Banderas de IA:                                          |
| [✓] Servicio Consultado  [✓] Promo Enviada  [ ] Slot Elegido|
|                                                             |
| 💬 Última Interacción IA:                                   |
| "Le ofreció Limpieza Dental 2x1 hace 15 min"                |
|                                                             |
| 🎯 Siguiente Paso Sugerido:                                 |
| ⌛ Esperando confirmación de slot para el 17 de Julio       |
|                                                             |
| ⚡ Acción Rápida: [ 👁️ Ver Chat ]  [ ✋ Intervenir Humano ]   |
+-------------------------------------------------------------+


### Componentes UI de la Tarjeta:
1. **Header:** Nombre del cliente, teléfono y **Badge Animado de Estado de IA**:
   * `🤖 IA Gestionando` (Verde animado si hubo actividad de n8n < 5 min).
   * `⏱️ Esperando Respuesta del Cliente`.
   * `✋ Requiere Intervención Humana` (Alerta roja brillante si la IA no comprende o el cliente exige hablar con una persona).
2. **Banderas / Pills (Booleanos):** Indicadores visuales de avance (`[✓] Promo Enviada`, `[✓] Slots Vistos`, `[ ] Confirmado`).
3. **Último Log de la IA:** Micro-texto informativo (Ej: *"IA: Le ofreció Limpieza Dental 2x1 a las 10:15 a.m."*).
4. **Indicador de Temperatura del Lead:** Punto de color (Rojo = Frío/Sin respuesta, Amarillo = En negociación, Verde = Listo para cerrar).
5. **Switch de Intervención Humana:** Control rápido `needs_human: true/false` que pausa temporalmente la IA para permitir el manejo manual del chat.

---

## 📊 5. Métricas Clave en la Cabecera del Kanban (Top Bar)

Resumen de KPIs en tiempo real ubicados en la barra superior del tablero:
* 🤖 **Citas Agendadas por IA:** Total de cierres automáticos del mes.
* 🔄 **Pacientes Recuperados:** Total de no-shows re-agendados exitosamente por la IA.
* ⏱️ **Tiempo Promedio de Respuesta:** Velocidad media de respuesta de la IA (ej. 4 segundos).

---

## 🛠️ 6. Payload JSON de Referencia (Sincronización n8n ➔ Backend API)

```json
{
  "client_id": "cli_9928",
  "client_name": "Cristian Siguenza",
  "phone": "+50240319928",
  "pipeline_stage": "RECOVERY",
  "ai_flags": {
    "queried_services": true,
    "offered_promo": true,
    "queried_slots": true,
    "appointment_created": false,
    "no_show_detected": true
  },
  "last_interaction": {
    "timestamp": "2026-07-24T10:15:00Z",
    "summary": "Se le envió mensaje de recuperación tras no presentarse a su cita."
  },
  "needs_human": false
}
🔬 7. TAREAS DE EVALUACIÓN Y OPTIMIZACIÓN (PARA LA IA RECEPTORA)
Por favor realiza un análisis técnico profundo respondiendo a los siguientes 5 puntos clave dentro de tu respuesta:

1. Inspección y Análisis de Contexto vía MCPs
Examina el repositorio del proyecto NovTurnIA (Frontend en React/Tailwind/Vue, Backend, endpoints REST/GraphQL y modelo de Base de Datos actual).

Determina si el módulo de Pipedrive debe construirse como una extensión con toggle (Vista Lista vs Vista Kanban) dentro de la sección de Seguimiento actual o como un submódulo independiente.

2. Modelo de Datos y Sincronización Realtime
Diseña la estructura de tablas para la Base de Datos (pipelines, pipeline_stages, deals/cards, ai_events_log).

Especifica la arquitectura de comunicación en tiempo real (WebSockets, Supabase/Firebase Realtime o Server-Sent Events) para reflejar los cambios de n8n en el frontend sin recargar la página.

3. Gestión de Casos de Borde (Edge Cases)
Saltos de etapa: ¿Cómo responde el Kanban si un cliente pasa de "Consulta Informativa" (Paso 1) directamente a "Cita Confirmada" (Paso 3)?

Re-entrada al Pipeline: ¿Cómo se maneja un cliente recurrente que ya completó la fase 5 y vuelve a consultar por un nuevo servicio?

Pérdida de Conexión en n8n: ¿Qué mecanismo de resiliencia se debe aplicar si falla el webhook de actualización de estado?

4. Optimización de la Experiencia UI/UX
Propón el diseño de filtros avanzados (Filtrar por Temperatura de Lead, Estado de la IA, Rango de Fechas o Atendido por Humano).

Sugiere micro-interacciones (animaciones Drag & Drop, resaltado visual cuando una IA mueve una tarjeta, notificaciones push).

5. Plan de Ejecución Técnico Definitivo
Genera la hoja de ruta paso a paso dividida en:

Fase Backend: Migraciones de DB, APIs, Webhooks.

Fase n8n: Estructuración de nodos HTTP Request y lógica de booleanos.

Fase Frontend: Componentes React/Tailwind, estado global y WebSocket listener.