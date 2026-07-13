import { useState } from 'react';
import { ChevronLeft, Trash2, Check, Wallet, Calendar, Clock, CreditCard, Tag, User, Layers, Coins } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import ConfirmDialog from '../ui/ConfirmDialog';

const money = (n) => `Q${Number(n || 0).toFixed(2)}`;
const METHOD_LABEL = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };

function fullDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const date = d.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} · ${time}`;
}

function Row({ icon: Icon, label, value, accent }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2.5 border-t border-white/40 first:border-t-0">
            <span className="flex items-center gap-2 text-[11px] font-bold text-navy-700/60 tracking-wide shrink-0">
                <Icon size={13} className="text-navy-700/50" /> {label}
            </span>
            <span className={`text-[12px] font-bold text-right ${accent || 'text-navy-900'}`}>{value}</span>
        </div>
    );
}

// Detalle de un cobro "Por confirmar" (ingreso 'pending'). Sólo permite Confirmar
// (el dinero entró → pasa a Ingresos) o Anular (el turno vuelve a "Cobrar"). Sin editar.
export default function PendingValidationDrawer({ entry, canConfirm, canVoid, onConfirm, onVoid, onClose }) {
    const [confirming, setConfirming] = useState(false);
    const [voiding, setVoiding] = useState(false);
    const [confirmingVoid, setConfirmingVoid] = useState(false);
    if (!entry) return null;

    async function handleConfirm() {
        setConfirming(true);
        try {
            await onConfirm(entry.id);
            showSuccessToast('Ingreso confirmado', `${money(entry.amount)} registrado en Ingresos.`);
            onClose();
        } catch (err) {
            showErrorToast('No se pudo confirmar', err.message || '');
            setConfirming(false);
        }
    }

    async function handleVoid() {
        setVoiding(true);
        try {
            await onVoid(entry.id, 'Validación anulada');
            showSuccessToast('Cobro anulado', 'El turno vuelve a estar disponible para cobrar.');
            onClose();
        } catch (err) {
            showErrorToast('No se pudo anular', err.message || '');
            setVoiding(false);
            setConfirmingVoid(false);
        }
    }

    return (
        <div className="fixed inset-0 sm:absolute sm:top-3 sm:right-3 sm:bottom-3 sm:left-auto sm:w-[360px] bg-white/95 sm:bg-white/30 backdrop-blur-2xl border border-white/60 rounded-none sm:rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] z-[120] sm:z-50 flex flex-col animate-drawer-in overflow-hidden">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

            {/* Header */}
            <div className="relative z-10 flex items-center gap-2 p-4">
                <button onClick={onClose} className="relative overflow-hidden w-7 h-7 flex items-center justify-center rounded-full bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-700 hover:bg-white/60 shadow-md transition-colors">
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    <ChevronLeft size={16} className="relative z-10" />
                </button>
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-sm text-center">Por confirmar</h3>
                <div className="w-7 h-7" />
            </div>

            {/* Monto cobrado (pendiente de validar) */}
            <div className="relative z-10 px-6 pb-2">
                <div className="flex items-center gap-3 mb-2 px-1">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border bg-amber-500/10 border-amber-500/20">
                        <Wallet size={22} className="text-amber-600" />
                    </div>
                    <div className="overflow-hidden">
                        <div className="text-xl font-bold tabular-nums leading-none text-amber-600">{money(entry.amount)}</div>
                        <div className="font-bold text-navy-900 text-sm truncate mt-1">{entry.service_name || 'Servicio'}</div>
                    </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[10px] font-bold">
                    <Clock size={11} /> En validación · esperando confirmación
                </div>
            </div>

            {/* Detalle scrollable */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pb-4 pt-2">
                <div className="bg-white/30 border border-white/50 rounded-2xl px-4 py-1 shadow-sm">
                    {entry.patient_name && <Row icon={User} label="Cliente" value={entry.patient_name} />}
                    <Row icon={Calendar} label="Turno" value={fullDateTime(entry.date_start)} />
                    <Row icon={Tag} label="Servicio" value={entry.service_name || '—'} />
                    {entry.service_price != null && <Row icon={Coins} label="Precio del servicio" value={money(entry.service_price)} accent="text-navy-700/70" />}
                    {entry.cost_snapshot != null && Number(entry.cost_snapshot) > 0 && (
                        <Row icon={Layers} label="Costo (insumos)" value={money(entry.cost_snapshot)} accent="text-navy-700/70" />
                    )}
                    {entry.payment_method && <Row icon={CreditCard} label="Método de pago" value={METHOD_LABEL[entry.payment_method]} />}
                    <Row icon={Wallet} label="Monto cobrado" value={money(entry.amount)} accent="text-amber-600" />
                </div>

                {/* Observaciones / Notas */}
                <div className="mt-4">
                    <h4 className="text-[11px] font-bold text-navy-800 tracking-wide mb-2 px-1">Observaciones</h4>
                    <div className="bg-white/30 border border-white/50 rounded-2xl px-4 py-3 shadow-sm min-h-[64px]">
                        {entry.notes ? (
                            <p className="text-[12px] text-navy-700/80 font-medium leading-relaxed italic break-words">"{entry.notes}"</p>
                        ) : (
                            <p className="text-[12px] text-navy-700/40 font-semibold italic">Sin observaciones registradas.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Acciones — sólo Confirmar / Anular (sin editar) */}
            {(canConfirm || canVoid) && (
                <div className="relative z-10 p-4 flex items-center justify-center gap-3 border-t border-white/40">
                    {canConfirm && (
                        <button onClick={handleConfirm} disabled={confirming}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-emerald-600 text-[11px] font-bold rounded-full shadow-md hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all duration-300 disabled:opacity-50">
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Check size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap relative z-10">{confirming ? 'Confirmando…' : 'Confirmar ingreso'}</span>
                        </button>
                    )}
                    {canVoid && (
                        <button onClick={() => setConfirmingVoid(true)} disabled={voiding}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-rose-500 text-[11px] font-bold rounded-full shadow-md hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all duration-300 disabled:opacity-50">
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Trash2 size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[70px] transition-all duration-300 whitespace-nowrap relative z-10">{voiding ? 'Anulando…' : 'Anular'}</span>
                        </button>
                    )}
                </div>
            )}

            <ConfirmDialog open={confirmingVoid} danger loading={voiding}
                title="¿Anular este cobro?"
                message={`Se anulará el cobro de ${money(entry.amount)} y el turno volverá a "Cobrar".`}
                confirmLabel="Sí, anular" loadingLabel="Anulando..."
                onConfirm={handleVoid} onCancel={() => setConfirmingVoid(false)} />
        </div>
    );
}
