import { useState } from 'react';
import { Users, Percent, HandCoins, UserX } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { money, MiniStatCard, AddBtn, ModalShell, FieldLabel, ModalButtons, PercentInput, decimalToTenths, tenthsToDecimal } from './financeUi';

// Producción por profesional — cuánto generó cada miembro del equipo en el
// período visible y cuánta comisión le corresponde. El % se congela en cada
// cobro (snapshot): cambiarlo aquí solo afecta cobros FUTUROS, nunca la
// historia. "Pagar" registra el egreso de la comisión con un clic.

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// Modal para editar el % de comisión — el aviso de que se congela en cada
// cobro vive aquí (antes era un texto suelto al pie del listado).
function CommissionModal({ row, onClose, onSave }) {
    const [tenths, setTenths] = useState(decimalToTenths(row.commission_pct ?? 0));
    const [saving, setSaving] = useState(false);

    async function submit() {
        const pct = tenthsToDecimal(tenths) ?? 0;
        setSaving(true);
        try {
            await onSave(row.staff_id, pct);
            showSuccessToast('Comisión actualizada', `${row.staff_name}: ${pct}% en cobros futuros.`);
            onClose();
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || '');
            setSaving(false);
        }
    }

    return (
        <ModalShell title="% de comisión" subtitle={row.staff_name} onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Guardar" loading={saving} confirmIcon={Percent} />}>
            <div>
                <FieldLabel title="Porcentaje" subtitle="El % se congela en cada cobro (snapshot): cambiarlo aquí solo afecta a los cobros futuros, nunca a la historia ya registrada." />
                <PercentInput tenths={tenths} onChange={setTenths} autoFocus />
            </div>
        </ModalShell>
    );
}

export default function ProductionSection({ prod, totalIncome, periodLabel, canEditCommission, canRecordExpense, onPayCommission }) {
    const [paying, setPaying] = useState(null); // row
    const [payBusy, setPayBusy] = useState(false);
    const [editingCommission, setEditingCommission] = useState(null); // row

    const withActivity = prod.rows.filter(r => Number(r.services_count) > 0 || r.active);
    const unassigned = Math.max(0, Number(totalIncome || 0) - prod.assignedRevenue);

    return (
        <div className="space-y-3">
            {/* Totales del período — 2 paneles ícono+título+monto, igual que Resumen */}
            <div className="flex items-center gap-2 flex-wrap px-1">
                <MiniStatCard icon={HandCoins} label="Comisiones del período" value={money(prod.totalCommission)} />
                <MiniStatCard icon={Users} label="Atribuido al equipo" value={money(prod.assignedRevenue)} />
                {unassigned > 0 && (
                    <MiniStatCard icon={UserX} label="Sin atribuir" value={money(unassigned)}
                        title='Elige "Atendido por" al cobrar para verlo aquí' />
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
                        Al cobrar un servicio elige quién lo atendió: aquí verás cuánto generó cada quien y su comisión.
                    </p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {withActivity.map(r => (
                        <div key={r.staff_id} className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 flex-wrap">
                            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="relative z-10 flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-b from-white to-gray-100 border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] flex items-center justify-center text-navy-900 font-bold text-[13px] shrink-0">
                                    {initials(r.staff_name)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-navy-900 text-sm leading-tight truncate">{r.staff_name}</span>
                                        {!r.active && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[8px] font-bold tracking-widest text-navy-900/40">Inactivo</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-semibold text-navy-700/55 mt-0.5">
                                        {r.services_count} {Number(r.services_count) === 1 ? 'servicio' : 'servicios'} · generó {money(r.revenue)}
                                    </p>
                                </div>
                            </div>
                            <div className="relative z-10 flex items-center gap-2.5 shrink-0 flex-wrap">
                                {canEditCommission ? (
                                    <button onClick={() => setEditingCommission(r)}
                                        title="Editar % de comisión (aplica a cobros futuros)"
                                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-navy-900/5 border border-navy-900/10 text-[10px] font-bold text-navy-800 hover:bg-navy-900/10 transition-all tabular-nums">
                                        <Percent size={10} /> {Number(r.commission_pct ?? 0)}%
                                    </button>
                                ) : (
                                    <span className="px-2 py-1 rounded-full bg-navy-900/5 border border-navy-900/10 text-[10px] font-bold text-navy-800 tabular-nums">
                                        {Number(r.commission_pct ?? 0)}%
                                    </span>
                                )}
                                <div className="text-right">
                                    <span className="text-[9px] font-bold tracking-widest text-navy-900/40 block leading-none">Comisión</span>
                                    <span className="text-[15px] font-bold text-navy-900 tabular-nums leading-none block mt-0.5">{money(r.commission_total)}</span>
                                </div>
                                {canRecordExpense && Number(r.commission_total) > 0 && (
                                    <AddBtn icon={HandCoins} label="Pagar" onClick={() => setPaying(r)} />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editingCommission && (
                <CommissionModal row={editingCommission} onClose={() => setEditingCommission(null)} onSave={prod.saveCommission} />
            )}

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
