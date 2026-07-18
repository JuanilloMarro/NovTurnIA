import { useState } from 'react';
import { Users, Percent, Check, X, Pencil, HandCoins } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { money } from './financeUi';

// Producción por profesional — cuánto generó cada miembro del equipo en el
// período visible y cuánta comisión le corresponde. El % se congela en cada
// cobro (snapshot): cambiarlo aquí solo afecta cobros FUTUROS, nunca la
// historia. "Pagar" registra el egreso de la comisión con un clic.

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function CommissionEditor({ row, onSave }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(row.commission_pct ?? 0));
    const [saving, setSaving] = useState(false);

    if (!editing) {
        return (
            <button onClick={() => { setValue(String(row.commission_pct ?? 0)); setEditing(true); }}
                title="Editar % de comisión (aplica a cobros futuros)"
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-navy-900/5 border border-navy-900/10 text-[10px] font-bold text-navy-800 hover:bg-navy-900/10 transition-all tabular-nums">
                <Percent size={10} /> {Number(row.commission_pct ?? 0)}% <Pencil size={9} className="text-navy-900/40" />
            </button>
        );
    }
    return (
        <span className="flex items-center gap-1">
            <input type="number" min="0" max="100" step="0.5" value={value} onChange={e => setValue(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(false); }}
                className="w-16 bg-white/60 border border-white/70 rounded-full px-2.5 py-1 text-[11px] font-bold text-navy-900 outline-none focus:ring-1 focus:ring-white tabular-nums" />
            <button onClick={submit} disabled={saving} className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 hover:bg-emerald-500/20 transition-all">
                <Check size={11} />
            </button>
            <button onClick={() => setEditing(false)} className="w-6 h-6 rounded-full bg-white/50 border border-white/60 flex items-center justify-center text-navy-700/50 hover:text-navy-900 transition-all">
                <X size={11} />
            </button>
        </span>
    );

    async function submit() {
        const pct = Number(value);
        if (!(pct >= 0 && pct <= 100)) { showErrorToast('Porcentaje inválido', 'Debe estar entre 0 y 100.'); return; }
        setSaving(true);
        try {
            await onSave(row.staff_id, pct);
            showSuccessToast('Comisión actualizada', `${row.staff_name}: ${pct}% en cobros futuros.`);
            setEditing(false);
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || '');
        } finally {
            setSaving(false);
        }
    }
}

export default function ProductionSection({ prod, totalIncome, periodLabel, canEditCommission, canRecordExpense, onPayCommission }) {
    const [paying, setPaying] = useState(null); // row
    const [payBusy, setPayBusy] = useState(false);

    const withActivity = prod.rows.filter(r => Number(r.services_count) > 0 || r.active);
    const unassigned = Math.max(0, Number(totalIncome || 0) - prod.assignedRevenue);

    return (
        <div className="space-y-3">
            {/* Totales del período */}
            <div className="flex items-center gap-3 flex-wrap px-1">
                <div className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl px-4 py-2.5 shadow-md">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-navy-900/40 block leading-none">Comisiones del período</span>
                    <span className="text-[16px] font-bold text-navy-900 tabular-nums leading-none block mt-1">{money(prod.totalCommission)}</span>
                </div>
                <div className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl px-4 py-2.5 shadow-md">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-navy-900/40 block leading-none">Atribuido al equipo</span>
                    <span className="text-[16px] font-bold text-navy-900 tabular-nums leading-none block mt-1">{money(prod.assignedRevenue)}</span>
                </div>
                {unassigned > 0 && (
                    <span className="text-[10px] font-bold text-navy-900/40">
                        {money(unassigned)} sin atribuir — elige "Atendido por" al cobrar para verlo aquí
                    </span>
                )}
            </div>

            {prod.loading ? (
                <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" /></div>
            ) : withActivity.length === 0 ? (
                <div className="text-center py-14">
                    <div className="w-11 h-11 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mx-auto mb-2.5">
                        <Users size={16} className="text-navy-700/50" />
                    </div>
                    <p className="text-[12px] font-bold text-navy-900/60 mb-1">Sin producción registrada</p>
                    <p className="text-[11px] font-semibold text-navy-700/40 max-w-[340px] mx-auto">
                        Al cobrar un servicio elige quién lo atendió — aquí verás cuánto generó cada quien y su comisión.
                    </p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {withActivity.map(r => (
                        <div key={r.staff_id} className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 flex-wrap">
                            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="relative z-10 flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center text-white font-bold text-[13px] shrink-0 shadow-sm">
                                    {initials(r.staff_name)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-navy-900 text-sm leading-tight truncate">{r.staff_name}</span>
                                        {!r.active && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[8px] font-bold uppercase tracking-widest text-navy-900/40">Inactivo</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-semibold text-navy-700/55 mt-0.5">
                                        {r.services_count} {Number(r.services_count) === 1 ? 'servicio' : 'servicios'} · generó {money(r.revenue)}
                                    </p>
                                </div>
                            </div>
                            <div className="relative z-10 flex items-center gap-2.5 shrink-0 flex-wrap">
                                {canEditCommission ? <CommissionEditor row={r} onSave={prod.saveCommission} /> : (
                                    <span className="px-2 py-1 rounded-full bg-navy-900/5 border border-navy-900/10 text-[10px] font-bold text-navy-800 tabular-nums">
                                        {Number(r.commission_pct ?? 0)}%
                                    </span>
                                )}
                                <div className="text-right">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-navy-900/40 block leading-none">Comisión</span>
                                    <span className="text-[15px] font-bold text-navy-900 tabular-nums leading-none block mt-0.5">{money(r.commission_total)}</span>
                                </div>
                                {canRecordExpense && Number(r.commission_total) > 0 && (
                                    <button onClick={() => setPaying(r)}
                                        title="Registrar el pago de esta comisión como egreso"
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-navy-900 border border-white/10 text-white text-[9.5px] font-bold shadow-card hover:bg-navy-800 transition-all">
                                        <HandCoins size={11} /> Pagar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-[9.5px] font-bold text-navy-900/35 px-1">
                El % se congela en cada cobro: cambiarlo solo afecta cobros futuros. La producción usa los ingresos confirmados del período visible.
            </p>

            <ConfirmDialog open={!!paying} loading={payBusy}
                title={paying ? `¿Pagar comisión a ${paying.staff_name}?` : ''}
                message={paying ? `Se registrará un egreso de ${money(paying.commission_total)} (comisiones · ${periodLabel}). El egreso queda en el libro y descuenta de la utilidad.` : ''}
                confirmLabel="Sí, registrar pago" loadingLabel="Registrando..."
                onConfirm={async () => {
                    setPayBusy(true);
                    try {
                        await onPayCommission(paying);
                        showSuccessToast('Comisión pagada', `${money(paying.commission_total)} registrado como egreso.`);
                    } catch (err) {
                        showErrorToast('No se pudo registrar', err.message || '');
                    } finally {
                        setPayBusy(false);
                        setPaying(null);
                    }
                }}
                onCancel={() => setPaying(null)} />
        </div>
    );
}
