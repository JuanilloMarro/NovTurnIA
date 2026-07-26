# WhatsApp Cloud API — Funcionamiento, Multi-Tenancy y Costos

> **Fecha:** 2026-07-04 · Toda la información proviene de documentación oficial de Meta (developers.facebook.com / whatsappbusiness.com) — enlaces en cada sección y en [§ Fuentes](#fuentes). Donde el dato exacto solo existe en el rate card dinámico, se usaron dos réplicas independientes del card oficial verificadas cruzadas.

---

## 1. Respuestas directas a tus preguntas

| Pregunta | Respuesta corta |
|---|---|
| ¿Con una sola app de Meta pueden varios clientes usar la API? | **Sí.** Una app puede servir a N clientes. Hay dos formas: números bajo tu propio WABA (simple, límite 20) o modelo *Tech Provider* con Embedded Signup (cada cliente su WABA, escala a cientos). §4 y §5. |
| ¿Las plantillas son generales o por usuario? | **Por WABA.** Todos los números de un mismo WABA comparten plantillas. Si cada cliente tiene su WABA (Tech Provider), cada uno tiene las suyas. §3. |
| ¿Los "1,000 mensajes gratis" son por mes o por año? | Eran **1,000 conversaciones de servicio POR MES**… y ya no existen como límite: desde **nov-2024 las conversaciones de servicio son gratis e ilimitadas**. §6.2. |
| ¿Costos de plantillas fuera de la ventana de 24h? | Se cobra **por mensaje entregado** (desde 1-jul-2025). Guatemala: utility/auth **$0.0130**, marketing **$0.0851**. §6.3. |
| ¿Cuántos números de teléfono permite una app/WABA? | Por WABA: **2 al inicio → 20** tras verificación del negocio (o al alcanzar límite de mensajería de 2,000). La app en sí no tiene límite de WABAs conectadas. §2.3. |
| ¿Se puede personalizar por negocio o todos hablan a un solo número? | **Tu perspectiva original es correcta y está bien implementada**: cada negocio tiene su propio número (`phone_number_id` por tenant). No necesitas cambiarla. §7. |

---

## 2. Cómo funciona la jerarquía de Meta

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
Mensajes (servicio gratis / plantillas cobradas)
```

### 2.1 La App
Es tu punto de integración: credenciales, webhook y permisos (`whatsapp_business_messaging`). **Una sola app puede operar mensajería para muchos WABAs** — el webhook recibe TODOS los eventos e identifica al tenant por `metadata.phone_number_id` (exactamente lo que hace tu flujo n8n).

### 2.2 El WABA
Contenedor de números + plantillas + facturación. Un Business Manager puede tener varios WABAs.

### 2.3 Números de teléfono
Fuente: [Meta — Business phone numbers](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers)
- Límite inicial: **2 números registrados** por portfolio → sube **automáticamente a 20** al verificar el negocio o alcanzar messaging limit de 2,000.
- El número debe poder recibir SMS/llamada (para el OTP de registro) y **no puede estar activo en WhatsApp consumer/Business app** (hay que darlo de baja primero, o usar *coexistence*).
- Cada número tiene display name sujeto a aprobación (`name_status`).

---

## 3. Plantillas (templates)

- **Ámbito: el WABA.** No son globales de la app ni por número: todos los números del mismo WABA las comparten; WABAs distintos NO.
- Requieren **aprobación previa de Meta** (categoría + contenido). Categorías: **Marketing**, **Utility**, **Authentication** — Meta puede recategorizar si el contenido no coincide.
- Se usan **solo** para iniciar conversación fuera de la ventana de 24h (p. ej., recordatorio de cita del día siguiente). Dentro de la ventana, texto libre sin plantilla.
- Implicación multi-tenant: si todos tus clientes cuelgan de TU WABA, comparten catálogo de plantillas ("Recordatorio de cita de {{negocio}}" parametrizado). Con WABA por cliente (Tech Provider), cada uno registra las suyas con su propia marca.

---

## 4. Los dos modelos multi-tenant

### Modelo B — Centralizado (lo que tienes hoy)
Todos los números de clientes registrados bajo **tu** Business Manager/WABA. Tú los das de alta manualmente y guardas su `phone_number_id` + token en `businesses`.

| ✅ Pros | ❌ Contras |
|---|---|
| Setup simple — ya funciona | **Techo de 20 números = 20 clientes** |
| Control total de la infraestructura | Meta **te factura a ti** todas las plantillas |
| Onboarding sin fricción para el cliente (no toca Meta) | Plantillas compartidas entre todos los clientes |
| Un solo webhook, una sola app | Riesgo concentrado: una violación de políticas de UN cliente puede afectar TU WABA completo (y a todos los demás) |

### Modelo A — Tech Provider + Embedded Signup (el oficial para SaaS)
Fuentes: [Get started for Tech Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers) · [Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)

Te registras como **Tech Provider** de Meta y embebes el flujo de alta ("Embedded Signup") en tu dashboard: el cliente hace clic, se autentica con su cuenta de Meta, y el flujo **crea automáticamente su propio WABA + registra su número + te otorga acceso** — te devuelve `waba_id`, `phone_number_id` y un token intercambiable. Exactamente los dos campos que ya guardas.

| ✅ Pros | ❌ Contras |
|---|---|
| **El cliente agrega SU método de pago — Meta le factura directo** (tus plantillas dejan de ser costo tuyo) | Requiere Business Verification + App Review + Access Verification |
| Escala: 10 clientes/semana por defecto → **200/semana** verificado | Implementar el flujo Embedded Signup en el dashboard (JS SDK) |
| Cada cliente: sus plantillas, su marca, su riesgo aislado | El cliente interactúa una vez con Meta (algo de fricción en onboarding) |
| El cliente es dueño de sus activos (portabilidad limpia) | Token exchange + refresh que gestionar server-side |

### Recomendación

**Quédate en el Modelo B hasta ~10–15 clientes** (ya lo tienes funcionando y el techo de 20 números te da margen), pero con dos reglas: (1) verifica tu negocio en Meta YA, para que el límite suba de 2 a 20 y desbloquear volumen; (2) recordatorios con tope incluido en el plan, porque las plantillas las pagas tú (ver [01-modelo-de-negocio.md §6.5](01-modelo-de-negocio.md)).

**Migra al Modelo A antes del cliente ~15** o cuando actives plantillas salientes en volumen (auto_confirm Enterprise). La migración no rompe tu esquema: `businesses.phone_number_id` y `whatsapp_token` son exactamente lo que Embedded Signup devuelve — solo cambia CÓMO se obtienen (flujo embebido vs alta manual) y quién paga las plantillas.

---

## 5. Escalabilidad del onboarding (Modelo A)

Fuente: [Embedded Signup — Overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)
- Por defecto: **10 clientes nuevos por ventana móvil de 7 días**.
- Con Business Verification + App Review + Access Verification: **200 clientes/7 días**.
- El cliente onboarded debe agregar método de pago a su WABA para enviar plantillas (los mensajes de servicio no lo requieren).

---

## 6. Costos (verificados)

### 6.1 El modelo de cobro vigente
Fuente: [Meta — Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [conversation-based (deprecado)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing/)

Desde el **1 de julio de 2025** Meta cobra **por mensaje de plantilla ENTREGADO** (el modelo anterior por "conversación" está deprecado). Solo pagan las plantillas; la categoría y el país del destinatario determinan la tarifa.

### 6.2 Lo que es GRATIS
1. **Conversaciones de servicio: gratis e ilimitadas.** Cuando el usuario escribe primero, se abre una ventana de servicio de 24h; todos tus mensajes de texto libre dentro de ella son gratis. *(Historia del "límite de 1,000": hasta oct-2024 Meta regalaba 1,000 conversaciones de servicio POR MES por WABA; desde nov-2024 eliminó el cap — ahora es ilimitado. Eso es lo que viste.)*
2. **Plantillas utility DENTRO de la ventana de 24h: gratis.**
3. **Free Entry Point (FEP):** si el usuario llega por un anuncio Click-to-WhatsApp o botón CTA de página de Facebook y respondes en 24h, se abre una ventana de **72h donde TODO es gratis** (incluidas plantillas de cualquier categoría).

→ **El flujo core de NovTurnIA (paciente escribe → bot agenda) opera 100% en territorio gratis.**

### 6.3 Lo que se PAGA — rate card para Guatemala
Guatemala pertenece a la región **"Rest of Latin America"** (junto a Bolivia, Costa Rica, R. Dominicana, Ecuador, El Salvador, Honduras, Haití, Jamaica, Nicaragua, Panamá, Paraguay, Puerto Rico, Uruguay, Venezuela). Tarifas vigentes (card efectivo **1-jul-2026**, verificado en dos réplicas independientes del card oficial):

| Categoría | USD/mensaje entregado | Uso típico en NovTurnIA |
|---|---|---|
| **Utility** | **$0.0130** | Recordatorios/confirmaciones de cita fuera de ventana |
| **Authentication** | **$0.0130** | OTPs (no aplica hoy) |
| **Marketing** | **$0.0851** | Promociones/ofertas (módulo dynamic_pricing) |

- **Tiers de volumen:** utility y authentication tienen descuentos por volumen (se agregan a nivel portfolio, reset mensual). A tu escala inicial no aplican; a 100+ clientes con Modelo B sí sumarían.
- ⚠️ El card oficial se descarga en [whatsappbusiness.com/products/platform-pricing](https://whatsappbusiness.com/es-la/products/platform-pricing/) (CSV/PDF por moneda). Meta lo actualiza ~anualmente — revisar cada semestre.

### 6.4 Ejemplos concretos
| Escenario | Costo/mes |
|---|---|
| Cliente Básico: solo bot reactivo (servicio) | **$0.00** |
| Cliente Pro: bot + 500 recordatorios utility fuera de ventana | **$6.50 ≈ Q50** |
| Cliente Enterprise: bot + 2,000 recordatorios + 500 marketing | $26 + $42.55 = **$68.55 ≈ Q528** |

---

## 7. Verificación de la implementación actual de NovTurnIA

Auditado contra el esquema real de la DB y el flujo n8n (v44):

| Aspecto | Estado | Detalle |
|---|---|---|
| Número propio por tenant | ✅ Correcto | `businesses.phone_number_id` (NOT NULL) por negocio — tu perspectiva original era la correcta; no todos hablan a un solo número. |
| Token por tenant | ✅ Funcional / ⚠️ mejorable | `businesses.whatsapp_token` en texto plano. Migrar a Supabase Vault sigue pendiente (decisión deliberada para no romper n8n — mantenerla en el radar). |
| Ruteo multi-tenant del webhook | ✅ Correcto | Un solo webhook de app; n8n resuelve el tenant por `metadata.phone_number_id` del payload. Es el patrón oficial para apps multi-WABA — no cambia al migrar al Modelo A. |
| Aislamiento de datos (RLS) | ✅ Auditado | Ver `docs/Auditoria Tecnica Multi-Tenant.md` — políticas por `business_id` en todas las tablas, hoyos críticos corregidos 2026-07-03/04. |
| Alta de número en onboarding | ✅ Compatible | `AdminOnboarding.jsx` acepta `phone_number_id`/`whatsapp_token` opcionales (se configuran tras aprobar el número en Meta); editable después en `AdminPanel.jsx` tab "Horario + IA". |
| Costos de plantillas | ⚠️ Decisión pendiente | Hoy (Modelo B) las pagarías tú. Tope incluido por plan + migración a Tech Provider ≥15 clientes (§4). |

**Conclusión:** tu implementación es correcta para el Modelo B actual y — punto clave — **ya es estructuralmente compatible con el Modelo A** (Tech Provider devuelve exactamente `waba_id` + `phone_number_id` + token). No hay deuda arquitectónica que corregir; solo una decisión comercial de cuándo migrar.

---

## Fuentes

**Oficiales de Meta:**
- Pricing (modelo por mensaje, vigente): <https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing>
- Pricing por conversación (deprecado, referencia histórica): <https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing/>
- Actualizaciones de pricing: <https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/>
- Calculadora/rate cards oficiales: <https://whatsappbusiness.com/es-la/products/platform-pricing/>
- Cuentas de WhatsApp Business (WABA): <https://developers.facebook.com/documentation/business-messaging/whatsapp/whatsapp-business-accounts>
- Números de teléfono (límites 2→20, requisitos): <https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers>
- Embedded Signup (onboarding de clientes, límites 10→200/semana): <https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview>
- Tech Provider program: <https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers>

**Réplicas del rate card oficial (verificación cruzada de tarifas RestLatAm):**
- SleekFlow Help: <https://help.sleekflow.io/en_US/whatsapp/pricing>
- Gallabox Docs: <https://docs.gallabox.com/pricing-and-billing-modules/new-per-message-pricing>
