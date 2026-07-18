import { useState, useMemo } from 'react';
import { ChevronRight, ArrowDownRight, Repeat, ChevronDown, Zap } from 'lucide-react';
import { LedgerSearch, methodLabelFrom } from './financeUi';

const money = (n) => `Q${Number(n || 0).toFixed(2)}`;
const CAT_LABEL = { insumo: 'Insumos', renta: 'Renta', salario: 'Salarios', servicios: 'Servicios', marketing: 'Marketing', general: 'General', otro: 'Otro' };
const PAGE = 30;

function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Libro de egresos con búsqueda local y paginación oculta. Los gastos fijos
// materializados por el cron llegan con template_id → chip "Automático".
export default function ExpenseSection({ expenses, methods = [], onSelect, selectedId }) {
    const [query, setQuery] = useState('');
    const [visible, setVisible] = useState(PAGE);

    const filtered = useMemo(() => {
        const t = query.trim().toLowerCase();
        if (!t) return expenses;
        return expenses.filter(e =>
            (e.description || '').toLowerCase().includes(t) ||
            (e.finance_categories?.name || e.category || '').toLowerCase().includes(t) ||
            (methodLabelFrom(e.payment_method, methods) || '').toLowerCase().includes(t)
        );
    }, [expenses, query, methods]);

    const shown = filtered.slice(0, visible);

    if (expenses.length === 0) return <p className="text-[12px] font-semibold text-navy-700/40 text-center py-12">Sin egresos en este período.</p>;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                <LedgerSearch value={query} onChange={v => { setQuery(v); setVisible(PAGE); }} placeholder="Buscar por descripción, categoría…" />
                <span className="text-[10px] font-bold text-navy-900/40">{filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'}</span>
            </div>

            {shown.length === 0 && (
                <p className="text-[12px] font-semibold text-navy-700/40 text-center py-10">Sin coincidencias para tu búsqueda.</p>
            )}

            {shown.map(e => (
                <button key={e.id} onClick={() => onSelect?.(e)}
                    className={`group relative overflow-hidden backdrop-blur-2xl rounded-2xl p-4 w-full flex items-center justify-between gap-3 border shadow-md text-left transition-all ${selectedId === e.id ? 'bg-white/60 border-white/80' : 'bg-white/40 border-white/60 hover:bg-white/60'}`}>
                    <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(244,63,94,0.04)' }} />
                    <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    <div className="flex items-center gap-3 relative z-10 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                            <ArrowDownRight size={17} className="text-rose-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-navy-900 text-sm truncate leading-tight flex items-center gap-1.5">
                                {e.description}
                                {e.recurring && <Repeat size={11} className="text-navy-700/40 shrink-0" title="Costo fijo: se repite solo cada mes" />}
                                {e.template_id && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-700 text-[8px] font-bold uppercase tracking-wide shrink-0">
                                        <Zap size={8} /> Automático
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] font-semibold text-navy-700/55 flex items-center gap-1.5 leading-tight mt-1 truncate">
                                <span className="px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10"
                                    style={e.finance_categories?.color ? { background: `${e.finance_categories.color}1a`, borderColor: `${e.finance_categories.color}40`, color: e.finance_categories.color } : undefined}>
                                    {e.finance_categories?.name || CAT_LABEL[e.category] || e.category}
                                </span>
                                {e.payment_method && <span>· {methodLabelFrom(e.payment_method, methods)}</span>}
                                <span>· {fmtDate(e.occurred_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 relative z-10 shrink-0">
                        <span className="text-[13px] font-bold text-rose-500 tabular-nums">-{money(e.amount)}</span>
                        <div className="relative overflow-hidden flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/40 backdrop-blur-2xl text-navy-700 group-hover:bg-white group-hover:scale-105 transition-all shadow-md">
                            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <ChevronRight size={16} className="relative z-10" />
                        </div>
                    </div>
                </button>
            ))}

            {filtered.length > visible && (
                <button onClick={() => setVisible(v => v + PAGE)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-white/30 border border-white/50 text-[11px] font-bold text-navy-700/60 hover:bg-white/50 hover:text-navy-900 transition-all">
                    <ChevronDown size={13} /> Mostrar más ({filtered.length - visible} restantes)
                </button>
            )}
        </div>
    );
}
