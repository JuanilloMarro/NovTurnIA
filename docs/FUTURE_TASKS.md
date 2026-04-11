# NovTurnAI — Tareas Futuras & Deuda Técnica

> Documento generado 2026-04-02. Actualizar conforme se resuelvan items.
> Prioridades: 🔴 Crítica · 🟠 Alta · 🟡 Media · 🟢 Baja

---

## Índice

1. [Base de Datos & SQL](#1-base-de-datos--sql)
2. [Seguridad](#2-seguridad)
3. [Arquitectura Frontend](#3-arquitectura-frontend)
4. [Rendimiento Frontend](#4-rendimiento-frontend)
5. [Calidad de Código](#5-calidad-de-código)
6. [Observabilidad & Monitoreo](#6-observabilidad--monitoreo)
7. [UX & Accesibilidad](#7-ux--accesibilidad)
8. [Infraestructura & DevOps](#8-infraestructura--devops)

---

## 1. Base de Datos & SQL

### 1.1 🟠 Migrar `appointments` a UUID v7

**Problema:** `appointments.id` usa `gen_random_uuid()` (UUID v4), que genera valores aleatorios. Cada INSERT escribe en una página aleatoria del B-tree, causando:
- Page splits frecuentes → fragmentación del índice
- Cache miss en disco: lecturas no secuenciales
- JOINs más lentos: comparar 16 bytes (UUID) vs 4 bytes (INT)

**Cuándo actuar:** Cuando `appointments` supere **~50k filas**.

**Solución:**
```sql
-- 1. Habilitar extensión
CREATE EXTENSION IF NOT EXISTS "pg_uuidv7";

-- 2. Cambiar el default (solo afecta rows nuevos)
ALTER TABLE appointments
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();
```

**Consideraciones:**
- Verificar que `pg_uuidv7` esté disponible en tu plan de Supabase
- Los UUIDs existentes NO necesitan migración, solo los nuevos serán v7
- Evaluar lo mismo para `patients` si crece significativamente
- `history` y `audit_log` son tables de append-only — UUID v7 les beneficiaría aún más

**Esfuerzo:** Medio (requiere validar extensión, testear en staging)

---

### 1.2 🟡 Agregar `business_id` directo a `patient_phones`

**Problema:** Las policies RLS de `patient_phones` requieren una subquery correlacionada:
```sql
EXISTS (
  SELECT 1 FROM patients p
  WHERE p.id = patient_phones.patient_id
  AND p.business_id = get_user_business_id()
)
```
Esto se ejecuta por cada fila y hace un JOIN implícito a `patients`.

**Solución:** Agregar `business_id` directamente a `patient_phones`:
```sql
ALTER TABLE patient_phones ADD COLUMN business_id INTEGER REFERENCES businesses(id);
UPDATE patient_phones pp SET business_id = (SELECT p.business_id FROM patients p WHERE p.id = pp.patient_id);
ALTER TABLE patient_phones ALTER COLUMN business_id SET NOT NULL;
CREATE INDEX idx_patient_phones_business ON patient_phones(business_id);
```

Luego simplificar la policy:
```sql
CREATE POLICY "Staff can view patient phones" ON patient_phones
  FOR SELECT USING (business_id = get_user_business_id());
```

**Esfuerzo:** Bajo-Medio (migración SQL + actualizar INSERTs en frontend)

---

### 1.3 🟡 ~~[PARCIAL]~~ Consolidar queries de `useStats.js` en una sola RPC

**Estado:** Parcialmente completado (2026-04-10). Las vistas materializadas ahora se consultan via `get_business_stats()` y `get_patient_stats()` (SECURITY DEFINER, acceso directo revocado). Quedan 3 queries directas: turnos del mes actual, conteos de mensajes, y tendencia de 6 meses.

**Problema original:** `useStats.js` hacía **7 queries paralelas**. Ahora son **4** (7→4 reducido). La mejora pendiente es consolidar las 3 restantes en una sola RPC:

```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  -- Una sola query con CTEs que retorna todo el JSON:
  -- current_month_apts + message_counts + trend_6m
$$;
```

**Beneficios adicionales al completar:**
- 4 roundtrips → 1 roundtrip
- RLS evaluada una sola vez

**Esfuerzo:** Medio (escribir la función SQL con CTEs, adaptar `useStats.js`)

---

### 1.4 ✅ ~~Agregar índice parcial para pacientes activos~~ (YA EXISTÍA)

**Verificado (2026-04-10):** El índice `idx_patients_business` ya existe con `WHERE (deleted_at IS NULL)`:
```sql
CREATE INDEX idx_patients_business ON public.patients USING btree (business_id)
WHERE (deleted_at IS NULL);
```
No requiere acción.

---

### 1.5 ✅ ~~Auditar índices faltantes en tablas de alto tráfico~~ (COMPLETADO — YA EXISTÍAN)

**Verificado (2026-04-10):** Todos los índices críticos ya existían. Inventario actual:

| Tabla | Índices relevantes |
|---|---|
| `appointments` | `idx_appt_business_date (business_id, date_start, status)`, `idx_appt_patient (patient_id, status)`, `no_overlapping_appointments` (GIST exclusion) |
| `patients` | `idx_patients_business (business_id) WHERE deleted_at IS NULL`, `idx_patients_name_trgm` (GIN trigram), `idx_patients_takeover` |
| `notifications` | `idx_notifications_business_created`, `idx_notifications_unread WHERE read = false` |
| `audit_log` | `idx_audit_business (business_id, created_at DESC)`, `idx_audit_record` |
| `history` | `idx_history_lookup (business_id, patient_id, created_at DESC) INCLUDE (role, content)` |
| `staff_users` | `idx_staff_users_business WHERE active = true` |

No requiere acción adicional.

---

### 1.6 🟢 Particionar `history` y `audit_log` por mes

**Problema:** Estas tablas son append-only y crecerán indefinidamente. Sin particionamiento, las queries full-scan se degradarán.

**Solución:** Usar particionamiento nativo de PostgreSQL por rango de `created_at`, con particiones mensuales.

**Cuándo actuar:** Cuando `history` supere ~500k filas.

**Esfuerzo:** Alto (requiere recrear la tabla como particionada, migrar datos)

---

## 2. Seguridad

### 2.1 ✅ ~~Mover credenciales de Supabase a variables de entorno~~ (COMPLETADO 2026-04-02)

**Problema:** `supabase.js` tiene la URL y anon key hardcodeados:
```js
// config/supabase.js líneas 3-4
const SUPABASE_URL = 'https://kwpaaqdkklwwfslhkqpb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
```
Están commiteados en Git. Aunque la anon key es pública por diseño en Supabase, el project ID (`kwpaaqdkklwwfslhkqpb`) quedó expuesto en el historial de Git de forma permanente. Esto dificulta rotar credenciales y hace imposible tener múltiples entornos (dev/staging/prod) sin modificar código.

**Solución:**
```bash
# .env
VITE_SUPABASE_URL=https://kwpaaqdkklwwfslhkqpb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
```js
// config/supabase.js
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

Agregar `.env` a `.gitignore` y crear `.env.example` con placeholders.

**Esfuerzo:** Bajo (10 min)

---

### 2.2 ✅ ~~Deshabilitar `?bid=` override en producción~~ (COMPLETADO 2026-04-03)

**Resuelto:** `config/supabase.js` ahora solo lee `?bid=` de la URL cuando `import.meta.env.DEV` es `true`. En builds de producción, el valor siempre se establece desde el perfil autenticado via `setBusinessId()` en `useAuth.js`.

---

### 2.3 ✅ ~~RBAC completamente del lado del cliente (MAIN_ROLES hardcodeado)~~ (COMPLETADO 2026-04-03)

**Resuelto:** Eliminado el array `MAIN_ROLES = ['dentist', 'barber', ...]` de `usePermissions.js`. Todos los permisos ahora se derivan **únicamente** del campo `permissions` en la columna de `staff_roles` en la DB. No existe ningún rol "especial" en el frontend. Si un rol necesita todos los permisos, éstos deben estar seteados en su registro de DB.

---

### 2.4 ✅ ~~Subscription leak en `onAuthStateChange` + TOKEN_REFRESHED no manejado~~ (COMPLETADO 2026-04-03)

**Resuelto:** `initializeAuth` en `useAuth.js` ahora retorna el objeto `subscription`. `App.jsx` almacena la referencia y llama `subscription.unsubscribe()` en el cleanup del `useEffect`. Además, se agregó manejo de los eventos `TOKEN_REFRESHED` y `SIGNED_IN` para re-fetch del perfil cuando Supabase rota el JWT automáticamente.

---

### 2.5 ✅ ~~`deletePatient` era hard delete~~ (COMPLETADO 2026-04-03)

**Resuelto:** `deletePatient` en `supabaseService.js` ahora hace soft delete (`.update({ deleted_at: ... })`) en lugar de `.delete()`. El historial de turnos, conversaciones y audit trail del paciente se preserva. `getPatients` ya filtraba `.is('deleted_at', null)`, por lo que el paciente desaparece del listado sin borrar datos.

---

### 2.6 ✅ ~~Headers de seguridad faltantes~~ (COMPLETADO 2026-04-03)

**Resuelto:** Agregado `Content-Security-Policy` en `vercel.json`. Los demás headers (`X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Referrer-Policy`, `X-XSS-Protection`) ya estaban presentes. El CSP restringe scripts/estilos al origen, y `connect-src` limita las conexiones a `*.supabase.co` únicamente.

---

### 2.7 ✅ ~~RLS deshabilitado en `message_buffer` y `api_rate_limits`~~ (COMPLETADO 2026-04-10)

**Resuelto:** Ambas tablas tenían RLS deshabilitado, exponiéndolas a cualquier usuario autenticado via PostgREST. Habilitado RLS sin policies (deny all para `authenticated`/`anon`). Las funciones `SECURITY DEFINER` (`reactivate_bot`, triggers) siguen accediendo normalmente al bypassear RLS.

---

### 2.8 ✅ ~~Materialized views expuestas sin control de tenant~~ (COMPLETADO 2026-04-10)

**Resuelto:** `mv_business_stats` y `mv_patient_stats` eran accesibles por cualquier usuario autenticado (las MV no soportan RLS). Se revocó `SELECT` de `anon` y `authenticated`, y se crearon dos RPCs `SECURITY DEFINER`:
- `get_business_stats()` → reemplaza acceso directo a `mv_business_stats`
- `get_patient_stats()` → reemplaza acceso directo a `mv_patient_stats`

El frontend (`getStatsOverview`) migrado a `.rpc()`.

---

### 2.9 ✅ ~~Políticas RLS duplicadas con dos funciones distintas~~ (COMPLETADO 2026-04-10)

**Resuelto:** Cada tabla tenía dos sets de políticas PERMISSIVE usando `get_user_business_id()` y `get_my_business_id()` respectivamente — Postgres las combina con OR, duplicando el costo de evaluación. Se eliminaron las 8 políticas `*_own_business` (las que usaban `get_my_business_id()`). Ahora cada tabla tiene una sola política canónica por operación.

---

### 2.10 ✅ ~~`SET search_path` faltante en todas las funciones~~ (COMPLETADO 2026-04-10)

**Resuelto:** Las 6 funciones flaggeadas por el security advisor fueron actualizadas con `SET search_path = ''` y nombres de tabla schema-qualified (`public.staff_users`, `public.appointments`, etc.): `get_user_business_id`, `get_my_business_id`, `reactivate_bot`, `handle_audit_log`, `trigger_add_notification`, `trigger_set_updated_at`, `prevent_mass_delete`.

---

### 2.11 ✅ ~~Unicidad de teléfono cross-tenant~~ (COMPLETADO 2026-04-10)

**Resuelto:** `patient_phones.phone` tenía dos índices únicos globales (`uq_phone` constraint + `idx_phones_phone`), impidiendo que el mismo número de teléfono existiera en dos negocios distintos. Se eliminaron ambos y se reemplazaron por `uq_phone_per_patient UNIQUE(patient_id, phone)` — la unicidad es ahora por paciente, no global.

---

### 2.12 ✅ ~~`get_user_business_id` sin `active = true` y recursión RLS~~ (COMPLETADO 2026-04-10)

**Resuelto:** La función no filtraba `active = true`, permitiendo que usuarios desactivados pudieran pasar el check de RLS. Corregido. Además, al cambiar a `SECURITY INVOKER` se generó recursión infinita (la función consultaba `staff_users` desde dentro de una policy de `staff_users`). Corrección: ambas funciones helper de RLS (`get_user_business_id`, `get_my_business_id`) son ahora `SECURITY DEFINER` — estándar recomendado por Supabase para este patrón.

---

### 2.13 ✅ ~~Timezone hardcodeado en frontend y trigger~~ (COMPLETADO 2026-04-10)

**Resuelto:** `toISO()` en `supabaseService.js` hardcodeaba `-06:00` (Guatemala) para todos los negocios. Reemplazado por una función que cachea el timezone IANA del negocio desde la DB y usa `Intl.DateTimeFormat` para calcular el offset UTC real (con soporte de DST). El trigger `trigger_add_notification` también hardcodeaba `'America/Guatemala'`; ahora lee el campo `timezone` de la tabla `businesses`.

---

### 2.14 ✅ ~~Double-write en `updatePatient`~~ (COMPLETADO 2026-04-10)

**Resuelto:** La función hacía un `upsert` de teléfono dentro de `Promise.all` y luego volvía a hacer `update` + posible `insert` del mismo teléfono. Eliminado el upsert del `Promise.all`. La lógica es ahora secuencial y sin duplicación: actualizar paciente → update teléfono → insert si no existía.

---

### 2.15 🟠 Refactorizar fuente de `BUSINESS_ID` — eliminar filtro `?bid=` redundante del frontend

**Problema:** Casi TODAS las queries en `supabaseService.js` tienen `.eq('business_id', BUSINESS_ID)` — se encontraron **27 ocurrencias**. Pero RLS ya filtra por `business_id` en el servidor.

El filtro del frontend es una defensa en profundidad válida, PERO:
- El `BUSINESS_ID` global mutable (`export let BUSINESS_ID = ...`) es frágil
- Si el usuario manipula `?bid=X` en la URL, podría intentar ver otro business (RLS lo bloquea, pero aún genera queries innecesarias)
- Complica la lógica: ¿quién es la fuente de verdad, el frontend o RLS?

**Solución propuesta:**
1. **Fase 1:** Arreglar la fuente — leer `business_id` del store en lugar del `export let` mutable:
```js
// Actual (frágil): export let BUSINESS_ID = parseInt(new URLSearchParams(...))
// Correcto: derivarlo del perfil autenticado en cada llamada
const { profile } = useAppStore.getState();
const BUSINESS_ID = profile?.business_id;
```
2. **Fase 2:** Mantener `.eq('business_id', ...)` en todas las queries como defensa en profundidad — **no removerlo**. El riesgo no es el filtro en sí, sino su fuente mutable.

> **Nota:** La Fase 3 original (remover el filtro del frontend confiando solo en RLS) se descarta — eliminaría la defensa en profundidad sin beneficio tangible.

**Esfuerzo:** Medio (refactor gradual)

---

### 2.16 🔴 Migrar `businesses.id` de INTEGER a UUID

**Problema:** El ID de tenant es un entero secuencial (`1`, `2`, `3`...) expuesto en la URL como `?bid=1`. Esto permite:
- **Enumeración de tenants**: un competidor puede inferir cuántos clientes tiene el SaaS y en qué orden se registraron
- **Fuzzing dirigido**: aunque RLS protege los datos, el parámetro enumerable facilita ataques de fuerza bruta a RLS

**Solución:** Migrar `businesses.id` a UUID y actualizar todos los FK que dependen de él:

```sql
-- 1. Agregar columna UUID a businesses
ALTER TABLE public.businesses ADD COLUMN uuid_id UUID DEFAULT gen_random_uuid() NOT NULL;

-- 2. Agregar columnas uuid_id en cada tabla con FK
ALTER TABLE public.appointments   ADD COLUMN business_uuid UUID;
ALTER TABLE public.patients       ADD COLUMN business_uuid UUID;
ALTER TABLE public.staff_users    ADD COLUMN business_uuid UUID;
ALTER TABLE public.staff_roles    ADD COLUMN business_uuid UUID;
ALTER TABLE public.services       ADD COLUMN business_uuid UUID;
ALTER TABLE public.history        ADD COLUMN business_uuid UUID;
ALTER TABLE public.notifications  ADD COLUMN business_uuid UUID;
ALTER TABLE public.audit_log      ADD COLUMN business_uuid UUID;

-- 3. Backfill desde businesses.uuid_id
UPDATE public.appointments  a SET business_uuid = b.uuid_id FROM public.businesses b WHERE b.id = a.business_id;
-- (repetir para cada tabla)

-- 4. Agregar NOT NULL, FKs, y reemplazar columnas
-- 5. Actualizar policies RLS y funciones helper
-- 6. Actualizar frontend: setBusinessId() recibe UUID, URL usa UUID
```

**Consideraciones:**
- Requiere staging/branching en Supabase para no afectar producción durante la migración
- Las RLS policies y funciones `get_user_business_id()` / `get_my_business_id()` deben actualizarse para usar UUID
- El frontend debe dejar de exponer el ID en la URL (derivar del perfil autenticado solamente)

**Cuándo actuar:** Antes de onboarding masivo de clientes — más difícil de migrar con datos en producción.

**Esfuerzo:** Alto (migración multi-tabla + frontend + validar RLS)

---

### 2.17 🟡 `createStaffUser`: polling sin rollback si el trigger falla

**Problema:** La función `createStaffUser` en `supabaseService.js` crea un usuario en `auth.users` vía `supabase.auth.signUp()` y luego espera con backoff exponencial (hasta 5 reintentos) a que el trigger `handle_new_staff_user` cree el row en `staff_users`. Si el trigger falla silenciosamente (error en la función del trigger, constraint violation, etc.):
- El usuario queda creado en `auth.users` (puede autenticarse)
- Pero NO existe en `staff_users` (RLS lo bloquea todo → app completamente rota para ese usuario)
- El polling agota el tiempo y lanza error al administrador, pero el usuario auth ya fue creado y no se revierte

**Solución propuesta:**
1. Reemplazar el trigger por una **Edge Function** `create-staff-user` que use el service role:
   - Crea el usuario en `auth.users`
   - Inmediatamente inserta en `staff_users` en la misma transacción lógica
   - Si algo falla, hace rollback y retorna error limpio
2. O bien, agregar una **función RPC SECURITY DEFINER** que haga ambas operaciones atómicamente y sea llamada por el dashboard en lugar de `supabase.auth.signUp()` directamente

```sql
-- Alternativa RPC (requiere service_role o privilegios elevados para insertar en auth.users)
CREATE OR REPLACE FUNCTION public.create_staff_user(
  p_email TEXT, p_full_name TEXT, p_role_id INTEGER, p_business_id INTEGER
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id UUID;
BEGIN
  -- Insertar en auth.users via función de Supabase (disponible en versiones recientes)
  -- Luego insertar en staff_users en la misma transacción
  -- Si algo falla, todo hace rollback automáticamente
END;
$$;
```

**Esfuerzo:** Medio-Alto (requiere Edge Function o evaluar API de Supabase Auth admin)

---

### 2.18 🟡 Rate limiting en `createStaffUser`

**Problema:** `createStaffUser` hace `supabase.auth.signUp()` sin throttling. Un usuario malicioso con acceso podría crear usuarios masivamente.

**Solución:** Implementar un rate limiter client-side + verificar en Supabase Auth las configuraciones de rate limit del proyecto.

**Esfuerzo:** Bajo

---

## 3. Arquitectura Frontend

### 3.1 🟠 Centralizar Supabase queries con un `useQuery`-like pattern

**Problema:** Cada hook (`usePatients`, `useAppointments`, `useUsers`, `useStats`) reimplementa manualmente:
- Loading state
- Error handling
- Data caching (solo `usePatients` lo tiene)
- Stale detection
Esto lleva a inconsistencias y duplicación de lógica.

**Solución:** Adoptar **TanStack Query (React Query)** o crear un hook genérico `useSupabaseQuery`:
```js
const { data, loading, error, refetch } = useSupabaseQuery('patients', () => getPatients(search));
```

**Beneficios:**
- Cache automático con stale-while-revalidate
- Deduplicación de requests
- Retry automático
- Window focus refetching
- Elimina ~60% del boilerplate en hooks

**Esfuerzo:** Alto (refactor de todos los hooks, pero valor enorme)

---

### 3.2 🟡 Separar Realtime subscriptions del render cycle

**Problema:** `useRealtime.js` crea un Supabase channel por cada componente que lo consume. Si `Calendar` y otra vista usan appointments, hay 2 channels abiertos.

**Solución:** Mover las suscripciones a un **subscription manager** singleton fuera de React:
```js
// services/realtimeManager.js
class RealtimeManager {
  subscribe(table, businessId, callback) { ... }
  unsubscribe(table) { ... }
}
```

O usar un `RealtimeProvider` a nivel de `App.jsx` que distribuya eventos.

**Esfuerzo:** Medio

---

### 3.3 🟡 Lazy loading de rutas con `React.lazy()`

**Problema:** `App.jsx` importa TODAS las 8 páginas de forma estática:
```js
import Calendar from './pages/Calendar';
import Patients from './pages/Patients';
import Conversations from './pages/Conversations';
// ... etc
```
Todo se incluye en un solo bundle.

**Solución:**
```js
const Calendar = React.lazy(() => import('./pages/Calendar'));
const Stats = React.lazy(() => import('./pages/Stats'));
// Envolver en <Suspense fallback={<Loader />}>
```

**Beneficios:**
- Reduce el bundle inicial un ~30-40%
- Stats, AuditLog, Users solo se cargan cuando se navega a ellos
- Login no necesita el layout completo

**Esfuerzo:** Bajo (30 min, cambiar imports + agregar Suspense)

---

### 3.4 ✅ ~~Eliminar debounce del search con `window._patientSearchTimeout`~~ (COMPLETADO 2026-04-03)

**Resuelto:** Reemplazado `window._patientSearchTimeout` por `useRef(null)` privado a la instancia del hook. Se agregó un `useEffect` de cleanup que llama `clearTimeout` al desmontar. Además se removió `rawPatients.length` de las dependencias de `useCallback` (reemplazado por `hasDataRef`), eliminando el ciclo potencial que causaba re-fetches al recibir eventos de realtime.

---

## 4. Rendimiento Frontend

### 4.1 ✅ ~~`useStats` hace 7 queries sin cache ni stale detection~~ (COMPLETADO 2026-04-03)

**Resuelto:** `useStats.js` fue refactorizado para:
1. Usar `getStatsOverview()` (vistas materializadas `mv_business_stats` + `mv_patient_stats`) para conteos de pacientes y comparación con mes anterior — reemplazando 2 queries crudas a tablas grandes
2. Agregar cache de 5 minutos en Zustand (`_statsCache`) — navegaciones frecuentes a `/stats` son instantáneas
3. Exponer `reload` para forzar refresco desde la UI si se necesita

De 7 queries + sin cache → 4 queries + cache de 5 min.

---

### 4.2 ✅ ~~`useCallback` con dependencias inestables en `useAppointments`~~ (COMPLETADO 2026-04-02)

**Resuelto:** Se removió `appointments.length` de las dependencias y se reemplazó el loading check con `useRef(hasLoadedRef)`. Elimina el bug de doble-fetch en realtime.

---

### 4.3 ✅ ~~`getPatients` trae todos los turnos sin límite~~ (COMPLETADO 2026-04-02)

**Resuelto:** Se agregó `.order('date_start', { referencedTable: 'appointments', ascending: false }).limit(5, { referencedTable: 'appointments' })` en `supabaseService.js`. Solo trae los 5 turnos más recientes por paciente.

---

### 4.4 ✅ ~~Race condition en `createStaffUser`~~ (COMPLETADO 2026-04-02)

**Resuelto:** Se reemplazó el `setTimeout(500)` por un retry loop con backoff exponencial (200ms, 400ms, 600ms, 800ms, 1000ms) con máximo 5 intentos y error descriptivo si falla.

---

### 4.5 🟢 Virtualizar lista de pacientes

**Problema:** Si un business tiene 500+ pacientes, el DOM renderiza 500 cards/rows. Con los 5 appointments embebidos, cada card es compleja.

**Solución:** Usar `react-window` o `@tanstack/react-virtual`:
```jsx
<FixedSizeList height={600} itemSize={80} itemCount={patients.length}>
  {({ index, style }) => <PatientCard patient={patients[index]} style={style} />}
</FixedSizeList>
```

**Cuándo actuar:** Cuando un business tenga >200 pacientes.

**Esfuerzo:** Medio

---

## 5. Calidad de Código

### 5.1 ✅ ~~Limpiar `console.log` de debugging~~ (COMPLETADO 2026-04-02)

**Resuelto:** Se eliminaron 3 `console.log` de debug en `useUsers.js` y 3 `.subscribe()` con logging en `useRealtime.js` y `useNotifications.js`.

---

### 5.2 🟡 Unificar error handling en `supabaseService.js`

**Problema:** El manejo de errores es inconsistente:
- Algunas funciones hacen `throw error` (el objeto Supabase crudo)
- Otras hacen `throw new Error('mensaje en español')`
- Algunas loguean con `console.error` antes del throw, otras no

**Solución:** Crear un wrapper uniforme:
```js
function handleSupabaseError(error, userMessage) {
  if (import.meta.env.DEV) console.error('[Supabase]', error);
  throw new Error(userMessage || error.message);
}
```

**Esfuerzo:** Bajo-Medio (refactor sistemático)

---

### 5.3 🟢 Agregar TypeScript gradualmente

**Problema:** Todo el proyecto es JavaScript puro. Con el crecimiento del SaaS, los tipos ayudarían a:
- Prevenir bugs en la capa de datos (shapes de Supabase)
- Documentar contratos entre hooks y componentes
- Mejorar autocomplete y refactoring

**Solución:** Migración gradual empezando por:
1. `supabaseService.js` → `.ts` con tipos de tablas
2. Stores (Zustand soporta types nativamente)
3. Hooks
4. Componentes (última prioridad)

Supabase puede generar tipos automáticamente:
```bash
npx supabase gen types typescript --project-id kwpaaqdkklwwfslhkqpb > src/types/database.ts
```

**Esfuerzo:** Alto (progresivo, no necesita hacerse de golpe)

---

## 6. Observabilidad & Monitoreo

### 6.1 🟡 Agregar error boundary global

**Problema:** Si un componente rompe (ej: un campo inesperado de Supabase), toda la app crashea con pantalla blanca. No hay error boundary.

**Solución:**
```jsx
// components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}
```

Envolver `<App>` y opcionalmente cada página.

**Esfuerzo:** Bajo (1 componente + wrapping)

---

### 6.2 🟢 Tracking de métricas de rendimiento (Web Vitals)

**Problema:** No hay visibilidad de cómo performa la app para los usuarios reales.

**Solución:** Agregar `web-vitals` (ya viene con Vite):
```js
import { onLCP, onFID, onCLS } from 'web-vitals';
onLCP(console.log); onFID(console.log); onCLS(console.log);
```

Y opcionalmente enviar a un analytics ligero como Plausible o PostHog.

**Esfuerzo:** Bajo

---

## 7. UX & Accesibilidad

### 7.1 🟡 Agregar estados de error visibles en las vistas

**Problema:** Los hooks capturan errores pero no los exponen al usuario:
```js
// useAppointments.js
} catch (err) {
    console.error("Error loading appointments:", err);
    // ← el usuario no ve nada, solo no cargan datos
}
```

**Solución:** Cada hook debería exponer un `error` state:
```js
return { data, loading, error, reload };
```
Y los componentes deberían renderizar un `<ErrorState />` cuando `error` no es null.

**Esfuerzo:** Bajo-Medio

---

### 7.2 🟢 Responsive design para la sidebar

**Problema:** `App.jsx` tiene `ml-[240px]` hardcodeado. En móvil, la sidebar ocupa todo el espacio.

**Esfuerzo:** Medio (hacer sidebar colapsable/overlay en mobile)

---

## 8. Infraestructura & DevOps

### 8.1 🟠 Completar la adopción de migraciones versionadas

**Problema:** Ya existen `supabase/migrations/001_enable_rls.sql`, `002_triggers.sql` y `003_notifications.sql`, pero los cambios de schema más recientes (RLS policies, seed data, índices) están en `scripts/` y se aplican manualmente pegando SQL en el Supabase SQL Editor. Esto rompe la cadena de versionamiento.

**Solución:** Mover toda la lógica de `scripts/rls_policies.sql` y futuros cambios de schema a migraciones numeradas en `supabase/migrations/`:
```bash
npx supabase migration new add_rls_policies_v2
npx supabase migration new add_uuid_v7_appointments
npx supabase db push  # Aplica a producción
```

**Acción inmediata:** El próximo cambio de schema (sea UUID v7, índices, o business_id en patient_phones) debe crearse como migración, no ejecutarse manualmente.

**Beneficios:**
- Historial completo en Git
- Rollback posible
- Consistencia garantizada entre entornos

**Esfuerzo:** Bajo por cambio (el setup ya está parcialmente hecho)

---

### 8.2 🟡 Tests E2E mínimos

**Problema:** No hay tests automatizados. Cada cambio se verifica manualmente.

**Solución:** Agregar Playwright o Cypress con 3-5 tests clave:
1. Login → Dashboard carga
2. Crear paciente → aparece en lista
3. Crear turno → aparece en calendario
4. Cambiar vista (día/semana/mes) funciona
5. Logout → redirect a login

**Esfuerzo:** Medio (setup + 5 tests)

---

## Resumen Ejecutivo

_Actualizado 2026-04-10_

| Categoría | ✅ Hecho | 🔴 | 🟠 | 🟡 | 🟢 | Pendiente |
|-----------|---------|---|---|---|---|-----------|
| Base de Datos | 2 | 0 | 1 | 1 | 2 | 4 |
| Seguridad | 12 | 1 | 1 | 2 | 0 | 4 |
| Arquitectura FE | 1 | 0 | 1 | 2 | 0 | 3 |
| Rendimiento FE | 4 | 0 | 0 | 1 | 1 | 2 |
| Calidad de Código | 1 | 0 | 0 | 2 | 1 | 3 |
| Observabilidad | 0 | 0 | 0 | 1 | 1 | 2 |
| UX & Accesibilidad | 0 | 0 | 0 | 1 | 1 | 2 |
| Infra & DevOps | 0 | 0 | 1 | 1 | 0 | 2 |
| **Total** | **20** | **1** | **4** | **11** | **6** | **22** |

### Tareas que requieren mayor cambio de infraestructura

| # | Tarea | Impacto | Esfuerzo | Ref |
|---|-------|---------|----------|-----|
| 1 | **`businesses.id` INTEGER → UUID** | Seguridad SaaS (enumeración de tenants) | Alto — migración de PK + 8 FKs + RLS + frontend | §2.16 |
| 2 | **`createStaffUser` sin rollback atómico** | Usuarios huérfanos en auth sin perfil | Medio-Alto — Edge Function o RPC con service_role | §2.17 |
| 3 | **Migraciones versionadas** | Todos los cambios de schema aplicados manualmente sin historial | Bajo por cambio, desbloqueador para el resto | §8.1 |
| 4 | **UUID v7 en `appointments`** | Rendimiento a escala (50k+ filas) | Medio — validar extensión, solo afecta rows nuevos | §1.1 |
| 5 | **Particionar `history` y `audit_log`** | Queries se degradan sin particionamiento (500k+ filas) | Alto — recrear tablas, migrar datos | §1.6 |
| 6 | **TanStack Query / cache global** | Elimina ~60% del boilerplate de hooks, cache coherente | Alto — refactor de todos los hooks | §3.1 |
| 7 | **Consolidar stats en una sola RPC** | 4 queries → 1 por carga de `/stats` | Medio — CTEs en SQL + adaptar `useStats.js` | §1.3 |
