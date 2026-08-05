# Backlog Maestro — Pendientes

> **Solo pendientes.** Si algo está hecho va a [Backlog - Completadas](Backlog%20-%20Completadas.md). Nada de casillas `[x]`, nada de "cerrado, ver Completadas", nada de histórico.
> **Observaciones, decisiones tomadas, trampas operativas y diseños propuestos NO van acá:** viven en **[Observaciones y Decisiones](Observaciones%20y%20Decisiones.md)**. Leelo antes de trabajar cualquier ítem de n8n — tiene las trampas del API y los diseños de A5 y A7.
> **Responsable:** **[IA]** = aplicable por el asistente vía MCP/API · **[TÚ]** = requiere Vercel/Supabase Studio/Meta/n8n manual · **[MIXTO]** = ambos.
> **Antes de trabajar un ítem, re-medilo.** Varios diagnósticos resultaron falsos o mal atribuidos al ir a tocarlos.

---

## 🚧 Bloqueos vigentes — qué NO puede avanzar y por qué

| # | Qué está trabado | Causa | Quién lo destraba |
|---|---|---|---|
| 1 | **INF-1 · paridad de migraciones** | **120** migraciones de producción sin contraparte en el repo. Sin branch ni PITR (free tier), el repositorio es la única red de seguridad que existe | **[TÚ]** — CLI de Supabase + contraseña de DB |
| 2 | **VER-1 · smoke test de `wa-human-reply` v7** | La ventana de 24h de WhatsApp está cerrada (hace falta que un cliente escriba primero) | **[TÚ]**, cuando se abra |
| 3 | **OPS-1 · credencial de WhatsApp sandbox** | Los nodos `WA - Respuesta *` firman con una credencial que Meta rechaza (`GraphMethodException 100/33`) | **[TÚ]** |
| 4 | **EDGE-4 · allowlist de CORS** | Falta el origen exacto de Vercel | **[TÚ]** — pasarme el dominio |

---

## P0 — Bloqueantes y vulnerabilidades abiertas

- [ ] **[TÚ] INF-1 · Reproducibilidad: faltan 120 migraciones en el repositorio** — ➡️ **el delta ya está medido y nombrado, migración por migración, en [INF-1 - Delta de migraciones.md](INF-1%20-%20Delta%20de%20migraciones.md)**. Deja de ser un número difuso: son 141 en producción contra 39 archivos, 21 coinciden, y las 120 que faltan incluyen Finanzas v2 entera, Centro IA, vouchers, Pipeline, agenda avanzada, dunning y los triggers de límite. Un `db reset` desde este repo **no reconstruye producción**.
  **Cómo cerrarlo** (3 comandos, están en el documento): `supabase link` → `supabase db pull` → `supabase migration list`. `db pull` genera **una** línea base con el esquema completo, que es lo correcto: reconstruir 120 migraciones históricas una por una no aporta nada frente a un baseline que sí reproduce el sistema. Requiere el CLI y la contraseña de la base — por eso es tuyo. *(Infraestructura §2 I1)*
- [ ] **[TÚ] VER-1 · Smoke test de `wa-human-reply` v7** — enviar un mensaje desde Conversaciones y confirmar que llega. Es la única función donde el `requireEnv` nuevo podría fallar **al arrancar** si faltara un secret. Rollback: redesplegar v6. ⛔ Bloqueo 4.
- [ ] **[TÚ] VER-2 · Re-verificar el límite de `max_staff`** — como `manage-staff` devolvía 403 a todo el mundo, el check de `max_staff` **nunca se ejerció de verdad en producción**. Con la v10 desplegada, confirmar a mano que al llegar al tope el alta se rechaza con mensaje amable.
- [ ] **[TÚ] OPS-1 · Credencial de WhatsApp no cubre el número sandbox** — `GraphMethodException 100/33`. ⛔ Bloqueo 5.
- [ ] **[TÚ] OPS-2 · Activar protección de contraseñas filtradas (HIBP)** — ⛔ **Bloqueado por plan**: exige **Pro** y **Custom SMTP**. Se desbloquea si el proyecto sube a Pro (el SMTP puede salir de PROD-11/Resend). Mitigación disponible en free, misma pantalla: subir la longitud mínima de contraseña y exigir clases de caracteres.

---

## P1 — Modelo de negocio: sin esto el costo por cliente no está acotado

*(Modelo de Negocio §8-12)*

**Bloque 1 — medir bien y gastar poco** *(la mitad de DB está cerrada; lo que falta es todo de n8n)*

- [ ] **[TÚ] A5a · Validar y activar el reconciliador de tokens** — el workflow `Tokens - Reconciliación (A5)` (`T44G3h5zETwtXJd2`) está creado e **inactivo**. Correrlo a mano una vez desde la UI, revisar que `Code - Sumar Tokens por Negocio` devuelva un ítem por negocio con cifras razonables, y recién ahí activarlo.
- [ ] **[IA] A5b · Poner en 0 la estimación de tokens del bot** — en los 3 nodos `Uso - Registrar`, dejar `p_tokens_in`/`p_tokens_out` en 0 y agregar `p_direction: "out"`. ⚠️ **Debe hacerse en el mismo momento en que se activa A5a**: si conviven, los tokens se cuentan dos veces; si se hace antes, se dejan de contar. Detalle en [Observaciones y Decisiones §P1](Observaciones%20y%20Decisiones.md).


**Bloque 4 — cobranza**
- [ ] **[TÚ] B5b · Marcar pagado a los negocios existentes** — 1 clic por negocio en AdminPanel, que llama a `record_payment()` y deja el rastro en `payments`. Hoy *Clínica Doc* y *NovTurnIA QA* siguen con `plan_expires_at` en `NULL`. El trigger nuevo solo cubre altas nuevas: cambiarle la fecha de cobranza a un cliente que ya existe es tu decisión, no técnica.

---

## P2 — Infraestructura y base de datos

*(Infraestructura Supabase §8 · Auditoría Técnica §6)*

- [ ] **[TÚ] INF-11 · Migrar `whatsapp_token` a Supabase Vault** — texto plano en 1 de 2 negocios; `supabase_vault` está instalado y sin usar.
- [ ] **[IA] INF-12 · Gate `has_feature()` en políticas de escritura premium** — solo 2 de **116** políticas lo usan, ambas de Centro IA. El resto de módulos premium se gatea únicamente en el frontend. Caso testigo confirmado por `supabase/tests/security/verb_asymmetry_detector.sql`: `ai_chat_messages` tiene `has_feature` en SELECT pero no en DELETE. **Incluye la deuda que dejó INF-2**: cerrar `get_user_business_id`, `is_business_active` y `has_feature` a `anon` exige reescribir antes las ~50 políticas `TO public` que las tienen embebidas.
- [ ] **[IA] INF-14 · Auditoría asíncrona vía `pgmq`** — los triggers de `audit_log` siguen síncronos dentro de la transacción de negocio. Aceptado por volumen actual.

---

## P3 — Edge Functions

*(Auditoría Técnica §5)*

- [ ] **[IA] EDGE-3 · Sin idempotencia en el envío de WhatsApp** — un reintento del cliente tras un corte de red duplica el mensaje al paciente. Blueprint de deduplicación por contenido en ventana de 60s.
- [ ] **[IA] EDGE-4 · `Access-Control-Allow-Origin: *` en las 8 funciones**, incluidas `admin-update-business` y `export-tenant-data`. Con `verify_jwt` no es bypass, pero un comodín sobre un endpoint que exporta los datos completos de un tenant no pasa revisión. ⛔ Bloqueo 6.
- [ ] **[IA] EDGE-5b · Propagar `requireEnv` al resto de funciones** — vive solo en `wa-human-reply` v7; las demás siguen con `Deno.env.get(...)!`, que es una aserción de TypeScript **sin efecto en runtime**. Trabajo mecánico, aprovechar el próximo deploy de cada una.
- [ ] **[TÚ] EDGE-7 · `auth-login` y `create-appointment` están en el repositorio y no desplegadas** — o es código muerto (y se borra) o es un deploy pendiente. Decidir cuál.
- [ ] **[TÚ] EDGE-8 · Verificar/redeployar `onboard-tenant`** — confirmar que el deploy v15 es posterior al cambio que agregó `view_pipeline` a OWNER/SECRETARY. Solo afecta tenants nuevos.

---

## P4 — Frontend responsive

*(Frontend §4 — T1–T31. Todo lo cerrado está en Completadas §16 y §18)*

> **Restricción dura del dueño, vigente para todo lo que sigue:**
> *"si cambiaras estilos asegurate que se apliquen solo en telefono no en dimensiones mas grandes… la idea es que no me toques el estilo del actual"*.
> En la práctica: cada regla nueva va dentro de una media query de pantalla chica o de una variante `max-sm:`, y **se verifica en el CSS compilado**, no en el fuente. El bloque "AJUSTES DE PANTALLA CHICA" de `index.css` es el patrón de referencia, y arriba de él está el contrato de capas.

- [ ] **[IA] T25 · Escalón tipográfico móvil** — **110** usos bajo 10px (10 de 7px, 22 de 8px, 78 de 9px).
  ⚠️ **No aplicar un override global** aunque sea tentador (`.text-\[7px\]{font-size:10px}` en el bloque de teléfono): varios de esos 7px viven dentro de círculos de 14px (`w-3.5 h-3.5`, los pasos numerados del Pipeline) y subirlos los desborda. Es una pasada caso por caso con revisión visual — candidato para una sesión dedicada junto a T30.
- [ ] **[IA] T21b · Reemplazar los `title=""` nativos que quedan** — ⚠️ **la cifra estaba 4× inflada**. Se contaban 226 ocurrencias de `title=`, pero al clasificarlas resulta que **104 son props de componentes propios** (`FeatureLock`, `Card`, `MiniStatCard`…) y no son atributos HTML ni un bug. Los atributos nativos reales son **54**, en ~25 archivos.
  El componente `ui/Tooltip.jsx` ya existe y está adoptado en los avisos de plan, que eran los que más dolían (texto de venta, invisible en táctil). Los 54 restantes son casi todos **etiquetas de botones de solo icono** — "Marcar como leído", "Eliminar notificación", "Borrar mensaje", "Más acciones", "Ver paneles" — que en teléfono no se pueden leer de ninguna forma.
  ⚠️ **No hacerlo de corrido a ciegas.** `Tooltip` envuelve al hijo en un `<span className="inline-flex">`, así que en un contenedor flex **el span pasa a ser el ítem** y las clases de flex que tenga el botón (`flex-1`, `shrink-0`, `w-full`) dejan de aplicar donde aplicaban. Hay que ir módulo por módulo mirando el resultado, o pasarle esas clases al wrapper vía `className`.
- [ ] **[IA] T18 · Calendario mensual en móvil como agenda vertical** — hoy funciona con deslizamiento horizontal (`min-w-[560px]`, 80px por celda). Pasar a agenda vertical sigue siendo mejor UX —se ve el mes entero sin deslizar— pero es **mejora de producto, no defecto**, y toca el módulo más usado del sistema. Conviene decidirlo mirando un diseño.
- [ ] **[TÚ] T29 · Recorrer los 9 módulos autenticados a 375/414/768/834/1024px** — requiere sesión real; ninguna auditoría lo ha podido hacer. El harness de Playwright y el tenant semilla ya existen; falta completar `SEED_*` en `.env.test` y crear el negocio semilla vía `/admin/new-tenant`.
- [ ] **[IA] T30 · Auditoría de consistencia visual** — repasar que botones, paneles y degradados sigan el mismo lenguaje glass. Sesión dedicada, junto con T25.
- [ ] **[IA] T31 · Correr `tests/e2e/responsive-fase1-shell.spec.js`** — quedó escrito y **nunca ejecutado**. La verificación de T1–T5 se hizo a mano en navegador; el spec sigue sin correr. Depende de lo mismo que T29.

---

## P5 — Resiliencia y observabilidad

- [ ] **[IA] RES-2 · Onboarding atómico** — 4 escrituras secuenciales con compensación que solo borra `businesses` y está silenciada con `.catch(() => {})`. Si falla el paso 4 queda un usuario en `auth.users` sin `staff_users`: **login exitoso, dashboard vacío, y el email bloqueado para reintentar**. RPC `provision_tenant` lista *(Auditoría Técnica §2.4)*.
- [ ] **[IA] OBS-1 · Correlation id extremo a extremo** — `set_request_context` + header en el cliente + tag en Sentry con hash de tenant (**no** el uuid). Diseño en *(Auditoría Técnica §3.2)*.
- [ ] **[TÚ] OBS-2 · Sentry en producción** — `VITE_SENTRY_DSN` sin configurar en Vercel; `vite.config.js` sigue con `sourcemap: false` (cambiar a `'hidden'` + subir a Sentry CLI).
- [ ] **[MIXTO] OBS-3 · Métricas SaaS (MRR, churn, LTV, CAC)** — sin instrumentar. Hoy no se puede responder "¿cuánto facturo este mes?" sin contar negocios a mano.
- [ ] **[IA] RES-4 · Rate limiting por tenant en n8n** — hoy es por usuario+negocio (20 msg/h); falta cuota agregada que aísle ráfagas de un tenant ruidoso.
- [ ] **[TÚ] RES-5 · Preview deployments de Vercel apuntan a la DB de producción** — configurar una branch de Supabase. Conecta con INF-1: sin migraciones versionadas no se puede levantar una branch con el modelo real. (Y branching exige plan Pro.)

---

## P6 — Calidad de código

- [ ] **[IA] COD-1 · `cache: 'no-store'` global** — `src/config/supabase.js:14` lo aplica a *todas* las peticiones, anulando el HTTP cache incluso en lecturas idempotentes. **Revisado y NO aplicado, a propósito**: invertir el default introduce riesgo real de lecturas rancias sobre datos clínicos, porque PostgREST no emite `Cache-Control` y el navegador cachea por heurística — que es justo el motivo por el que se agregó. Sobre `POST/PATCH/DELETE` la bandera no hace nada. Cerrarlo bien exige decidir **caso por caso** qué lecturas toleran staleness: es un trade-off de producto, no un bug.
- [ ] **[IA] COD-2b · Bajar los 148 warnings de ESLint** — el linter ya está configurado y en **0 errores**. Los warnings son 48 `no-unused-vars` (imports muertos de refactors viejos), 48 `react-hooks/set-state-in-effect`, 21 `react-refresh/only-export-components` y 17 `exhaustive-deps`. Ninguno rompe nada hoy; conviene bajarlos por módulo, no de corrido, y **`exhaustive-deps` es el que más vale la pena** — una dependencia faltante es estado rancio esperando a pasar.
- [ ] **[IA] COD-6 · Auditoría profunda de permisos por módulo** — verificar que **todas** las acciones tengan permiso en `usePermissions`/`Users.jsx`/DB, no solo las 6 cerradas en la Pesada #3. EDGE-9 (una llave de permiso que no existía en ningún rol) es la prueba de que esta clase de fallo estaba sin barrer.
- [ ] **[TÚ] COD-7 · Testear el sistema de punta a punta** — QA formal con click-through autenticado. Harness Fase A listo. ⏸️ Bloqueado en: crear el negocio semilla vía `/admin/new-tenant` (super-admin, humano) y completar `SEED_*` en `.env.test`.
- [ ] **[TÚ] COD-8 · Versionado de la aplicación** — delimitar metas y features por versión.
- [ ] **[IA] COD-9 · `ui/Modal.jsx` sigue sin usarse** — se conservó como primitiva y se le aplicó el patrón de T27 para que quien lo adopte no reintroduzca el modal recortado. Decidir si se adopta de verdad o se borra.

---

## P7 — Producto y roadmap

**Bot / IA** *(detalle en [Automatización IA - n8n](Automatizacion%20IA%20-%20n8n.md))*
- [ ] **[MIXTO] A4 · Motor de recordatorios (H6)** — confirmado en el workflow activo: **cero `scheduleTrigger`**, el único disparador es `Trigger - WhatsApp`. `reminders` (Pro/Ent) y `auto_confirm` (Ent) **se venden sin motor**. El workflow inactivo de abril tenía uno completo: es rescate, no obra nueva. **Son 2 de los 15 mensajes del presupuesto del modelo de negocio.**
- [ ] **[IA] A7 · `onError` en los 65 nodos que alimentan a otros** — cobertura hoy **73/138**. **Ya no está bloqueado**: A8 existe y está cableado, así que "continuar" dejó de significar "fallar en silencio". Sigue sin admitir una regla en bloque — criterio y caso testigo en [Observaciones y Decisiones §P2](Observaciones%20y%20Decisiones.md).
- [ ] **[IA] A14 · El mensaje del cliente no se guarda al cortarse por límite** — verificado recorriendo el grafo: los gates de límite **son ancestros** de `Historial - Guardar Mensaje Usuario`, así que al cortar, el mensaje nunca llega a guardarse; el dueño ve la notificación pero no qué pidió el cliente. **No es un ajuste**: exige mover los gates después de la resolución del paciente (al cortar todavía no existe `patient_id`), y eso toca el camino principal del bot.
- [ ] **[IA] PROD-3 · Batch semanal automático de Centro IA** — `pg_cron` para `weekly_digest`/`retention`, hoy solo on-demand.
- [ ] **[IA] PROD-4 · Botón "Crear oferta"** que pre-llene el módulo Ofertas desde un insight `content_offer`.
- [ ] **[IA] PROD-5 · Techo de tokens para el bot** — `usage_counters` ya acumula `tokens_in`/`tokens_out` (17 mensajes → 9,071 tokens), pero **nada corta por tokens** y el consumo no se muestra en ninguna pantalla.
- [ ] **[IA] PROD-6 · Reemplazar la heurística Descubrimiento vs Negociación** — el backfill separa las dos primeras etapas por número de mensajes (≥6); con las banderas reales ya disponibles, borrar la aproximación.
- [ ] **[IA] PROD-7 · Memoria semántica pgvector del bot** — diferida por costo de tokens; diseño preservado.

**Finanzas y citas**
- [ ] **[IA] PROD-8 · `appointments.staff_id`** — permitiría asignar profesional al agendar, prerequisito de una agenda multi-silla. La atribución de comisión hoy funciona vía `income_entries.staff_id`.
- [ ] **[IA] PROD-9 · Re-agendación automática al cancelarse un turno** — priorizar clientes en espera para slots liberados.
- [ ] **[IA] PROD-10 · Filtros de período más granulares en Seguimiento.**

**Infraestructura y cobro**
- [ ] **[MIXTO] PROD-11 · Emails transaccionales** — Edge Function `send-email` + Resend sobre `businesses.notification_email` (la columna existe, sin función asociada). Habilita `notification_email`/`gmail_integration`, hoy vendidas sin motor. Disparadores: dunning, alta de tenant, corte por límite. **También destraba OPS-2**, que exige Custom SMTP.
- [ ] **[TÚ] PROD-12 · Stripe** (al pasar ~5 clientes) — `invoice.paid` → `record_payment` → dunning automático.
- [ ] **[TÚ] PROD-13 · Migración a WhatsApp Tech Provider + `waba_id` por negocio** (≥15 clientes) — decisión comercial. **Cambia la estructura de márgenes**: bajo Modelo A el costo de mensajes deja de ser tuyo.
- [ ] **[TÚ] PROD-14 · Web Push para handoffs** — Realtime ya emite el cambio de `human_takeover`; falta service worker + Push API.
- [ ] **[TÚ] PROD-15 · Storage para logo del negocio e imágenes de pacientes** — hoy el bot las ignora. Bucket por tenant con RLS.

**UI grande**
- [ ] **[IA] PROD-16 · Modo oscuro** — `tailwind.config.js` no tiene `darkMode` y hay 0 clases `dark:`. Sin trabajo previo que reutilizar. Sesión dedicada.
