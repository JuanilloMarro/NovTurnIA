import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444'];

export function AppointmentStatusChart({ data, confRate }) {
    return (
        <div className="bg-white/80 backdrop-blur-card border border-gray-100 rounded-[20px] shadow-sm p-6 h-full flex flex-col">
            <h3 className="font-semibold text-navy-900 mb-6 text-[15px]">Tasa de confirmación</h3>

            <div className="relative flex-1 flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%" cy="50%"
                            innerRadius={70}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ background: 'white', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13, padding: '8px 12px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                    <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Confirmados</span>
                    <span className="text-[32px] font-bold text-navy-900 tracking-tight leading-none mt-1">{confRate}%</span>
                </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
                {data.map((entry, index) => {
                    const total = data.reduce((acc, curr) => acc + curr.value, 0);
                    const percentage = total === 0 ? 0 : Math.round((entry.value / total) * 100);
                    return (
                        <div key={index} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }}></span>
                                <span className="text-gray-600 font-medium">{entry.name}</span>
                            </div>
                            <span className="font-bold text-navy-900">{percentage}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
