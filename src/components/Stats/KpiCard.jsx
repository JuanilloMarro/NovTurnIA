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
            className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] p-3.5 animate-fade-up flex flex-col justify-between min-h-[72px] shadow-md group hover:bg-white/50 transition-all duration-300"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            <div className="absolute -top-6 -right-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-6 -left-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-6 -right-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-6 -left-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(64,98,200,0.05)' }} />

            {/* Top Row: Label and Icon */}
            <div className="relative z-10 flex items-start justify-between mb-1">
                <span className="text-navy-900 font-bold text-[10px] leading-tight pt-[5px]">
                    {label}
                </span>
                <div className="w-9 h-9 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 transition-all duration-300 group-hover:scale-110 shadow-sm">
                    {icon}
                </div>
            </div>

            {/* Bottom Row: Centered Number */}
            <div className="relative z-10 flex items-center justify-center tabular-nums">
                <span className="text-2xl font-bold text-navy-900 tracking-tighter leading-none">
                    {value}
                </span>
            </div>
        </div>
    );
}
