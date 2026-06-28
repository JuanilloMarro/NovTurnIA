import { useState } from 'react';
import { ChevronLeft, Trash2, Pencil, ArrowUpRight, ArrowDownRight, Calendar, CreditCard, Tag, User, Package, Repeat, Layers } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';

const money = (n) => `Q${Number(n || 0).toFixed(2)}`;
const SOURCE_LABEL = { appointment: 'Turno confirmado', manual: 'Manual', product: 'Producto' };
const METHOD_LABEL = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };
const CAT_LABEL = { insumo: 'Insumos', renta: 'Renta', salario: 'Salarios', servicios: 'Servicios', marketing: 'Marketing', general: 'General', otro: 'Otro' };

function fullDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Fila de info (mismo lenguaje visual que la ficha del cliente)
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

export default function FinanceDetailDrawer({ entry, type, canVoid, canEdit, onEdit, onClose, onVoid }) {
    const [voiding, setVoiding] = useState(false);
    if (!entry) return null;
    const isIncome = type === 'income';

    async function handleVoid() {
        if (!window.confirm(`¿Anular este ${isIncome ? 'ingreso' : 'egreso'} de ${money(entry.amount)}? No se puede deshacer.`)) return;
        setVoiding(true);
        try {
            await onVoid(entry.id, 'Anulado manualmente');
            showSuccessToast(isIncome ? 'Ingreso anulado' : 'Egreso anulado', '');
            onClose();
        } catch (err) {
            showErrorToast('No se pudo anular', err.message || '');
            setVoiding(false);
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
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-sm text-center">{isIncome ? 'Detalle del ingreso' : 'Detalle del egreso'}</h3>
                <div className="w-7 h-7" />
            </div>

            {/* Monto + descripción */}
            <div className="relative z-10 px-6 pb-2">
                <div className="flex items-center gap-3 mb-4 px-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${isIncome ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        {isIncome ? <ArrowUpRight size={22} className="text-emerald-600" /> : <ArrowDownRight size={22} className="text-rose-500" />}
                    </div>
                    <div className="overflow-hidden">
                        <div className={`text-xl font-bold tabular-nums leading-none ${isIncome ? 'text-emerald-600' : 'text-rose-500'}`}>{isIncome ? '+' : '-'}{money(entry.amount)}</div>
                        <div className="font-bold text-navy-900 text-sm truncate mt-1">{entry.description}</div>
                    </div>
                </div>
            </div>

            {/* Detalle scrollable */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pb-4">
                <div className="bg-white/30 border border-white/50 rounded-2xl px-4 py-1 shadow-sm">
                    {isIncome ? (
                        <>
                            <Row icon={Tag} label="Origen" value={SOURCE_LABEL[entry.source] || entry.source} />
                            {entry.payment_method && <Row icon={CreditCard} label="Método de pago" value={METHOD_LABEL[entry.payment_method]} />}
                            {entry.patients?.display_name && <Row icon={User} label="Cliente" value={entry.patients.display_name} />}
                            <Row icon={Calendar} label="Fecha" value={fullDate(entry.occurred_at)} />
                            {entry.cost_snapshot != null && Number(entry.cost_snapshot) > 0 && (
                                <Row icon={Layers} label="Costo (insumos)" value={money(entry.cost_snapshot)} accent="text-navy-700/70" />
                            )}
                        </>
                    ) : (
                        <>
                            <Row icon={Tag} label="Categoría" value={CAT_LABEL[entry.category] || entry.category} />
                            {entry.supplies?.name && <Row icon={Package} label="Insumo" value={entry.supplies.name} />}
                            <Row icon={Repeat} label="Frecuencia" value={entry.recurring ? 'Mensual (fijo)' : 'Única'} />
                            <Row icon={Calendar} label="Fecha" value={fullDate(entry.occurred_at)} />
                        </>
                    )}
                    {entry.created_at && <Row icon={Calendar} label="Registrado" value={fullDate(entry.created_at)} accent="text-navy-700/70" />}
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

            {/* Acciones — mismo formato que el perfil del cliente (Editar / Eliminar) */}
            {(canEdit || canVoid) && (
                <div className="relative z-10 p-4 flex items-center justify-center gap-3 border-t border-white/40">
                    {canEdit && (
                        <button onClick={() => onEdit?.(entry)}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md hover:bg-white/60 transition-all duration-300">
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Pencil size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-300 whitespace-nowrap relative z-10">Editar</span>
                        </button>
                    )}
                    {canVoid && (
                        <button onClick={handleVoid} disabled={voiding}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-rose-500 text-[11px] font-bold rounded-full shadow-md hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all duration-300 disabled:opacity-50">
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Trash2 size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[70px] transition-all duration-300 whitespace-nowrap relative z-10">{voiding ? 'Anulando…' : 'Anular'}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
