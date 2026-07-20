import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#9CA3AF'];

export function AppointmentStatusChart({ data, confRate }) {
    if (!data?.length) return null;
    const hasData = data.some(d => d.value > 0);
    // If all values are 0, use a placeholder slice so a ring is visible
    const chartData = hasData ? data : [{ name: 'Sin datos', value: 1 }];
    const chartColors = hasData ? PIE_COLORS : ['#E5E7EB'];

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex items-start gap-3 mb-2 shrink-0">
                <div className="w-8 h-8 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                    <Activity size={16} />
                </div>
                <div className="min-w-0 pt-[4px]">
                    <h3 className="text-[13px] font-bold text-navy-900 leading-none tracking-tight">Tasa de confirmación</h3>
                    <p className="text-[10px] font-bold text-navy-900/40 mt-0.5">Distribución de estados</p>
                </div>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"  cy="50%"
                            innerRadius="40%"
                            outerRadius="56%"
                            paddingAngle={hasData ? 3 : 0}
                            dataKey="value"
                            stroke="none"
                            isAnimationActive={hasData}
                        >
                            {chartData.map((_, i) => (
                                <Cell key={i} fill={chartColors[i % chartColors.length]} />
                            ))}
                        </Pie>
                        {hasData && (
                            <Tooltip
                                contentStyle={{ background: 'white', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13, padding: '8px 12px' }}
                            />
                        )}
                    </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-navy-900/40 text-[8px] font-bold tracking-tight text-center">Confirmación</span>
                    <span className="text-xl font-bold text-navy-900 tracking-tight leading-none mt-0.5">{confRate}%</span>
                    {!hasData && <span className="text-[8px] text-navy-900/30 font-bold mt-1">Sin turnos este mes</span>}
                </div>
            </div>

            <div className="mt-2 flex flex-col shrink-0 gap-1">
                {data.map((entry, index) => {
                    const total = data.reduce((acc, curr) => acc + curr.value, 0);
                    const percentage = total === 0 ? 0 : Math.round((entry.value / total) * 100);
                    return (
                        <div key={index} className="flex justify-between items-center py-1.5 px-1 border-b border-white/20 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: PIE_COLORS[index] }}></span>
                                <span className="text-navy-900/80 font-bold text-[13px] tracking-tight truncate">{entry.name}</span>
                            </div>
                            <span className="font-bold text-navy-900 text-[14px] tracking-tight tabular-nums shrink-0">{percentage}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
