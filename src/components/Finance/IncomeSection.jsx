import { useState, useMemo } from 'react';
import { ChevronRight, ArrowUpRight, ChevronDown, User, Plus, DollarSign } from 'lucide-react';
import { LedgerSearch, AddBtn, MiniStatCard, methodLabelFrom } from './financeUi';

const money = (n) => `Q${Number(n || 0).toFixed(2)}`;
const SOURCE_LABEL = { appointment: 'Turno', manual: 'Manual', product: 'Producto', plan: 'Abono' };

function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Libro de ingresos — paginación real (`hasMore`/`onLoadMore` vienen de
// useFinance, que pide la siguiente página a Supabase; ver financeUi/useFinance).
// La búsqueda filtra sobre lo ya cargado; "Cargar más" también amplía lo que
// alcanza la búsqueda.
export default function IncomeSection({ income, hasMore, loadingMore, onLoadMore, methods = [], onSelect, selectedId, canRecord, onAdd }) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const t = query.trim().toLowerCase();
        if (!t) return income;
        return income.filter(e =>
            (e.description || '').toLowerCase().includes(t) ||
            (e.patients?.display_name || '').toLowerCase().includes(t) ||
            (e.finance_categories?.name || '').toLowerCase().includes(t) ||
            (methodLabelFrom(e.payment_method, methods) || '').toLowerCase().includes(t)
        );
    }, [income, query, methods]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                <MiniStatCard icon={DollarSign} label="Movimientos" value={filtered.length} />
                <div className="flex items-center gap-2">
                    <LedgerSearch wide value={query} onChange={setQuery} placeholder="Buscar por descripción, cliente, categoría…" />
                    {canRecord && <AddBtn icon={Plus} label="Registrar ingreso" onClick={onAdd} />}
                </div>
            </div>

            {income.length === 0 ? (
                <p className="text-[12px] font-semibold text-navy-700/40 text-center py-12">Sin ingresos en este período.</p>
            ) : filtered.length === 0 && (
                <p className="text-[12px] font-semibold text-navy-700/40 text-center py-10">Sin coincidencias para tu búsqueda.</p>
            )}

            {filtered.map(e => (
                <button key={e.id} onClick={() => onSelect?.(e)}
                    className={`group relative overflow-hidden backdrop-blur-2xl rounded-2xl p-4 w-full flex items-center justify-between gap-3 border shadow-md text-left transition-all ${selectedId === e.id ? 'bg-white/60 border-white/80' : 'bg-white/40 border-white/60 hover:bg-white/60'}`}>
                    <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(16,185,129,0.05)' }} />
                    <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    <div className="flex items-center gap-3 relative z-10 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                            <ArrowUpRight size={17} className="text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-navy-900 text-sm truncate leading-tight">{e.description}</div>
                            <div className="text-[10px] font-semibold text-navy-700/55 flex items-center gap-1.5 leading-tight mt-1 truncate">
                                {e.finance_categories?.name ? (
                                    <span className="px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10"
                                        style={e.finance_categories.color ? { background: `${e.finance_categories.color}1a`, borderColor: `${e.finance_categories.color}40`, color: e.finance_categories.color } : undefined}>
                                        {e.finance_categories.name}
                                    </span>
                                ) : (
                                    <span className="px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10">{SOURCE_LABEL[e.source] || e.source}</span>
                                )}
                                {e.payment_method && <span>· {methodLabelFrom(e.payment_method, methods)}</span>}
                                {e.patients?.display_name && (
                                    <span className="flex items-center gap-0.5 truncate">· <User size={9} className="shrink-0" /> {e.patients.display_name}</span>
                                )}
                                <span>· {fmtDate(e.occurred_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 relative z-10 shrink-0">
                        <span className="text-[13px] font-bold text-emerald-600 tabular-nums">+{money(e.amount)}</span>
                        <div className="relative overflow-hidden flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/40 backdrop-blur-2xl text-navy-700 group-hover:bg-white group-hover:scale-105 transition-all shadow-md">
                            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <ChevronRight size={16} className="relative z-10" />
                        </div>
                    </div>
                </button>
            ))}

            {hasMore && (
                <button onClick={onLoadMore} disabled={loadingMore}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-white/30 border border-white/50 text-[11px] font-bold text-navy-700/60 hover:bg-white/50 hover:text-navy-900 transition-all disabled:opacity-50">
                    <ChevronDown size={13} /> {loadingMore ? 'Cargando…' : 'Cargar más'}
                </button>
            )}
        </div>
    );
}
