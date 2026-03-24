# NovTurnAI Dashboard — Contexto Completo para Migración

## Objetivo
Migrar el dashboard existente al nuevo schema de base de datos manteniendo el diseño visual y estructura React intactos. El sistema de agendación de turnos via WhatsApp + IA es el core del producto.

---

## Stack tecnológico (NO cambiar)
- React 19 + Vite
- Tailwind CSS 3.4 con configuración personalizada
- Zustand para estado global
- Supabase JS v2 para BD y Auth
- Recharts para gráficas
- React Router v7
- Lucide React para iconos

---

## Design System (preservar al 100%)

### Paleta de colores (tailwind.config.js)
```js
navy: {
  50: '#F5F8FD',
  100: '#EBF2FB',
  300: '#5B8AC4',
  500: '#1D5FAD',
  700: '#1A3A6B',
  900: '#0F2044',
}
glass: {
  card: 'rgba(255,255,255,0.82)',
  border: 'rgba(255,255,255,0.90)',
  input: 'rgba(255,255,255,0.65)',
  hover: 'rgba(255,255,255,0.60)',
}
```

### Sombras personalizadas
```js
'card': '0 2px 8px rgba(15,32,68,0.06), 0 1px 3px rgba(15,32,68,0.04)'
'card-hover': '0 4px 20px rgba(15,32,68,0.08), 0 2px 8px rgba(15,32,68,0.04)'
'modal': '0 16px 48px rgba(15,32,68,0.12), 0 8px 20px rgba(15,32,68,0.06)'
'btn': '0 2px 8px rgba(26,58,107,0.25)'
```

### Clases CSS globales clave (index.css)
- `.glass-premium` — glassmorphism principal de cards
- `.glass-morphism` — glassmorphism secundario
- `.glass-input` — inputs con glass effect
- `.animate-fade-up` — animación de entrada de elementos
- `.animate-drawer-in` — animación del drawer lateral
- `.animate-shimmer` — skeleton loading
- `.shadow-card` — sombra estándar de cards
- `.lg-orb` — orbes decorativos de fondo

### Fondo global
```css
body { background-color: #F4F5F9; font-family: 'Inter', sans-serif; }
body::before { /* orbes radiales decorativos - NO modificar */ }
```

### Contenedor principal de la app
```jsx
<div className="w-full max-w-[1920px] h-full rounded-[24px] sm:rounded-[32px] 
  bg-white/40 backdrop-blur-xl border border-white/60 
  shadow-[0_20px_50px_rgba(26,58,107,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] 
  overflow-hidden relative z-10 flex">
```

---

## Estructura de carpetas (preservar)
```
src/
├── App.jsx
├── main.jsx
├── index.css
├── config/
│   └── supabase.js          ← MODIFICAR
├── services/
│   └── supabaseService.js   ← MODIFICAR COMPLETAMENTE
├── hooks/
│   ├── useAuth.js           ← MODIFICAR
│   ├── useAppointments.js   ← MODIFICAR
│   ├── usePatients.js       ← MODIFICAR
│   ├── useStats.js          ← MODIFICAR COMPLETAMENTE
│   ├── useRealtime.js       ← MODIFICAR
│   ├── useNotifications.js  ← SIN CAMBIOS
│   ├── usePermissions.js    ← SIN CAMBIOS
│   └── useUsers.js          ← SIN CAMBIOS
├── store/
│   ├── useAppStore.js       ← SIN CAMBIOS
│   └── useToastStore.js     ← SIN CAMBIOS
├── pages/
│   ├── Calendar.jsx         ← MODIFICAR (createAppointment)
│   ├── Patients.jsx         ← MODIFICAR (createPatient)
│   ├── Conversations.jsx    ← MODIFICAR (reactivate_bot RPC)
│   ├── PatientHistory.jsx   ← MODIFICAR (patient_id UUID)
│   ├── Stats.jsx            ← MODIFICAR (materialized views)
│   ├── Users.jsx            ← SIN CAMBIOS
│   └── Login.jsx            ← MODIFICAR (Supabase Auth nativo)
├── components/
│   ├── Sidebar.jsx          ← SIN CAMBIOS
│   ├── Topbar.jsx           ← SIN CAMBIOS
│   ├── ToastContainer.jsx   ← SIN CAMBIOS
│   ├── Calendar/            ← MODIFICAR (nueva estructura appointments)
│   ├── Patients/            ← MODIFICAR (patients + patient_phones)
│   ├── Stats/               ← MODIFICAR (materialized views)
│   └── ui/                  ← SIN CAMBIOS
└── utils/
    ├── format.js            ← SIN CAMBIOS
    └── calendarUtils.js     ← SIN CAMBIOS
```

---

## Supabase — Nuevo Schema Completo

### URL y configuración
```
URL: https://scjvhrzdlnwktzcejrgl.supabase.co
BUSINESS_ID: desde URL param ?bid=1 (multi-tenant)
```

### CRÍTICO: Manejo de claves
```js
// config/supabase.js — NUEVO
// ELIMINAR supabaseAdmin del frontend — service_role key NUNCA en el cliente
// Solo usar supabase (anon key) + Supabase Auth nativo

import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://scjvhrzdlnwktzcejrgl.supabase.co';
const SUPABASE_ANON_KEY = '[anon_key]'; // solo esta

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const BUSINESS_ID = parseInt(
  new URLSearchParams(window.location.search).get('bid') || '1'
);
```

### ENUMs del schema
```sql
appt_status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
message_role: 'user' | 'assistant' | 'system'
service_mode: 'auto' | 'eval' | 'human'
audit_action: 'INSERT' | 'UPDATE' | 'DELETE'
```

### Tablas — estructura completa

#### businesses
```
id SERIAL PK | name VARCHAR | phone_number_id VARCHAR
whatsapp_token TEXT | schedule_start INTEGER (default 9)
schedule_end INTEGER (default 18) | schedule_days VARCHAR (default 'Lun-Vie')
appointment_duration INTEGER (30|60|90|120) | timezone VARCHAR
plan VARCHAR (basic|pro|enterprise) | active BOOLEAN
created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

#### patients (REEMPLAZA a 'users')
```
id UUID PK (gen_random_uuid()) | business_id INTEGER FK→businesses
display_name VARCHAR | email VARCHAR UNIQUE | notes TEXT
human_takeover BOOLEAN (default false) | handoff_reason VARCHAR(50) [libre, lo escribe N8N]
handoff_at TIMESTAMPTZ | deleted_at TIMESTAMPTZ (soft delete, NULL=activo)
created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

#### patient_phones (NUEVA — normalización)
```
id SERIAL PK | patient_id UUID FK→patients (CASCADE)
phone VARCHAR(20) UNIQUE | is_primary BOOLEAN
created_at TIMESTAMPTZ
```
**CRÍTICO:** El teléfono ya NO es el ID del paciente. Para buscar un paciente por teléfono:
```js
// JOIN patients con patient_phones
const { data } = await supabase
  .from('patient_phones')
  .select('patient_id, patients(*)')
  .eq('phone', phone)
  .single();
```

#### appointments
```
id UUID PK | business_id INTEGER FK→businesses
patient_id UUID FK→patients | service_id INTEGER FK→services (nullable)
date_start TIMESTAMPTZ | date_end TIMESTAMPTZ
status appt_status (scheduled|confirmed|completed|cancelled|no_show)
notif_24hs BOOLEAN | confirmed BOOLEAN | cancellation_reason VARCHAR
created_by VARCHAR (bot|dashboard|api) | created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```
**CRÍTICO cambio de schema anterior:**
- `status: 'active'` → ahora es `status: 'scheduled'` (turno nuevo del bot)
- `user_id` (phone string) → ahora es `patient_id` (UUID)
- Filtros de turnos activos: `status IN ('scheduled', 'confirmed')`

#### services (NUEVA)
```
id SERIAL PK | business_id INTEGER FK→businesses
name VARCHAR | description TEXT
duration_minutes INTEGER (múltiplo de 30)
blocks INTEGER GENERATED (duration_minutes/30, solo lectura)
mode service_mode (auto|eval|human) | active BOOLEAN
created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

#### history
```
id BIGSERIAL PK | business_id INTEGER FK→businesses
patient_id UUID FK→patients [CAMBIO: antes era user_id con phone]
role message_role (user|assistant|system) | content TEXT
created_at TIMESTAMPTZ
```

#### staff_roles
```
id SERIAL PK | business_id INTEGER FK→businesses
name VARCHAR | permissions JSONB | created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```
JSONB de permissions:
```json
{
  "view_stats": true,
  "manage_staff": true,
  "view_patients": true,
  "edit_appointments": true,
  "reactivate_bot": true,
  "view_audit_log": true
}
```

#### staff_users
```
id UUID PK (= auth.users.id) | business_id INTEGER FK→businesses
role_id INTEGER FK→staff_roles | full_name VARCHAR
active BOOLEAN | created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

#### notifications
```
id UUID PK | business_id INTEGER FK→businesses
patient_id UUID FK→patients (nullable) | appointment_id UUID FK→appointments (nullable)
type VARCHAR | title VARCHAR | read BOOLEAN (default false)
metadata JSONB | created_at TIMESTAMPTZ
```

#### Materialized Views para Stats
```sql
-- mv_business_stats: estadísticas mensuales por negocio
SELECT business_id, month, total, completed, cancelled, no_show,
       confirmed_count, created_by_bot, created_by_staff,
       completion_pct, cancellation_pct, avg_days_advance
FROM mv_business_stats
WHERE business_id = BUSINESS_ID
  AND month = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Guatemala');

-- mv_patient_stats: totales de pacientes por negocio
SELECT business_id, total_patients, active_patients, in_takeover, new_this_month
FROM mv_patient_stats
WHERE business_id = BUSINESS_ID;
```

---

## Auth — Supabase Auth Nativo (CAMBIO IMPORTANTE)

### Antes (Edge Function auth-login — ELIMINAR)
```js
// ❌ NO usar más — eliminar edge functions de auth
const result = await callEdgeFunction('auth-login', { email, password });
```

### Ahora (Supabase Auth nativo)
```js
// ✅ Login directo con Supabase Auth
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  
  // Obtener perfil del staff desde staff_users
  const { data: profile } = await supabase
    .from('staff_users')
    .select('*, staff_roles(*)')
    .eq('id', data.user.id)
    .single();
    
  return { user: data.user, profile };
}

// Logout
async function logout() {
  await supabase.auth.signOut();
}

// Inicializar sesión
async function initializeAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: profile } = await supabase
      .from('staff_users')
      .select('*, staff_roles(*)')
      .eq('id', session.user.id)
      .single();
    return { user: session.user, profile };
  }
  return null;
}

// Escuchar cambios de sesión
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') clearAuth();
});
```

---

## RPC Functions — Endpoints disponibles en Supabase

### 1. get_patient_by_phone(p_phone)
```js
// Busca paciente por teléfono — reemplaza el lookup manual
const { data } = await supabase.rpc('get_patient_by_phone', {
  p_phone: '50247989357'
});
// Devuelve: [{ patient_id, business_id, display_name, human_takeover, handoff_reason, deleted_at }]
```

### 2. get_available_slots(p_business_id, p_date)
```js
// Slots disponibles de un día
const { data } = await supabase.rpc('get_available_slots', {
  p_business_id: 1,
  p_date: '2025-01-20'
});
// Devuelve: [{ slot_start, slot_end, available }]
```

### 3. reactivate_bot(p_patient_id)
```js
// Reactivar bot para un paciente (botón "Reactivar IA")
// Atómico: desactiva human_takeover + crea notificación
const { data } = await supabase.rpc('reactivate_bot', {
  p_patient_id: 'uuid-del-paciente'
});
// Devuelve: { ok: true } o { ok: false, error: '...' }
```

---

## Cambios por archivo — Guía de migración

### config/supabase.js
- Eliminar `supabaseAdmin` (service role key fuera del frontend)
- Eliminar `callEdgeFunction` y manejo manual de tokens
- Mantener `BUSINESS_ID` desde URL param
- Solo exportar `supabase` (anon key) y `BUSINESS_ID`

### services/supabaseService.js — Cambios críticos

#### getAppointmentsByWeek
```js
// ANTES: .select('*, users(display_name)')
// AHORA:
.select('*, patients(display_name)')
// El join cambia de users a patients
```

#### createAppointment
```js
// ANTES: user_id: userId (phone), status: 'active'
// AHORA:
{
  business_id: BUSINESS_ID,
  patient_id: patientId,    // UUID del paciente
  service_id: serviceId,    // ID del servicio (nullable)
  date_start: dateStart,    // timestamptz ISO
  date_end: dateEnd,        // timestamptz ISO
  status: 'scheduled',      // NO 'active'
  created_by: 'dashboard',
  confirmed: false,
  notif_24hs: false
}
// NOTA: El EXCLUSION CONSTRAINT en la BD previene double booking automáticamente
// No necesitás el conflict check manual — capturar el error de Supabase
```

#### cancelAppointment
```js
// ANTES: status: 'cancelled' (string libre)
// AHORA: igual pero es ENUM — mismo valor 'cancelled' funciona
```

#### getPatients
```js
// ANTES: .from('users').select('*, appointments(...)')
// AHORA:
const { data } = await supabase
  .from('patients')
  .select(`
    *,
    patient_phones(phone, is_primary),
    appointments(id, date_start, status)
  `)
  .eq('business_id', BUSINESS_ID)
  .is('deleted_at', null)          // soft delete filter
  .order('display_name', { ascending: true });
```

#### getPatientHistory
```js
// ANTES: .eq('user_id', userId) donde userId era el phone
// AHORA: .eq('patient_id', patientId) donde patientId es UUID
```

#### setHumanTakeover — REEMPLAZAR con RPC
```js
// ANTES: update directo en users
// AHORA para REACTIVAR (human_takeover → false):
const { data } = await supabase.rpc('reactivate_bot', { p_patient_id: patientId });

// Para ACTIVAR (human_takeover → true) — lo hace N8N automáticamente
// Si el dashboard lo necesita activar manualmente:
await supabase.from('patients')
  .update({ human_takeover: true, handoff_reason: 'manual', handoff_at: new Date().toISOString() })
  .eq('id', patientId);
```

#### createPatient — NUEVO (dos inserts atómicos)
```js
// ANTES: insert en users con id = phone
// AHORA: insert en patients + patient_phones
async function createPatient({ display_name, phone, email, notes }) {
  // 1. Crear paciente
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert({ business_id: BUSINESS_ID, display_name, email, notes })
    .select()
    .single();
  if (patientError) throw patientError;

  // 2. Agregar teléfono
  const { error: phoneError } = await supabase
    .from('patient_phones')
    .insert({ patient_id: patient.id, phone, is_primary: true });
  if (phoneError) throw phoneError;

  return patient;
}
```

#### getStatsOverview — REEMPLAZAR con materialized views
```js
// ANTES: queries directas a users y appointments (caro)
// AHORA: leer de materialized views (instantáneo)
async function getStatsOverview() {
  const [{ data: apptStats }, { data: patientStats }] = await Promise.all([
    supabase.from('mv_business_stats')
      .select('*')
      .eq('business_id', BUSINESS_ID)
      .order('month', { ascending: false })
      .limit(6),
    supabase.from('mv_patient_stats')
      .select('*')
      .eq('business_id', BUSINESS_ID)
      .single()
  ]);
  return { apptStats: apptStats || [], patientStats };
}
```

#### loginStaff — REEMPLAZAR con Auth nativo
```js
// ANTES: callEdgeFunction('auth-login', { email, password })
// AHORA: supabase.auth.signInWithPassword({ email, password })
// Ver sección Auth arriba para implementación completa
```

### hooks/useAuth.js
- Eliminar importación de `loginStaff` de supabaseService
- Usar `supabase.auth.signInWithPassword` directamente
- Usar `supabase.auth.getSession()` para inicializar
- Usar `supabase.auth.onAuthStateChange` para detectar logout
- Eliminar manejo manual de JWT tokens en localStorage
- Supabase Auth maneja la sesión automáticamente

### hooks/useStats.js — REESCRIBIR COMPLETAMENTE
```js
// ANTES: queries directas a users, appointments, history
// AHORA: leer de mv_business_stats y mv_patient_stats
// Calcular KPIs desde los campos precalculados de las MVs:
// total, completed, cancelled, no_show, confirmed_count,
// completion_pct, cancellation_pct, avg_days_advance,
// total_patients, active_patients, in_takeover, new_this_month
```

### hooks/useRealtime.js
```js
// ANTES: escucha tabla 'users'
// AHORA: escucha tabla 'patients'
export function useRealtimePatients(onUpdate) {
  useEffect(() => {
    const channel = supabase
      .channel('patients-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'patients' }, // 'users' → 'patients'
        (payload) => {
          if (payload.new?.business_id == BUSINESS_ID || payload.old?.business_id == BUSINESS_ID) {
            onUpdate(payload);
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [onUpdate]);
}
// useRealtimeAppointments: sin cambios (ya escucha 'appointments')
```

### pages/Conversations.jsx
```js
// ANTES: handleReactivateIA llama setHumanTakeover(id, false)
// AHORA: usar RPC reactivate_bot
async function handleReactivateIA() {
  const { data } = await supabase.rpc('reactivate_bot', {
    p_patient_id: selectedPatient.id
  });
  if (data?.ok) {
    setSelectedPatient({ ...selectedPatient, human_takeover: false });
  }
}

// ANTES: formatPhone(p.id) donde id era el phone
// AHORA: formatPhone(p.patient_phones?.[0]?.phone)
// patients.id ahora es UUID, el teléfono está en patient_phones
```

### pages/PatientHistory.jsx
```js
// ANTES: getPatientHistory(userId) donde userId era phone
// AHORA: getPatientHistory(patient.id) donde id es UUID
// La query en el servicio ya filtra por patient_id UUID
```

---

## Módulo Calendar — Cambios en creación de turnos

```js
// NewAppointmentModal.jsx — campos que cambian
// ANTES: userId (phone del paciente)
// AHORA: patientId (UUID del paciente) + serviceId

// Al crear desde el dashboard:
await createAppointment({
  patientId: selectedPatient.id,  // UUID
  serviceId: selectedService?.id, // opcional
  date: selectedDate,
  startTime: '09:00',
  endTime: '10:00'
});

// Si hay double booking, Supabase retorna error con código 23P01
// (exclusion constraint violation) — capturarlo y mostrar mensaje amigable
try {
  await createAppointment(...);
} catch (err) {
  if (err.code === '23P01') {
    showError('Este horario ya está ocupado. Seleccioná otro.');
  }
}
```

---

## Módulo Stats — Nueva estructura de datos

```js
// KPI Cards disponibles desde MVs:
// mv_business_stats:
//   total          → turnos totales del mes
//   completed      → turnos completados
//   cancelled      → turnos cancelados
//   no_show        → no se presentaron
//   confirmed_count → turnos confirmados
//   created_by_bot  → agendados por el bot
//   created_by_staff → agendados desde dashboard
//   completion_pct  → % completitud (0-100, 1 decimal)
//   cancellation_pct → % cancelación
//   avg_days_advance → días promedio de anticipación

// mv_patient_stats:
//   total_patients   → total histórico
//   active_patients  → sin soft delete
//   in_takeover      → con human_takeover activo
//   new_this_month   → creados en los últimos 30 días

// Para el gráfico de tendencia mensual (últimos 6 meses):
const { data } = await supabase
  .from('mv_business_stats')
  .select('month, total, completed, cancelled, completion_pct')
  .eq('business_id', BUSINESS_ID)
  .order('month', { ascending: true })
  .limit(6);
```

---

## Módulo Patients — Nueva búsqueda

```js
// Búsqueda por nombre O teléfono
// ANTES: search en users (id=phone)
// AHORA: search en patients + join patient_phones

async function getPatients(search = '') {
  let query = supabase
    .from('patients')
    .select('*, patient_phones(phone, is_primary), appointments(id, date_start, status)')
    .eq('business_id', BUSINESS_ID)
    .is('deleted_at', null)
    .order('display_name', { ascending: true });

  if (search) {
    // Buscar por nombre en patients o teléfono en patient_phones
    query = query.or(
      `display_name.ilike.%${search}%`
    );
    // Para búsqueda por teléfono necesitás una query separada:
    // buscar en patient_phones → obtener patient_ids → filtrar patients
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
```

---

## Módulo Users — Sin cambios
El módulo de gestión de staff (`pages/Users.jsx`) no cambia — ya usa las tablas `staff_users` y `staff_roles` que son las mismas en el nuevo schema.

Los permisos del JSONB mantienen los mismos keys:
- `view_stats`, `manage_staff`, `view_patients`, `edit_appointments`, `reactivate_bot`, `view_audit_log`

---

## Realtime — Tablas activas
Solo estas dos tablas tienen Realtime habilitado:
- `notifications` → badge de alertas en vivo (ya funcionaba)
- `appointments` → calendario en vivo (ya funcionaba)

`patients` NO tiene Realtime habilitado en la BD. Para sincronización de la lista de pacientes mantener el patrón actual de refetch en cambios.

---

## Manejo de soft delete en patients

```js
// SIEMPRE filtrar pacientes activos con:
.is('deleted_at', null)

// Para "archivar" un paciente (no eliminar físicamente):
await supabase
  .from('patients')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', patientId);
```

---

## Resumen de renombres críticos

| Antes | Ahora | Afecta |
|---|---|---|
| tabla `users` | tabla `patients` | todos los módulos |
| `users.id` (phone string) | `patients.id` (UUID) | Calendar, Patients, Conversations, History |
| `appointments.user_id` | `appointments.patient_id` | Calendar, Stats |
| `appointments.status = 'active'` | `status = 'scheduled'` | Calendar, Stats |
| `history.user_id` (phone) | `history.patient_id` (UUID) | Conversations, History |
| `setHumanTakeover(id, false)` | `rpc('reactivate_bot', {id})` | Conversations |
| `getStatsOverview()` directo | `mv_business_stats` + `mv_patient_stats` | Stats |
| Edge Function auth-login | `supabase.auth.signInWithPassword` | Login |
| `supabaseAdmin` en frontend | ❌ eliminar | todos |
| `callEdgeFunction` | ❌ eliminar | todos |
