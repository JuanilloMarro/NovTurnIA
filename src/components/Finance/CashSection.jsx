import { useState } from 'react';
import { Wallet, Lock, Unlock, ArrowUpRight, ArrowDownRight, Scale, Clock } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, AmountInput, NotesField, ModalButtons, money } from './financeUi';

// Caja diaria — el ritual de apertura/cierre de efectivo (barberías y salones
// viven de esto). El "esperado" lo calcula la DB: apertura + ingresos en
// métodos marcados como efectivo − egresos en efectivo del rango de la sesión.
// Al cerrar se guarda el conteo real y la diferencia (sobrante/faltante).

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('es-GT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

function elapsedLabel(iso) {
    if (!iso) return '';
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return `${h} h ${mins % 60} min`;
}

function OpenModal({ onClose, onSubmit }) {
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    async function submit() {
        const amt = Number(amount);
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa el efectivo inicial (puede ser 0).'); return; }
        setSaving(true);
        try {
            await onSubmit(amt, notes.trim() || null);
            showSuccessToast('Caja abierta', `Fondo inicial: ${money(amt)}.`);
            onClose();
        } catch (err) {
            showErrorToast('No se pudo abrir la caja', err.message || '');
            setSaving(false);
        }
    }
    return (
        <ModalShell title="Abrir caja" subtitle="Cuenta el efectivo con el que inicias el día." onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Abrir caja" loading={saving} confirmIcon={Unlock} />}>
            <div>
                <FieldLabel title="Fondo inicial" subtitle="El efectivo que hay en caja al abrir (cambio, sencillo…)." />
                <AmountInput value={amount} onChange={setAmount} autoFocus />
            </div>
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional." />
                <NotesField value={notes} onChange={setNotes} placeholder="Ej: turno de la mañana…" />
            </div>
        </ModalShell>
    );
}

function CloseModal({ expected, onClose, onSubmit }) {
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const diff = amount === '' ? null : Number(amount) - Number(expected || 0);
    async function submit() {
        const amt = Number(amount);
        if (!(amt >= 0)) { showErrorToast('Conteo inválido', 'Ingresa el efectivo contado.'); return; }
        setSaving(true);
        try {
            const row = await onSubmit(amt, notes.trim() || null);
            const d = Number(row?.difference ?? 0);
            showSuccessToast(
                'Caja cerrada',
                d === 0 ? 'Cuadre perfecto: sin diferencia. ✔' : d > 0 ? `Sobrante de ${money(d)}.` : `Faltante de ${money(Math.abs(d))}.`
            );
            onClose();
        } catch (err) {
            showErrorToast('No se pudo cerrar la caja', err.message || '');
            setSaving(false);
        }
    }
    return (
        <ModalShell title="Cerrar caja" subtitle={`Efectivo esperado: ${money(expected)}`} onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Cerrar caja" loading={saving} confirmIcon={Lock} />}>
            <div>
                <FieldLabel title="Efectivo contado" subtitle="Cuenta el dinero físico de la caja y anota el total real." />
                <AmountInput value={amount} onChange={setAmount} autoFocus />
            </div>
            {diff != null && isFinite(diff) && (
                <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-[11.5px] font-bold ${diff === 0 ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-700' : diff > 0 ? 'bg-sky-500/5 border-sky-500/15 text-sky-700' : 'bg-rose-500/5 border-rose-500/15 text-rose-600'}`}>
                    <Scale size={13} className="shrink-0" />
                    {diff === 0 ? 'Cuadre perfecto — sin diferencia.' : diff > 0 ? `Sobrante de ${money(diff)}.` : `Faltante de ${money(Math.abs(diff))}.`}
                </div>
            )}
            <div>
                <FieldLabel title="Notas" subtitle="Explica la diferencia si la hay (propinas, error de cambio…)." />
                <NotesField value={notes} onChange={setNotes} placeholder="Observaciones del cierre…" />
            </div>
        </ModalShell>
    );
}

function StatCell({ icon: Icon, label, value, accent }) {
    return (
        <div className="flex-1 min-w-[130px] bg-white/40 border border-white/60 rounded-2xl px-4 py-3 shadow-sm">
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-navy-900/40 leading-none">
                <Icon size={11} /> {label}
            </span>
            <span className={`text-[16px] font-bold tabular-nums leading-none block mt-1.5 ${accent || 'text-navy-900'}`}>{value}</span>
        </div>
    );
}

export default function CashSection({ cash, canManage }) {
    const [opening, setOpening] = useState(false);
    const [closing, setClosing] = useState(false);

    const open = cash.status?.session?.status === 'open' ? cash.status : null;

    return (
        <div className="space-y-4">
            {/* Estado actual */}
            {cash.loading ? (
                <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" /></div>
            ) : open ? (
                <div className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] p-5 shadow-md">
                    <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(16,185,129,0.06)' }} />
                    <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <Wallet size={20} className="text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-bold text-navy-900 leading-none">Caja abierta</h3>
                                    <p className="text-[10px] font-bold text-navy-900/40 mt-1 flex items-center gap-1">
                                        <Clock size={10} /> Desde {fmtDateTime(open.session.opened_at)} · {elapsedLabel(open.session.opened_at)}
                                    </p>
                                </div>
                            </div>
                            {canManage && (
                                <button onClick={() => setClosing(true)}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-navy-900 border border-white/10 text-white text-[11px] font-bold rounded-full shadow-card hover:bg-navy-800 transition-all">
                                    <Lock size={13} /> Cerrar caja
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <StatCell icon={Unlock} label="Fondo inicial" value={money(open.session.opening_amount)} />
                            <StatCell icon={ArrowUpRight} label="Efectivo entró" value={`+${money(open.cash_in)}`} accent="text-emerald-600" />
                            <StatCell icon={ArrowDownRight} label="Efectivo salió" value={`-${money(open.cash_out)}`} accent="text-rose-500" />
                            <StatCell icon={Scale} label="Esperado en caja" value={money(open.expected)} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] p-8 shadow-md text-center">
                    <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mb-3">
                            <Wallet size={20} className="text-navy-700/50" />
                        </div>
                        <p className="text-[13px] font-bold text-navy-900 mb-1">Caja cerrada</p>
                        <p className="text-[11px] font-semibold text-navy-700/50 max-w-[320px] mb-4">
                            Abre la caja al iniciar el día con tu fondo de efectivo; al cerrar comparas lo contado contra lo esperado.
                        </p>
                        {canManage && (
                            <button onClick={() => setOpening(true)}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-navy-900 border border-white/10 text-white text-[11px] font-bold rounded-full shadow-card hover:bg-navy-800 transition-all">
                                <Unlock size={13} /> Abrir caja
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Historial de cierres */}
            {cash.sessions.length > 0 && (
                <div>
                    <p className="text-[9px] font-bold text-navy-900/40 tracking-widest uppercase mb-2 px-1">Cierres anteriores</p>
                    <div className="space-y-2">
                        {cash.sessions.filter(s => s.status === 'closed').map(s => {
                            const d = Number(s.difference ?? 0);
                            return (
                                <div key={s.id} className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl px-4 py-3 shadow-md flex items-center justify-between gap-3 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-bold text-navy-900 leading-tight">
                                            {fmtDateTime(s.opened_at)} → {fmtDateTime(s.closed_at)}
                                        </p>
                                        <p className="text-[10px] font-semibold text-navy-700/50 mt-0.5">
                                            {s.opened_by_name ? `Abrió ${s.opened_by_name}` : ''}{s.closed_by_name ? ` · cerró ${s.closed_by_name}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                                        <span className="text-[10px] font-bold text-navy-900/45 tabular-nums">
                                            Esperado {money(s.expected_amount)} · contado {money(s.counted_amount)}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold tabular-nums ${d === 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : d > 0 ? 'bg-sky-500/10 border-sky-500/20 text-sky-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'}`}>
                                            {d === 0 ? 'Cuadre ✔' : d > 0 ? `Sobrante ${money(d)}` : `Faltante ${money(Math.abs(d))}`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {opening && <OpenModal onClose={() => setOpening(false)} onSubmit={cash.open} />}
            {closing && open && <CloseModal expected={open.expected} onClose={() => setClosing(false)} onSubmit={cash.close} />}
        </div>
    );
}
