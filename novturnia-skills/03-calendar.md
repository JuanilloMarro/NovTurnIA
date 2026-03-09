# Skill: Calendario Semanal — React

## Cuándo usar esta skill
- Al modificar el calendario semanal
- Al cambiar cómo se renderizan los eventos
- Al debuggear posicionamiento de turnos

---

## Lógica de navegación semanal

```javascript
// hooks/useAppointments.js
import { useState, useEffect, useCallback } from 'react';
import { getAppointmentsByWeek } from '../services/supabaseService';
import { useRealtimeAppointments } from './useRealtime';

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function useAppointments() {
  const [weekStart, setWeekStart]       = useState(getMonday(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppointmentsByWeek(
        weekStart.toISOString().slice(0, 10),
        weekEnd.toISOString().slice(0, 10)
      );
      setAppointments(data);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  // Recargar al recibir cambio en tiempo real
  useRealtimeAppointments(load);

  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  const goToday  = () => setWeekStart(getMonday(new Date()));

  return { appointments, loading, weekStart, weekEnd, prevWeek, nextWeek, goToday };
}
```

---

## Posicionamiento de eventos — CRÍTICO

Cada hora = **60px**. Horario visible: **09:00 a 18:00** = 540px total.

```javascript
// utils/calendarUtils.js
const BASE_HOUR = 9;
const PX_PER_HOUR = 60;

export function getEventStyle(dateStart, dateEnd) {
  const toDecimal = iso => {
    const d = new Date(iso);
    const h = parseInt(d.toLocaleTimeString('es-GT', { hour: '2-digit', hour12: false, timeZone: 'America/Guatemala' }));
    return h + d.getMinutes() / 60;
  };

  const start  = toDecimal(dateStart);
  const end    = toDecimal(dateEnd);
  const top    = (start - BASE_HOUR) * PX_PER_HOUR;
  const height = (end - start) * PX_PER_HOUR;

  return {
    top:    `${Math.max(top, 0)}px`,
    height: `${Math.max(height, 28)}px`,
    position: 'absolute',
    left: '4px',
    right: '4px',
  };
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth()    === date2.getMonth() &&
    date1.getDate()     === date2.getDate()
  );
}
```

---

## Componente CalendarWeek.jsx

```jsx
import { getWeekDays, getEventStyle, isSameDay } from '../../utils/calendarUtils';
import CalendarEvent from './CalendarEvent';

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9 a 17

export default function CalendarWeek({ appointments, weekStart, loading }) {
  const days = getWeekDays(weekStart);

  return (
    <div className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card overflow-hidden">

      {/* Header días */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-100">
        <div className="p-2 text-xs text-gray-400 text-center">GMT-6</div>
        {days.map(day => (
          <div key={day} className="p-2 text-center border-l border-gray-100">
            <div className="text-xs text-gray-400 uppercase">
              {day.toLocaleDateString('es-GT', { weekday: 'short' })}
            </div>
            <div className={`text-sm font-semibold mt-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full
              ${isSameDay(day, new Date()) ? 'bg-navy-700 text-white' : 'text-gray-700'}`}>
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Cuerpo */}
      <div className="grid grid-cols-[64px_1fr] overflow-y-auto" style={{ height: '540px' }}>

        {/* Gutter de horas */}
        <div>
          {HOURS.map(h => (
            <div key={h} className="h-[60px] flex items-start justify-end pr-2 pt-1">
              <span className="text-xs text-gray-400">{h}:00</span>
            </div>
          ))}
        </div>

        {/* Columnas de días */}
        <div className="grid grid-cols-7">
          {days.map(day => (
            <div key={day} className="relative border-l border-gray-100" style={{ minHeight: '540px' }}>

              {/* Líneas de hora */}
              {HOURS.map(h => (
                <div key={h} className="absolute w-full border-t border-gray-100/80" style={{ top: `${(h - 9) * 60}px` }} />
              ))}

              {/* Eventos del día */}
              {appointments
                .filter(apt => isSameDay(new Date(apt.date_start), day))
                .map(apt => (
                  <CalendarEvent
                    key={apt.id}
                    appointment={apt}
                    style={getEventStyle(apt.date_start, apt.date_end)}
                  />
                ))
              }
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
```

---

## Colores de eventos

```jsx
// CalendarEvent.jsx
export default function CalendarEvent({ appointment, style, onClick }) {
  const colors = {
    confirmed: 'bg-navy-500/10 border-navy-500 text-navy-700',
    pending:   'bg-amber-500/10 border-amber-500 text-amber-800',
    cancelled: 'bg-red-500/8  border-red-400   text-red-600 opacity-50',
  };

  const status = appointment.status === 'cancelled' ? 'cancelled'
    : appointment.confirmed ? 'confirmed' : 'pending';

  return (
    <div
      style={style}
      onClick={() => onClick?.(appointment)}
      className={`border-l-2 rounded-r-lg px-2 py-1 cursor-pointer hover:brightness-95 transition-all text-xs overflow-hidden ${colors[status]}`}
    >
      <div className="font-semibold truncate">
        {appointment.users?.display_name || appointment.user_id}
      </div>
      <div className="opacity-70">
        {new Date(appointment.date_start).toLocaleTimeString('es-GT', {
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true
        })}
      </div>
    </div>
  );
}
```

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| Evento en hora incorrecta | Parsear sin `timeZone: 'America/Guatemala'` | Siempre pasar timezone al parsear |
| Eventos superpuestos en grilla | Falta `position: relative` en columna | Agregar al contenedor del día |
| Realtime no actualiza el calendario | `load` no está en dependencias del useEffect | Usar `useCallback` en `load` |
