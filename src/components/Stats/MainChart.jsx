import { useMemo, useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';

const PERIODS = [
    { key: 'day', label: 'Día' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
];

// Helpers para agrupar
function getWeekKey(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

function formatWeekLabel(mondayStr) {
    const mon = new Date(mondayStr + 'T12:00:00');
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${fmt(mon)}-${fmt(sun)}`;
}

export function MainChart({ rawApts }) {
    const [period, setPeriod] = useState('week');

    const data = useMemo(() => {
        if (!rawApts) return [];

        const today = new Date();
        today.setHours(12, 0, 0, 0); // Evitar problemas de timezone

        const generatedData = [];

        if (period === 'day') {
            // Monday to Sunday of the current week
            const dayOfWeek = today.getDay();
            const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(today);
            monday.setDate(diff);

            for (let i = 0; i < 7; i++) {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                const key = d.toISOString().split('T')[0];
                const label = d.toLocaleDateString('es-GT', { weekday: 'short', day: '2-digit' }).replace('.', '');
                generatedData.push({ key, name: label, turnos: 0, completed: 0, cancelled: 0 });
            }
        } else if (period === 'week') {
            // 4 weeks ago to 1 week ahead (6 weeks total)
            const dayOfWeek = today.getDay();
            const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const mondayThisWeek = new Date(today);
            mondayThisWeek.setDate(diff);
            
            const startMonday = new Date(mondayThisWeek);
            startMonday.setDate(startMonday.getDate() - 28);

            for (let i = 0; i < 6; i++) {
                const d = new Date(startMonday);
                d.setDate(startMonday.getDate() + (i * 7));
                const key = getWeekKey(d);
                const label = formatWeekLabel(key);
                generatedData.push({ key, name: label, turnos: 0, completed: 0, cancelled: 0 });
            }
        } else if (period === 'month') {
            // Jan to Dec current year
            const year = today.getFullYear();
            for (let i = 0; i < 12; i++) {
                const d = new Date(year, i, 15);
                const key = `${year}-${String(i + 1).padStart(2, '0')}`;
                let label = d.toLocaleDateString('es-GT', { month: 'short' }).replace('.', '');
                label = label.charAt(0).toUpperCase() + label.slice(1);
                generatedData.push({ key, name: label, turnos: 0, completed: 0, cancelled: 0 });
            }
        }

        const map = {};
        generatedData.forEach(item => {
            map[item.key] = item;
        });

        rawApts.forEach(apt => {
            const d = new Date(apt.date_start);
            let key;
            if (period === 'day') {
                key = d.toISOString().split('T')[0];
            } else if (period === 'week') {
                key = getWeekKey(d);
            } else {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }

            if (map[key]) {
                if (apt.status !== 'cancelled') {
                    map[key].turnos++;
                }
                if (apt.status === 'completed') map[key].completed++;
                if (apt.status === 'cancelled') map[key].cancelled++;
            }
        });

        return generatedData;
    }, [rawApts, period]);


    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="font-bold text-navy-900 text-sm tracking-tight mb-1">Turnos por período</h3>
                    <p className="text-[10px] text-navy-900/40 font-bold tracking-tight">
                        {period === 'day' ? 'Esta semana (Lun-Dom)' : period === 'week' ? 'Vistazo de 6 semanas' : `Año ${new Date().getFullYear()}`}
                    </p>
                </div>

                {/* Period Selector */}
                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-0.5 shadow-sm">
                    {PERIODS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-tight transition-all ${
                                period === p.key
                                    ? 'bg-white shadow-sm text-navy-900'
                                    : 'text-navy-700/60 hover:text-navy-900'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                {data.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-navy-900/30">
                        <p className="text-xs font-bold">Sin datos para este período</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorTurnos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.6}/>
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                dy={10}
                                interval={0}
                                angle={period === 'day' ? -45 : 0}
                                textAnchor={period === 'day' ? 'end' : 'middle'}
                                height={period === 'day' ? 50 : 30}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: '#1A3A6B',
                                    border: 'none',
                                    borderRadius: 12,
                                    color: 'white',
                                    fontSize: 12,
                                    padding: '8px 12px',
                                    boxShadow: '0 10px 25px rgba(26,58,107,0.3)'
                                }}
                                itemStyle={{ color: 'white', fontWeight: 'bold' }}
                                labelStyle={{ color: '#9CA3AF', marginBottom: '4px', fontSize: 11 }}
                                cursor={{ stroke: 'rgba(26,58,107,0.1)', strokeWidth: 2, fill: 'none' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="turnos"
                                stroke="#10B981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorTurnos)"
                                name="Turnos"
                                activeDot={{ r: 6, fill: '#10B981', stroke: 'white', strokeWidth: 2 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
