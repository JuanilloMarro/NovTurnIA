import { useState } from 'react';
import { CheckCircle2, Check, Clock } from 'lucide-react';
import { showSuccessToast } from '../../store/useToastStore';
import ConfirmDeliveryModal from './ConfirmDeliveryModal';

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

export default function PendingDeliveries({ pending, canConfirm, onConfirm }) {
    const [target, setTarget] = useState(null);

    return (
        <div className="space-y-3">
            {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
                        <CheckCircle2 size={22} className="text-emerald-600" />
                    </div>
                    <p className="text-[12px] font-semibold text-navy-700/50 max-w-[260px]">
                        No hay turnos pendientes de confirmar. Todos los servicios entregados ya tienen ingreso registrado.
                    </p>
                </div>
            ) : (
                pending.map((a) => (
                    <div key={a.id} className="group relative overflow-hidden backdrop-blur-2xl rounded-2xl p-3 flex items-center justify-between gap-3 border shadow-md bg-white/40 border-white/60 hover:bg-white/60 transition-all duration-300">
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
                            <span className="text-[12px] font-bold text-navy-900/70 tabular-nums">{a.service_price != null ? money(a.service_price) : '—'}</span>
                            {canConfirm && (
                                <button onClick={() => setTarget(a)}
                                    className="relative overflow-hidden group/btn h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-3 bg-white/40 backdrop-blur-2xl border border-white/60 text-emerald-600 text-[10px] font-bold rounded-full shadow-md hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all duration-300 shrink-0"
                                    title="Confirmar que el servicio se dio y registrar el ingreso">
                                    <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(16,185,129,0.08)' }} />
                                    <div className="absolute -bottom-3 -left-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(52,211,153,0.08)' }} />
                                    <Check size={13} className="shrink-0 relative z-10" />
                                    <span className="max-w-0 overflow-hidden group-hover/btn:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">Confirmar</span>
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}

            {target && (
                <ConfirmDeliveryModal
                    serviceName={target.service_name}
                    clientName={target.patient_name}
                    defaultAmount={target.service_price}
                    onClose={() => setTarget(null)}
                    onConfirm={async ({ amount, paymentMethod, notes }) => {
                        await onConfirm({ appointmentId: target.id, amount, paymentMethod, notes });
                        showSuccessToast('Servicio confirmado', `Ingreso de ${money(amount)} registrado.`);
                    }}
                />
            )}
        </div>
    );
}
