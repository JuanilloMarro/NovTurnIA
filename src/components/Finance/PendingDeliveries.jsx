import { CheckCircle2, Clock, ChevronRight, Wallet } from 'lucide-react';

const money = (n) => `Q${Number(n || 0).toFixed(2)}`;
function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}
function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function Glow2() {
    return (
        <>
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
        </>
    );
}

// Cola de validación de ingresos. Cada cobro enviado desde un turno aparece aquí
// como 'pending'; al hacer clic se abre el detalle para confirmar o anular.
export default function PendingDeliveries({ pending, onSelect, selectedId }) {
    return (
        <div className="space-y-3">
            {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
                        <CheckCircle2 size={22} className="text-emerald-600" />
                    </div>
                    <p className="text-[12px] font-semibold text-navy-700/50 max-w-[280px]">
                        No hay cobros por validar. Cuando cobres un turno, el ingreso esperará aquí tu confirmación antes de contar.
                    </p>
                </div>
            ) : (
                pending.map((a) => {
                    const isSel = selectedId === a.id;
                    return (
                        <button key={a.id} onClick={() => onSelect?.(a)}
                            className={`group relative overflow-hidden w-full text-left backdrop-blur-2xl rounded-2xl p-3 flex items-center justify-between gap-3 border shadow-md transition-all duration-300 ${isSel ? 'bg-white/70 border-white/80' : 'bg-white/40 border-white/60 hover:bg-white/60'}`}>
                            <Glow2 />
                            <div className="flex items-center gap-3 relative z-10 min-w-0">
                                <div className="w-9 h-9 flex items-center justify-center text-[11px] font-bold shrink-0 border rounded-full leading-none bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900">
                                    {initials(a.patient_name)}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-navy-900 text-[12px] truncate leading-tight">{a.service_name || 'Servicio'}</div>
                                    <div className="text-[10px] font-semibold text-navy-700/60 flex items-center gap-1 leading-tight mt-0.5 truncate">
                                        <Clock size={10} className="shrink-0" />
                                        {a.patient_name || 'Cliente'} · {fmtDate(a.date_start)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 relative z-10 shrink-0">
                                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-600 tabular-nums">
                                    <Wallet size={12} className="shrink-0" />{money(a.amount)}
                                </span>
                                <ChevronRight size={15} className="text-navy-700/30 shrink-0" />
                            </div>
                        </button>
                    );
                })
            )}
        </div>
    );
}
