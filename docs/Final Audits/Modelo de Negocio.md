# Modelo de Negocio NovTurnIA

> Todas las cifras son del **escenario máximo posible**: el peor cliente que el plan permite. El consumo real siempre será menor y esa diferencia es margen adicional.
> **FX:** Q8.00/USD.

---

## 1. La escalera

| | **Básico** | **Pro** ⭐ | **Enterprise** |
|---|---|---|---|
| **Precio mensual** | **Q599** | **Q1,999** | **Q3,999** |
| **Precio anual** (−16%) | — | **Q1,679/mes** | **Q3,359/mes** |
| **Mensajes salientes/mes — tope duro** | **1,050** | **3,000** | **6,750** |
| Pacientes | 70 | 200 | 450 |
| Turnos/mes | 100 | 500 | Ilimitados |
| Staff | 1 | 5 | Ilimitado |
| Centro IA (chat + reportes) | — | ✅ | ✅ |
| Tokens IA/semana | — | 750,000 | 2,000,000 |
| Retención de conversaciones | 3 meses | 6 meses | 12 meses |
| **Mensajes adicionales** | — | Q350 / 1,000 | Q350 / 1,000 |

`mensajes = pacientes × 15` — quince mensajes salientes es el techo que un cliente puede consumir en un mes (3 de agendamiento + 2 de recordatorio y confirmación + 10 de fricción).

**Básico se vende solo en mensual.** Su modalidad anual daba utilidad negativa (§3).

### Features por plan

| Plan | Incluye |
|---|---|
| **Básico** | Agenda, bot de WhatsApp, clientes, dashboard limitado |
| **Pro** | Lo anterior + finanzas, kanban, seguimiento, pipeline CRM, roles, notas, contexto IA, registro de actividad, Centro IA |
| **Enterprise** | Lo anterior + insumos/recetas, ofertas, exportaciones, inteligencia de negocio, nombre de agente |

---

## 2. Costos

### 2.1 Variable — por mensaje saliente

| Componente | USD | **Q** |
|---|---|---|
| WhatsApp (tarifa utility Guatemala) | $0.01300 | 0.104 |
| Tokens IA (contexto ~4k + respuesta) | $0.00158 | 0.013 |
| Margen de seguridad IA (audio, contextos largos) | $0.00225 | 0.018 |
| **Total** | **$0.01683** | **0.135** |

Solo se cobran los salientes. Los mensajes del cliente son gratis. Una respuesta humana desde el dashboard cuesta Q0.104 (sin IA).

### 2.2 Fijo — mensual, independiente del número de clientes

| Concepto | USD | **Q** |
|---|---|---|
| Supabase Pro | $25 | 200 |
| Vercel Pro | $20 | 160 |
| n8n (Elestio) | $11 | 88 |
| **Total fase Comercial** | **$56** | **448** |

| Fase | USD | **Q** |
|---|---|---|
| Beta (sin clientes) | $32–36 | 256–288 |
| **Comercial (1–9 clientes)** | **$56** | **448** |
| Crecimiento (10–30 clientes) | $90 | 720 |
| Escala (50+ clientes) | $135–150 | 1,080–1,200 |

---

## 3. Resumen general — un solo cliente pagando todo

Ingreso menos costo variable máximo menos **todos** los costos fijos.

| Concepto | **Básico Q599** | **Pro Q1,999** | **Pro anual Q1,679** | **Enterprise Q3,999** | **Ent. anual Q3,359** |
|---|---|---|---|---|---|
| Ingreso | 599.00 | 1,999.00 | 1,679.00 | 3,999.00 | 3,359.00 |
| − Mensajes (tope duro) | −141.75 | −405.00 | −405.00 | −911.25 | −911.25 |
| − Centro IA | — | −16.00 | −16.00 | −42.00 | −42.00 |
| − Supabase Pro | −200.00 | −200.00 | −200.00 | −200.00 | −200.00 |
| − Vercel Pro | −160.00 | −160.00 | −160.00 | −160.00 | −160.00 |
| − n8n Elestio | −88.00 | −88.00 | −88.00 | −88.00 | −88.00 |
| **= Utilidad neta** | **Q9.25** | **Q1,130.00** | **Q810.00** | **Q2,597.75** | **Q1,957.75** |
| **Margen neto** | **1.5%** | **56.5%** | **48.2%** | **65.0%** | **58.3%** |

Modalidad retirada por utilidad negativa:

| Concepto | Básico anual Q503 |
|---|---|
| Ingreso | 503.00 |
| − Mensajes + fijos | −589.75 |
| **= Utilidad neta** | **−Q86.75** |

---

## 4. Margen por plan

### 4.1 Variable — el que escala

Los fijos no crecen con cada cliente. Este es el margen que se repite en cada venta adicional.

| Plan | Precio | Costo máximo | **Margen** | **% del precio** |
|---|---|---|---|---|
| Básico | Q599 | Q141.75 | **Q457.25** | **76.3%** |
| Pro | Q1,999 | Q421.00 | **Q1,578.00** | **78.9%** |
| Pro anual | Q1,679 | Q421.00 | **Q1,258.00** | **74.9%** |
| Enterprise | Q3,999 | Q953.25 | **Q3,045.75** | **76.2%** |
| Enterprise anual | Q3,359 | Q953.25 | **Q2,405.75** | **71.6%** |

**Techo de costo variable: 25% del precio.** Los tres planes quedan por debajo:

| Plan | Costo / Precio |
|---|---|
| Básico | **23.7%** |
| Pro | **21.1%** |
| Enterprise | **23.8%** |

### 4.2 Ingreso anual por cliente

| Plan | Margen variable/mes | **Al año** |
|---|---|---|
| Básico | Q457.25 | **Q5,487** |
| Pro | Q1,578.00 | **Q18,936** |
| Pro anual | Q1,258.00 | **Q15,096** |
| Enterprise | Q3,045.75 | **Q36,549** |
| Enterprise anual | Q2,405.75 | **Q28,869** |

### 4.3 Paquete de mensajes adicionales

| Precio | Costo | **Margen** | **%** |
|---|---|---|---|
| Q350 / 1,000 msgs | Q135 | **Q215** | **61.4%** |

---

## 5. Proyección

| Clientes | Mix | Ingreso | Costo variable | Fijos | **Utilidad** | **Margen** |
|---|---|---|---|---|---|---|
| 1 | 1 Básico | Q599 | Q142 | Q448 | **Q9** | 1.5% |
| 1 | 1 Pro | Q1,999 | Q421 | Q448 | **Q1,130** | 56.5% |
| 1 | 1 Enterprise | Q3,999 | Q953 | Q448 | **Q2,598** | 65.0% |
| 3 | 2B + 1P | Q3,197 | Q705 | Q448 | **Q2,044** | 63.9% |
| 5 | 2B + 2P + 1E | Q9,195 | Q2,079 | Q448 | **Q6,668** | 72.5% |
| 10 | 4B + 4P + 2E | Q18,390 | Q4,158 | Q720 | **Q13,512** | 73.5% |
| 20 | 8B + 8P + 4E | Q36,780 | Q8,316 | Q720 | **Q27,744** | 75.4% |
| 50 | 20B + 20P + 10E | Q91,950 | Q20,790 | Q1,200 | **Q69,960** | 76.1% |

Punto de equilibrio: **1 cliente Pro o Enterprise**. Con solo clientes Básicos hacen falta **2** para cubrir los fijos con holgura.

---

## 6. Mecánica de venta

| | |
|---|---|
| Orden de presentación | Enterprise → Pro → Básico |
| Precio fundador | Pro a Q1,499 los primeros 6 meses · primeros 10 clientes |
| Garantía | 30 días |
| Anual | Visible en Pro y Enterprise. Básico no tiene anual |

| Plan | Pitch |
|---|---|
| Básico Q599 | Q20 al día — menos que un almuerzo, y no deja ir al cliente que escribe a las 9 de la noche |
| Pro Q1,999 | Medio salario de recepcionista por un empleado que atiende 24/7, agenda, confirma y lleva las finanzas |
| Enterprise Q3,999 | Un salario completo — la única alternativa local cobra Q3,500 solo por voz |

**Regla de revisión:** si los 10 primeros prospectos compran Básico y nadie sube en 60 días → recortar Básico a 45 pacientes / 675 mensajes. Si más del 30% de los Pro compran paquetes cada mes → subir cupo a 4,000 y precio a Q2,199.

---

## 7. Posicionamiento

| Competidor | Precio/mes en Q | Qué no tiene |
|---|---|---|
| AgendaPro | Q152 / Q232 / Q472 | Bot IA, finanzas |
| Booksy | Q240 + Q160/staff | Bot IA |
| Fresha | Q0–160 | Bot IA; cobra 20% de comisión por cliente nuevo |
| Doctoralia | ~Q480–800 | Bot IA de WhatsApp |
| Reservas GP / ReservaSimple 🇬🇹 | Q0+ | Todo lo demás |
| Wati | Q472 / Q952 / Q2,232 | Vertical de citas; markup sobre Meta |
| B2Chat | Q840 / Q1,496 (+IA ≈ Q1,504) | Vertical de citas |
| Uniamos 🇬🇹 (voz IA dental) | Q3,500 + Q9,000 setup | Sistema, agenda, finanzas |
| Alegra (ancla SaaS pyme) | Q320 | No es del rubro |
| Recepcionista en Guatemala | Q2,000–4,000 | No contesta a las 10 pm |

Replicar NovTurnIA con piezas del mercado (AgendaPro Premium Q472 + B2Chat con IA Q1,504) ≈ **Q1,976/mes**, prácticamente lo mismo que Pro, sin bot que agende solo ni finanzas.

---

# AUDITORÍA DE IMPLEMENTACIÓN

## 8. Estado actual

| Pieza | Estado |
|---|---|
| Límite de pacientes, staff y turnos | ✅ Trigger en DB + bloqueo en UI + respeta overrides |
| Contador de mensajes | ⚠️ Cuenta entrantes + salientes juntos |
| Corte automático del bot al agotar cupo | ✅ |
| Corte del dashboard al agotar cupo | ❌ No existe |
| Registro de consumo del dashboard | ❌ No existe |
| Techo de tokens de Centro IA | ✅ Aplicado en servidor |
| Suspensión por falta de pago | ⚠️ Construida, desconectada en el alta |
| Recordatorio y confirmación | ❌ No existen |
| Paquetes de mensajes adicionales | ❌ No existe |
| Modelo comercial en migraciones | ❌ Solo en la base de producción |

## 9. Supabase — backend

| # | Qué hacer | Por qué |
|---|---|---|
| B1 | Separar entrantes de salientes en `usage_counters` (`messages_in` / `messages_out`); el corte lee solo `messages_out` | El cupo se agota al doble de velocidad de lo que cuesta |
| B2 | `record_usage` debe recibir la dirección del mensaje | Alimenta B1 |
| B3 | Cargar en `plans`: `max_conversations` 1,050 / 3,000 / 6,750 · `max_patients` 70 / 200 / 450 | Los valores actuales no corresponden a esta escalera |
| B4 | `businesses.extra_messages` — se suma al cupo, se reinicia con el ciclo | Sin esto no se venden los paquetes de Q350 |
| B5 | `plan_expires_at` en el alta de pago (hoy `onboard-tenant` lo crea `NULL`) | El cron de cobranza vence por fecha: un cliente de pago nunca se suspende |
| B6 | Volcar el modelo comercial a migraciones versionadas: precios, límites, contadores, corte, overrides, cobranza, retención, presupuesto de IA | Nada existe en el repositorio; un restore deja el negocio sin cobro ni medición |
| B7 | `get_plan_limits` debe devolver `messages_out` y el cupo efectivo (plan + extras − consumido) | Es la fuente del bloqueo del dashboard |

## 10. Dashboard — frontend

| # | Qué hacer | Por qué |
|---|---|---|
| F1 | Bloquear el composer de Conversaciones al agotarse el cupo | Es la mitad del tope duro; hoy se envía sin límite |
| F2 | Barra de consumo de salientes: cupo, consumido, fecha de reinicio | El cliente debe ver cuánto le queda |
| F3 | Aviso al 80% del cupo con opción de comprar paquete | Convierte el corte en venta |
| F4 | `PlansModal`: agregar módulo Centro IA y renombrar la fila de mensajes a "salientes" | Centro IA justifica el salto Básico→Pro y hoy es invisible |
| F5 | `PlansModal`: fila de mensajes adicionales con su precio | Es parte de la oferta |
| F6 | AdminPanel: agregar `stats_intelligence` y `business_intelligence` a `FEATURE_DEFS` | Hoy no se puede dar una prueba de Centro IA sin tocar la base |
| F7 | AdminPanel: consumo de salientes + carga de paquetes | Operación diaria del cobro |

## 11. Automatización — n8n

| # | Qué hacer | Por qué |
|---|---|---|
| A3/A9 | Acotar tokens del bot: `maxOutputTokens` en los 3 agentes, historial 100→20 mensajes, iteraciones 10→5 | El bot ya manda un solo mensaje por turno (verificado); el gasto está en el contexto, no en los envíos |
| N2 | Registrar consumo por cada mensaje saliente, no por interacción | Si una interacción envía dos y cuenta una, el tope no protege |
| N3 | El gate de plan debe leer el cupo de salientes (plan + extras) | Alinea el corte del bot con el costo |
| N4 | Motor de recordatorio y confirmación | Son 2 de los 15 mensajes presupuestados y no existen |
| N5 | Workflow de error global | Un fallo fuera de las ramas manejadas muere en silencio |

## 12. Orden de ejecución

| Bloque | Contenido | Bloquea |
|---|---|---|
| **1** | B1, B2, N2, N1 | Medir bien y gastar poco antes de fijar cupos |
| **2** | B3, B4, B7, N3 | Cargar la escalera y el cupo efectivo |
| **3** | F1, F2, F3 | Cerrar el tope duro del lado del dashboard |
| **4** | B5, B6 | Cobranza automática y reproducibilidad |
| **5** | F4, F5, F6, F7 | Que la oferta se pueda vender y operar |
| **6** | N4, N5 | Completar lo que ya se vende |

Los bloques **1 a 3 son obligatorios**: sin ellos el contador mide mal, el bot gasta de más y el dashboard envía sin límite.

---

## 13. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Dashboard sin tope | Costo del 24% pasa al 40% | F1 + B1/B2 |
| Bot verboso | Duplica o triplica el costo de WhatsApp | N1 |
| Un solo cliente Básico | Q9 de utilidad — break-even | Vender Pro primero; 2 Básicos mínimo |
| Meta sube la tarifa por mensaje | Se mueve todo el §2.1 | Recalcular cupo con `pacientes × 15` |
| Modelo no reproducible desde el repositorio | Restore sin cobro ni medición | B6 |
| Cobranza desconectada en el alta | Cliente moroso nunca se suspende | B5 |
| Recordatorios vendidos sin motor | Feature inexistente ya vendida | N4 |
| FX sobre Q8.50/USD | Fijos y WhatsApp más caros | Re-tarificar pasando ese umbral |

---

## Fuentes

**WhatsApp:** [Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [Rate card](https://whatsappbusiness.com/es-la/products/platform-pricing/) · [Gallabox](https://docs.gallabox.com/pricing-and-billing-modules/new-per-message-pricing) · [Chakra HQ](https://chakrahq.com/article/whatsapp-api-pricing-update-service-messages-october-2026/)

**Stack:** [Supabase](https://supabase.com/pricing) · [Vercel](https://vercel.com/docs/plans/pro-plan) · [Elestio](https://elest.io/pricing) · [Gemini API](https://ai.google.dev/gemini-api/docs/pricing) · [Groq](https://groq.com/pricing)

**Competencia:** [AgendaPro](https://agendapro.com/es/planes) · [Fresha](https://www.fresha.com/pricing) · [Booksy](https://pabau.com/blog/fresha-vs-booksy/) · [Doctoralia](https://pro.doctoralia.com.mx/precios/medicos-y-especialistas) · [Wati](https://www.wati.io/pricing/) · [B2Chat](https://www.b2chat.io/en/pricing/) · [Uniamos](https://uniamos.com/blog/agente-voz-ia-clinicas-dentales-ciudad-guatemala-2026) · [Alegra](https://www.alegra.com/costarica/precios/)
