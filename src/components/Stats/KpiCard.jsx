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
            className="bg-white/80 backdrop-blur-card border border-gray-100 rounded-[20px] shadow-sm p-6 animate-fade-up flex flex-col justify-between"
            style={{ animationDelay: `${index * 0.06}s` }}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="text-gray-500 font-medium text-[15px]">{label}</div>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-sm shadow-sm opacity-90`}>
                    {icon}
                </div>
            </div>
            <div>
                <div className="text-[32px] font-bold text-navy-900 tracking-tight leading-none mb-3">{value}</div>
                <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    <span className={`flex items-center ${isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'} px-2 py-0.5 rounded-full`}>
                        {isPositive ? '↑' : '↓'} {isPositive ? '+' : ''}{change}%
                    </span>
                    <span className="text-gray-400 font-normal">vs mes ant</span>
                </div>
            </div>
        </div>
    );
}
