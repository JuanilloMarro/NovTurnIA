import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#0F2044'];

export function AppointmentStatusChart({ data, confRate }) {
    const hasData = data.some(d => d.value > 0);
    // If all values are 0, use a placeholder slice so a ring is visible
    const chartData = hasData ? data : [{ name: 'Sin datos', value: 1 }];
    const chartColors = hasData ? PIE_COLORS : ['#E5E7EB'];

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6">
                <h3 className="font-bold text-navy-900 text-sm tracking-tight mb-1">Tasa de confirmación</h3>
                <p className="text-[10px] text-navy-900/40 font-bold tracking-tight">Distribución de estados</p>
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center min-h-[200px]">
                <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"  cy="50%"
                            innerRadius={60}
                            outerRadius={80}
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

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                    <span className="text-navy-900/40 text-[9px] font-bold tracking-tight text-center">Confirmación</span>
                    <span className="text-3xl font-bold text-navy-900 tracking-tight leading-none mt-1">{confRate}%</span>
                    {!hasData && <span className="text-[9px] text-navy-900/30 font-bold mt-1">Sin turnos este mes</span>}
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                {data.map((entry, index) => {
                    const total = data.reduce((acc, curr) => acc + curr.value, 0);
                    const percentage = total === 0 ? 0 : Math.round((entry.value / total) * 100);
                    return (
                        <div key={index} className="flex justify-between items-center py-2.5 px-1 border-b border-white/20 last:border-0">
                            <div className="flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[index] }}></span>
                                <span className="text-navy-900/80 font-bold text-[12px] tracking-tight">{entry.name}</span>
                            </div>
                            <span className="font-bold text-navy-900 text-sm tracking-tighter">{percentage}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
