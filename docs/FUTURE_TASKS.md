# NovTurnAI — Tareas Pendientes & Plan de Ejecución

> Actualizado: 2026-04-13
> Prioridades: 🔴 Pre-lanzamiento · 🟠 Primer mes · 🟡 Segundo mes · 🟢 Escalabilidad
> Estado: 🔲 Pendiente · 🔄 En progreso · 🚫 Bloqueada por dependencia
> Completadas → ver [COMPLETED_TASKS.md](./COMPLETED_TASKS.md)

---

## Resumen Ejecutivo

| Fase | Tareas | Bloqueante para |
|------|--------|----------------|
| 🔴 Pre-lanzamiento | 7 | Cobrar, operar y lanzar sin riesgos críticos |
| 🟠 Primer mes | 15 | Visibilidad en producción, onboarding, features clave |
| 🟡 Segundo mes | 14 | Compliance médico, resiliencia, calidad de datos |
| 🟢 Escalabilidad | 8 | Crecimiento a 10k+ usuarios |
| Técnicas de apoyo | 6 | Sin ventana fija, soportan las demás |

---

## FASE 1 — 🔴 Pre-lanzamiento (bloqueantes absolutos)

> Sin estas tareas el sistema no puede cobrar, tiene bugs críticos de seguridad o expone datos de otros tenants.

---

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

### T-02 🔴 Ciclo de vida del tenant — suspender y cancelar cuentas 🔲

**Problema:** No hay forma de suspender o cancelar una cuenta. Si un cliente no paga, el sistema sigue funcionando. No existe flujo de offboarding ni recuperación de datos.

**Solución:**

1. **Estados del tenant** (depende de T-01):
   - `active` → acceso normal
   - `suspended` → login posible, lectura posible, escritura bloqueada, banner de aviso
   - `cancelled` → login bloqueado, datos en retención 30 días, luego purga automática

2. **Middleware en `useAuth.js`:**
```js
if (business.plan_status === 'suspended') {
  // Mostrar SuspendedBanner, bloquear mutaciones
}
if (business.plan_status === 'cancelled') {
  // Cerrar sesión, mostrar mensaje de cuenta cancelada
}
```

3. **RLS policy de suspensión** en cada tabla de escritura:
```sql
AND EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id = business_id AND b.plan_status = 'active'
)
```

4. **Componente `<SuspendedBanner>`** con link a reactivación/pago.

5. **RPC `suspend_tenant(business_id, reason)`** protegida con service_role.

**Esfuerzo:** Medio-Alto
**Depende de:** T-01

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

### T-04 🔴 `deleteStaffUser` completo — eliminar de `auth.users` 🔲

**Problema:** `deleteStaffUser` solo hace soft delete en `staff_users` (`.update({ active: false })`), pero el usuario sigue existiendo en `auth.users` con credenciales válidas. Puede intentar autenticarse — RLS lo bloquea, pero es un estado inconsistente y un riesgo de seguridad real.

**Solución:**
```typescript
// supabase/functions/delete-staff-user/index.ts
Deno.serve(async (req) => {
  const { userId } = await req.json();
  // 1. Verificar que el caller tiene permiso (manage_users)
  // 2. Soft delete en staff_users
  await supabaseAdmin.from('staff_users').update({ active: false }).eq('id', userId);
  // 3. Eliminar de auth.users definitivamente
  await supabaseAdmin.auth.admin.deleteUser(userId);
});
```

**Esfuerzo:** Medio
**Archivos impactados:** nuevo `supabase/functions/delete-staff-user/`, `supabaseService.js`

---

### T-25 🔴 BUG CRÍTICO: Trigger `validate_appointment` nunca se ejecuta 🔲

**Archivo:** `supabase/migrations/002_triggers.sql:58-63`

**Problema:** El trigger de validación de turnos tiene una condición incorrecta:
```sql
WHEN (NEW.status = 'active')   -- ← 'active' NUNCA existe en el sistema
```
El app usa `status = 'scheduled'`, `'confirmed'` y `'cancelled'`. El valor `'active'` no existe en ningún flujo. Resultado: **la validación de solapamiento de horarios y restricción de horario laboral nunca se ejecuta**. Solo el constraint GIST previene el doble booking.

**Solución:**
```sql
DROP TRIGGER IF EXISTS trg_validate_appointment ON appointments;
CREATE TRIGGER trg_validate_appointment
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    WHEN (NEW.status IN ('scheduled', 'confirmed'))
    EXECUTE FUNCTION validate_appointment();
```
También corregir la función `validate_appointment()` que internamente filtra `status = 'active'` → cambiar a `status NOT IN ('cancelled')`.

**Esfuerzo:** Bajo (1 migración SQL)

---

### T-26 🔴 `manage-staff` Edge Function desconectada y con bug grave 🔲

**Archivos:** `supabase/functions/manage-staff/index.ts`, `src/services/supabaseService.js:393-422`

**Problema (doble):**
1. La Edge Function `manage-staff` **existe pero nunca es llamada** por el frontend. `createStaffUser` sigue usando `supabase.auth.signUp()` directamente + polling — la Edge Function fue creada pero nunca conectada.
2. La Edge Function tiene un **bug grave**: en `handleCreate()` intenta hacer `INSERT INTO staff_users` con un campo `password` — `staff_users` no tiene columna `password`. Si se llamara, fallaría siempre.

**Solución:**
1. Corregir la Edge Function: usar `supabaseAdmin.auth.admin.createUser()` + insertar en `staff_users` sin campo `password`
2. Conectar `createStaffUser` en el service a llamar la Edge Function:
```js
await supabase.functions.invoke('manage-staff', {
  body: { action: 'create', email, full_name, role_id, business_id }
});
```
3. Eliminar el flujo de `signUp()` + polling del frontend

**Esfuerzo:** Medio (se puede resolver junto con T-13)

---

### T-38 🔴 TIME_SLOTS hardcodeados — modal ignora horario del negocio 🔲

**Archivo:** `src/components/NewAppointmentModal.jsx`

**Problema:** Los slots horarios disponibles en el modal "Nuevo Turno" están hardcodeados (probablemente 09:00–17:00). La tabla `businesses` tiene campos `schedule_start` y `schedule_end` que definen el horario real de cada clínica, pero el modal nunca los lee. Resultado: todas las clínicas muestran los mismos horarios independientemente de su configuración real.

**Solución:**
```js
// En useAuth.js al cargar el perfil, leer schedule_start/schedule_end
// Exponer businessHours desde el store

// En NewAppointmentModal.jsx
const { businessHours } = useAppStore();
const TIME_SLOTS = generateTimeSlots(businessHours.start, businessHours.end, 30);

function generateTimeSlots(start, end, stepMinutes) {
  // Genera slots de 'start' a 'end' con paso 'stepMinutes'
}
```

**Esfuerzo:** Bajo-Medio
**Archivos impactados:** `NewAppointmentModal.jsx`, `useAuth.js`, `useAppStore.js`

---

## FASE 2 — 🟠 Primer mes (necesario para operar en producción)

---

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

### T-06 🟠 Onboarding automatizado de tenants 🔲

**Problema:** Crear un nuevo cliente (tenant) es completamente manual: insertar en `businesses`, crear usuario admin en Supabase Auth, asignar rol, etc. No escala y es propenso a errores humanos.

**Solución:**
```typescript
// Edge Function onboard-tenant
// Recibe: business_name, admin_email, admin_name, plan
// 1. INSERT INTO businesses (name, plan, ...)
// 2. INSERT INTO staff_roles (roles por defecto del negocio)
// 3. auth.admin.createUser({ email, password: tempPassword })
// 4. INSERT INTO staff_users (user_id, business_id, role_id, ...)
// 5. Enviar email de bienvenida con contraseña temporal
```
+ Página `/admin/new-tenant` (solo super-admin) con formulario de alta.

**Esfuerzo:** Medio-Alto

---

### T-07 🟠 Paginación real en `getPatients` y `getAuditLog` 🔲

**Problema:** `getAuditLog` no tiene límite. Un negocio con 1 año de actividad puede tener 50k+ rows que se traen completos al cliente, bloqueando el navegador. `getPatients` tiene búsqueda pero sin paginación de página 2+.

**Solución:**
```js
export async function getAuditLog(businessId, { page = 0, pageSize = 50 } = {}) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .range(from, to);
  return { data, count, hasMore: to < count - 1 };
}
```
Aplicar el mismo patrón a `getPatients`. Actualizar `useAuditLog.js` con `loadMore()`.

**Esfuerzo:** Bajo-Medio

---

### T-08 🟠 Migrar `businesses.id` de INTEGER a UUID 🔲

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
**Depende de:** T-09

---

### T-09 🟠 CI/CD + Supabase Branch para staging 🔲

**Problema:** Todos los cambios de schema se aplican pegando SQL directamente en producción. No hay staging, no hay rollback fácil. Un error en una migración afecta directamente a clientes reales.

**Solución:**
1. Activar **Supabase Branching** (rama `main` = prod, rama `staging` = DB propia)
2. Mover scripts SQL a **migraciones versionadas** con `supabase migration new`
3. **GitHub Actions** que ejecute `supabase db push` antes del deploy a Vercel

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  migrate:
    steps:
      - run: supabase db push --db-url ${{ secrets.SUPABASE_DB_URL }}
  deploy:
    needs: migrate
    uses: vercel deploy
```

**Esfuerzo:** Medio (setup inicial, luego Bajo por ejecución)

---

### T-20 🟠 Refactorizar fuente de `BUSINESS_ID` — leer del store en lugar del `export let` mutable 🔲

**Archivo:** `src/config/supabase.js`

**Problema:** `BUSINESS_ID` es una variable `export let` mutable a nivel de módulo. Múltiples lugares del código la importan y `setBusinessId()` la muta directamente. Es difícil rastrear cambios y puede causar condiciones de carrera si el perfil carga tarde.

**Solución:** Mover `businessId` al store de Zustand. Los hooks lo leen desde `useAppStore.getState().businessId`. `setBusinessId` despacha una acción al store.

**Esfuerzo:** Medio

---

### T-21 🟠 Error boundary global en `App.jsx` 🔲

**Problema:** Si un componente lanza un error de React no capturado, toda la app colapsa con pantalla en blanco. No hay fallback, no hay mensaje al usuario, Sentry no lo captura (hasta instalar T-05).

**Solución:**
```jsx
// src/components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    Sentry.captureException(error);
  }
  render() {
    if (this.state.hasError)
      return <ErrorFallback onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}
// App.jsx: envolver <RouterProvider> con <ErrorBoundary>
```

**Esfuerzo:** Bajo

---

### T-27 🟠 Contraseña mínima de 4 caracteres en `manage-staff` 🔲

**Archivo:** `supabase/functions/manage-staff/index.ts:80`

**Problema:**
```typescript
if (!password || password.length < 4) { // ← 4 no cumple ningún estándar
```
NIST 800-63B recomienda mínimo 8 caracteres. Una contraseña de 4 caracteres es trivialmente vulnerable a fuerza bruta, especialmente en una app médica.

**Solución:** Cambiar a mínimo 8 caracteres + validación de complejidad básica (al menos 1 número o símbolo). También validar en el formulario del frontend.

**Esfuerzo:** Bajo

---

### T-28 🟠 `createPatient` no es atómica — paciente puede quedar sin teléfono 🔲

**Archivo:** `src/services/supabaseService.js:230-252`

**Problema:** `createPatient` hace dos operaciones separadas: 1) INSERT en `patients`, 2) INSERT en `patient_phones`. Si el segundo falla (error de red, constraint), el paciente queda en DB sin número de teléfono. El bot de WhatsApp necesita el teléfono — ese paciente queda en estado inválido permanentemente.

**Solución:** RPC `SECURITY DEFINER` que ejecute ambos INSERTs en la misma transacción Postgres:
```sql
CREATE OR REPLACE FUNCTION public.create_patient_with_phone(
  p_business_id INTEGER, p_display_name TEXT, p_phone TEXT
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_patient_id UUID;
BEGIN
  INSERT INTO public.patients (business_id, display_name)
  VALUES (p_business_id, p_display_name) RETURNING id INTO v_patient_id;

  INSERT INTO public.patient_phones (patient_id, phone, is_primary)
  VALUES (v_patient_id, p_phone, true);

  RETURN v_patient_id;
END;
$$;
```

**Esfuerzo:** Bajo-Medio

---

### T-29 🟠 `useStats.js` y `useNotifications.js` llaman a Supabase directamente 🔲

**Archivos:** `src/hooks/useStats.js:53-68`, `src/hooks/useNotifications.js:21-58`

**Problema:** La arquitectura define que todo acceso a DB debe ir por `supabaseService.js`. Sin embargo `useStats.js` llama `supabase.from('appointments')` directamente y `useNotifications.js` crea un canal Realtime directamente. Esto rompe la capa de servicio, duplica lógica y hace las queries imposibles de testear de forma aislada.

**Solución:**
- Mover las 3 queries directas de `useStats.js` a `supabaseService.js` (`getCurrentMonthAppointments`, `getMessageCounts`, `getAppointmentTrend`)
- El canal realtime de notificaciones puede quedar en el hook pero debe recibir `businessId` como parámetro

**Esfuerzo:** Bajo-Medio

---

### T-30 🟠 `AuditLog.jsx` carga todos los pacientes para enriquecer logs 🔲

**Archivo:** `src/pages/AuditLog.jsx:167-208`

**Problema:** Al abrir `/audit-log` se ejecutan 3 queries en paralelo, incluyendo `getPatients()` que trae el listado completo con citas anidadas — solo para obtener los nombres de los pacientes en los logs. Con 1.000+ pacientes es una query muy cara que se repite en cada apertura.

**Solución rápida:**
```js
// Query liviana solo id + nombre, sin joins a appointments
const { data } = await supabase
  .from('patients')
  .select('id, display_name')
  .eq('business_id', BUSINESS_ID)
  .is('deleted_at', null);
```
**Solución correcta:** El trigger `handle_audit_log` ya guarda `new_data` como JSONB. Incluir `_patient_name` en el momento de escribir el log, no al leerlo.

**Esfuerzo:** Bajo (solución rápida) / Medio (solución con trigger)

---

### T-39 🟠 Sistema de recordatorios de citas 🔲

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

### T-40 🟠 Detección de conflictos en UI antes de crear turno 🔲

**Problema:** El modal "Nuevo Turno" muestra todos los slots sin indicar cuáles ya están ocupados. El usuario puede intentar crear un turno en un horario tomado, la DB lo rechaza con un error de constraint GIST, y el usuario ve un mensaje de error confuso. La validación ocurre demasiado tarde.

**Solución:**
```js
// Al abrir el modal o al seleccionar fecha, traer slots ocupados del día:
const { data: occupied } = await supabase
  .from('appointments')
  .select('date_start, date_end')
  .eq('business_id', BUSINESS_ID)
  .eq('date', selectedDate)
  .in('status', ['scheduled', 'confirmed']);

// En el selector de hora, deshabilitar/marcar visualmente slots ocupados
```

**Esfuerzo:** Medio
**Archivos impactados:** `NewAppointmentModal.jsx`, `supabaseService.js`

---

### T-41 🟠 Tracking de no-shows (pacientes que no se presentaron) 🔲

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

### T-42 🟠 Export CSV / Excel de datos (compliance GDPR) 🔲

**Problema:** No hay forma de exportar los datos del negocio. GDPR (Art. 20) requiere que los pacientes puedan solicitar portabilidad de sus datos. Los negocios tampoco pueden hacer backups locales ni migrar a otro sistema.

**Solución:**
1. **Edge Function `export-data`** protegida con `manage_users`:
   - Exportar citas del mes seleccionado → CSV
   - Exportar pacientes activos → CSV
   - Exportar historial de conversaciones → JSON
2. **Botón de descarga** en `/audit-log` y en `/patients`
3. Para GDPR: endpoint `export-patient-data/{patientId}` que devuelva todos los datos de un paciente específico en JSON.

**Esfuerzo:** Medio

---

## FASE 3 — 🟡 Segundo mes (compliance médico y resiliencia)

---

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

### T-31 🟡 `Conversations.jsx` usa `usePatients` completo — carga citas innecesarias 🔲

**Archivo:** `src/pages/Conversations.jsx:20`

**Problema:** La página de Conversaciones llama a `usePatients()` que trae por cada paciente: datos completos + teléfonos + últimos 5 citas. Conversations solo necesita `display_name`, `phone` y `human_takeover`. Con 500 pacientes se traen potencialmente 2.500 filas de citas que nunca se muestran.

**Solución:**
```js
// supabaseService.js — query liviana específica para conversaciones
export async function getPatientsForConversations() {
  return supabase
    .from('patients')
    .select('id, display_name, human_takeover, patient_phones(phone, is_primary)')
    .eq('business_id', BUSINESS_ID)
    .is('deleted_at', null)
    .order('display_name');
}
```
+ Hook liviano `useConversationPatients`.

**Esfuerzo:** Bajo

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

### T-34 🟡 `isSecretaryRole` hardcodeado — permisos solo editables para 'secretary' 🔲

**Archivo:** `src/pages/Users.jsx:23-27`

**Problema:**
```js
function isSecretaryRole(roleName) {
  return (roleName || '').toLowerCase() === 'secretary';
}
```
Solo los roles con nombre exacto `'secretary'` tienen sus permisos configurables en la UI. Cualquier otro rol (doctor, admin, staff, o roles personalizados) muestra los checkboxes bloqueados. La lógica no debería depender del nombre del rol.

**Solución:**
```js
// Un rol es editable si tiene permisos JSONB en la DB
const isEditableRole = (role) => role?.permissions !== null;
// O agregar campo explícito: is_configurable BOOLEAN en staff_roles
```

**Esfuerzo:** Bajo (cambio de lógica) / Medio (con campo en DB)

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

### T-47 🟡 Invalidación de cache en eventos de Realtime 🔲

**Archivos:** `src/store/useAppStore.js`, `src/hooks/usePatients.js`, `src/hooks/useStats.js`

**Problema:** El cache de pacientes (1 min) y de stats (5 min) en el store de Zustand nunca se invalida cuando llegan eventos de Realtime. Un nuevo paciente creado por otra sesión activa el Realtime en `usePatients`, pero si el cache de stats no se invalida, los contadores muestran datos incorrectos por hasta 5 minutos.

**Solución:**
```js
// En useRealtime.js, al recibir INSERT/UPDATE de patients:
useAppStore.getState().invalidatePatientsCache();
// Al recibir INSERT/UPDATE de appointments:
useAppStore.getState().invalidateStatsCache();
```
Agregar funciones `invalidatePatientsCache()` e `invalidateStatsCache()` al store.

**Esfuerzo:** Bajo-Medio

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

---

## Orden de ejecución recomendado

```
T-09 (CI/CD + Branch)           ← Habilita hacer todo lo demás con seguridad
    ↓
T-25 (Bug trigger status)       ← Fix crítico, 1 migración SQL, bajo esfuerzo
T-26 (Edge Function conectar)   ← Security + arquitectura
T-04 (deleteStaffUser)          ← Bajo esfuerzo, alto impacto de seguridad
T-21 (Error boundary)           ← Bajo esfuerzo, necesario antes de prod
T-38 (TIME_SLOTS desde DB)      ← Crítico para multi-tenant real
    ↓
T-05 (Sentry)                   ← Visibilidad desde el día 1 en prod
T-28 (createPatient atómico)    ← Fix data integrity, bajo esfuerzo
T-27 (Password mínimo 8)        ← Security fix trivial
    ↓
T-01 (Plan enforcement)         ← Base de todo el modelo de negocio
T-02 (Ciclo de vida tenant)     ← Depende de T-01
T-03 (Billing — Stripe)         ← Depende de T-01 + T-02
    ↓
T-13 (createStaffUser atómico)  ← Se puede resolver con T-26
T-07 (Paginación real)
T-06 (Onboarding automatizado)
T-08 (businesses.id → UUID)     ← Depende de T-09 (staging seguro)
    ↓
T-39 (Recordatorios)
T-40 (Conflictos UI)
T-41 (No-shows)
T-42 (Export CSV/GDPR)
    ↓
T-10 (Retención/GDPR)
T-11 (Reconexión Realtime)
T-12 (Backup verificado)
T-45 (Audit trail permisos)
    ↓
T-14, T-15, T-16                ← Escalabilidad: cuando el volumen lo pida
T-36, T-37, T-48, T-49         ← Features + UX adicional
```
