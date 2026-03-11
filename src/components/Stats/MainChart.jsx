import { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { ChevronDown } from 'lucide-react';

export function MainChart({ rawApts }) {
    const [period, setPeriod] = useState('Mes');
    const [showOptions, setShowOptions] = useState(false);

    const { data, isPositive, prevAvg } = useMemo(() => {
        const now = new Date();
        const activeApts = (rawApts || []).filter(a => a.status === 'active');
        const grouped = {};

        let previousPeriodTotal = 0;
        let previousPeriodCount = 0;
        let currentPeriodTotal = 0;

        if (period === 'Semana') {
            const startOfThisWeek = new Date(now);
            startOfThisWeek.setDate(now.getDate() - now.getDay() + 1);
            startOfThisWeek.setHours(0, 0, 0, 0);

            const startOfLastWeek = new Date(startOfThisWeek);
            startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

            // Initialize 7 days
            const days = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
            days.forEach(d => grouped[d] = 0);

            activeApts.forEach(apt => {
                const d = new Date(apt.date_start);
                if (d >= startOfThisWeek) {
                    const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
                    grouped[days[dayIdx]] += 1;
                    currentPeriodTotal++;
                } else if (d >= startOfLastWeek && d < startOfThisWeek) {
                    previousPeriodTotal++;
                }
            });
            previousPeriodCount = 7;
        } else if (period === 'Mes') {
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                grouped[i] = 0;
            }

            activeApts.forEach(apt => {
                const d = new Date(apt.date_start);
                if (d >= startOfThisMonth) {
                    grouped[d.getDate()] += 1;
                    currentPeriodTotal++;
                } else if (d >= startOfLastMonth && d < startOfThisMonth) {
                    previousPeriodTotal++;
                }
            });
            const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
            previousPeriodCount = daysInLastMonth;
        } else if (period === 'Año') {
            const startOfThisYear = new Date(now.getFullYear(), 0, 1);
            const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);

            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            months.forEach(m => grouped[m] = 0);

            activeApts.forEach(apt => {
                const d = new Date(apt.date_start);
                if (d >= startOfThisYear) {
                    grouped[months[d.getMonth()]] += 1;
                    currentPeriodTotal++;
                } else if (d >= startOfLastYear && d < startOfThisYear) {
                    previousPeriodTotal++;
                }
            });
            previousPeriodCount = 12;
        }

        const chartData = Object.keys(grouped).map(key => ({
            name: key,
            turnos: grouped[key]
        }));

        const isPositive = currentPeriodTotal >= previousPeriodTotal;
        const prevAvg = previousPeriodCount > 0 ? previousPeriodTotal / previousPeriodCount : 0;

        return { data: chartData, isPositive, prevAvg };

    }, [rawApts, period]);

    const lineColor = isPositive ? '#10B981' : '#EF4444'; // Emerald for positive, red for negative

    return (
        <div className="bg-white/20 backdrop-blur-md p-6 h-full flex flex-col">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h3 className="font-bold text-navy-900 text-sm tracking-tight mb-1">Turnos atendidos</h3>
                    <p className="text-[10px] text-navy-900/40 font-bold tracking-tight">Comparativa vs. período anterior</p>
                </div>

                <div className="relative">
                    <div
                        onClick={() => setShowOptions(!showOptions)}
                        className="flex items-center gap-1.5 bg-white/40 border border-white/60 rounded-full px-3 py-1.5 text-[10px] font-bold text-navy-900/60 hover:bg-white/60 cursor-pointer transition-all shadow-sm"
                    >
                        Este {period} <ChevronDown size={14} className="text-navy-900/40" />
                    </div>
                    {showOptions && (
                        <div className="absolute right-0 top-full mt-2 w-32 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 z-10 py-1 overflow-hidden animate-scale-in">
                            {['Semana', 'Mes', 'Año'].map(opt => (
                                <div
                                    key={opt}
                                    onClick={() => { setPeriod(opt); setShowOptions(false); }}
                                    className={`px-4 py-2 text-[11px] font-bold cursor-pointer transition-colors ${period === opt ? 'text-navy-900 bg-navy-900/5' : 'text-navy-900/60 hover:bg-navy-900/5 font-bold'}`}
                                >
                                    Este {opt}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorTurnos" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9CA3AF', fontSize: 11 }}
                            dy={10}
                            minTickGap={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9CA3AF', fontSize: 11 }}
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{ background: '#1A3A6B', border: 'none', borderRadius: 12, color: 'white', fontSize: 13, padding: '8px 12px', boxShadow: '0 10px 25px rgba(26,58,107,0.3)' }}
                            itemStyle={{ color: 'white', fontWeight: 'bold' }}
                            labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                            cursor={{ stroke: 'rgba(26,58,107,0.1)', strokeWidth: 2 }}
                        />

                        {/* Reference line for previous period average */}
                        <ReferenceLine
                            y={Math.ceil(prevAvg)}
                            stroke="#9CA3AF"
                            strokeDasharray="4 4"
                            strokeOpacity={0.6}
                        />

                        <Line
                            type="monotone"
                            dataKey="turnos"
                            stroke={lineColor}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, fill: lineColor, stroke: 'white', strokeWidth: 2 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
