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

### 1.3 🟡 Mover queries de `useStats.js` a una función RPC/View

**Problema:** `useStats.js` hace **7 queries paralelas** al montar la página Stats:
1. Turnos del mes actual
2. Turnos del mes pasado
3. Total pacientes (count)
4. Nuevos este mes (count)
5. Mensajes enviados (count)
6. Mensajes recibidos (count)
7. Tendencia últimos 6 meses

Cada query pasa por RLS individualmente + network roundtrip.

**Solución:** Crear una función RPC en PostgreSQL:
```sql
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_business_id INTEGER)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
  -- Una sola query con CTEs que retorna todo el JSON
$$;
```

**Beneficios:**
- 7 roundtrips → 1 roundtrip
- Las CTEs pueden reutilizar scans
- RLS se evalúa una vez (SECURITY DEFINER)

**Esfuerzo:** Medio (escribir la función SQL, adaptar `useStats.js`)

---

### 1.4 🟢 Agregar índice parcial para pacientes activos

**Problema:** Casi todas las queries de pacientes filtran `deleted_at IS NULL`, pero el índice actual incluye pacientes borrados.

**Solución:**
```sql
CREATE INDEX idx_patients_active
ON patients(business_id, display_name)
WHERE deleted_at IS NULL;
```

**Cuándo actuar:** Cuando haya un volumen significativo de pacientes soft-deleted.

**Esfuerzo:** Bajo (1 línea SQL)

---

### 1.5 🟠 Auditar y crear índices faltantes en tablas de alto tráfico

**Problema:** No hay un inventario de índices actuales. Las queries más frecuentes del sistema probablemente están haciendo sequential scans:

| Query | Columnas filtradas | Índice esperado |
|---|---|---|
| `getAppointmentsByWeek` | `(business_id, date_start)` | Compuesto |
| `getPatientAppointments` | `(patient_id, business_id)` | Compuesto |
| `getNotifications` | `(business_id, created_at)` | Compuesto |
| `markNotificationsRead` | `(business_id, read)` | Compuesto |
| `getAuditLog` | `(business_id, created_at)` | Compuesto |

**Solución:** Verificar con `pg_stat_user_indexes` y crear los faltantes:
```sql
-- Verificar índices existentes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'appointments';

-- Crear los faltantes
CREATE INDEX IF NOT EXISTS idx_appointments_business_date
  ON appointments(business_id, date_start);

CREATE INDEX IF NOT EXISTS idx_appointments_patient
  ON appointments(patient_id, business_id);

CREATE INDEX IF NOT EXISTS idx_notifications_business_read
  ON notifications(business_id, read) WHERE read = false;
```

**Cuándo actuar:** Antes de lanzar a producción real — los índices correctos son fundamentales y baratos de crear antes de tener datos.

**Esfuerzo:** Bajo (verificar + ejecutar SQL)

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

### 2.7 🟠 Refactorizar fuente de `BUSINESS_ID` — eliminar filtro `?bid=` redundante del frontend

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

### 2.3 🟡 Rate limiting en `createStaffUser`

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

| Categoría | 🔴 | 🟠 | 🟡 | 🟢 | Total |
|-----------|---|---|---|---|-------|
| Base de Datos | 0 | 2 | 2 | 2 | 6 |
| Seguridad | 1 | 1 | 1 | 0 | 3 |
| Arquitectura FE | 0 | 1 | 3 | 0 | 4 |
| Rendimiento FE | 0 | 2 | 2 | 1 | 5 |
| Calidad de Código | 0 | 0 | 2 | 1 | 3 |
| Observabilidad | 0 | 0 | 1 | 1 | 2 |
| UX & Accesibilidad | 0 | 0 | 1 | 1 | 2 |
| Infra & DevOps | 0 | 1 | 1 | 0 | 2 |
| **Total** | **1** | **7** | **13** | **6** | **27** |

### Top 5 Acciones Inmediatas (Quick Wins)

| # | Tarea | Esfuerzo | Ref | Estado |
|---|-------|----------|-----|--------|
| 1 | Mover credenciales a `.env` | 10 min | §2.1 | ✅ |
| 2 | Fix race condition `setTimeout` en `createStaffUser` | 10 min | §4.4 | ✅ |
| 3 | Limitar appointments en `getPatients` | 5 min | §4.3 | ✅ |
| 4 | Limpiar console.logs | 15 min | §5.1 | ✅ |
| 5 | Fix dependencias `useCallback` | 10 min | §4.2 | ✅ |

### Top 5 Alto Impacto (Requieren Planificación)

| # | Tarea | Impacto | Ref |
|---|-------|---------|-----|
| 1 | Auditar e implementar índices faltantes | Rendimiento base | §1.5 |
| 2 | Completar migraciones versionadas | Estabilidad + desbloqueador | §8.1 |
| 3 | React Query / cache global | Rendimiento + DX | §3.1 |
| 4 | Stats RPC function | 7 queries → 1 | §1.3 |
| 5 | UUID v7 en appointments | Rendimiento a escala | §1.1 |
