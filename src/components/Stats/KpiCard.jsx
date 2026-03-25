export default function KpiCard({ label, value, change, icon, color = 'navy', index = 0 }) {
    const colors = {
        navy: 'bg-navy-900',
        emerald: 'bg-emerald-600',
        amber: 'bg-amber-600',
        rose: 'bg-rose-600',
    };

    const isPositive = Number(change) >= 0;

    return (
        <div
            className="bg-white/40 backdrop-blur-md border border-white/60 rounded-[18px] p-3.5 animate-fade-up flex flex-col justify-between min-h-[72px] shadow-sm group hover:bg-white/50 transition-all duration-300"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {/* Top Row: Label and Icon */}
            <div className="flex items-center justify-between mb-1">
                <span className="text-navy-900 font-bold text-[11px] leading-tight">
                    {label}
                </span>
                <div className={`w-6 h-6 rounded-lg shrink-0 ${colors[color] || 'bg-navy-900'} flex items-center justify-center text-white border border-white/10 transition-transform group-hover:scale-110 shadow-sm opacity-90`}>
                    {icon}
                </div>
            </div>
            
            {/* Bottom Row: Centered Number */}
            <div className="flex items-center justify-center tabular-nums">
                <span className="text-2xl font-black text-navy-900 tracking-tighter leading-none">
                    {value}
                </span>
            </div>
        </div>
    );
}
