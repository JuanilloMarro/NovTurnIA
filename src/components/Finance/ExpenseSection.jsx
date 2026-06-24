import { Trash2, ArrowDownRight, Repeat } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';

const money = (n) => `Q${Number(n || 0).toFixed(2)}`;
const CAT_LABEL = { insumo: 'Insumos', renta: 'Renta', salario: 'Salarios', servicios: 'Servicios', marketing: 'Marketing', general: 'General', otro: 'Otro' };
function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExpenseSection({ expenses, canVoid, onVoid }) {
    async function voidEntry(e) {
        if (!window.confirm(`¿Anular este egreso de ${money(e.amount)}? No se puede deshacer.`)) return;
        try { await onVoid(e.id, 'Anulado manualmente'); showSuccessToast('Egreso anulado', ''); }
        catch (err) { showErrorToast('No se pudo anular', err.message || ''); }
    }

    if (expenses.length === 0) return <p className="text-[12px] font-semibold text-navy-700/40 text-center py-12">Sin egresos en este período.</p>;

    return (
        <div className="space-y-3">
            {expenses.map(e => (
                <div key={e.id} className="group relative overflow-hidden backdrop-blur-2xl rounded-2xl p-4 flex items-center justify-between gap-3 border shadow-md bg-white/40 border-white/60 hover:bg-white/60 transition-all">
                    <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(244,63,94,0.04)' }} />
                    <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    <div className="flex items-center gap-3 relative z-10 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                            <ArrowDownRight size={17} className="text-rose-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-navy-900 text-sm truncate leading-tight flex items-center gap-1.5">
                                {e.description}
                                {e.recurring && <Repeat size={11} className="text-navy-700/40 shrink-0" title="Recurrente mensual" />}
                            </div>
                            <div className="text-[10px] font-semibold text-navy-700/55 flex items-center gap-1.5 leading-tight mt-1 truncate">
                                <span className="px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10">{CAT_LABEL[e.category] || e.category}</span>
                                <span>· {fmtDate(e.occurred_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 relative z-10 shrink-0">
                        <span className="text-[13px] font-bold text-rose-500 tabular-nums">-{money(e.amount)}</span>
                        {canVoid && (
                            <button onClick={() => voidEntry(e)} title="Anular egreso"
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/50 border border-white/60 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shadow-sm shrink-0">
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
