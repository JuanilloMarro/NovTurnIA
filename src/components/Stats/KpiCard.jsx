export default function KpiCard({ label, value, change, icon, color = 'navy', index = 0 }) {
    const colors = {
        navy: 'from-navy-700 to-navy-500',
        emerald: 'from-emerald-700 to-emerald-500',
        amber: 'from-amber-600 to-amber-400',
        rose: 'from-rose-700 to-rose-500',
    };

    const isPositive = Number(change) >= 0;

    return (
        <div
            className="bg-white/40 backdrop-blur-md border border-white/60 rounded-[32px] p-5 animate-fade-up flex flex-col justify-between"
            style={{ animationDelay: `${index * 0.06}s` }}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="text-navy-900/60 font-bold text-xs tracking-tight">{label}</div>
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-sm shadow-sm opacity-90`}>
                    {icon}
                </div>
            </div>
            
            <div className="flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold text-navy-900 tracking-tight leading-none mb-3">{value}</div>
                {change !== undefined && change !== "0.0" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className={`flex items-center ${isPositive ? 'text-emerald-600 bg-emerald-50/50' : 'text-rose-600 bg-rose-50/50'} px-2 py-0.5 rounded-full border border-current/10`}>
                            {isPositive ? '↑' : '↓'} {isPositive ? '+' : ''}{change}%
                        </span>
                        <span className="text-navy-900/40 font-bold tracking-tight text-[9px]">vs mes ant</span>
                    </div>
                )}
            </div>
        </div>
    );
}
