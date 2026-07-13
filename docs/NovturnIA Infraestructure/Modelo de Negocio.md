# Modelo de Negocio NovTurnIA — VERSIÓN FINAL (v3)

> **Fecha:** 2026-07-10 · **FX:** Q7.70/USD (actualizar al facturar) · **Este es el documento oficial y definitivo** — reemplaza a `01-modelo-de-negocio.md` (eliminado). Contiene: veredicto, estructura de precios final (3 planes), costos verificados, márgenes, benchmarking Guatemala, posicionamiento, y la **auditoría completa de cumplimiento de límites y planes** (DB + frontend + automatización n8n), verificada en vivo.
> Docs hermanos: [WhatsApp Api.md](WhatsApp%20Api.md) (multi-tenancy, plantillas, costos Meta) · [Automatización Agente IA.md](Automatización%20Agente%20IA.md) (auditoría del bot + plan Módulo IA).

---

## 1. Veredicto ejecutivo

**El negocio es viable como SaaS y la meta "la primera mensualidad cubre todos los costos" se cumple** con la estructura v3:

| Escenario | Costo fijo mensual | ¿1 Básico (Q599) lo cubre? | ¿1 Pro (Q1,999) lo cubre? |
|---|---|---|---|
| **Fase Beta** (Vercel Free + Elestio + Supabase Pro) | ~$33 ≈ **Q254** | ✅ sobran ~Q335 | ✅ sobran ~Q1,735 |
| **Fase Comercial** (Vercel Pro + Elestio + Supabase Pro) | ~$56 ≈ **Q431** | ✅ justo (~Q158) | ✅ sobran ~Q1,558 |
| **Fase Crecimiento** (+ compute Small, Sentry Team) | ~$90 ≈ **Q693** | ❌ necesitas 2 Básicos | ✅ sobran ~Q1,296 |

Claves estructurales (validadas con números en §4-§6):
1. **Los fijos NO escalan por cliente.** El costo marginal de un cliente es su IA (~Q10-500 en el techo absurdo) + WhatsApp (~Q0-50). Margen incremental **87-98%**.
2. **La tarifa plana con corte automático es la arquitectura correcta** — el costo real de tokens es tan bajo que trasladarlo al cliente mataría la venta sin proteger nada relevante.
3. **El cuello de botella no son los costos: es la adquisición** — y ahí ataca la v3 (entrada Q599 + pitch de planilla, §2).
4. ⚠️ **Deuda comercial previa a vender** (auditoría §8): el corte por consumo NO opera hoy (H1/H2) y los recordatorios de Pro/Ent no existen en el workflow (H6). Se venden límites y features que el sistema aún no aplica.

---

## 2. ★ ESTRUCTURA DE PRECIOS FINAL v3 — 3 planes (decidida 2026-07-10)

> **Decisión del usuario:** solo 3 planes (patrón Good-Better-Best; más opciones = más duda), manteniendo el **pitch de ahorro de planilla**. La v3 **solo toca el Básico** (precio y mensajes); Pro y Enterprise quedan intactos porque el benchmark (§7) los sostiene con holgura.
> **Estado:** ✅ **APLICADA EN PRODUCCIÓN (2026-07-11)** — migración `pricing_v3_basic_and_drop_unused_overloads`, verificado en vivo: basic **Q599/500 msgs** · pro Q1,999/5,000 · enterprise Q3,999/20,000. `AdminOnboarding` no requirió cambio (solo referencia tiers, sin precios).

### 2.1 La escalera

| | **Básico Q599** | **Pro Q1,999** ⭐ "Más popular" | **Enterprise Q3,999** |
|---|---|---|---|
| Mensajes IA/mes | **500** | 5,000 (10×) | 20,000* |
| Pacientes | 50 | 150 (3×) | Ilimitados |
| Staff | 1 | 5 | Ilimitado |
| Turnos/mes | 100 | 500 (5×) | Ilimitados |
| Retención de conversaciones | 3 meses | 3 meses | 12 meses |
| Features | Core (agenda + bot + clientes, dashboard limitado) | + finanzas (con **categorías dinámicas**), kanban, followup, roles, notas, custom_prompt, recordatorios†, audit log | + insumos/recetas, ofertas, auto_confirm†, multi-sucursal†, export, stats-IA/Módulo IA, contenido, nombre de agente, 20k msgs |
| Anual (−16%) | **Q503/mes** | **Q1,679/mes** | **Q3,359/mes** |

\* "Ilimitado" comercialmente; 20,000 es el techo interno de corte (`ai_paused`) que protege el margen.
† Features listadas en `plans.features` cuya implementación aún está pendiente (ver auditoría §8.2 H6) — no prometerlas en la venta hasta que existan.

**Decisión sobre el submódulo de Categorías Dinámicas de Finanzas (2026-07-10):** las categorías siguen al flag **`finance`** → disponibles en **Pro y Enterprise**, no en Básico. Verificado en código: el tab "Categorías" vive dentro del `FeatureLock feature="finance"` que envuelve todo el módulo Finanzas (`Finance.jsx:271`), e Insumos/Recetas conserva su candado adicional solo-Enterprise. No requiere flag nuevo ni cambio de código.

### 2.2 Por qué cada precio (la lógica v3)

1. **Básico Q599 — la puerta de entrada cultural.** Queda en la zona donde la pyme guatemalteca ya gasta sin fricción (Alegra ~Q308, AgendaPro Premium ~Q454) y gana la comparación directa: *"por Q145 más que AgendaPro tienes un empleado digital que agenda solo por WhatsApp"*. Cubre él solo los fijos de Beta y Comercial.
2. **El recorte 1,000→500 mensajes es la pieza clave, no el precio.** Un negocio al que el bot le funciona quema 500 mensajes en 2-3 semanas → el upgrade a Pro se vende solo y con datos ("la IA te atendió 480 conversaciones este mes"). Con 1,000 mensajes a Q599, el Básico canibalizaría al Pro.
3. **El salto 3.3× (Q599→Q1,999) es deliberado**: 10× mensajes + 3× pacientes + finanzas/kanban hacen del Pro "obviamente la mejor compra" (efecto center-stage: en Good-Better-Best bien diseñado, el 60-70% elige el del medio). Pro cubre los fijos de cualquier fase con margen ~93%.
4. **Enterprise Q3,999 intacto**: el único agente IA vertical local (Uniamos) cobra Q3,500/mes **solo por voz**, sin sistema, sin finanzas, sin dashboard.

### 2.3 El pitch de planilla (calibrado por plan)

- **Básico Q599:** "Q20 al día — menos que un almuerzo, y no deja ir al cliente que escribe a las 9 de la noche."
- **Pro Q1,999:** el pitch central — "**medio salario de una recepcionista** por un empleado que atiende 24/7, agenda, confirma y además te lleva las finanzas. Sin vacaciones, sin aguinaldo, sin renuncias."
- **Enterprise Q3,999:** "un salario completo — y la única alternativa local (Uniamos) te cobra Q3,500 solo por la voz."

### 2.4 Mecánica de venta

1. **Presentar SIEMPRE de mayor a menor** (Enterprise → Pro → Básico): anclado en Q3,999, el Q1,999 suena razonable y el Q599 regalado.
2. **Precio fundador sobre PRO, no sobre Básico:** "primeros 10 clientes: Pro a Q1,499 por 6 meses, luego lista." Descuentos en el héroe atraen a los clientes que quieres; descuentos en la entrada atraen a los que no.
3. **Garantía de 30 días** (no mes gratis): en Guatemala nadie firma sin probar, y la garantía filtra mejor que el "gratis".
4. **Anual −16% siempre visible** junto al mensual (Q503 perfora psicológicamente los Q500).

### 2.5 Regla de revisión (datos mandan)

Tras los primeros 10 prospectos reales: si todos compran Básico y nadie sube en 60 días → **recortar mensajes de Básico a 300**, no subir el precio. Si se pierden 3+ ventas de Pro explícitamente por precio → bajar Pro a Q1,699, no antes. Plan de contingencia (solo si el patrón "caro" persiste aun con la v3): reprice completo Q599/Q1,499/Q2,999.

---

## 3. Stack de costos fijos (verificados)

| Fase | Supabase | Vercel | n8n (Elestio) | Otros | **Total USD** | **Total GTQ** |
|---|---|---|---|---|---|---|
| **Beta** (0 ingresos, validación) | $25 | $0 | $7–11 | $0 | ~$32–36 | **~Q246–277** |
| **Comercial** (1er cliente facturado) | $25 | $20 | $11 | $0 | ~$56 | **~Q431** |
| **Crecimiento** (10–30 clientes) | $30 (Small) | $20 | $14 | $26 (Sentry) | ~$90 | **~Q693** |
| **Escala** (50+ clientes) | $75 (Medium) | $20 | $14–30 | $26 | ~$135–150 | **~Q1,040–1,155** |

Notas verificadas: Supabase Pro $25 incluye compute Micro (suficiente hasta 10-30 tenants; Small +$5 cuando duela) y backups diarios 7 días — **no activar PITR** (+$100/mes, no $10). Vercel Hobby prohíbe uso comercial → **Pro $20 desde la primera factura** (riesgo de ToS, no técnico). n8n en Elestio (~$11-15) = ejecuciones ilimitadas + backups/updates gestionados. Cloudflare/Sentry Free/Better Stack = $0.

## 4. Costos variables

**WhatsApp** (detalle en [WhatsApp Api.md](WhatsApp%20Api.md)): el flujo core (paciente escribe → bot responde en ventana 24h) cuesta **$0** — conversaciones de servicio gratis e ilimitadas desde nov-2024. Solo pagan las **plantillas** iniciadas fuera de ventana (rate card RestLatAm vigente): utility/auth **$0.0130**, marketing **$0.0851** por mensaje entregado. Un Pro con 500 recordatorios/mes ≈ **Q50**.

**IA (tokens):** Gemini 2.5 Flash $0.30/$2.50 por M tokens (in/out), Flash-Lite $0.10/$0.40, Groq llama-3.3-70b $0.59/$0.79 (transcripción de audio). El "escenario imposible" (cada mensaje = conversación entera de 50k tokens):

| Plan | Límite msgs | Techo absurdo IA | Techo realista* | Precio | Holgura |
|---|---|---|---|---|---|
| Básico | 500 | ~$10 ≈ Q79 | ~Q10 | Q599 | ✅ 7.5× incluso en el absurdo |
| Pro | 5,000 | ~$102 ≈ Q789 | ~Q131 (con 500 recordatorios) | Q1,999 | ✅ 2.5× en el absurdo |
| Enterprise | 20,000 | ~$410 ≈ Q3,157 | ~Q508 | Q3,999 | ✅ 1.3× incluso en el absurdo total |

\* Realista = conversaciones reales de agendamiento (~10 msgs × 2-3k tokens); el consumo típico es 10-20× menor que el techo.

## 5. Márgenes por plan (v3)

| Plan | Precio | Costo marginal (techo realista) | **Margen incremental** | ¿Cubre fijos Comercial (Q431) solo? |
|---|---|---|---|---|
| Básico Q599 | $77.80 | ~Q10 | **~98%** | ✅ justo |
| Pro Q1,999 | $259.60 | ~Q131 (IA + 500 recordatorios) | **~93%** | ✅ |
| Enterprise Q3,999 | $519.40 | ~Q508 (techo; realista ~Q200) | **~87%** | ✅ |

## 6. Proyección v3 (fase Comercial, fijos Q431; Crecimiento a partir de 10)

| Clientes | Mix | Ingreso/mes | Costos totales | Utilidad | Margen |
|---|---|---|---|---|---|
| 1 | 1 Básico | Q599 | ~Q441 | Q158 | 26% |
| 1 | 1 Pro | Q1,999 | ~Q562 | Q1,437 | 72% |
| 3 | 2 B + 1 P | Q3,197 | ~Q582 | Q2,615 | 82% |
| 5 | 2 B + 2 P + 1 E | Q9,195 | ~Q1,221 | Q7,974 | 87% |
| 10 | 4 B + 4 P + 2 E | Q18,390 | ~Q2,273 (Crecimiento) | Q16,117 | 88% |

El margen converge a ~88% — estructura de SaaS sano. **El primer cliente ideal sigue siendo Pro**; el Básico es puerta de entrada, no sostén.

---

## 7. Benchmarking Guatemala (2026-07-10) — y dónde entra NovTurnIA

### 7.1 (a) Software de agendamiento puro — la categoría con la que te COMPARAN

| Producto | Precio/mes | En Q | Qué incluye | Qué NO |
|---|---|---|---|---|
| **AgendaPro** (LatAm, opera en GT) | $19 / $29 / $59 | Q146 / Q223 / Q454 | Agenda online, reservas, recordatorios, app | Bot IA conversacional; finanzas |
| **Booksy** | $29.99 + $20/staff | Q231 + Q154/staff | Agenda + marketplace (Boost: 30% del primer servicio) | Bot IA |
| **Fresha** | $0 (o $19.95) | Q0–154 | Agenda "gratis" — monetiza con 20% de comisión por cliente nuevo + fees tarjeta | Bot IA; lo gratis sale caro al crecer |
| **Doctoralia** | no publica (típico $60-100) | ~Q460-770 | Perfil premium + agenda + reputación | Bot IA de WhatsApp |
| **Reservas GP / ReservaSimple** (🇬🇹) | freemium/gratis | Q0+ | Agenda básica | Todo lo demás — el "ancla gratis" local |
| **XMed** (🇬🇹 clínicas) | por cotización | ? | Expediente + agenda | Recordatorios WhatsApp "próximamente" |

### 7.2 (b) Plataformas WhatsApp / chatbot IA — la categoría de tu DIFERENCIADOR

| Producto | Precio/mes | En Q | Nota |
|---|---|---|---|
| **Wati** | $59 / $119 / $279 | Q454 / Q916 / Q2,148 | + ~20% markup sobre Meta + add-ons IA; Growth cap 3 usuarios |
| **B2Chat** (LatAm) | $105 con WA / $187 | Q808 / Q1,440 | AI Assistant = **add-on +$80-86** → básico+IA ≈ **Q1,425/mes** |
| Chatbots pymes LATAM | $15-50 básicos / $100-300 medianos | Q115-385 / Q770-2,310 | Sin vertical de citas; configúralo tú |
| **Uniamos** (🇬🇹, voz IA dental) | **Q3,500/mes** + Q9,000 setup | Q3,500 | El ancla ALTA local de agentes IA verticales |

**(c) Anclas culturales:** Alegra (el SaaS pyme normalizado en la región) ≈ $40 ≈ **Q308/mes**. Y el ancla que de verdad importa: **una recepcionista en GT cuesta ~Q2,000-4,000/mes** — y no contesta a las 10 pm.

### 7.3 Dónde entra NovTurnIA (la comparación final)

1. **Contra el bundle real, eres barato:** replicar NovTurnIA con piezas del mercado (AgendaPro Premium Q454 + B2Chat con WhatsApp + AI Q1,425) ≈ **Q1,880/mes** — y aun así el bot no agenda solo en tu vertical. Tu Pro Q1,999 da eso integrado + finanzas; tu Enterprise Q3,999 se defiende contra Uniamos Q3,500 (que solo hace voz).
2. **El problema era de categoría percibida, no de precio absoluto:** el cliente te archivaba como "software de citas" (Q0-450 con opciones gratis locales) y ahí Q999 se sentía 2-4× caro. El Básico Q599 entra en esa conversación sin regalar el producto.
3. **El hueco del mercado GT es tuyo:** nadie local ofrece bot IA de WhatsApp que agenda solo + dashboard + finanzas por debajo de Q1,000. Entre el "gratis local" (sin IA) y el agente IA a la Uniamos (Q3,500), el vacío Q500-1,500 es exactamente donde vive la v3.

---

## 8. ★ AUDITORÍA DE CUMPLIMIENTO DE LÍMITES Y PLANES (2026-07-10, verificada en vivo)

> **Método:** definiciones reales de triggers/funciones/políticas leídas de `pg_catalog` por MCP; tabla `plans` y `usage_counters` en producción; grep exhaustivo del frontend (`usePlanLimits`, `FeatureLock`, `hasFeature` — 27 archivos); workflow n8n **activo** bajado por API (129 nodos funcionales). Cada celda refleja lo que el sistema HACE hoy.

### 8.1 Matriz límite × capa

| Límite (B/P/E) | DB (fuente de verdad) | Frontend | Bot n8n |
|---|---|---|---|
| **Pacientes** 50/150/∞ | ✅ Trigger a INSERT/restore (`deleted_at IS NULL`, respeta `limit_overrides` vía `get_effective_limit`); bot exento (`auth.uid() IS NULL`) — decisión de producto | ✅ `canAddPatient`: banner + botón deshabilitado; visibilidad recortada a los N más recientes (`get_visible_patient_ids`) | ✅ Exento POR DISEÑO: crea el #51+; el negocio solo VE 50 |
| **Staff** 1/5/∞ | ✅ Trigger (cuenta `active=true`, respeta overrides) | ⚠️ **H4**: `Users.jsx` muestra `staffUsed/maxStaff` pero NO deshabilita el botón de crear (el error del trigger llega crudo) | N/A |
| **Turnos/mes** 100/500/∞ | ✅ Trigger por mes de `date_start` del turno nuevo, excluye cancelados, respeta overrides | ✅ `canAddAppointment` + banner (menor: cuenta el mes actual → bloquea de más al agendar el mes siguiente) | ⚠️ **H3**: gate propio por `created_at` ≠ `date_start` |
| **Mensajes IA/mes** 500/5,000/20,000 | 🔴 **H1**: `record_usage` existe y pausa bien + cron `reset-usage-ai-pause` mensual… pero **NADIE la llama**: `usage_counters` = 0 filas en producción | 🔴 `conversations_used` lee `usage_counters` → tenant y admin ven siempre **0**; extra: `Conversations.jsx:365` compara la variable equivocada (`patientsUsed > maxConversations`) **(H8)** | ⚠️ **H3**: gate propio cuenta `history` user+assistant (≈2× → límite real ≈ mitad) y NO respeta `limit_overrides` |
| **`ai_paused` (kill-switch)** | ✅ Columna + `record_usage` la activa + `reactivate_bot` | ✅ AdminPanel: badge + toggle + % de uso | 🔴 **H2**: el workflow NO chequea `ai_paused` en ningún nodo (0 menciones) → ni el corte automático ni el toggle del super-admin apagan al bot |
| **Suspensión/dunning 7/30** | ✅ Cron `run-dunning` diario + `is_business_active()` en políticas de ESCRITURA de 10 tablas (incluye `finance_categories`) + `record_payment` | ✅ `AccountStatusModal` (suspended aviso / cancelled bloqueo duro) | ✅ `¿Plan Activo?` (active|trial + active + `plan_expires_at` vigente) |
| ↳ nota dunning | 🟡 **H5**: los negocios actuales tienen `plan_expires_at = NULL` (nunca vencen) → dunning inoperante hasta setear fecha en alta/cobro; falta botón "Marcar pagado" en AdminPanel | | |
| **Rate limit** | ✅ `check_rate_limit` + cron de limpieza | N/A | ✅ 20 msg/h por usuario+negocio (bloquea del 21º) |
| **Retención historial** 3/3/12m | ✅ `history_retention_months` + cron `retain-history` | N/A | N/A |

### 8.2 Matriz de features por plan

**Frontend — ✅ cobertura completa (el estándar del sistema).** `hasFeature()` + `FeatureLock` gatean las 12+ páginas: Sidebar (nav), Stats (`dashboard`, `stats_intelligence`), Calendar (`kanban`), **Finanzas (`finance` — incluye el tab Categorías, verificado `Finance.jsx:271`)**, Insumos (`supplies`, candado Enterprise anidado), Offers (`dynamic_pricing`), FollowUp (`followup`), AuditLog (`audit_log`, `export_reports`), Patients (`export_patients`, `patient_notes`), BusinessSettings (`custom_prompt`, `ai_agent_name`), Settings (`service_description`). `feature_flags` del negocio hace merge sobre el plan (override por tenant) y `SAFE_DEFAULTS` bloquea durante la carga (sin flash premium).

**Bot n8n — cobertura parcial:**

| Feature vendida | ¿Implementada en el bot? |
|---|---|
| `dynamic_pricing` (ofertas) | ✅ Tool "Ofertas Activas" solo en Agente Enterprise |
| `ai_reasoning` (escalera de modelos) | ✅ aproximado (Basic=flash-lite, Pro/Ent=flash) — falta fijar `modelName` explícito en Pro/Ent |
| `custom_prompt` (Pro/Ent) | 🟡 **H7**: se inyecta a TODOS los planes, Básico incluido (el front impide editarlo, pero si la columna tiene valor el bot lo usa) |
| `reminders` (Pro/Ent) | 🔴 **H6**: el workflow activo NO tiene ningún `scheduleTrigger` — los recordatorios no existen (estaban en el workflow viejo inactivo) |
| `auto_confirm` (Ent) | 🔴 **H6**: sin implementación (0 menciones) |
| `ai_memory` (Pro/Ent) | 🟠 `get_patient_profile` listo en DB; tool sin cablear (plan en [Automatización Agente IA.md](Automatización%20Agente%20IA.md) §C.2) |
| `ai_agent_name` (Ent) | 🟡 sin uso en el prompt |
| `gmail_integration` / `notification_email` (Ent) | 🔴 sin implementación en el workflow activo |
| `multi_branch` (Ent) | 🔴 roadmap — el concepto de sucursal no existe aún en el sistema |

**Observación de arquitectura (🟡 aceptada):** el gating de features es **solo frontend** en todo el sistema (la RLS gatea por `business_id`/`is_business_active`, no por feature). Un tenant Básico técnicamente hábil podría escribir en las tablas de finanzas por la API REST con su JWT. Consistente y de bajo riesgo hoy; defensa en profundidad (añadir `has_feature()` a las políticas de escritura de las tablas premium) queda como mejora P2.

### 8.3 Módulo de planes (Admin) — revisado

- ✅ AdminPanel: edita plan, `plan_status`, `limit_overrides`, `ai_paused` vía `admin-update-business` (service_role); muestra % de uso (hoy siempre 0 por H1) y badge de pausa.
- ⚠️ **Pendiente v3:** la tabla `plans` en producción aún tiene los precios/límites v2 (Básico Q999 · 1,000 msgs). Aplicar la v3 = 1 `UPDATE` ([IA], con tu confirmación).
- 🟡 Conocido (P2): `AdminOnboarding.jsx` tiene el array de planes **hardcodeado** en vez de leer la tabla `plans` — si aplicas la v3, ese array quedaría desincronizado. Corregirlo junto con el UPDATE.

### 8.4 Hallazgos priorizados (resumen ejecutivo de la auditoría)

| # | Sev | Hallazgo | Dónde se arregla |
|---|---|---|---|
| H1 | 🔴 | Metering muerto: nadie llama `record_usage` → panel en 0, corte por consumo imposible. **El límite de 500 msgs que sostiene la v3 hoy no se aplica de verdad** | n8n: 1 nodo HTTP tras cada `Historial - Respuesta *` |
| H2 | 🔴 | El bot ignora `ai_paused` (ni corte automático ni kill-switch manual lo detienen) | n8n: condición extra en `¿Plan Activo?` (dato ya cargado, 0 requests) |
| H6 | 🔴 | `reminders`/`auto_confirm` se venden sin motor (sin `scheduleTrigger`) | portar del workflow viejo o quitar los flags hasta implementarlos |
| H3 | 🟠 | Gates del bot miden distinto que la DB (turnos por `created_at`; conversaciones 2×; sin overrides) | n8n |
| H4 | ✅ | **Resuelto 2026-07-11** (y re-auditado: no existía botón de crear en la UI — el hueco real era que `manage-staff` corre con service_role, exento del trigger, y no chequeaba `max_staff`). Fix: check de límite en la Edge (**v8**) + contador `X/Y usuarios del plan` en Users.jsx | — |
| H5 | 🟢 | **Casi resuelto 2026-07-11**: botón "Marcar pagado" en AdminPanel (edge v9 → `record_payment`) + trial 14d con vencimiento (onboard-tenant v13). [TÚ] queda 1 clic: marcar pagado al negocio real | — |
| H7 | 🟡 | `custom_prompt` inyectado a todos los planes en el bot | n8n (condición por tier) o aceptar |
| H8 | ✅ | **Resuelto 2026-07-11**: la comparación correcta era contra `maxPatients` (el límite que recorta los chats visibles) | — |

**Lo que SÍ está sólido:** límites duros de pacientes/staff/turnos en dashboard con 3 capas coherentes (trigger + visibilidad + UX), `limit_overrides` respetado en DB y front, suspensión con dientes (RLS 10 tablas + modal + gate del bot), retención por plan, gating de features del front completo, y el submódulo de Categorías correctamente encuadrado en Pro/Enterprise vía `finance`.

**Orden recomendado de cierre:** H1+H2 (misma sesión de n8n, [IA] puede por API) → H6 (decisión de producto) → H5 (habilita el cobro real) → H3/H4 → H7/H8.

---

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Vender límites/features que no se aplican (H1/H2/H6) | Deuda comercial: cliente Enterprise ilimitado de facto; recordatorios prometidos inexistentes | Cerrar H1/H2 antes del primer cliente v3; no listar recordatorios hasta H6 |
| Enterprise sin techo real de IA | Margen negativo con 1 cliente abusivo | El techo 20k ya está en `plans`; se vuelve real al cerrar H1 |
| Básico canibaliza al Pro | Mix de ingresos pobre | 500 msgs es el freno; regla §2.5 (recortar a 300, no subir precio) |
| Vercel Hobby en producción comercial | Suspensión por ToS | Pro $20 al facturar el primer cliente |
| PITR asumido barato (real $100/mes) | +Q700/mes sorpresa | No activar; backups diarios de Pro bastan |
| Rate card Meta cambia (~anual) | Recordatorios más caros | Revisar card cada semestre; tope incluido por plan |
| FX sube (>Q8.5/USD) | Fijos más caros | Colchón de margen ~88%; re-tarificar solo si FX>8.5 |
| Groq/Gemini suben precios | Costo IA sube | Multi-proveedor ya en n8n; Flash-Lite como fallback |

---

## Fuentes

**Stack (verificadas 2026-07-04):** [Supabase pricing](https://supabase.com/pricing) · [Vercel Pro](https://vercel.com/docs/plans/pro-plan) · [Elestio](https://elest.io/pricing) · [n8n Cloud](https://n8n.io/pricing/) · [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Groq pricing](https://groq.com/pricing) · [Meta WhatsApp pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [Rate card oficial](https://whatsappbusiness.com/es-la/products/platform-pricing/) · réplicas RestLatAm: [SleekFlow](https://help.sleekflow.io/en_US/whatsapp/pricing) · [Gallabox](https://docs.gallabox.com/pricing-and-billing-modules/new-per-message-pricing)

**Benchmarking Guatemala (consultadas 2026-07-10):** [AgendaPro planes](https://agendapro.com/es/planes) · [análisis de precios AgendaPro (Cronos)](https://blog.cronoscal.com/agendapro-opiniones-precios/) · [Medesk review](https://www.medesk.net/es/blog/agenda-pro-review/) · [Fresha pricing](https://www.fresha.com/pricing) · [Fresha vs Booksy (Pabau)](https://pabau.com/blog/fresha-vs-booksy/) · [GlossyStack](https://www.glossystack.com/vs/fresha-vs-booksy) · [Booksy en LatAm (Turnito)](https://turnito.app/blog/los-mejores-software-para-peluquerias-en-mexico-2026/) · [Doctoralia PRO](https://pro.doctoralia.com.mx/precios/medicos-y-especialistas) · [Wati pricing](https://www.wati.io/pricing/) · [Costbench Wati](https://costbench.com/software/live-chat/wati/) · [B2Chat pricing](https://www.b2chat.io/en/pricing/) · [Guía chatbots LATAM (AutoLatam)](https://auto-latam.com/blog/chatbot-whatsapp-precio-empresas-latam-2026) · [Aurora Inbox](https://www.aurorainbox.com/en/2026/02/21/how-much-does-chatbot-whatsapp-cost/) · [Uniamos GT (voz IA dental)](https://uniamos.com/blog/agente-voz-ia-clinicas-dentales-ciudad-guatemala-2026) · [Reservas GP](https://agendagt.com/) · [ReservaSimple](https://www.reservasimple.com/app-citas-medicos-guatemala) · [XMed](https://xmedcloud.app/) · [ComparaSoftware GT](https://www.comparasoftware.gt/medico-para-clinicas) · [Alegra planes](https://www.alegra.com/costarica/precios/)
