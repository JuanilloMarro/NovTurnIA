# Skill: Supabase — Queries y Realtime

## Cuándo usar esta skill
- Al crear o modificar queries
- Al configurar suscripciones en tiempo real
- Al cambiar estructura de tablas
- Al debuggear errores de base de datos

---

## Configuración (config/supabase.js)

```javascript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://scjvhrzdlnwktzcejrgl.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Business ID siempre desde la URL
export const BUSINESS_ID = parseInt(
  new URLSearchParams(window.location.search).get('bid') || '1'
);
```

**REGLA CRÍTICA:** Todas las queries SIEMPRE incluyen `business_id` igual a `BUSINESS_ID`.

---

## Esquema de Tablas (Plan Pro)

### businesses
```sql
id              serial primary key
name            varchar(100)
schedule_start  integer default 9
schedule_end    integer default 18
appointment_duration integer default 60
timezone        varchar(50) default 'America/Guatemala'
active          boolean default true
created_at      timestamp with time zone default now()
```

### users (pacientes)
```sql
id              varchar(20) primary key  -- número de teléfono ej: 50247989357
business_id     integer references businesses(id)
display_name    varchar(100)
created_at      timestamp with time zone default now()
```

### appointments
```sql
id              serial primary key
business_id     integer references businesses(id)
user_id         varchar(20) references users(id)
date_start      timestamp without time zone  -- NUNCA with time zone
date_end        timestamp without time zone  -- NUNCA with time zone
status          varchar(20) default 'active' -- active / cancelled
notif_24hs      boolean default false
confirmed       boolean default false
created_at      timestamp with time zone default now()
```

### conversation_history
```sql
id              serial primary key
business_id     integer references businesses(id)
user_id         varchar(20)
role            varchar(20)  -- 'user' o 'assistant'
content         text
created_at      timestamp with time zone default now()
```

---

## Queries CRUD (services/supabaseService.js)

```javascript
import { supabase, BUSINESS_ID } from '../config/supabase';

// ── Appointments ──────────────────────────────────────────
export async function getAppointmentsByWeek(weekStart, weekEnd) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, users(display_name)')
    .eq('business_id', BUSINESS_ID)
    .gte('date_start', weekStart)
    .lt('date_start', weekEnd)
    .order('date_start', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAppointment(payload) {
  const { data, error } = await supabase
    .from('appointments')
    .insert({ ...payload, business_id: BUSINESS_ID })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelAppointment(id) {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('business_id', BUSINESS_ID);

  if (error) throw error;
}

export async function confirmAppointment(id) {
  const { error } = await supabase
    .from('appointments')
    .update({ confirmed: true })
    .eq('id', id)
    .eq('business_id', BUSINESS_ID);

  if (error) throw error;
}

// ── Patients ──────────────────────────────────────────────
export async function getPatients(search = '') {
  let query = supabase
    .from('users')
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`display_name.ilike.%${search}%,id.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPatientHistory(userId) {
  const { data, error } = await supabase
    .from('conversation_history')
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ── Stats ─────────────────────────────────────────────────
export async function getStatsOverview() {
  const startOfMonth = new Date(
    new Date().getFullYear(), new Date().getMonth(), 1
  ).toISOString().slice(0, 10);

  const [{ count: totalPatients }, { count: totalApts }, { count: monthApts }] =
    await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true })
        .eq('business_id', BUSINESS_ID),
      supabase.from('appointments').select('*', { count: 'exact', head: true })
        .eq('business_id', BUSINESS_ID).eq('status', 'active'),
      supabase.from('appointments').select('*', { count: 'exact', head: true })
        .eq('business_id', BUSINESS_ID).eq('status', 'active')
        .gte('date_start', startOfMonth),
    ]);

  return { totalPatients, totalApts, monthApts };
}
```

---

## Supabase Realtime

### Habilitar en Supabase Dashboard
Ir a **Database → Replication** y activar las tablas:
- `appointments` ✅
- `users` ✅

### Hook de suscripción (patrón estándar)

```javascript
import { useEffect } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';

export function useRealtimeAppointments(onUpdate) {
  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',           // INSERT | UPDATE | DELETE | *
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${BUSINESS_ID}`
        },
        (payload) => {
          console.log('Cambio en appointments:', payload.eventType);
          onUpdate(payload);
        }
      )
      .subscribe();

    // Limpiar suscripción al desmontar
    return () => supabase.removeChannel(channel);
  }, [onUpdate]);
}
```

### Eventos disponibles de Realtime

| Evento | Cuándo llega |
|--------|-------------|
| `INSERT` | Nuevo turno creado (por bot o dashboard) |
| `UPDATE` | Turno confirmado, cancelado o modificado |
| `DELETE` | Turno eliminado físicamente |
| `*` | Todos los anteriores |

### Estrategia recomendada
Al recibir cualquier cambio, **recargar los datos del período visible** en lugar de mutar el estado manualmente. Es más simple y evita inconsistencias:

```javascript
// En el hook useAppointments.js
const handleRealtimeUpdate = useCallback(() => {
  loadWeekAppointments(currentWeekStart);
}, [currentWeekStart]);

useRealtimeAppointments(handleRealtimeUpdate);
```

---

## Formato de Fechas — CRÍTICO

`date_start` y `date_end` son `timestamp WITHOUT time zone` — guardan hora Guatemala directa.

```javascript
// Guardar en Supabase (sin offset)
function toISO(date, time) {
  const [h, m] = time.split(':');
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00`;
}

// Mostrar al usuario
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('es-GT', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Guatemala', hour12: true
  });
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/Guatemala'
  });
}
```

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| Datos de otro cliente | Falta `business_id` en query | Siempre `.eq('business_id', BUSINESS_ID)` |
| Hora con +6 horas | Columna `with time zone` | Usar `without time zone` |
| Realtime no llega | Tabla sin replicación activada | Activar en Supabase → Replication |
| Suscripción duplicada | `useEffect` sin cleanup | Siempre retornar `() => supabase.removeChannel(channel)` |
| N+1 queries | `await` dentro de `.map()` | Usar `Promise.all()` |
