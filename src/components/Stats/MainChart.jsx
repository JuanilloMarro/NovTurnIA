import { useMemo, useState, useEffect } from 'react';
import { getAppointmentTrend } from '../../services/supabaseService';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';

const PERIODS = [
    { key: 'day', label: 'Día' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
];

// ── Date range helpers ────────────────────────────────────────────────────────

function getDayRange() {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 7);
    return { start: monday.toISOString(), end: end.toISOString() };
}

function getWeekRange() {
    // 4 weeks back → 1 week ahead (6 weeks total)
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    const start = new Date(monday);
    start.setDate(monday.getDate() - 28);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 14);
    return { start: start.toISOString(), end: end.toISOString() };
}

function getMonthRange() {
    const year = new Date().getFullYear();
    return {
        start: new Date(year, 0, 1).toISOString(),
        end: new Date(year + 1, 0, 1).toISOString(),
    };
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function formatWeekLabel(mondayStr) {
    const mon = new Date(mondayStr + 'T12:00:00');
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${fmt(mon)}-${fmt(sun)}`;
}

// ── Slot generation (empty grid for each period) ──────────────────────────────

function buildSlots(period) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    if (period === 'day') {
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('es-GT', { weekday: 'short', day: '2-digit' }).replace('.', '');
            return { key, name: label, turnos: 0, completed: 0, cancelled: 0 };
        });
    }

    if (period === 'week') {
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
        const start = new Date(monday);
        start.setDate(monday.getDate() - 28);
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i * 7);
            const key = d.toISOString().split('T')[0];
            return { key, name: formatWeekLabel(key), turnos: 0, completed: 0, cancelled: 0 };
        });
    }

    // month
    const year = today.getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(year, i, 15);
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        let label = d.toLocaleDateString('es-GT', { month: 'short' }).replace('.', '');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        return { key, name: label, turnos: 0, completed: 0, cancelled: 0 };
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MainChart() {
    const [period, setPeriod] = useState('week');
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchTrend() {
            setLoading(true);
            try {
                const range = period === 'day' ? getDayRange()
                    : period === 'week' ? getWeekRange()
                    : getMonthRange();
                const rows = await getAppointmentTrend(period, range.start, range.end);
                if (!cancelled) setTrendData(rows);
            } catch (err) {
                console.error('Error loading trend:', err);
                if (!cancelled) setTrendData([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchTrend();
        return () => { cancelled = true; };
    }, [period]);

    // Merge aggregated server rows into the pre-generated slot grid
    const data = useMemo(() => {
        const slots = buildSlots(period);
        const map = Object.fromEntries(slots.map(s => [s.key, s]));
        trendData.forEach(row => {
            if (map[row.period]) {
                map[row.period].turnos    = (row.total ?? 0) - (row.cancelled ?? 0);
                map[row.period].completed = row.completed ?? 0;
                map[row.period].cancelled = row.cancelled ?? 0;
            }
        });
        return slots;
    }, [trendData, period]);

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
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-navy-900/20 border-t-navy-900/60 rounded-full animate-spin" />
                    </div>
                ) : data.length === 0 ? (
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
