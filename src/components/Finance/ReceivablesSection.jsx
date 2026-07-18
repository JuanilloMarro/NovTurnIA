import { useState, useEffect, useRef } from 'react';
import { Plus, Search, User, X, HandCoins, Copy, Check, Ban, MessageCircle, ChevronDown } from 'lucide-react';
import { searchPatients } from '../../services/supabaseService';
import { useAppStore } from '../../store/useAppStore';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { ModalShell, FieldLabel, TextInput, AmountInput, OptionWheel, NotesField, ModalButtons, LedgerSearch, useMethodOptions, money } from './financeUi';
import { formatPhone } from '../../utils/format';

// Por cobrar — planes de pago (tratamientos/paquetes en abonos). El caso
// dental por excelencia: una ortodoncia de Q12,000 pagada en cuotas. El saldo
// vive en la DB (RPC get_payment_plans); aquí se registra cada abono y se
// puede copiar un recordatorio de WhatsApp (borrador — NUNCA se envía solo).

const PAGE = 20;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_META = {
    active: { label: 'Activo', cls: 'bg-sky-500/10 border-sky-500/20 text-sky-700' },
    completed: { label: 'Completado', cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' },
    cancelled: { label: 'Cancelado', cls: 'bg-navy-900/5 border-navy-900/10 text-navy-900/40' },
};

// ── Modal: nuevo plan de pago ────────────────────────────
function NewPlanModal({ onClose, onSubmit }) {
    const [patient, setPatient] = useState(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef(null);
    const [description, setDescription] = useState('');
    const [total, setTotal] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        const term = query.trim();
        if (!term) { setResults([]); setSearching(false); return; }
        setSearching(true);
        debounceRef.current = setTimeout(() => {
            searchPatients(term, 8).then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
        }, 250);
        return () => clearTimeout(debounceRef.current);
    }, [query]);

    async function submit() {
        const amt = Number(total);
        if (!description.trim()) { showErrorToast('Falta descripción', 'Describe el tratamiento o paquete.'); return; }
        if (!(amt > 0)) { showErrorToast('Total inválido', 'Ingresa el total a cobrar.'); return; }
        setSaving(true);
        try {
            await onSubmit({ patient_id: patient?.id ?? null, description: description.trim(), total_amount: amt, notes: notes.trim() || null });
            showSuccessToast('Plan creado', `${description.trim()} · ${money(amt)} por cobrar.`);
            onClose();
        } catch (err) {
            showErrorToast('No se pudo crear', err.message || 'Intenta de nuevo.');
            setSaving(false);
        }
    }

    return (
        <ModalShell title="Nuevo plan de pago" subtitle="Tratamiento o paquete que el cliente pagará en abonos." onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Crear plan" loading={saving} confirmIcon={Plus} />}>
            <div>
                <FieldLabel title="Cliente" subtitle="Opcional pero recomendado — habilita el recordatorio de WhatsApp." />
                {patient ? (
                    <div className="flex items-center justify-between gap-2 bg-white/50 border border-white/60 rounded-2xl px-3.5 py-2.5 shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                                <User size={13} className="text-navy-900" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[12px] font-bold text-navy-900 truncate leading-tight">{patient.display_name}</p>
                                {patient.phone && <p className="text-[10px] font-semibold text-navy-700/50 leading-tight mt-0.5">{formatPhone(patient.phone)}</p>}
                            </div>
                        </div>
                        <button onClick={() => { setPatient(null); setQuery(''); }}
                            className="w-6 h-6 rounded-full bg-white/60 border border-white/60 flex items-center justify-center text-navy-700/60 hover:text-navy-900 hover:bg-white transition-colors shrink-0">
                            <X size={12} />
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-700/40 pointer-events-none" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Busca un cliente por nombre…"
                            className="w-full bg-white/40 border border-white/60 rounded-full pl-9 pr-3 py-2.5 text-[12px] font-semibold text-navy-900 outline-none focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40" />
                        {(results.length > 0 || searching) && (
                            <div className="absolute top-full inset-x-0 mt-1.5 bg-white/95 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-[0_8px_32px_rgba(26,58,107,0.18)] overflow-hidden max-h-52 overflow-y-auto custom-scrollbar z-20">
                                {searching && results.length === 0 && <p className="px-4 py-3 text-[11px] font-semibold text-navy-700/50">Buscando…</p>}
                                {results.map(r => (
                                    <button key={r.id} onClick={() => { setPatient(r); setResults([]); setQuery(''); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-navy-900/5 transition-colors">
                                        <div className="w-6 h-6 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                                            <User size={11} className="text-navy-900" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-bold text-navy-900 truncate leading-tight">{r.display_name}</p>
                                            {r.phone && <p className="text-[10px] font-semibold text-navy-700/50 leading-tight">{formatPhone(r.phone)}</p>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div>
                <FieldLabel title="Descripción" subtitle="¿Qué se está pagando? (ej: Ortodoncia, paquete de 10 sesiones)" />
                <TextInput value={description} onChange={setDescription} placeholder="Ej: Tratamiento de ortodoncia" maxLength={120} />
            </div>
            <div>
                <FieldLabel title="Total a cobrar" subtitle="El monto completo del tratamiento o paquete." />
                <AmountInput value={total} onChange={setTotal} />
            </div>
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional (acuerdos, frecuencia de abonos…)." />
                <NotesField value={notes} onChange={setNotes} placeholder="Ej: abonos quincenales de Q500…" />
            </div>
        </ModalShell>
    );
}

// ── Modal: registrar abono ───────────────────────────────
function PaymentModal({ plan, onClose, onSubmit }) {
    const methodOptions = useMethodOptions();
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    async function submit() {
        const amt = Number(amount);
        if (!(amt > 0)) { showErrorToast('Monto inválido', 'Ingresa el monto del abono.'); return; }
        setSaving(true);
        try {
            const r = await onSubmit({ planId: plan.id, amount: amt, paymentMethod: method, notes: notes.trim() || null });
            showSuccessToast(
                r?.completed ? '¡Plan completado! 🎉' : 'Abono registrado',
                r?.completed ? `${plan.description} quedó totalmente pagado.` : `${money(amt)} abonado · saldo ${money(r?.balance)}.`
            );
            onClose();
        } catch (err) {
            showErrorToast('No se pudo registrar', err.message || 'Intenta de nuevo.');
            setSaving(false);
        }
    }

    return (
        <ModalShell title="Registrar abono" subtitle={`${plan.description} · saldo ${money(plan.balance)}`} onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Abonar" loading={saving} confirmIcon={HandCoins} />}>
            <div>
                <FieldLabel title="Monto del abono" subtitle={`Saldo pendiente: ${money(plan.balance)}. El abono cuenta como ingreso de hoy.`} />
                <AmountInput value={amount} onChange={setAmount} autoFocus />
            </div>
            <div>
                <FieldLabel title="Método de pago" subtitle="¿Cómo pagó el cliente?" />
                <OptionWheel options={methodOptions} value={method} onChange={setMethod} />
            </div>
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional." />
                <NotesField value={notes} onChange={setNotes} placeholder="Ej: abono correspondiente a enero…" />
            </div>
        </ModalShell>
    );
}

function ReminderCopyButton({ plan, businessName }) {
    const [copied, setCopied] = useState(false);
    const text = `¡Hola ${plan.patient_name || ''}! 👋 Te saludamos de ${businessName || 'nuestro negocio'}. Te recordamos que tienes un saldo pendiente de ${money(plan.balance)} por ${plan.description}. ¿Cuándo te queda bien pasar a abonar? ¡Gracias! 😊`;
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                }).catch(() => {});
            }}
            title="Copiar recordatorio para WhatsApp (no se envía solo: tú decides)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/15 text-[9.5px] font-bold text-emerald-700 hover:bg-emerald-500/10 transition-all shrink-0"
        >
            {copied ? <Check size={11} /> : <MessageCircle size={11} />}
            {copied ? 'Copiado' : 'Recordatorio'}
        </button>
    );
}

export default function ReceivablesSection({ rec, canRecord, canVoid }) {
    const businessName = useAppStore(s => s.businessName);
    const [query, setQuery] = useState('');
    const [visible, setVisible] = useState(PAGE);
    const [newPlan, setNewPlan] = useState(false);
    const [paying, setPaying] = useState(null);   // plan
    const [cancelling, setCancelling] = useState(null); // plan
    const [cancelBusy, setCancelBusy] = useState(false);

    const t = query.trim().toLowerCase();
    const filtered = t
        ? rec.plans.filter(p => (p.patient_name || '').toLowerCase().includes(t) || (p.description || '').toLowerCase().includes(t))
        : rec.plans;
    const shown = filtered.slice(0, visible);

    return (
        <div className="space-y-3">
            {/* Header: saldo total + acciones */}
            <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                <div className="flex items-center gap-3">
                    <div className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl px-4 py-2.5 shadow-md">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-navy-900/40 block leading-none">Por cobrar</span>
                        <span className="text-[16px] font-bold text-navy-900 tabular-nums leading-none block mt-1">{money(rec.totalBalance)}</span>
                    </div>
                    <span className="text-[10px] font-bold text-navy-900/40">{rec.active.length} {rec.active.length === 1 ? 'plan activo' : 'planes activos'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <LedgerSearch value={query} onChange={v => { setQuery(v); setVisible(PAGE); }} placeholder="Buscar por cliente o tratamiento…" />
                    {canRecord && (
                        <button onClick={() => setNewPlan(true)}
                            className="relative overflow-hidden group h-9 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 rounded-full shadow-md hover:bg-white/60 transition-all duration-300">
                            <Plus size={15} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[110px] transition-all duration-300 whitespace-nowrap text-[11px] font-bold relative z-10">Nuevo plan</span>
                        </button>
                    )}
                </div>
            </div>

            {rec.loading ? (
                <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-14">
                    <p className="text-[12px] font-bold text-navy-900/60 mb-1">{rec.plans.length === 0 ? 'Sin planes de pago todavía' : 'Sin coincidencias'}</p>
                    {rec.plans.length === 0 && (
                        <p className="text-[11px] font-semibold text-navy-700/40 max-w-[340px] mx-auto">
                            Crea un plan cuando un cliente pague un tratamiento o paquete en cuotas — el saldo se controla solo con cada abono.
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {shown.map(p => {
                        const meta = STATUS_META[p.status] || STATUS_META.active;
                        const paidPct = Number(p.total_amount) > 0 ? Math.min(100, Math.round((Number(p.paid_amount) / Number(p.total_amount)) * 100)) : 0;
                        return (
                            <div key={p.id} className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl p-4 shadow-md">
                                <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                <div className="relative z-10 flex items-start justify-between gap-3 flex-wrap">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-navy-900 text-sm leading-tight">{p.description}</span>
                                            <span className={`px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-widest ${meta.cls}`}>{meta.label}</span>
                                        </div>
                                        <div className="text-[10px] font-semibold text-navy-700/55 flex items-center gap-1.5 mt-1 flex-wrap">
                                            {p.patient_name && <span className="flex items-center gap-1"><User size={10} /> {p.patient_name}</span>}
                                            <span>· creado {fmtDate(p.created_at)}</span>
                                            {p.last_payment_at && <span>· último abono {fmtDate(p.last_payment_at)}</span>}
                                        </div>
                                        <div className="flex items-center gap-2.5 mt-2.5">
                                            <div className="flex-1 max-w-[260px] h-2 rounded-full bg-navy-900/10 overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${paidPct}%`, background: p.status === 'completed' ? '#10B981' : 'linear-gradient(90deg, rgba(64,98,200,1), rgba(120,110,230,1))' }} />
                                            </div>
                                            <span className="text-[10px] font-bold text-navy-900/50 tabular-nums shrink-0">
                                                {money(p.paid_amount)} de {money(p.total_amount)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <div className="text-right">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-navy-900/40 block leading-none">Saldo</span>
                                            <span className={`text-[16px] font-bold tabular-nums leading-none block mt-0.5 ${p.status === 'completed' ? 'text-emerald-600' : 'text-navy-900'}`}>
                                                {money(p.balance)}
                                            </span>
                                        </div>
                                        {p.status === 'active' && (
                                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                {p.patient_phone && <ReminderCopyButton plan={p} businessName={businessName} />}
                                                {canRecord && (
                                                    <button onClick={() => setPaying(p)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-navy-900 border border-white/10 text-white text-[9.5px] font-bold shadow-card hover:bg-navy-800 transition-all">
                                                        <HandCoins size={11} /> Abonar
                                                    </button>
                                                )}
                                                {canVoid && (
                                                    <button onClick={() => setCancelling(p)} title="Cancelar plan"
                                                        className="w-7 h-7 rounded-full bg-white/50 border border-white/60 flex items-center justify-center text-navy-700/50 hover:text-rose-600 hover:border-rose-200 transition-all">
                                                        <Ban size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filtered.length > visible && (
                        <button onClick={() => setVisible(v => v + PAGE)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-white/30 border border-white/50 text-[11px] font-bold text-navy-700/60 hover:bg-white/50 hover:text-navy-900 transition-all">
                            <ChevronDown size={13} /> Mostrar más ({filtered.length - visible} restantes)
                        </button>
                    )}
                </div>
            )}

            {newPlan && <NewPlanModal onClose={() => setNewPlan(false)} onSubmit={rec.addPlan} />}
            {paying && <PaymentModal plan={paying} onClose={() => setPaying(null)} onSubmit={rec.addPayment} />}
            <ConfirmDialog open={!!cancelling} danger loading={cancelBusy}
                title="¿Cancelar este plan?"
                message={cancelling ? `Se cancela "${cancelling.description}" con saldo pendiente de ${money(cancelling.balance)}. Los abonos ya registrados se conservan.` : ''}
                confirmLabel="Sí, cancelar" loadingLabel="Cancelando..."
                onConfirm={async () => {
                    setCancelBusy(true);
                    try {
                        await rec.cancelPlan(cancelling.id, 'Cancelado desde Finanzas');
                        showSuccessToast('Plan cancelado', 'El plan ya no aparecerá en Por cobrar.');
                    } catch (err) {
                        showErrorToast('No se pudo cancelar', err.message || '');
                    } finally {
                        setCancelBusy(false);
                        setCancelling(null);
                    }
                }}
                onCancel={() => setCancelling(null)} />
        </div>
    );
}
