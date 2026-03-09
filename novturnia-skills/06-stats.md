# Skill: Estadísticas y Gráficas — Recharts

## Cuándo usar esta skill
- Al agregar o modificar gráficas
- Al agregar KPI cards
- Al modificar el módulo de estadísticas

---

## Librerías necesarias

```bash
npm install recharts
```

---

## KPI Cards

```jsx
// components/Stats/KpiCard.jsx
export default function KpiCard({ label, value, sub, icon, color = 'navy', index = 0 }) {
  const colors = {
    navy:    'from-navy-700 to-navy-500',
    emerald: 'from-emerald-700 to-emerald-500',
    amber:   'from-amber-600 to-amber-400',
    rose:    'from-rose-700 to-rose-500',
  };

  return (
    <div
      className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card p-5 animate-fade-up"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-base`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-navy-900 tracking-tight">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
```

---

## Gráfica de turnos por día (BarChart)

```jsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

// data esperada:
// [{ day: 'Lun', turnos: 5 }, { day: 'Mar', turnos: 3 }, ...]

export function AppointmentsByDayChart({ data }) {
  return (
    <div className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card p-5">
      <h3 className="font-semibold text-navy-900 mb-4 text-sm">Turnos por día</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: 'white', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13 }}
            cursor={{ fill: 'rgba(26,58,107,0.04)' }}
          />
          <Bar dataKey="turnos" fill="#1A3A6B" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Gráfica de estado de turnos (PieChart)

```jsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// data esperada:
// [{ name: 'Confirmados', value: 12 }, { name: 'Pendientes', value: 5 }, { name: 'Cancelados', value: 2 }]

const PIE_COLORS = ['#1A3A6B', '#F59E0B', '#EF4444'];

export function AppointmentStatusChart({ data }) {
  return (
    <div className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card p-5">
      <h3 className="font-semibold text-navy-900 mb-4 text-sm">Estado de turnos</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'white', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Gráfica de pacientes nuevos por mes (LineChart)

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// data esperada:
// [{ month: 'Ene', pacientes: 8 }, { month: 'Feb', pacientes: 12 }, ...]

export function NewPatientsChart({ data }) {
  return (
    <div className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card p-5">
      <h3 className="font-semibold text-navy-900 mb-4 text-sm">Pacientes nuevos por mes</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: 'white', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13 }}
          />
          <Line type="monotone" dataKey="pacientes" stroke="#1A3A6B" strokeWidth={2.5} dot={{ fill: '#1A3A6B', r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Hook useStats

```javascript
// hooks/useStats.js
import { useState, useEffect } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';

export function useStats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
      const startOfWeek  = (() => {
        const d = new Date(now);
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        return d.toISOString().slice(0,10);
      })();

      const [
        { count: totalPatients },
        { count: totalApts },
        { count: monthApts },
        { count: weekApts },
        { data: byStatus },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).eq('status', 'active'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).gte('date_start', startOfMonth),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID).gte('date_start', startOfWeek),
        supabase.from('appointments').select('status, confirmed').eq('business_id', BUSINESS_ID),
      ]);

      const confirmed = byStatus?.filter(a => a.confirmed && a.status === 'active').length || 0;
      const pending   = byStatus?.filter(a => !a.confirmed && a.status === 'active').length || 0;
      const cancelled = byStatus?.filter(a => a.status === 'cancelled').length || 0;

      setStats({
        totalPatients, totalApts, monthApts, weekApts,
        pieData: [
          { name: 'Confirmados', value: confirmed },
          { name: 'Pendientes',  value: pending },
          { name: 'Cancelados',  value: cancelled },
        ]
      });
    } finally {
      setLoading(false);
    }
  }

  return { stats, loading };
}
```

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| Gráfica no renderiza | Falta `ResponsiveContainer` | Siempre envolver en `ResponsiveContainer` |
| Tooltip con fondo negro | Estilo por defecto de Recharts | Usar `contentStyle` en el `Tooltip` |
| Barras sin redondear | Falta `radius` en `Bar` | Agregar `radius={[6,6,0,0]}` |
| Datos vacíos en gráfica | Promise.all sin manejo de null | Siempre `data || []` |
