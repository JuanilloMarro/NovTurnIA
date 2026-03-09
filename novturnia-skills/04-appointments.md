# Skill: Appointments — CRUD de Turnos

## Cuándo usar esta skill
- Al crear, confirmar o cancelar turnos desde el dashboard
- Al modificar el modal de nuevo turno
- Al modificar el drawer de detalle

---

## Crear turno

```javascript
// services/supabaseService.js
export async function createAppointment({ userId, date, startTime, endTime }) {
  // Verificar disponibilidad primero
  const dateStr = date instanceof Date ? date.toISOString().slice(0, 10) : date;
  const { data: existing } = await supabase
    .from('appointments')
    .select('id, date_start, date_end')
    .eq('business_id', BUSINESS_ID)
    .eq('status', 'active')
    .gte('date_start', `${dateStr}T00:00:00`)
    .lt('date_start', `${dateStr}T23:59:59`);

  const startDec = timeToDecimal(startTime);
  const endDec   = timeToDecimal(endTime);
  const conflict = (existing || []).find(a => {
    const aStart = timeToDecimal(a.date_start.slice(11, 16));
    const aEnd   = timeToDecimal(a.date_end.slice(11, 16));
    return startDec < aEnd && endDec > aStart;
  });

  if (conflict) throw new Error('Ya existe un turno en ese horario');

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      business_id: BUSINESS_ID,
      user_id:     userId,
      date_start:  toISO(date, startTime),
      date_end:    toISO(date, endTime),
      status:      'active',
      confirmed:   false,
      notif_24hs:  false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function timeToDecimal(str) {
  const [h, m] = str.slice(0, 5).split(':').map(Number);
  return h + m / 60;
}

function toISO(date, time) {
  const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
  const [h, m] = time.split(':').map(Number);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00`;
}
```

---

## Modal nuevo turno

```jsx
// components/Calendar/NewAppointmentModal.jsx
import { useState } from 'react';
import { createAppointment } from '../../services/supabaseService';
import { getPatients } from '../../services/supabaseService';

const TIME_SLOTS = Array.from({ length: 9 }, (_, i) => {
  const h = i + 9;
  return `${String(h).padStart(2, '0')}:00`;
}); // ['09:00', '10:00', ... '17:00']

export default function NewAppointmentModal({ onClose, onCreated }) {
  const [patientId,  setPatientId]  = useState('');
  const [patientQ,   setPatientQ]   = useState('');
  const [patients,   setPatients]   = useState([]);
  const [date,       setDate]       = useState('');
  const [startTime,  setStartTime]  = useState('09:00');
  const [endTime,    setEndTime]    = useState('10:00');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  async function searchPatients(q) {
    setPatientQ(q);
    if (q.length < 2) return setPatients([]);
    const data = await getPatients(q);
    setPatients(data);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!patientId) return setError('Selecciona un paciente');
    setError(''); setLoading(true);
    try {
      await createAppointment({ userId: patientId, date, startTime, endTime });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-modal border border-white/90 rounded-2xl shadow-modal w-full max-w-md p-7 animate-fade-up">
        <h2 className="text-lg font-bold text-navy-900 mb-5">Nuevo turno</h2>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Búsqueda de paciente */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Paciente</label>
            <input
              className="mt-1 w-full bg-white/65 border border-navy-100/50 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:bg-white focus:border-navy-500 focus:ring-2 focus:ring-navy-100 transition-all"
              value={patientQ}
              onChange={e => searchPatients(e.target.value)}
              placeholder="Buscar paciente..."
            />
            {patients.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-modal overflow-hidden">
                {patients.map(p => (
                  <button key={p.id} type="button"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy-50 transition-colors"
                    onClick={() => { setPatientId(p.id); setPatientQ(p.display_name || p.id); setPatients([]); }}
                  >
                    <span className="font-medium text-navy-900">{p.display_name || '—'}</span>
                    <span className="text-gray-400 ml-2">+{p.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="mt-1 w-full bg-white/65 border border-navy-100/50 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:bg-white focus:border-navy-500 focus:ring-2 focus:ring-navy-100 transition-all"
            />
          </div>

          {/* Horario */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Inicio</label>
              <select value={startTime} onChange={e => { setStartTime(e.target.value); setEndTime(`${String(parseInt(e.target.value)+1).padStart(2,'0')}:00`); }}
                className="mt-1 w-full bg-white/65 border border-navy-100/50 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:bg-white focus:border-navy-500 transition-all">
                {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fin</label>
              <select value={endTime} onChange={e => setEndTime(e.target.value)}
                className="mt-1 w-full bg-white/65 border border-navy-100/50 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:bg-white focus:border-navy-500 transition-all">
                {TIME_SLOTS.slice(1).concat(['18:00']).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-white/70 border border-white/60 text-gray-600 text-sm font-medium py-2.5 rounded-full transition-all hover:bg-white">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-navy-700 hover:bg-navy-900 text-white text-sm font-semibold py-2.5 rounded-full shadow-btn transition-all disabled:opacity-60">
              {loading ? 'Guardando...' : 'Guardar turno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Drawer detalle del turno

```jsx
// components/Calendar/AppointmentDrawer.jsx
import { cancelAppointment, confirmAppointment } from '../../services/supabaseService';

export default function AppointmentDrawer({ appointment, onClose, onUpdated }) {
  const { id, date_start, date_end, status, confirmed, users } = appointment;

  const statusLabel = status === 'cancelled' ? 'cancelled' : confirmed ? 'confirmed' : 'pending';
  const badgeClass  = {
    confirmed: 'bg-emerald-50 text-emerald-700',
    pending:   'bg-amber-50 text-amber-700',
    cancelled: 'bg-red-50 text-red-700',
  }[statusLabel];

  async function handleCancel() {
    if (!confirm('¿Cancelar este turno?')) return;
    await cancelAppointment(id);
    onUpdated(); onClose();
  }

  async function handleConfirm() {
    await confirmAppointment(id);
    onUpdated();
  }

  return (
    <div className="fixed top-3 right-3 bottom-3 w-80 bg-white/95 backdrop-blur-modal border border-white/90 rounded-2xl shadow-modal p-6 z-50 overflow-y-auto animate-drawer-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-navy-900">Detalle del turno</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Paciente</div>
          <div className="font-semibold text-navy-900">{users?.display_name || '—'}</div>
          <div className="text-sm text-gray-400">+{appointment.user_id}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Fecha y hora</div>
          <div className="text-sm text-gray-700">
            {new Date(date_start).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guatemala' })}
          </div>
          <div className="text-sm text-gray-500">
            {new Date(date_start).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true })}
            {' → '}
            {new Date(date_end).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Estado</div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
            {statusLabel === 'confirmed' ? 'Confirmado' : statusLabel === 'pending' ? 'Pendiente' : 'Cancelado'}
          </span>
        </div>
      </div>

      {status === 'active' && (
        <div className="mt-6 space-y-2">
          {!confirmed && (
            <button onClick={handleConfirm}
              className="w-full bg-navy-700 hover:bg-navy-900 text-white text-sm font-semibold py-2.5 rounded-full shadow-btn transition-all">
              ✓ Confirmar turno
            </button>
          )}
          <button onClick={handleCancel}
            className="w-full bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold py-2.5 rounded-full transition-all">
            Cancelar turno
          </button>
        </div>
      )}
    </div>
  );
}
```
