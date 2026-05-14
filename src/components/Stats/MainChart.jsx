import { useMemo, useState, useEffect } from 'react';
import { getAppointmentTrend } from '../../services/supabaseService';
import { getStatsDateRange } from '../../hooks/useStats';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';
import { BarChart2 } from 'lucide-react';

// ── Label helpers ─────────────────────────────────────────

function formatWeekLabel(mondayStr) {
    const mon = new Date(mondayStr + 'T12:00:00');
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const fmt = d => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${fmt(mon)} · ${fmt(sun)}`;
}

// ── Slot generation (usa el mismo ancla que getStatsDateRange) ────────────────

function buildSlots(period, year, month, day = null) {
    const now            = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const anchor         = new Date(day != null ? new Date(year, month, day) : (isCurrentMonth ? now : new Date(year, month, 15)));
    anchor.setHours(12, 0, 0, 0);

    if (period === 'day') {
        const dow    = anchor.getDay();
        const monday = new Date(anchor);
        monday.setDate(anchor.getDate() - dow + (dow === 0 ? -6 : 1));
        return Array.from({ length: 7 }, (_, i) => {
            const d   = new Date(monday);
            d.setDate(monday.getDate() + i);
            const key   = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('es-GT', { weekday: 'short', day: '2-digit' }).replace('.', '');
            return { key, name: label, turnos: 0, no_show: 0, cancelled: 0 };
        });
    }

    if (period === 'week') {
        const dow    = anchor.getDay();
        const monday = new Date(anchor);
        monday.setDate(anchor.getDate() - dow + (dow === 0 ? -6 : 1));
        const start = new Date(monday);
        start.setDate(monday.getDate() - 28);
        return Array.from({ length: 6 }, (_, i) => {
            const d   = new Date(start);
            d.setDate(start.getDate() + i * 7);
            const key = d.toISOString().split('T')[0];
            return { key, name: formatWeekLabel(key), turnos: 0, no_show: 0, cancelled: 0 };
        });
    }

    // month: los 12 meses del año seleccionado
    return Array.from({ length: 12 }, (_, i) => {
        const d   = new Date(year, i, 15);
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        let label = d.toLocaleDateString('es-GT', { month: 'short' }).replace('.', '');
        label     = label.charAt(0).toUpperCase() + label.slice(1);
        return { key, name: label, turnos: 0, no_show: 0, cancelled: 0 };
    });
}

// ── Subtítulo del gráfico según período ──────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function chartSubtitle(period, year, month) {
    if (period === 'day')   return `Semana · ${MONTH_NAMES[month]} ${year}`;
    if (period === 'week')  return `6 semanas · ${MONTH_NAMES[month]} ${year}`;
    return `Año ${year}`;
}

// ── Component ─────────────────────────────────────────────

export function MainChart({ period = 'week', selectedYear, selectedMonth, selectedDay = null }) {
    const now   = new Date();
    const year  = selectedYear  ?? now.getFullYear();
    const month = selectedMonth ?? now.getMonth();

    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading]     = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchTrend() {
            setLoading(true);
            try {
                const { start, end } = getStatsDateRange(period, year, month, selectedDay);
                const rows = await getAppointmentTrend(period, start, end);
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
    }, [period, year, month, selectedDay]);

    const data = useMemo(() => {
        const slots = buildSlots(period, year, month, selectedDay);
        const map   = Object.fromEntries(slots.map(s => [s.key, s]));
        trendData.forEach(row => {
            if (map[row.period]) {
                map[row.period].turnos    = row.total ?? 0;
                map[row.period].no_show   = row.no_show ?? 0;
                map[row.period].cancelled = row.cancelled ?? 0;
            }
        });
        return slots;
    }, [trendData, period, year, month]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-start gap-3 mb-6">
                <div className="w-9 h-9 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                    <BarChart2 size={18} />
                </div>
                <div className="min-w-0 pt-[5px]">
                    <h3 className="text-[13px] font-bold text-navy-900 leading-none tracking-tight">Turnos por período</h3>
                    <p className="text-[10px] font-bold text-navy-900/40 mt-0.5">{chartSubtitle(period, year, month)}</p>
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
                                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.6} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
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
                                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: '#065F46',
                                    border: 'none',
                                    borderRadius: 12,
                                    color: 'white',
                                    fontSize: 11,
                                    padding: '8px 12px',
                                    boxShadow: '0 10px 25px rgba(16,185,129,0.25)',
                                }}
                                itemStyle={{ color: 'white', fontWeight: 'bold' }}
                                labelStyle={{ color: '#A7F3D0', marginBottom: '4px', fontSize: 11 }}
                                cursor={{ stroke: 'rgba(16,185,129,0.15)', strokeWidth: 2, fill: 'none' }}
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
