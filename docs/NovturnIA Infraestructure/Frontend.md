# Frontend — Auditoría Oficial (2026-07-11)

> **Documento oficial** — cierra el último sector pendiente de auditar (infra ✅, negocio/límites ✅, bot n8n ✅, multi-tenant ✅). **Método:** revisión estática exhaustiva de `src/` (greps dirigidos + lectura de los módulos núcleo: `App.jsx`, `useAuth`, `usePlanLimits`, `usePermissions`, `useRealtime`, `supabaseService`, `adminService`, `vite.config.js`). Sin credenciales de login no se hizo click-through autenticado — los hallazgos son de código, no de comportamiento observado en sesión.
> Stack: React **19.2** + Vite, react-router **7**, Zustand **5**, @supabase/supabase-js **2.98**, Tailwind 3.4 + glass morphism, recharts 3.8, lucide.

---

## 1. Resumen ejecutivo

**El frontend está en buen estado — arquitectura disciplinada y sorprendentemente limpio.** La deuda es puntual (8 hallazgos, 2 de ellos ya conocidos del Modelo de Negocio) y ninguna es bloqueante para vender. La brecha más relevante no es un bug sino una ausencia: **resiliencia de red** (sin retry/backoff — un parpadeo de red se convierte en error visible).

| Área | Estado |
|---|---|
| Arquitectura (Pages→Hooks→Service→Supabase; store solo UI/auth) | ✅ disciplinada, sin fugas del cliente Supabase fuera del service |
| Higiene de código (console.log / XSS / dead code) | ✅ **0** `console.log`, **0** `dangerouslySetInnerHTML` |
| Code-splitting y arranque | ✅ TODAS las rutas lazy + `Suspense`; `manualChunks` en Vite; sourcemaps off en prod |
| Manejo de errores global | ✅ `ErrorBoundary` de clase en la raíz |
| Auth | ✅ `onAuthStateChange` + `getSession`, signOut defensivo en estados inválidos; fix del navigator-lock de gotrue en `adminService` (fetch directo + `AbortController` + timeout) |
| Realtime | ✅ canales con cleanup (`removeChannel` al desmontar), filtrados por `business_id` |
| Gating de plan/permisos | ✅ `usePlanLimits` (SAFE_DEFAULTS anti-flash premium) + `FeatureLock` en 12+ páginas + `usePermissions` DB-driven con redirects |
| Datos | ✅ paginación `.range()` en listas pesadas, `limit` en embebidos, RPCs para agregados (nunca agrega tablas crudas en cliente) |
| Resiliencia de red | 🔴 sin retry/backoff/circuit breaker (F-4) |

## 2. Lo que está bien (evidencia — conservar como estándar)

1. **Service layer único:** 96 funciones exportadas en `supabaseService.js` (1,726 líneas) — todo acceso a datos pasa por ahí; los componentes jamás tocan el cliente Supabase directo. `adminService.js` aparte para Edge Functions con timeout duro (20-30s) y `AbortController` (el fix del alta "trabada").
2. **Anti-flash de contenido premium:** `usePlanLimits` devuelve `SAFE_DEFAULTS` con `hasFeature: () => false` mientras carga — nunca se ve contenido desbloqueado por un instante. Cache en Zustand con invalidación al cambiar de sesión e inflight-dedupe.
3. **RBAC en su sitio:** los permisos viven SOLO en `staff_roles.permissions` (DB); `usePermissions` los deriva; las rutas sensibles redirigen; los botones se gatean por permiso (patrón documentado y seguido en el módulo nuevo de Categorías).
4. **Bundle cuidado:** rutas 100% lazy, `manualChunks` separando vendors pesados (recharts), `sourcemap: false`.
5. **`.env` limpio:** solo `VITE_SUPABASE_URL` + anon key (públicas por diseño de Supabase) — ningún secreto real en el bundle.
6. **Realtime correcto:** suscripciones por página con cleanup; callbacks refrescan estado local en vez de duplicar estado global.

## 3. Hallazgos (F-#; los H-# vienen de la auditoría de límites del Modelo de Negocio)

> **Actualización 2026-07-11:** F-1, F-2 y F-8 resueltos; F-3 re-auditado y cerrado como N/A (detalle en cada fila). Verificación: `npm run build` limpio.

| # | Sev | Hallazgo | Fix |
|---|---|---|---|
| F-1 (=H4) | ✅ | **RESUELTO + re-auditado:** no existía botón de crear usuario en la UI (el `addUser` del hook está huérfano) — el hueco REAL era que `manage-staff` (service_role → trigger exento) no chequeaba `max_staff`: el límite de staff no se aplicaba en la única vía de creación | Check de límite en la Edge (`get_effective_limit` + conteo, 409 amable) → **v8 desplegada**; Users.jsx muestra `X/Y usuarios del plan` |
| F-2 (=H8) | ✅ | **RESUELTO:** la variable correcta era `maxPatients` (el límite que recorta los chats visibles vía `get_visible_patient_ids`), no `conversationsUsed` como se propuso inicialmente | `maxPatients` + texto "(límite del plan)" |
| F-3 | ✅ | **Re-auditado — hallazgo sobreestimado, cerrado N/A:** `AdminOnboarding` solo hardcodea los ids de tier (`['basic','pro','enterprise']`), sin precios ni límites → no hay desync posible con la v3 | Ninguno necesario |
| F-4 | ✅ | **RESUELTO 2026-07-11:** `utils/withRetry.js` (3 intentos, backoff exponencial, SOLO errores transitorios) + adaptador `retryRead` (supabase-js no lanza errores de red — los relanza para reintentar). Aplicado a las 4 lecturas calientes: `getAppointmentsByWeek`, `getPatients`, `getFinanceSummary`, `getPlanLimits`. Solo lecturas, jamás escrituras | Circuit breaker completo queda como mejora futura |
| F-5 | ✅ | **RESUELTO 2026-07-11:** `ui/ConfirmDialog.jsx` (glass, portal, loading/danger) reemplaza los 4 `window.confirm` nativos — 0 restantes en el código | — |
| F-6 | 🟡 | **Sentry sin configurar en prod** (`VITE_SENTRY_DSN` no seteado en Vercel) — errores de clientes reales invisibles | [TÚ] setear DSN + sourcemaps ocultos (Auditoría §11) |
| F-7 | 🟡 | Contadores de uso de conversaciones muestran **siempre 0** — no es bug del front: `conversations_used` lee `usage_counters` vacía (H1 backend). Al cerrar H1 el front funciona sin cambios | Se resuelve solo con H1 |
| F-8 | ✅ | **RESUELTO 2026-07-11:** `createPatient` y `createAppointment` mapean `error.hint PLAN_LIMIT_*` → mensaje de upgrade amable (cubre la carrera de dos pestañas) | Aplicado en `supabaseService.js` |

**Bugs históricos ya corregidos (no reabrir):** "se levantan los componentes" al seleccionar chat (scrollIntoView → scrollTop del contenedor, fix 2026-07), alta de tenant "trabada" (navigator lock de gotrue → fetch directo con timeout), 406 del super-admin (`maybeSingle`).

## 4. Orden recomendado

1. **F-3 + UPDATE v3** juntos (coherencia de precios al crear tenants).
2. **F-1** (única brecha del gating UX de límites).
3. **F-4** (la mejora de robustez de mayor impacto real para clientes).
4. F-8 → F-5 → F-2 (pulido).
5. F-6 al facturar el primer cliente (junto con Vercel Pro).

**Pendiente de verificación manual [TÚ]:** click-through autenticado general (login → cada módulo) tras los próximos cambios — esta auditoría es estática.
