export default function KpiCard({ label, value, icon, index = 0 }) {
    return (
        <div
            className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] p-4 shadow-md animate-fade-up"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            <div className="absolute -top-6 -right-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-6 -left-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(120,110,230,0.05)' }} />

            <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-navy-700/50 leading-tight">{label}</div>
                    <div className="text-lg font-bold text-navy-900 tabular-nums truncate leading-tight mt-0.5">{value}</div>
                </div>
            </div>
        </div>
    );
}
