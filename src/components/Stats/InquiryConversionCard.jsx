import { MessageCircleQuestion } from 'lucide-react';

// Feedback de conversión: cuántos clientes escribieron (history.role='user')
// en el período vs cuántos terminaron con un turno creado — mismo semáforo
// que "por cobrar" en Finanzas (rojo <40%, amarillo 40-75%, verde >75%).
function ratioColor(pct) {
    if (pct < 40) return '#f43f5e';
    if (pct < 75) return '#f59e0b';
    return '#10b981';
}

// Panel en 2 columnas (icono+título+número | barra+dato) para ocupar menos
// alto — pensado para convivir con el sidebar activo sin pasarse de altura.
export function InquiryConversionCard({ asked = 0, booked = 0, notBooked = 0, index = 0 }) {
    const pctBooked = asked > 0 ? Math.round((booked / asked) * 100) : 0;

    return (
        <div
            className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] p-4 shadow-md animate-fade-up"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            <div className="absolute -top-6 -right-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-6 -left-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(120,110,230,0.05)' }} />

            <div className="relative z-10 flex items-center gap-4">
                <div className="flex items-center gap-3 shrink-0 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                        <MessageCircleQuestion size={16} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold tracking-wider text-navy-700/50 leading-tight">Preguntaron y no agendaron</div>
                        <div className="text-lg font-bold text-navy-900 tabular-nums truncate leading-tight mt-0.5">{notBooked}</div>
                    </div>
                </div>
                <div className="flex-1 min-w-[100px]">
                    <div className="w-full h-2 rounded-full bg-navy-900/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctBooked}%`, background: ratioColor(pctBooked) }} />
                    </div>
                    <p className="text-[9px] font-bold text-navy-900/40 mt-1.5">
                        {asked === 0 ? 'Nadie escribió en este período' : `${booked} de ${asked} ${asked === 1 ? 'agendó' : 'agendaron'}`}
                    </p>
                </div>
            </div>
        </div>
    );
}
