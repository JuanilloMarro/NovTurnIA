# WhatsApp Cloud API — Funcionamiento, Multi-Tenancy y Costos

> Referencia técnica de cómo Meta factura y cómo NovTurnIA está montado sobre la Cloud API. Toda la información proviene de documentación oficial de Meta — enlaces en cada sección y en [§ Fuentes](#fuentes). Donde el dato exacto solo existe en el rate card dinámico, se usaron dos réplicas independientes del card oficial verificadas cruzadas.
> **FX:** Q8.00/USD. Los precios y cupos de venta viven en [Final Audits/Modelo de Negocio.md](Modelo%20de%20Negocio.md).

---

## 1. Respuestas rápidas

| Pregunta | Respuesta |
|---|---|
| ¿Con una sola app de Meta pueden varios clientes usar la API? | **Sí.** Una app sirve a N clientes: números bajo tu propio WABA (simple, límite 20) o modelo *Tech Provider* con Embedded Signup (cada cliente su WABA, escala a cientos). §4 y §5 |
| ¿Las plantillas son generales o por usuario? | **Por WABA.** Todos los números de un mismo WABA comparten plantillas. Con Tech Provider, cada cliente tiene las suyas. §3 |
| ¿Qué se cobra? | **Todo mensaje que envía el negocio.** Respuestas del bot, respuestas humanas desde el dashboard y plantillas. Los mensajes que envía el cliente son gratis. §6 |
| ¿Cuánto cuesta un mensaje en Guatemala? | **$0.0130 ≈ Q0.104** (servicio, utility y authentication) · **$0.0851 ≈ Q0.681** (marketing). §6.3 |
| ¿Queda algo gratis? | Solo la ventana de **72 h del Free Entry Point** (conversaciones nacidas de anuncios Click-to-WhatsApp o CTA de Facebook/Instagram). §6.2 |
| ¿Cuántos números permite una app/WABA? | Por WABA: **2 al inicio → 20** tras verificación del negocio. La app no tiene límite de WABAs conectadas. §2.3 |
| ¿Cada negocio tiene su número? | Sí — `phone_number_id` por tenant. Implementación correcta y compatible con la migración a Tech Provider. §7 |

---

## 2. Jerarquía de Meta

```
App de Meta (la tuya, con el webhook)
   │  puede servir a N clientes
   ▼
Business Manager / Portfolio (dueño de los activos)
   │
   ▼
WABA — WhatsApp Business Account
   │  · las PLANTILLAS viven aquí (compartidas por sus números)
   │  · el MÉTODO DE PAGO vive aquí (quien posee el WABA paga a Meta)
   │  · límite: 2 → 20 números registrados
   ▼
Números de teléfono (cada uno con su phone_number_id)
   │  · el webhook entrega los mensajes con metadata.phone_number_id
   ▼
Mensajes (todos los salientes se cobran)
```

### 2.1 La App
Punto de integración: credenciales, webhook y permisos (`whatsapp_business_messaging`). **Una sola app opera mensajería para muchos WABAs** — el webhook recibe todos los eventos e identifica al tenant por `metadata.phone_number_id`, que es exactamente lo que hace el flujo n8n.

### 2.2 El WABA
Contenedor de números + plantillas + facturación. Un Business Manager puede tener varios WABAs.

### 2.3 Números de teléfono
- Límite inicial: **2 números registrados** por portfolio → sube **automáticamente a 20** al verificar el negocio o alcanzar messaging limit de 2,000.
- El número debe poder recibir SMS/llamada (OTP de registro) y **no puede estar activo en WhatsApp consumer/Business app** (darlo de baja primero, o usar *coexistence*).
- Cada número tiene display name sujeto a aprobación (`name_status`).

---

## 3. Plantillas (templates)

- **Ámbito: el WABA.** No son globales de la app ni por número: todos los números del mismo WABA las comparten; WABAs distintos no.
- Requieren **aprobación previa de Meta** (categoría + contenido). Categorías: **Marketing**, **Utility**, **Authentication** — Meta puede recategorizar si el contenido no coincide.
- Se usan para **iniciar** conversación fuera de la ventana de 24 h (recordatorio de cita del día siguiente). Dentro de la ventana se envía texto libre sin plantilla — pero **eso también se cobra** (§6).
- Implicación multi-tenant: si todos los clientes cuelgan de TU WABA, comparten catálogo de plantillas ("Recordatorio de cita de {{negocio}}" parametrizado). Con WABA por cliente, cada uno registra las suyas con su marca.

---

## 4. Los dos modelos multi-tenant

### Modelo B — Centralizado (el actual)
Todos los números de clientes registrados bajo **tu** Business Manager/WABA. Alta manual, guardando `phone_number_id` + token en `businesses`.

| ✅ Pros | ❌ Contras |
|---|---|
| Setup simple — ya funciona | **Techo de 20 números = 20 clientes** |
| Control total de la infraestructura | Meta **te factura a ti todos los mensajes de todos los clientes** |
| Onboarding sin fricción (el cliente no toca Meta) | Plantillas compartidas entre todos los clientes |
| Un solo webhook, una sola app | Riesgo concentrado: una violación de políticas de UN cliente puede afectar tu WABA completo |

### Modelo A — Tech Provider + Embedded Signup
Te registras como **Tech Provider** y embebes el flujo de alta en tu dashboard: el cliente hace clic, se autentica con Meta, y el flujo **crea su propio WABA + registra su número + te otorga acceso** — devuelve `waba_id`, `phone_number_id` y un token intercambiable.

| ✅ Pros | ❌ Contras |
|---|---|
| **El cliente agrega su método de pago — Meta le factura directo** | Requiere Business Verification + App Review + Access Verification |
| Escala: 10 clientes/semana → **200/semana** verificado | Implementar Embedded Signup en el dashboard (JS SDK) |
| Cada cliente: sus plantillas, su marca, su riesgo aislado | El cliente interactúa una vez con Meta |
| El cliente es dueño de sus activos (portabilidad limpia) | Token exchange + refresh server-side |

### Decisión

**Modelo B hasta ~10–15 clientes.** Con dos reglas: verificar el negocio en Meta para subir el límite de 2 a 20 números, y cupo de mensajes cerrado por plan — porque en este modelo **cada mensaje de cada cliente lo pagas tú**. Los cupos están en [Final Audits/Modelo de Negocio.md](Modelo%20de%20Negocio.md).

**Migrar al Modelo A antes del cliente ~15.** No rompe el esquema: `businesses.phone_number_id` y `whatsapp_token` son exactamente lo que devuelve Embedded Signup — solo cambia cómo se obtienen y **quién paga los mensajes**. Bajo Modelo A el costo variable de WhatsApp deja de ser tuyo, lo que cambia por completo la estructura de márgenes.

---

## 5. Escalabilidad del onboarding (Modelo A)

- Por defecto: **10 clientes nuevos por ventana móvil de 7 días**.
- Con Business Verification + App Review + Access Verification: **200 clientes/7 días**.
- El cliente onboarded debe agregar método de pago a su WABA para poder enviar.

---

## 6. Costos

### 6.1 Modelo de cobro

Meta cobra **por mensaje entregado**. El modelo anterior por "conversación" está deprecado.

| Concepto | Efectivo desde | Estado |
|---|---|---|
| Cobro por mensaje de plantilla entregado | 1-jul-2025 | Vigente |
| Plantillas utility dentro de la ventana de 24 h: gratis | 1-jul-2025 | Vigente hasta 30-sep-2026 |
| Conversaciones de servicio gratis e ilimitadas | nov-2024 | Vigente hasta 30-sep-2026 |
| **Cobro por cada mensaje de servicio** (respuestas del bot y del staff dentro de la ventana de 24 h) | **1-oct-2026** | **Es el escenario sobre el que está construido el modelo de negocio** |

Desde el 1-oct-2026 **no hay ventana gratuita**: todo mensaje que el negocio envía se cobra a la tarifa utility de su país, **sin descuentos por volumen** (a diferencia de utility y authentication, que sí los tienen). Meta publica las tarifas definitivas por mercado antes del 1-sep-2026.

### 6.2 Lo que sigue siendo gratis

1. **Mensajes entrantes.** Todo lo que escribe el cliente es gratis, siempre.
2. **Free Entry Point (FEP).** Si el usuario llega por un anuncio Click-to-WhatsApp o botón CTA de Facebook/Instagram y respondes en 24 h, se abre una ventana de **72 h donde todo es gratis**, incluidas plantillas de cualquier categoría.

El FEP es la única palanca de costo cero que queda: **una clínica que capta por anuncios Click-to-WhatsApp no paga por esas conversaciones durante 72 h.** Vale la pena empujarlo como práctica recomendada al cliente.

### 6.3 Rate card — Guatemala

Guatemala pertenece a la región **"Rest of Latin America"** (con Bolivia, Costa Rica, R. Dominicana, Ecuador, El Salvador, Honduras, Haití, Jamaica, Nicaragua, Panamá, Paraguay, Puerto Rico, Uruguay, Venezuela).

| Categoría | USD/mensaje | **Q/mensaje** | Uso en NovTurnIA |
|---|---|---|---|
| **Servicio** | $0.0130 | **Q0.104** | Toda respuesta del bot y del staff dentro de la conversación |
| **Utility** | $0.0130 | **Q0.104** | Recordatorios y confirmaciones fuera de ventana |
| **Authentication** | $0.0130 | **Q0.104** | OTPs (no aplica hoy) |
| **Marketing** | $0.0851 | **Q0.681** | Promociones enviadas como plantilla |

**Marketing cuesta 6.5× más que servicio.** Ofrecer una promoción **dentro** de una conversación abierta cuesta Q0.104; mandarla como plantilla de marketing cuesta Q0.681. El módulo de ofertas debe ofrecer promos dentro del flujo conversacional del bot, no como campaña saliente, salvo decisión comercial explícita.

- **Tiers de volumen:** utility y authentication tienen descuentos por volumen (agregados a nivel portfolio, reset mensual). Los mensajes de servicio **no** los tienen.
- El card oficial se descarga en [whatsappbusiness.com/products/platform-pricing](https://whatsappbusiness.com/es-la/products/platform-pricing/) (CSV/PDF por moneda). Meta lo actualiza ~anualmente — revisar cada semestre.

### 6.4 Costo por plan

Con los cupos vigentes, asumiendo que el cliente agota su cupo completo:

| Plan | Mensajes salientes | Costo WhatsApp |
|---|---|---|
| Básico | 1,050 | **Q109** |
| Pro | 3,000 | **Q312** |
| Enterprise | 6,750 | **Q702** |

| Escenario adicional | Costo |
|---|---|
| 100 promociones como plantilla de marketing | Q68 |
| 500 recordatorios utility fuera de ventana | Q52 |
| Conversación captada por anuncio CTWA (72 h) | **Q0** |

### 6.5 Dónde está y dónde no está la palanca de costo

**El bot ya envía un solo mensaje por turno** — verificado recorriendo el grafo del workflow: ninguna ruta encadena dos envíos a WhatsApp. El costo de WhatsApp por turno ya es el mínimo posible; no hay ahorro que extraer ahí.

**La palanca real está en los tokens.** El bot arrastra 100 mensajes de historial en cada turno y su agente permite hasta 10 iteraciones, así que un turno puede encadenar diez llamadas al modelo con el contexto completo. Bajar la ventana a 20 mensajes y las iteraciones a 5 recorta el componente de IA sin tocar la calidad de la conversación. Ver [Automatización IA - n8n](Automatizacion%20IA%20-%20n8n.md).

---

## 7. Estado de la implementación

| Aspecto | Estado | Detalle |
|---|---|---|
| Número propio por tenant | ✅ | `businesses.phone_number_id` (NOT NULL) por negocio |
| Token por tenant | ⚠️ | `businesses.whatsapp_token` en texto plano. Migrar a Supabase Vault sigue pendiente (decisión deliberada para no romper n8n) |
| Ruteo multi-tenant del webhook | ✅ | Un solo webhook; n8n resuelve el tenant por `metadata.phone_number_id`. Patrón oficial para apps multi-WABA; no cambia al migrar al Modelo A |
| Aislamiento de datos (RLS) | ✅ | Políticas por `business_id` en todas las tablas |
| Alta de número en onboarding | ✅ | `AdminOnboarding.jsx` acepta `phone_number_id`/`whatsapp_token` opcionales; editable después en `AdminPanel.jsx` |
| **Conteo de mensajes** | ❌ | `usage_counters` **suma entrantes y salientes juntos**. Solo los salientes cuestan: el cupo se agota al doble de velocidad de lo que factura Meta |
| **Respuestas humanas desde el dashboard** | ❌ | `wa-human-reply` **no registra consumo ni consulta el límite**. Cada respuesta del staff cuesta Q0.104, no descuenta cupo y no aparece en el contador |
| **Mensajes por turno del bot** | ✅ | Uno solo por ruta — verificado en el grafo del workflow (§6.5) |
| Costo de mensajes | ⚠️ | Bajo Modelo B lo pagas tú. Cupo cerrado por plan + migración a Tech Provider ≥15 clientes (§4) |

**Conclusión:** la arquitectura multi-tenant es correcta y ya es estructuralmente compatible con el Modelo A — no hay deuda arquitectónica, solo una decisión comercial de cuándo migrar. **La deuda real está en la medición:** el contador mezcla direcciones y el canal humano no se mide, así que hoy el costo por cliente no está acotado. El detalle y el orden de ejecución están en [Final Audits/Modelo de Negocio.md](Modelo%20de%20Negocio.md) §8-12.

---

## Fuentes

**Oficiales de Meta:**
- Pricing (modelo por mensaje, vigente): <https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing>
- Actualizaciones de pricing: <https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/>
- Pricing por conversación (deprecado, referencia histórica): <https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing/>
- Calculadora/rate cards oficiales: <https://whatsappbusiness.com/es-la/products/platform-pricing/>
- Cuentas de WhatsApp Business (WABA): <https://developers.facebook.com/documentation/business-messaging/whatsapp/whatsapp-business-accounts>
- Números de teléfono (límites 2→20, requisitos): <https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers>
- Embedded Signup: <https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview>
- Tech Provider program: <https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers>

**Réplicas del rate card (verificación cruzada RestLatAm):**
- SleekFlow: <https://help.sleekflow.io/en_US/whatsapp/pricing>
- Gallabox: <https://docs.gallabox.com/pricing-and-billing-modules/new-per-message-pricing>

**Cobro de mensajes de servicio:**
- Chakra HQ: <https://chakrahq.com/article/whatsapp-api-pricing-update-service-messages-october-2026/>
- Nordflux: <https://nordflux.de/en/insights/whatsapp-business-api-pricing-october-2026>
