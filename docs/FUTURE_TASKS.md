# NovTurnAI — Tareas Pendientes & Plan de Ejecución

> Actualizado: 2026-04-14
> Prioridades: 🔴 Pre-lanzamiento · 🟠 Primer mes · 🟡 Segundo mes · 🟢 Escalabilidad
> Estado: 🔲 Pendiente · 🔄 En progreso · 🚫 Bloqueada por dependencia
> Completadas → ver [COMPLETED_TASKS.md](./COMPLETED_TASKS.md)

---

## Resumen Ejecutivo

| Fase | Tareas | Bloqueante para |
|------|--------|----------------|
| 🔴 Pre-lanzamiento | 2 | Cobrar, operar y lanzar sin riesgos críticos |
| 🟠 Primer mes | 8 | Visibilidad en producción, features clave |
| 🟡 Segundo mes | 12 | Compliance médico, resiliencia, calidad de datos |
| 🟢 Escalabilidad | 8 | Crecimiento a 10k+ usuarios |
| Técnicas de apoyo | 10 | Sin ventana fija, soportan las demás |

---

## FASE 1 — 🔴 Pre-lanzamiento (bloqueantes absolutos)

> Sin estas tareas el sistema no puede cobrar, tiene bugs críticos de seguridad o expone datos de otros tenants.


### T-01 🔴 Plan enforcement — límites por suscripción 🔲

**Problema:** No existe ninguna lógica que restrinja el uso según el plan contratado. Todos los tenants tienen acceso ilimitado a todo. No se puede cobrar diferencialmente ni controlar el crecimiento de cada cliente.

**Solución:**

1. **Tabla de planes en DB:**
```sql
CREATE TABLE public.plans (
  id TEXT PRIMARY KEY,           -- 'free', 'starter', 'pro', 'enterprise'
  max_staff INTEGER,
  max_patients INTEGER,
  max_appointments_per_month INTEGER,
  features JSONB                 -- { "realtime": true, "ai_bot": false, ... }
);

ALTER TABLE public.businesses
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  ADD COLUMN plan_expires_at TIMESTAMPTZ,
  ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'active'
    CHECK (plan_status IN ('active', 'suspended', 'cancelled'));
```

2. **RPC `check_plan_limit`** (llamada antes de cada acción que consume un recurso):
```sql
CREATE OR REPLACE FUNCTION public.check_plan_limit(
  p_business_id INTEGER, p_resource TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
-- Retorna TRUE si el negocio está dentro del límite del recurso
$$;
```

3. **Hook `usePlanLimits`** en el frontend:
```js
const { canAddStaff, canAddPatient, currentPlan, limitsReached } = usePlanLimits();
```

4. **Gates en la UI:** deshabilitar botones "Nuevo paciente" / "Nuevo usuario" al alcanzar el límite. Mostrar upgrade prompt.

**Esfuerzo:** Alto
**Archivos impactados:** `supabaseService.js`, nuevo `src/hooks/usePlanLimits.js`, componentes de modales de creación

---

### T-03 🔴 Billing integration — Stripe/Paddle actualiza `businesses.plan` 🔲

**Problema:** No hay integración con ningún proveedor de pagos. El campo `plan` en `businesses` se actualizaría manualmente. No hay forma automatizada de cobrar ni de actualizar el plan tras un pago.

**Solución:**

1. **Edge Function `stripe-webhook`:**
```typescript
// supabase/functions/stripe-webhook/index.ts
switch (event.type) {
  case 'checkout.session.completed':
    await supabase.from('businesses')
      .update({ plan: planId, plan_status: 'active', plan_expires_at: expiresAt })
      .eq('stripe_customer_id', event.data.object.customer);
    break;
  case 'invoice.payment_failed':
    // → plan_status = 'suspended'
    break;
  case 'customer.subscription.deleted':
    // → plan_status = 'cancelled'
    break;
}
```

2. **Campo `stripe_customer_id`** en `businesses`.

3. **Edge Function `create-checkout`** que cree la sesión de Stripe y redirija.

4. **Página `/billing`**: plan actual, fecha de renovación, historial via Stripe Customer Portal.

**Esfuerzo:** Alto
**Depende de:** T-01, T-02

---

## FASE 2 — 🟠 Primer mes (necesario para operar en producción)

### T-05 🟠 Error tracking — Sentry 🔲

**Problema:** Sin visibilidad de errores en producción. Los errores aparecen solo en `console.error` sin alertas, sin contexto del usuario ni del tenant afectado. Si la app explota en producción para un cliente, nadie lo sabe.

**Solución:**
```js
// main.jsx
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Redactar PII: emails, teléfonos de pacientes
    return event;
  }
});
// En useAuth.js al login:
Sentry.setUser({ id: user.id, business_id: profile.business_id });
```

**Esfuerzo:** Bajo-Medio (1-2 días incluyendo configuración de alertas)

---


### T-08  Migrar `businesses.id` de INTEGER a UUID 🔲

**Problema:** El ID de tenant es un entero secuencial (`1`, `2`, `3`) visible en la URL `?bid=1`. Permite enumerar cuántos clientes tiene el SaaS y en qué orden se registraron — información sensible competitivamente.

**Plan de migración (requiere T-09 — staging):**
```sql
-- Fase 1: agregar columna UUID
ALTER TABLE public.businesses ADD COLUMN uuid_id UUID DEFAULT gen_random_uuid() NOT NULL;
-- Fase 2: columnas uuid en tablas con FK (appointments, patients, staff_users, etc.)
-- Fase 3: backfill
-- Fase 4: NOT NULL, FKs nuevas, eliminar columnas enteras
-- Fase 5: actualizar RLS policies
-- Fase 6: frontend lee UUID en lugar de INTEGER
```

**Esfuerzo:** Alto (migración multi-tabla + frontend + validar RLS)
**Depende de:** T-09 ✅ (CI/CD ya configurado)

---


### T-39  Sistema de recordatorios de citas 🔲

**Problema:** No existe ningún sistema de recordatorios. Los pacientes no reciben avisos antes de sus turnos, lo que genera alto índice de ausencias (no-shows). Para una clínica médica, los recordatorios son críticos para la operación diaria.

**Solución:**
1. **Supabase Scheduled Function** (pg_cron) que corra cada hora:
```sql
-- Seleccionar citas que tienen recordatorio pendiente en ~24h y ~1h
SELECT id, patient_id, date_start FROM appointments
WHERE status IN ('scheduled', 'confirmed')
  AND date_start BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
  AND reminder_24h_sent = false;
```
2. **Edge Function `send-reminders`** que llame al bot de WhatsApp o email por cada turno próximo.
3. **Campos `reminder_24h_sent`, `reminder_1h_sent`** en `appointments` para evitar duplicados.
4. Mensaje personalizable por negocio (template en `businesses`).

**Esfuerzo:** Alto
**Depende de:** T-06 (onboarding), integración WhatsApp/email activa

---

### T-41  Tracking de no-shows (pacientes que no se presentaron) 🔲

**Problema:** No existe el estado `no_show` en los turnos. No es posible saber cuántos pacientes faltan sin avisar, qué pacientes tienen historial de ausencias, ni calcular el costo real de los no-shows para la clínica.

**Solución:**
1. Agregar `'no_show'` a los estados válidos de `appointments`:
```sql
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'));
```
2. Botón "No se presentó" en el drawer del turno (visible solo después de la hora del turno).
3. **Métricas en Stats:** tasa de no-shows por mes, pacientes con 3+ no-shows.

**Esfuerzo:** Medio
**Archivos impactados:** `AppointmentDrawer.jsx`, `supabaseService.js`, `mv_business_stats`

---

### T-51 🟠 `useStats` — trendRaw trae filas individuales sin límite para un gráfico 🔲

**Archivo:** `src/hooks/useStats.js:63-67`

**Problema:** La query de tendencia trae todos los turnos de los últimos 6 meses sin `.limit()`. Con 500 turnos/mes × 6 = 3.000 filas transferidas solo para renderizar una línea en un gráfico. El componente `MainChart` necesita datos agrupados por semana/mes, no filas individuales.

**Solución:** Mover la agregación al servidor con una RPC:
```sql
CREATE OR REPLACE FUNCTION public.get_appointment_trend(
  p_business_id INTEGER, p_months INTEGER DEFAULT 6
) RETURNS TABLE (period TEXT, total INTEGER, confirmed INTEGER, cancelled INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    TO_CHAR(DATE_TRUNC('month', date_start), 'YYYY-MM') AS period,
    COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE status = 'confirmed')::INTEGER AS confirmed,
    COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER AS cancelled
  FROM public.appointments
  WHERE business_id = p_business_id
    AND date_start >= NOW() - (p_months || ' months')::INTERVAL
  GROUP BY period ORDER BY period;
$$;
```
Retorna 6 filas en lugar de 3.000. `MainChart` recibe `{ period, total }[]` directamente.

**Esfuerzo:** Bajo-Medio
**Archivos impactados:** `supabaseService.js` (nueva función), `useStats.js`, `MainChart.jsx`

---

## FASE 3 — 🟡 Segundo mes (compliance médico y resiliencia)

### T-10 🟡 Política de retención de datos + GDPR 🔲

**Problema:** No hay política definida para datos de pacientes. En muchos países los datos médicos tienen requisitos legales de retención mínima (ej: 5 años) Y eliminación segura a petición del paciente. Sin esto el SaaS no puede operar legalmente en mercados regulados.

**Solución:**
1. **Tabla `data_retention_policies`** por negocio con períodos configurables.
2. **pg_cron job** diario que purgue datos cuyo `deleted_at` supera el período de retención configurado.
3. **Endpoint "Eliminar mis datos"** (GDPR Art. 17) que marque al paciente para borrado inmediato.
4. Revisar si hay archivos en Supabase Storage que también necesiten purga.

**Esfuerzo:** Medio

---

### T-11 🟡 Reconexión automática de Realtime con aviso al usuario 🔲

**Problema:** Si la conexión WebSocket de Supabase Realtime se cae (red inestable, sleep del dispositivo), los datos del calendario y lista de pacientes quedan desactualizados sin ningún aviso al usuario. La recepcionista puede estar viendo datos con 30 minutos de retraso sin saberlo.

**Solución:**
```js
// useRealtime.js
channel.on('system', { event: 'disconnect' }, () => {
  setRealtimeStatus('disconnected');
});
channel.on('system', { event: 'connected' }, () => {
  setRealtimeStatus('connected');
  onReconnect?.(); // Re-fetch de datos al reconectar
});
```
Agregar `<RealtimeStatusBanner>` que aparezca solo cuando `status !== 'connected'`.

**Esfuerzo:** Bajo-Medio

---

### T-12 🟡 Backup verificado y plan de restore documentado 🔲

**Problema:** Supabase Pro hace backups automáticos diarios, pero nunca se ha verificado que el restore funcione en práctica. Para datos médicos, "sí hay backups" sin restore probado no es suficiente — si se necesita un restore en urgencia, no es el momento de descubrir que falla.

**Solución:**
1. Verificar que **Point-in-Time Recovery (PITR)** está habilitado.
2. Realizar un **restore de prueba** en un proyecto Supabase temporal y documentar el proceso.
3. Documentar **RTO/RPO** (tiempo de recuperación objetivo, pérdida de datos máxima aceptable).
4. Considerar **backup cross-region** si el SaaS opera en múltiples países.

**Esfuerzo:** Medio (verificación y documentación, no código)

---

### T-13 🟡 `createStaffUser` atómico — eliminar polling con rollback real 🔲

**Problema:** `createStaffUser` llama `supabase.auth.signUp()` + polling hasta 5 veces para verificar que el trigger creó el row en `staff_users`. Si el trigger falla, el usuario queda en `auth.users` sin perfil — puede intentar autenticarse, RLS lo bloquea, la app queda rota para ese usuario y no hay rollback automático.

**Solución:**
```typescript
// supabase/functions/create-staff-user/index.ts
Deno.serve(async (req) => {
  const { data: { user } } = await supabaseAdmin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true
  });
  try {
    await supabaseAdmin.from('staff_users').insert({
      id: user.id, business_id, role_id, full_name
    });
  } catch (err) {
    // Rollback: eliminar de auth.users si staff_users falla
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    throw err;
  }
});
```

**Esfuerzo:** Medio
**Se puede resolver junto con:** T-26

---



### T-32 🟡 `getPatientHistory` sin paginación — conversaciones largas colapsan el tab 🔲

**Archivo:** `src/services/supabaseService.js:191-200`

**Problema:** `getPatientHistory` trae **todo el historial** de un paciente sin límite. Un paciente activo con el bot de WhatsApp puede tener miles de mensajes. Esto causa tiempos de carga altos y puede congelar el navegador.

**Solución:**
```js
export async function getPatientHistory(patientId, { limit = 50, before = null } = {}) {
  let query = supabase.from('history')
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  return (data || []).reverse();
}
```
Agregar UI de "cargar mensajes anteriores" (infinite scroll inverso).

**Esfuerzo:** Bajo-Medio

---

### T-33 🟡 Sistema de tema (dark/light) definido pero no aplicado al DOM 🔲

**Archivos:** `src/store/useAppStore.js:8-11`, `src/components/Topbar.jsx:37-41`

**Problema:** El store tiene `theme` y `setTheme`, y el Topbar define opciones de tema, pero el menú solo muestra "Cerrar Sesión" — las opciones de tema nunca se renderizan. Además, aunque se renderizaran, nada aplica la clase `dark` al DOM cuando el tema cambia. El selector de tema está completo en el store pero muerto en la UI.

**Solución:**
1. Mostrar opciones de tema en el menú del perfil.
2. Aplicar clase en el elemento raíz:
```js
useEffect(() => {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else if (theme === 'light') root.classList.remove('dark');
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}, [theme]);
```
3. Definir tokens `dark:` en Tailwind para los elementos de glass morphism.

**Esfuerzo:** Medio-Alto (requiere definir todo el look en modo oscuro)

---



### T-35 🟡 AuditLog deduplica en cliente — O(n²) en JavaScript 🔲

**Archivo:** `src/pages/AuditLog.jsx:185-197`

**Problema:** La deduplicación de logs con mismo `table_name + action + record_id` en rango de 5 segundos se hace en JavaScript después de traer los datos. Es O(n²): con 200 logs son 20.000 comparaciones por apertura. Con 2.000 logs serían 2 millones de comparaciones.

**Solución:** Mover la deduplicación al trigger `handle_audit_log` — antes de escribir un log, verificar si existe uno similar en los últimos 5 segundos:
```sql
-- En handle_audit_log, antes del INSERT:
IF EXISTS (
  SELECT 1 FROM audit_log
  WHERE table_name = TG_TABLE_NAME AND action = TG_OP
    AND record_id = NEW.id AND business_id = NEW.business_id
    AND created_at > NOW() - INTERVAL '5 seconds'
) THEN RETURN NEW; END IF;
```

**Esfuerzo:** Bajo-Medio

---

### T-43 🟡 Validación de teléfono con formato correcto 🔲

**Archivo:** `src/components/NewPatientModal.jsx`

**Problema:** La validación de teléfono solo verifica longitud básica. No valida formato internacional, código de país, ni caracteres válidos. Se pueden guardar números inválidos que el bot de WhatsApp nunca podrá contactar, sin ningún aviso al usuario.

**Solución:**
```bash
npm install libphonenumber-js
```
```js
import { parsePhoneNumberFromString } from 'libphonenumber-js';

function validatePhone(phone, countryCode) {
  const parsed = parsePhoneNumberFromString(phone, countryCode);
  return parsed?.isValid() ?? false;
}
```
El `countryCode` se lee de la configuración del negocio.

**Esfuerzo:** Bajo-Medio

---

### T-44 🟡 Campo `birth_date` en pacientes — edad y verificación médica 🔲

**Problema:** La tabla `patients` no tiene fecha de nacimiento. Para una clínica médica, la edad del paciente es información clínica esencial (dosificación, restricciones, historial). Sin este dato el sistema no puede servir a especialidades pediátricas o que necesiten verificación de edad.

**Solución:**
```sql
ALTER TABLE public.patients ADD COLUMN birth_date DATE;
```
- Agregar campo opcional al modal de crear/editar paciente.
- Mostrar edad calculada (`EXTRACT(YEAR FROM AGE(birth_date))`) en el drawer del paciente.
- Materializar edad en `mv_patient_stats` si se necesitan estadísticas por rango etario.

**Esfuerzo:** Bajo-Medio

---

### T-45 🟡 Audit trail para cambios de permisos y roles 🔲

**Archivo:** `src/pages/Users.jsx:261` / `src/hooks/useUsers.js`

**Problema:** El trigger `handle_audit_log` no registra cuando se modifica `staff_roles.permissions`. Un administrador puede cambiar silenciosamente qué puede o no puede hacer cada rol sin dejar rastro. Para una app médica esto es un gap de compliance crítico — debe saber quién cambió qué permisos y cuándo.

**Solución:**
```sql
-- Agregar trigger en staff_roles
CREATE TRIGGER trg_audit_staff_roles
  AFTER UPDATE ON public.staff_roles
  FOR EACH ROW
  WHEN (OLD.permissions IS DISTINCT FROM NEW.permissions)
  EXECUTE FUNCTION handle_audit_log();
```
El frontend ya graba el `user_id` del actor en el audit log — este trigger lo reutiliza.

**Esfuerzo:** Bajo

---

### T-46 🟡 Focus trap + tecla Escape en todos los modales 🔲

**Problema:** Los modales (NewAppointmentModal, NewPatientModal, EditAppointmentModal, etc.) no atrapan el foco del teclado. Un usuario que navega con Tab puede salir del modal sin cerrarlo. La tecla Escape tampoco cierra los modales de forma consistente. Esto viola WCAG 2.1 (criterio 2.1.2) y es inutilizable con lectores de pantalla.

**Solución:**
```js
// useModalFocus.js — hook reutilizable
export function useModalFocus(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  // + focus trap logic con primer/último elemento focuseable
}
```
Aplicar en todos los modales del proyecto.

**Esfuerzo:** Bajo-Medio

---

### T-54 🟡 `activePatients` y `totalPatients` usan el mismo valor — posible bug 🔲

**Archivo:** `src/hooks/useStats.js:100-101`

**Problema:**
```js
totalPatients:  patientStats?.total_patients ?? 0,
activePatients: patientStats?.total_patients ?? 0, // ← mismo campo
```
`activePatients` nunca difiere de `totalPatients`. O `mv_patient_stats` no expone un campo `active_patients` (distintos de los soft-deleted), o la asignación es incorrecta. El campo `activePatients` se exporta desde el hook pero al tener siempre el mismo valor que `totalPatients` no aporta información real.

**Solución:**
1. Verificar si `mv_patient_stats` expone `active_patients` separado de `total_patients`.
2. Si no lo hace, agregar la columna a la vista materializada:
```sql
-- En mv_patient_stats o en get_patient_stats():
COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_patients,
COUNT(*) AS total_patients -- incluyendo soft-deleted históricamente
```
3. Si la distinción no es relevante, eliminar `activePatients` del hook para evitar confusión.

**Esfuerzo:** Bajo

---

### T-55 🟡 `updatePatient` — actualización de `patient_phones` sin verificar `business_id` 🔲

**Archivo:** `src/services/supabaseService.js:299-313`

**Problema:** Al actualizar el teléfono de un paciente, el UPDATE y el INSERT sobre `patient_phones` solo filtran por `patient_id` e `is_primary`. No se verifica `business_id` sobre la tabla de teléfonos. Aunque `patient_id` es FK de un paciente ya verificado por `business_id`, la ausencia de la guarda en `patient_phones` rompe el principio de defensa en profundidad — si RLS no está configurado correctamente sobre esa tabla, podría actualizar un teléfono de otro tenant.

**Solución:**
```js
// Opción A: agregar .eq('business_id', BUSINESS_ID) si patient_phones tiene la columna
// Opción B (recomendada): verificar en T-19 que patient_phones tiene business_id denormalizado
// y entonces agregar la guarda aquí
```
Revisar RLS de la tabla `patient_phones` y verificar que T-19 cubre este caso.

**Esfuerzo:** Muy Bajo (verificación + 1 línea de código)
**Depende de:** T-19

---

## FASE 4 — 🟢 Escalabilidad (cuando el volumen lo requiera)

---

### T-14 🟢 Particionar `history` y `audit_log` por mes 🔲

**Cuándo actuar:** Cuando `history` supere ~500k filas.

**Problema:** Tablas append-only que crecerán indefinidamente. Sin particionamiento, las queries full-scan se degradarán progresivamente hasta afectar la experiencia del usuario.

**Solución:** Particionamiento nativo de PostgreSQL por rango de `created_at` con particiones mensuales. Requiere recrear las tablas y migrar datos — hacerlo con Supabase Branch (T-09 como prerequisito).

**Esfuerzo:** Alto
**Depende de:** T-09

---

### T-15 🟢 TanStack Query — cache coherente y menos boilerplate 🔲

**Cuándo actuar:** Cuando haya 3+ desarrolladores o al agregar TypeScript (T-16).

**Problema:** Cada hook reimplementa manualmente loading state, error handling, caching y stale detection. ~60% del código de hooks es boilerplate idéntico que hay que mantener en paralelo.

**Solución:**
```js
const { data, isLoading, error } = useQuery({
  queryKey: ['patients', businessId, search],
  queryFn: () => getPatients(businessId, search),
  staleTime: 1000 * 60 * 2
});
```
Beneficios: cache automático, deduplicación, retry, window focus refetch.

**Esfuerzo:** Alto (refactor de todos los hooks, pero valor enorme a largo plazo)

---

### T-16 🟢 TypeScript — migración gradual 🔲

**Cuándo actuar:** Al agregar TanStack Query (T-15) o cuando el equipo crezca.

**Orden de migración:**
1. `supabaseService.js` → `.ts` con tipos generados por Supabase
2. Stores Zustand
3. Hooks
4. Componentes (última prioridad)

```bash
npx supabase gen types typescript --project-id <id> > src/types/database.ts
```

**Esfuerzo:** Alto (progresivo, no necesita hacerse de golpe)

---

### T-36 🟢 Gestión de servicios desde el dashboard 🔲

**Problema:** No hay UI para que el administrador gestione los tipos de citas/servicios que ofrece su negocio. El campo `service_id` en `appointments` referencia una tabla `services` que solo se puede editar directamente en DB.

**Solución:** Sección dentro de `/settings` (o `/users`) con lista de servicios activos, crear/editar/desactivar servicio. El modal "Nuevo Turno" ya tiene `serviceId` pero sin opciones reales cargadas desde DB.

**Esfuerzo:** Medio

---

### T-37 🟢 Configuración del negocio desde el dashboard (`/settings`) 🔲

**Problema:** No hay página donde el administrador pueda modificar la configuración de su negocio: nombre, horario de atención, timezone, logo, etc. Todo cambio requiere intervención directa en la base de datos.

**Solución:** Ruta `/settings` protegida con `manage_users` o nuevo permiso `manage_business`. Formulario para editar `businesses.name`, `schedule_start`, `schedule_end`, `schedule_days`, `timezone`. Usar `getBusinessInfo()` (ya existe) como base.

**Esfuerzo:** Medio

---

### T-48 🟢 Navegación por teclado en el calendario 🔲

**Problema:** El calendario no tiene atajos de teclado para navegar entre fechas. Los usuarios que prefieren el teclado (o personas con movilidad reducida) no pueden cambiar de día/semana sin el mouse. Esto viola WCAG 2.1 criterio 2.1.1.

**Solución:**
- `←` / `→` para día anterior / siguiente
- `Alt+←` / `Alt+→` para semana anterior / siguiente
- `T` para ir a hoy (today)
- Implementar con `useEffect` + `document.addEventListener('keydown', ...)` en el componente del calendario

**Esfuerzo:** Bajo

---

### T-49 🟢 Campo `cancelled_at` separado de `deleted_at` en appointments 🔲

**Problema:** Los turnos cancelados usan el mismo campo `deleted_at` que los borrados. No se puede distinguir entre "el paciente canceló a las 14:00" y "el admin borró el registro". Las métricas de cancelaciones son imprecisas y el historial del paciente pierde contexto importante.

**Solución:**
```sql
ALTER TABLE public.appointments ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN cancellation_reason TEXT;
```
Actualizar el flujo de cancelación en el frontend para setear `cancelled_at` en lugar de `deleted_at`. Actualizar `mv_business_stats` para separar las métricas.

**Esfuerzo:** Bajo-Medio

---

## Tareas Técnicas de Apoyo (sin fase fija)

| ID | Tarea | Prioridad | Depende de | Esfuerzo | Estado |
|----|-------|-----------|------------|---------|--------|
| T-17 | Consolidar 3 queries restantes de `useStats` en una sola RPC | 🟡 | — | Medio | 🔲 |
| T-18 | Migrar `appointments.id` a UUID v7 (cuando supere 50k filas) | 🟢 | T-09 | Medio | 🔲 |
| T-19 | Agregar `business_id` directo a `patient_phones` (optimización RLS) | 🟡 | T-09 | Bajo-Medio | 🔲 |
| T-22 | Lazy loading de rutas con `React.lazy()` | 🟡 | — | Bajo | 🔲 |
| T-23 | Unificar error handling en `supabaseService.js` | 🟡 | — | Bajo-Medio | 🔲 |
| T-24 | Rate limiting en `createStaffUser` | 🟡 | T-13 | Bajo | 🔲 |
| T-59 | `loadMore` en `usePatients` duplica la lógica de estado de `load` — unificar | 🟡 | — | Bajo | 🔲 |

---

## Orden de ejecución recomendado


```
✅ T-09 (CI/CD + Branch)        ← COMPLETADO
✅ T-21 (Error boundary)        ← COMPLETADO
✅ T-27 (Password mínimo 8)     ← COMPLETADO
✅ T-28 (createPatient atómico) ← COMPLETADO — RPC en producción
✅ T-29 (queries al service)    ← COMPLETADO
✅ T-30 (AuditLog optimizado)   ← COMPLETADO
✅ T-20 (BUSINESS_ID al store)  ← COMPLETADO
✅ T-06 (Onboarding tenants)    ← COMPLETADO
✅ T-31 (Conversations liviana) ← COMPLETADO
✅ T-34 (isEditableRole por DB) ← COMPLETADO
✅ T-50 (COUNT mensajes + mes)  ← COMPLETADO
✅ T-52 (handoff_at servidor)   ← COMPLETADO
✅ T-53 (setAuth user/profile)  ← COMPLETADO
✅ T-57 (useRealtime genérico)  ← COMPLETADO
✅ T-58 (getRange memoizado)    ← COMPLETADO
✅ T-38 (TIME_SLOTS dinámicos) ← COMPLETADO — Calendar + modales + getBusinessSchedule
✅ T-47 (Cache stats → Realtime) ← COMPLETADO
✅ T-56 (clearNotifications audit) ← COMPLETADO
✅ T-60 (unificar business queries) ← COMPLETADO
✅ T-61 (fetchBusinessStatus → service) ← COMPLETADO
✅ T-62 (catch rethrow vacío) ← COMPLETADO
✅ Bug: prop mutation AppointmentDrawer ← COMPLETADO
✅ Bug: alert() → showErrorToast ← COMPLETADO
✅ Bug: toISO null guard ← COMPLETADO
✅ Bug: parseInt radix CalendarWeek/Day ← COMPLETADO
✅ Bug: try/catch debounce NewAppointmentModal ← COMPLETADO
    ↓
T-05 (Sentry)                   ← Visibilidad desde el día 1 en prod
T-51 (trendRaw → RPC agrupado)  ← Performance: elimina 3k filas por carga
    ↓
T-01 (Plan enforcement)         ← Base de todo el modelo de negocio
T-02 (Ciclo de vida tenant)     ← Depende de T-01
T-03 (Billing — Stripe)         ← Depende de T-01 + T-02
    ↓
T-13 (createStaffUser atómico)
T-08 (businesses.id → UUID)     ← CI/CD ya está ✅
    ↓
T-39 (Recordatorios)
T-41 (No-shows)
    ↓
T-10 (Retención/GDPR)
T-11 (Reconexión Realtime)      ← T-57 ya hecho ✅
T-12 (Backup verificado)
T-45 (Audit trail permisos)
T-54 (activePatients bug)
T-55 (phones sin business_id)   ← Tras T-19
T-56 (clearNotifications audit)
    ↓
T-14, T-15, T-16                ← Escalabilidad: cuando el volumen lo pida
T-36, T-37, T-48, T-49         ← Features + UX adicional
```

## Deployment
- Vercel (ya lo tienes)
- Es la opción ideal para este stack. Lo que te permite hacer cambios en producción de forma segura:
  - Preview Deployments — cada PR o branch genera una URL única (proyecto-git-feature-x.vercel.app). Puedes testear en "producción real" antes de mergear a main.
  - Rollbacks — si algo rompe, vuelves a la versión anterior en segundos.
  - Integración con Supabase — funciona perfecto con el sistema de variables de entorno y el dashboard de Supabase.
