import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Curva de nuevos vs recurrentes por mes (últimos 6 meses) — RPC get_stats_dashboard
// ya trae el desglose (patient_monthly_stats), aquí solo se formatea y grafica.
// Sin header propio: vive dentro de una Card de Inteligencia que pone título y leyenda.
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function monthLabel(key) {
    const m = Number(String(key).slice(5, 7)) - 1;
    return MONTH_SHORT[m] ?? key;
}

export function ClientsTrendChart({ trend = [] }) {
    const data = trend.map(r => ({
        name: monthLabel(r.month),
        Nuevos: Number(r.new_count || 0),
        Recurrentes: Number(r.recurring_count || 0),
    }));
    const hasData = data.some(d => d.Nuevos > 0 || d.Recurrentes > 0);

    if (!hasData) {
        return (
            <div className="h-full flex items-center justify-center text-navy-900/30">
                <p className="text-xs font-bold">Sin turnos confirmados en este rango</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                    <linearGradient id="gradClientsNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradClientsRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4062C8" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#4062C8" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                    contentStyle={{ background: '#0F2044', border: 'none', borderRadius: 12, color: 'white', fontSize: 11, padding: '8px 12px', boxShadow: '0 10px 25px rgba(15,32,68,0.25)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    labelStyle={{ color: '#cbd5e1', marginBottom: 4, fontSize: 11 }}
                    cursor={{ stroke: 'rgba(15,32,68,0.15)', strokeDasharray: '3 3' }}
                />
                <Area type="monotone" dataKey="Recurrentes" stroke="#4062C8" strokeWidth={2.5} fill="url(#gradClientsRec)"
                    dot={{ r: 3, fill: '#4062C8', stroke: 'white', strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
                <Area type="monotone" dataKey="Nuevos" stroke="#10B981" strokeWidth={2.5} fill="url(#gradClientsNew)"
                    dot={{ r: 3, fill: '#10B981', stroke: 'white', strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
            </AreaChart>
        </ResponsiveContainer>
    );
}
