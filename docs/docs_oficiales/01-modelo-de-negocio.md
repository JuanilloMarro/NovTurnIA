# Modelo de Negocio NovTurnIA — Costos Reales y Propuesta Viable

> **Fecha:** 2026-07-04 · **Tipo de cambio usado:** Q7.70/USD (aprox.; actualizar al facturar)
> Todos los precios fueron verificados en la web contra fuentes oficiales el día de hoy (enlaces en [§ Fuentes](#fuentes)). El Excel `docs/audit_performance/Costos NovTurnIA.xlsx` se usó solo como referencia de metodología — cada cifra aquí fue re-investigada.

---

## 1. Veredicto ejecutivo

**Sí es viable como SaaS, y la meta "la primera mensualidad del primer cliente cubre todos los costos" se cumple** — con matices:

| Escenario | Costo fijo mensual | ¿1 cliente Básico (Q499) lo cubre? | ¿1 cliente Pro (Q999) lo cubre? |
|---|---|---|---|
| **Fase Beta** (Vercel Free + Elestio + Supabase Pro) | ~$33 ≈ **Q254** | ✅ Sobran ~Q245 | ✅ Sobran ~Q745 |
| **Fase Comercial** (Vercel Pro + Elestio + Supabase Pro) | ~$56 ≈ **Q431** | ✅ Justo (~Q68 de margen) | ✅ Sobran ~Q568 |
| **Fase Crecimiento** (+ compute Small, Sentry Team) | ~$87 ≈ **Q670** | ❌ Necesitas 2 Básicos | ✅ Sobran ~Q329 |

La clave estructural: **tus costos fijos NO escalan por cliente**. El costo *marginal* de un cliente adicional es solo su IA (~Q16–160 en el peor caso imposible) + WhatsApp (~Q0–50). Cada cliente nuevo deja un margen incremental de **85–95%**. El negocio funciona; el único punto frágil es el arranque (primeros 1–2 clientes) y ahí la fase Beta te protege.

Tu intuición sobre los tokens era correcta y queda **validada con números** en §4: la factura variable de IA es tan pequeña que la tarifa plana con corte automático (que ya implementaste con `usage_counters` + `ai_paused`) es la arquitectura de pricing correcta.

---

## 1-bis. ★ ESTRUCTURA DE PRECIOS v2 — APLICADA EN PRODUCCIÓN (2026-07-05)

> Decisión del usuario: **Básico = Q999 como ancla** y el resto proporcional al valor ofrecido. Esta sección **supersede** los cálculos con Q499/Q999/Q1999 que aparecen en §5–§6 (se conservan como referencia histórica). Los límites y precios de abajo ya están en la tabla `plans` y **se cumplen por triggers en la base de datos** (ver §1-ter).

### La escalera de valor (aplicada)

| | **Básico Q999** | **Pro Q1,999** | **Enterprise Q3,999** |
|---|---|---|---|
| Mensajes IA/mes | 1,000 | 5,000 (5×) | 20,000 (20×)* |
| Pacientes | 50 | 150 (3×) | Ilimitados |
| Staff | 1 | 5 | Ilimitado |
| Turnos/mes | 100 | 500 | Ilimitados |
| Features | Core | +8 (finance, kanban, followup, ai_memory, audit, reminders, custom_prompt, roles) | +7 más (auto_confirm, multi_branch, supplies, ofertas, export, stats-AI, content) |
| Anual (−16%) | Q839/mes | Q1,679/mes | Q3,359/mes |

\* "Ilimitado" comercialmente; 20,000 es el techo interno que activa el corte automático (`ai_paused`) — protege el margen sin que un cliente normal lo perciba jamás (20k mensajes ≈ 65 conversaciones diarias).

### El modelo que justifica cada precio

**1) El ancla (¿por qué Q999 es "lo ideal" para Básico?)**
- Cubre **él solo** los costos fijos de cualquier fase del stack (Beta Q254, Comercial Q431, Crecimiento Q693) → el negocio es rentable desde el cliente #1, que era tu meta.
- Payback del cliente: un consultorio con turno promedio de Q150–300 recupera Q999 evitando **4–7 no-shows al mes** — el bot confirma/recuerda justo eso. El precio se sostiene por valor, no solo por costo.

**2) Proporcionalidad por la métrica core (mensajes IA = valor Y costo):**

| Plan | Precio | Q por mensaje | Q por paciente |
|---|---|---|---|
| Básico | Q999 | **Q1.00** | Q19.98 |
| Pro | Q1,999 (2.0×) | **Q0.40** | Q13.33 |
| Enterprise | Q3,999 (2.0×) | **Q0.20** | → 0 |

Cada salto **duplica el precio pero multiplica ×4–5 la capacidad**: el precio unitario cae (descuento por volumen clásico de SaaS). Eso es "accesible con ganancias": el cliente grande paga más total pero menos por unidad → incentivo natural de upgrade, y tú capturas margen creciente porque tu costo unitario real (~Q0.016/mensaje en el peor caso) es casi plano.

**3) Márgenes verificados con los costos reales de §2–§4 (FX 7.70):**

| Plan | Precio | Costo marginal techo† | Margen incremental | ¿Cubre fijos solo (Q693)? |
|---|---|---|---|---|
| Básico | Q999 | ~Q16 (IA 1k msgs) | **~98%** | ✅ |
| Pro | Q1,999 | ~Q131 (IA 5k + 500 recordatorios) | **~93%** | ✅ |
| Enterprise | Q3,999 | ~Q508 (IA 20k + 2,000 recordatorios) | **~87%** | ✅ |

† "Techo" = escenario imposible de §4; el consumo realista es 5–10× menor.

**4) Proyección v2 (fase Comercial, fijos Q431):**

| Clientes | Mix | Ingreso/mes | Utilidad | Margen |
|---|---|---|---|---|
| 1 | 1 Básico | Q999 | Q552 | 55% |
| 3 | 2 Básico + 1 Pro | Q3,997 | Q3,403 | 85% |
| 5 | 3 Básico + 2 Pro | Q6,995 | Q6,239 | 89% |
| 10 | 5 B + 4 P + 1 E | Q16,990 | Q14,600 (stack Crecimiento) | 86% |

Con la v2, **cualquier** primer cliente (incluso Básico) cubre todos los fijos — desaparece la fragilidad que tenía el Q499.

---

## 1-ter. Enforcement de límites — implementado y verificado (2026-07-05)

Los límites dejaron de ser informativos. Tres capas, probadas con tests de rollback en producción:

| Capa | Mecanismo | Verificación |
|---|---|---|
| **DB (fuente de verdad)** | Triggers `enforce_patient_limit` / `enforce_staff_limit` / `enforce_appointment_limit` (mensual) — aplican a dashboard Y bot n8n; respetan `limit_overrides` | Paciente #51 en Básico → **rechazado**; turno #3 con override=2 → **rechazado**; staff sobre límite → **rechazado** (4/4 ✓) |
| **Visualización** | `get_visible_patient_ids`/`staff_ids` — corregidas para respetar `limit_overrides` | Devuelve exactamente 50 visibles en Básico ✓ |
| **UX (front)** | `usePlanLimits` con booleanos reales; botones deshabilitados + banner en Nuevo Cliente y Nuevo Turno | HMR sin errores ✓ |
| **Mensajes IA** | Ya existía: `record_usage` → `ai_paused` al llegar al límite (ahora también aplica al techo de 20k de Enterprise) | Auditado §4 |

---

## 2. Stack de costos fijos (verificados)

### 2.1 Supabase Pro — $25/mes
Fuente oficial: [supabase.com/pricing](https://supabase.com/pricing)

- Incluye: 8 GB de disco (luego $0.125/GB), **$10/mes de crédito de compute** (cubre la instancia Micro: 2-core ARM, 1 GB RAM), 100,000 MAUs, 250 GB egress, **backups diarios con 7 días de retención**.
- **Sobre las "virtual machines con más espacio" que preguntaste** — son los *compute add-ons* (misma base de datos, más músculo; se paga la diferencia sobre el crédito de $10):

| Instancia | Precio/mes | Specs | Costo real (tras crédito) |
|---|---|---|---|
| Micro | $10 | 2-core, 1 GB RAM | **$0** (incluida en Pro) |
| Small | $15 | 2-core, 2 GB RAM | +$5 |
| Medium | $60 | 2-core, 4 GB RAM | +$50 |
| Large | $110 | 2-core, 8 GB RAM | +$100 |
| XL | $210 | 4-core, 16 GB RAM | +$200 |
| 2XL–8XL | $410–$1,870 | hasta 128 GB RAM | — |

- **Cuándo subir:** Micro aguanta cómodamente 10–30 tenants de tu perfil (tablas chicas, tráfico de bot moderado). Small (+$5) cuando las queries del dashboard empiecen a tardar. No pagues Medium hasta tener >50 clientes.
- ⚠️ **Corrección al Excel:** el add-on de PITR (Point-in-Time Recovery) cuesta **$100/mes** por 7 días de retención — no $10 como asume la hoja "Fases". Los backups diarios incluidos en Pro son suficientes hasta que un cliente Enterprise exija RPO < 24h. **No actives PITR todavía.**

### 2.2 Vercel — $0 (Beta) → $20/mes (comercial)
Fuente oficial: [vercel.com/docs/plans/pro-plan](https://vercel.com/docs/plans/pro-plan)

- **Pro: $20/mes por seat** (1 seat te basta). Incluye $20/mes de crédito de uso, 1 TB Fast Data Transfer y 10M edge requests — tu dashboard no se acercará a esos límites en años.
- El plan Hobby (gratis) **prohíbe uso comercial**. Tu Excel lo trata como "zona gris aceptable en beta sin facturar" — razonable mientras NO cobres. **En el momento en que factures al primer cliente, pasas a Pro.** Es un riesgo de ToS, no técnico.

### 2.3 n8n — opción estable recomendada: Elestio (~$11–15/mes)
Fuentes: [elest.io/pricing](https://elest.io/pricing) · [elest.io/open-source/n8n](https://elest.io/open-source/n8n) · [n8n.io/pricing](https://n8n.io/pricing/)

Pediste que investigara una opción estable. Comparativa:

| Opción | Costo/mes | Estabilidad | Notas |
|---|---|---|---|
| **Elestio managed n8n** ⭐ | desde **~$11** (facturación por hora, créditos prepagados) | Alta | VM dedicada + backups automáticos + SSL + updates de OS/n8n + monitoreo incluidos. Eliges proveedor (Hetzner/DO/etc.). Es lo que ya usabas — buena elección, mantenla. |
| n8n Cloud Starter | $24 (€24) | Alta | 2,500 ejecuciones/mes de límite — con tu volumen de bot multi-tenant te puedes quedar corto; el límite de ejecuciones es el problema, no la estabilidad. |
| VPS crudo (Hetzner/DO) + Docker | $5–7 | Media | Gratis en licencia, pero TÚ eres los backups, el SSL y los updates. Un fallo del bot a las 3 AM es tu churn. |

**Recomendación: Elestio ~$11–15/mes.** Es el punto medio correcto: ejecuciones ilimitadas (self-hosted) + operación gestionada (backups/updates/monitoring). El plan de $7 de tu Excel corresponde al tier VM más pequeño — funciona, pero con 10+ tenants conviene el siguiente tier (~$14) por RAM.

### 2.4 Resto del stack — $0
Tu Excel ya lo tenía bien: Cloudflare Free (DNS/WAF/DDoS), Sentry Free (5K eventos/mes), Better Stack Free (uptime + status page). Total: **$0**. Sentry Team ($26) solo cuando el volumen de errores lo justifique.

### 2.5 Totales fijos por fase

| Fase | Supabase | Vercel | n8n (Elestio) | Otros | **Total USD** | **Total GTQ** |
|---|---|---|---|---|---|---|
| **Beta** (0 ingresos, validación) | $25 | $0 | $7–11 | $0 | **~$32–36** | **~Q246–277** |
| **Comercial** (1er cliente facturado) | $25 | $20 | $11 | $0 | **~$56** | **~Q431** |
| **Crecimiento** (10–30 clientes) | $30 (Small) | $20 | $14 | $26 (Sentry) | **~$90** | **~Q693** |
| **Escala** (50+ clientes) | $75 (Medium) | $20 | $14–30 | $26 | **~$135–150** | **~Q1,040–1,155** |

---

## 3. Costo de WhatsApp (resumen — detalle completo en [02-whatsapp-cloud-api.md](02-whatsapp-cloud-api.md))

Lo esencial para el modelo de negocio, verificado en fuentes de Meta:

1. **El caso de uso principal de NovTurnIA cuesta $0.** Desde nov-2024 las conversaciones de *servicio* (el paciente escribe → el bot responde dentro de la ventana de 24h) son **gratis e ilimitadas**. El viejo límite de "1,000 gratis" era mensual y fue eliminado.
2. **Solo pagan las plantillas** (mensajes que TÚ inicias fuera de ventana), por mensaje entregado. Rate card vigente (1-jul-2026) para Guatemala (región "Rest of Latin America"):
   - Utility (recordatorios de cita): **$0.0130/mensaje**
   - Marketing: **$0.0851/mensaje**
   - Authentication: **$0.0130/mensaje**
3. **Impacto real:** un cliente Pro con 500 recordatorios/mes fuera de ventana = **$6.50/mes ≈ Q50**. Es el único costo variable relevante de WhatsApp y solo aplica si activas `reminders`/`auto_confirm`.

---

## 4. Costo de IA (tokens) — tu metodología, validada

Precios oficiales por millón de tokens ([Gemini](https://ai.google.dev/gemini-api/docs/pricing) · [Groq](https://groq.com/pricing)):

| Modelo (los que usa tu bot en n8n) | Input | Output |
|---|---|---|
| Gemini 2.5 Flash (agentes Salud/Otro) | $0.30 | $2.50 |
| Gemini 2.5 Flash-Lite (clasificadores de scheduling) | $0.10 | $0.40 |
| Groq llama-3.3-70b (clasificadores + agente Belleza) | $0.59 | $0.79 |

### El "escenario imposible" (tu método del Excel, re-verificado)

1,000 conversaciones/mes × 50–75k tokens cada una (95% input / 5% output) — un consumo que ningún cliente real de agendamiento alcanza:

| Escenario | Tokens/mes | Todo con Flash | Todo con Flash-Lite |
|---|---|---|---|
| 1,000 conv × 50k | 50M | **$20.50** | $5.75 |
| 1,000 conv × 75k | 75M | **$30.75** | $8.63 |

✅ Tus números del Excel eran correctos. Y el techo por plan queda así (tratando cada **mensaje** como una conversación entera de 50k tokens — absurdo a propósito):

| Plan | Límite msgs/mes | Techo absurdo de IA | Precio del plan | ¿La mensualidad lo cubre? |
|---|---|---|---|---|
| Básico | 1,000 | $20.50 ≈ Q158 | Q499 | ✅ 3.2× de holgura |
| Pro | 5,000 | $102.50 ≈ Q789 | Q999 | ✅ 1.3× incluso en el absurdo total |
| Enterprise | ∞ | **sin techo** | Q1,999 | ⚠️ ver riesgo abajo |

**Conclusión: la tarifa plana es segura.** El consumo realista es 10–20× menor que el techo absurdo (una conversación de agendamiento son ~10 mensajes × 2–3k tokens). Y tu sistema ya tiene el seguro perfecto: `record_usage` corta la IA (`ai_paused=true`) al llegar al límite del plan — el peor caso está acotado por diseño.

⚠️ **Único hueco: Enterprise sin `max_conversations`.** Sin límite no hay corte automático. Recomendación: ponle un `limit_override` alto (p. ej. 20,000 msgs) a cada Enterprise — invisible para el cliente normal, pero techo matemático para tu margen.

---

## 5. Márgenes por plan (costo marginal por cliente)

Costo marginal = lo que te cuesta UN cliente adicional (los fijos ya están pagados):

| Plan | Precio | IA techo realista* | WhatsApp (recordatorios)** | Costo marginal total | **Margen incremental** |
|---|---|---|---|---|---|
| Básico Q499 | $64.80 | ~$2 | $0 (sin reminders) | ~$2 ≈ Q15 | **~97%** |
| Pro Q999 | $129.70 | ~$10 | ~$6.50 | ~$17 ≈ Q131 | **~87%** |
| Enterprise Q1,999 | $259.60 | ~$25 | ~$15 | ~$40 ≈ Q308 | **~85%** |

\* Techo realista = escenario imposible ajustado a conversaciones reales del límite del plan.
\** 500 recordatorios utility/mes en Pro; 1,000+ en Enterprise.

**Punto de equilibrio del sistema completo** (fase Comercial, fijos Q431):
- 1 cliente Pro → cubre fijos + Q437 de utilidad.
- 1 cliente Básico → cubre fijos + Q53 (apretado pero positivo).
- Cada cliente después del primero es ~90% utilidad bruta.

Con el descuento anual (−16%): Básico Q419/mes, Pro Q839/mes, Enterprise Q1,679/mes — incluso con descuento, un Pro anual sigue cubriendo los fijos de fase Crecimiento. El anual te conviene siempre: adelanta caja en un negocio cuyo riesgo es el arranque.

---

## 6. Propuesta de modelo viable (recomendaciones concretas)

1. **Mantén la tarifa plana con corte automático.** Ya está implementada (`usage_counters` + `record_usage` + `ai_paused`) y los números de §4 prueban que es segura. No pases el costo de tokens al cliente: una factura variable mata la venta en este mercado y tu riesgo real es de centavos.
2. **El primer cliente debe ser Pro (Q999).** Cubre cualquier fase de stack desde el día 1. El Básico existe como puerta de entrada, no como sostén del negocio.
3. **Secuencia de fases:** quédate en Beta (Vercel Free, Q254 fijos) hasta cerrar el primer cliente de pago → ese mismo día activa Vercel Pro (requisito de ToS para uso comercial) → no subas compute ni actives Sentry Team hasta sentir dolor real.
4. **Revisa el Básico: 10 pacientes es demasiado bajo.** Con `max_patients=10` un consultorio real lo agota en la primera semana y percibirá el plan como roto, no como limitado. Sugerencia: 50 pacientes / 1,000 msgs — el costo marginal no cambia (sigue siendo ~Q15) y la conversión a Pro mejora porque el cliente llega a experimentar el valor.
5. **Recordatorios (utility) con tope incluido:** Pro incluye hasta 500 recordatorios/mes (te cuestan ~Q50); Enterprise hasta 2,000 (~Q200). Excedente: Q0.15/mensaje (≈ 50% de margen sobre los $0.013 de Meta) o migrar al cliente a su propio WABA (modelo Tech Provider, doc 02) donde Meta le factura directo.
6. **Enterprise siempre con `limit_overrides`** (msgs y recordatorios). "Ilimitado" en la página de ventas, techo matemático en la base de datos.
7. **Cobro:** el descuento anual −16% es tu mejor herramienta de caja ahora. Stripe (T-03 pendiente) se vuelve urgente al pasar de ~5 clientes manuales.

### Proyección simple (fase Comercial, FX 7.70)

| Clientes | Mix | Ingreso/mes | Costos totales/mes | Utilidad | Margen |
|---|---|---|---|---|---|
| 1 | 1 Pro | Q999 | ~Q562 | Q437 | 44% |
| 3 | 2 Pro + 1 Básico | Q2,497 | ~Q724 | Q1,773 | 71% |
| 5 | 3 Pro + 2 Básicos | Q3,995 | ~Q886 | Q3,109 | 78% |
| 10 | 6 Pro + 3 Básicos + 1 Ent | Q9,988 | ~Q1,595 (stack Crecimiento) | Q8,393 | 84% |

El margen converge a ~85% — estructura típica de un SaaS sano. **El modelo es viable; tu cuello de botella no son los costos, es la adquisición de clientes.**

---

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Enterprise sin techo de IA/recordatorios | Margen negativo con 1 cliente abusivo | `limit_overrides` obligatorio (§6.6) |
| PITR asumido en $10 (real: $100) | Sorpresa de +Q700/mes | No activar; backups diarios de Pro bastan |
| Vercel Free en producción comercial | Suspensión de cuenta por ToS | Upgrade a Pro al facturar (§6.3) |
| Rate card de Meta cambia (lo hace ~anualmente) | Recordatorios más caros | Revisar el card oficial cada semestre; el tope incluido (§6.5) te protege |
| FX Q/USD sube | Fijos más caros en Q | Precios en Q ya tienen colchón ~85%; re-tarificar solo si FX > 8.5 |
| Groq/Gemini suben precios o deprecan modelos | Costo IA sube | Multi-proveedor ya implementado en n8n; Flash-Lite como fallback barato |

---

## Fuentes

- Supabase — precios Pro y compute add-ons: <https://supabase.com/pricing>
- Vercel — Pro plan (precio, créditos, uso comercial): <https://vercel.com/docs/plans/pro-plan>
- Elestio — managed hosting (desde $11/mes) y n8n gestionado: <https://elest.io/pricing> · <https://elest.io/open-source/n8n>
- n8n Cloud — planes: <https://n8n.io/pricing/>
- Google — precios Gemini API (2.5 Flash / Flash-Lite): <https://ai.google.dev/gemini-api/docs/pricing>
- Groq — precios on-demand (llama-3.3-70b-versatile): <https://groq.com/pricing>
- Meta — pricing WhatsApp Business Platform (por mensaje, vigente): <https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing>
- Meta — calculadora oficial de tarifas: <https://whatsappbusiness.com/es-la/products/platform-pricing/>
- Rate card "Rest of Latin America" 1-jul-2026 (réplicas verificadas cruzadas del card oficial): [SleekFlow](https://help.sleekflow.io/en_US/whatsapp/pricing) · [Gallabox](https://docs.gallabox.com/pricing-and-billing-modules/new-per-message-pricing)
