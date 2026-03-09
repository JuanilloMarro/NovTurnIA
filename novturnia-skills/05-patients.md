# Skill: Pacientes — Módulo React

## Cuándo usar esta skill
- Al modificar la lista de pacientes
- Al modificar el drawer de detalle
- Al modificar el historial conversacional

---

## Hook usePatients

```javascript
// hooks/usePatients.js
import { useState, useCallback } from 'react';
import { getPatients } from '../services/supabaseService';
import { useRealtimePatients } from './useRealtime';

export function usePatients() {
  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');

  const load = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const data = await getPatients(q);
      setPatients(data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Búsqueda con debounce
  function handleSearch(q) {
    setSearch(q);
    clearTimeout(window._patientSearchTimeout);
    window._patientSearchTimeout = setTimeout(() => load(q), 300);
  }

  // Realtime
  useRealtimePatients(load);

  return { patients, loading, search, handleSearch, reload: load };
}
```

---

## PatientCard

```jsx
// components/Patients/PatientCard.jsx
const AVATAR_GRADIENTS = [
  'from-navy-700 to-navy-500',
  'from-emerald-700 to-emerald-500',
  'from-cyan-700 to-cyan-500',
  'from-amber-700 to-amber-500',
  'from-rose-700 to-rose-500',
];

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PatientCard({ patient, index, onClick }) {
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const name     = patient.display_name || `+${patient.id}`;

  return (
    <div
      onClick={() => onClick(patient)}
      className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card p-4 hover:shadow-card-hover hover:-translate-y-px transition-all duration-200 cursor-pointer animate-fade-up"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
          {getInitials(patient.display_name)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-navy-900 text-sm truncate">{name}</div>
          <div className="text-xs text-gray-400">+{patient.id}</div>
        </div>
        <span className="ml-auto text-gray-300 text-lg">›</span>
      </div>
    </div>
  );
}
```

---

## PatientDrawer con historial

```jsx
// components/Patients/PatientDrawer.jsx
import { useEffect, useState } from 'react';
import { getPatientHistory } from '../../services/supabaseService';

export default function PatientDrawer({ patient, onClose }) {
  const [history, setHistory] = useState([]);
  const [tab,     setTab]     = useState('info'); // 'info' | 'history'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  async function loadHistory() {
    setLoading(true);
    const data = await getPatientHistory(patient.id);
    setHistory(data);
    setLoading(false);
  }

  const name = patient.display_name || `+${patient.id}`;

  return (
    <div className="fixed top-3 right-3 bottom-3 w-96 bg-white/95 backdrop-blur-modal border border-white/90 rounded-2xl shadow-modal z-50 flex flex-col animate-drawer-in">

      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <h3 className="font-bold text-navy-900">Perfil del paciente</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      {/* Avatar + nombre */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-navy-700 to-navy-500 flex items-center justify-center text-white font-bold text-base">
          {name[0]?.toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-navy-900">{name}</div>
          <div className="text-sm text-gray-400">+{patient.id}</div>
          <div className="text-xs text-gray-400">
            Desde {new Date(patient.created_at).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-5">
        {['info', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-navy-700 text-navy-700' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t === 'info' ? 'Información' : 'Conversación'}
          </button>
        ))}
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'info' && (
          <div className="space-y-3 text-sm text-gray-600">
            <div><span className="font-semibold text-gray-400">Teléfono:</span> +{patient.id}</div>
            <div><span className="font-semibold text-gray-400">Nombre:</span> {patient.display_name || '—'}</div>
            <div><span className="font-semibold text-gray-400">Registrado:</span> {new Date(patient.created_at).toLocaleDateString('es-GT')}</div>
          </div>
        )}

        {tab === 'history' && (
          loading
            ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="animate-shimmer h-10 rounded-xl" />)}</div>
            : history.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">Sin conversaciones registradas</p>
              : (
                <div className="space-y-3">
                  {history.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-navy-700 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-700 rounded-bl-sm'
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-navy-200' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )
        )}
      </div>
    </div>
  );
}
```

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `display_name` null | Paciente sin nombre en WhatsApp | Mostrar `+{id}` como fallback |
| Búsqueda no funciona | Caracteres especiales | Query usa `.ilike.%${search}%` — funciona con Supabase |
| Historial no carga al cambiar de tab | `useEffect` sin `tab` en deps | Agregar `tab` a las dependencias |
