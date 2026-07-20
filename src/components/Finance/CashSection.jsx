import { useState } from 'react';
import { Wallet, Lock, Unlock, ArrowUpRight, ArrowDownRight, Scale, Clock, SlidersHorizontal, ChevronDown, ChevronLeft } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, AmountInput, NotesField, ModalButtons, AddBtn, money } from './financeUi';

// Caja diaria — el ritual de apertura/cierre de efectivo (barberías y salones
// viven de esto). El "esperado" lo calcula la DB: apertura + ingresos en
// métodos marcados como efectivo − egresos en efectivo del rango de la sesión.
// Al cerrar se guarda el conteo real y la diferencia (sobrante/faltante).
//
// Layout calcado de Settings.jsx (Servicios): lista de cierres a la
// izquierda, panel grande a la derecha con el estado ACTUAL de la caja por
// defecto, o el detalle de un cierre pasado cuando se selecciona uno de la lista.

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('es-GT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

function elapsedLabel(iso) {
    if (!iso) return '';
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return `${h} h ${mins % 60} min`;
}

function diffBadge(diff) {
    const d = Number(diff ?? 0);
    if (d === 0) return { label: 'Cuadre ✔', cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' };
    if (d > 0) return { label: `Sobrante ${money(d)}`, cls: 'bg-sky-500/10 border-sky-500/20 text-sky-700' };
    return { label: `Faltante ${money(Math.abs(d))}`, cls: 'bg-rose-500/10 border-rose-500/20 text-rose-600' };
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
                    {diff === 0 ? 'Cuadre perfecto, sin diferencia.' : diff > 0 ? `Sobrante de ${money(diff)}.` : `Faltante de ${money(Math.abs(diff))}.`}
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
            <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-navy-900/40 leading-none">
                <Icon size={11} /> {label}
            </span>
            <span className={`text-[16px] font-bold tabular-nums leading-none block mt-1.5 ${accent || 'text-navy-900'}`}>{value}</span>
        </div>
    );
}

export default function CashSection({ cash, canManage }) {
    const [opening, setOpening] = useState(false);
    const [closing, setClosing] = useState(false);
    const [selectedId, setSelectedId] = useState(null); // null = sin elegir aún (lista en móvil) | 'current' | uuid de un cierre pasado
    const [showFilter, setShowFilter] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // all | match | diff

    const open = cash.status?.session?.status === 'open' ? cash.status : null;
    const closedSessions = cash.sessions.filter(s => s.status === 'closed');
    const filteredSessions = statusFilter === 'all' ? closedSessions
        : statusFilter === 'match' ? closedSessions.filter(s => Number(s.difference ?? 0) === 0)
            : closedSessions.filter(s => Number(s.difference ?? 0) !== 0);
    const selectedSession = selectedId && selectedId !== 'current' ? closedSessions.find(s => s.id === selectedId) : null;
    const isDetailOpen = selectedId !== null;

    return (
        <div className="relative h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex overflow-hidden">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

            {/* ── Izquierda: historial de cierres ── */}
            <div className={`${isDetailOpen ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] xl:w-[380px] flex-col z-10`}>
                <div className="p-4 pb-3 shrink-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-[12px] font-bold text-navy-900 tracking-tight">Cierres anteriores</h3>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="relative">
                                <button onClick={() => setShowFilter(v => !v)}
                                    className="relative overflow-hidden group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-3 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[10.5px] font-bold rounded-full shadow-sm transition-all duration-300 outline-none">
                                    <SlidersHorizontal size={12} strokeWidth={2.5} className="shrink-0 relative z-10" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap relative z-10">Filtros</span>
                                </button>
                                {showFilter && (
                                    <div className="overflow-hidden absolute right-0 top-full mt-2 w-44 bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[20px] shadow-md z-50 p-2 animate-fade-up">
                                        <div className="absolute -top-8 -right-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="absolute -bottom-8 -left-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(120,110,230,0.05)' }} />
                                        <div className="relative z-10">
                                            {[{ id: 'all', label: 'Todos' }, { id: 'match', label: 'Cuadre perfecto' }, { id: 'diff', label: 'Con diferencia' }].map(opt => (
                                                <div key={opt.id} onClick={() => { setStatusFilter(opt.id); setShowFilter(false); }}
                                                    className={`px-3 py-2 rounded-2xl text-[11px] font-bold cursor-pointer transition-all border ${statusFilter === opt.id ? 'bg-white/60 backdrop-blur-sm border-white/80 shadow-md text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-white/20'}`}>
                                                    {opt.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {canManage && !open && (
                                <AddBtn icon={Unlock} label="Abrir caja" onClick={() => setOpening(true)} />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pt-0 flex flex-col gap-1">
                    {cash.loading ? (
                        <div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" /></div>
                    ) : (
                        <>
                            {/* La caja de hoy (si sigue abierta) vive aquí también — así
                                nunca se "pierde" al mirar un cierre pasado, siempre hay
                                cómo volver a ella con un clic. */}
                            {open && (
                                <button onClick={() => setSelectedId('current')}
                                    className={`relative w-full flex items-center justify-between gap-2 p-3.5 rounded-2xl overflow-hidden transition-all duration-200 text-left border ${(selectedId === 'current' || selectedId === null) ? 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-md' : 'border-transparent hover:bg-white/20'}`}>
                                    <div className="min-w-0 flex items-center gap-2.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0 animate-pulse" />
                                        <div className="min-w-0">
                                            <p className="text-[11.5px] font-bold text-navy-900 leading-tight truncate">Hoy, en curso</p>
                                            <p className="text-[9.5px] font-semibold text-navy-700/50 mt-0.5 truncate">Abierta desde {fmtDateTime(open.session.opened_at)}</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full border text-[8.5px] font-bold shrink-0 bg-emerald-500/10 border-emerald-500/20 text-emerald-700">Actual</span>
                                </button>
                            )}

                            {filteredSessions.length === 0 ? (
                                <div className="px-4 py-8 text-center text-navy-900/40 text-xs font-bold">
                                    {closedSessions.length === 0 ? 'Sin cierres registrados todavía' : 'Sin coincidencias'}
                                </div>
                            ) : (
                                filteredSessions.map(s => {
                                    const badge = diffBadge(s.difference);
                                    const isSelected = selectedId === s.id;
                                    return (
                                        <button key={s.id} onClick={() => setSelectedId(s.id)}
                                            className={`relative w-full flex items-center justify-between gap-2 p-3.5 rounded-2xl overflow-hidden transition-all duration-200 text-left border ${isSelected ? 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-md' : 'border-transparent hover:bg-white/20'}`}>
                                            <div className="min-w-0">
                                                <p className="text-[11.5px] font-bold text-navy-900 leading-tight truncate">{fmtDateTime(s.opened_at)}</p>
                                                <p className="text-[9.5px] font-semibold text-navy-700/50 mt-0.5 truncate">{money(s.expected_amount)} esperado</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full border text-[8.5px] font-bold tabular-nums shrink-0 ${badge.cls}`}>{badge.label}</span>
                                        </button>
                                    );
                                })
                            )}
                        </>
                    )}

                    {cash.hasMore && (
                        <button onClick={cash.loadMore} disabled={cash.loadingMore}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-white/30 border border-white/50 text-[11px] font-bold text-navy-700/60 hover:bg-white/50 hover:text-navy-900 transition-all disabled:opacity-50">
                            <ChevronDown size={13} /> {cash.loadingMore ? 'Cargando…' : 'Cargar más'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Derecha: estado actual, o detalle del cierre seleccionado ── */}
            <div className={`${isDetailOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative min-w-0 p-5 overflow-y-auto custom-scrollbar`}>
                {selectedSession ? (
                    <div className="relative z-10">
                        <button onClick={() => setSelectedId(null)}
                            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white/80 shadow-sm mb-3">
                            <ChevronLeft size={16} />
                        </button>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-11 h-11 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                                <Wallet size={20} className="text-navy-800" />
                            </div>
                            <div>
                                <h3 className="text-[14px] font-bold text-navy-900 leading-none">Cierre del {fmtDateTime(selectedSession.opened_at)}</h3>
                                <p className="text-[10px] font-bold text-navy-900/40 mt-1">Cerrado {fmtDateTime(selectedSession.closed_at)}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 flex-wrap mb-4">
                            <StatCell icon={Unlock} label="Fondo inicial" value={money(selectedSession.opening_amount)} />
                            <StatCell icon={Scale} label="Esperado" value={money(selectedSession.expected_amount)} />
                            <StatCell icon={Wallet} label="Contado" value={money(selectedSession.counted_amount)} />
                        </div>
                        <p className="text-[10px] font-semibold text-navy-700/55">
                            {selectedSession.opened_by_name ? `Abrió ${selectedSession.opened_by_name}` : ''}{selectedSession.closed_by_name ? ` · cerró ${selectedSession.closed_by_name}` : ''}
                        </p>
                        {selectedSession.notes && (
                            <p className="text-[11px] font-semibold text-navy-700/60 mt-3 bg-white/30 border border-white/50 rounded-2xl p-3">{selectedSession.notes}</p>
                        )}
                    </div>
                ) : cash.loading ? (
                    <div className="flex-1 flex items-center justify-center"><div className="w-7 h-7 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" /></div>
                ) : open ? (
                    <div className="relative z-10">
                        <button onClick={() => setSelectedId(null)}
                            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white/80 shadow-sm mb-3">
                            <ChevronLeft size={16} />
                        </button>
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
                            {canManage && <AddBtn icon={Lock} label="Cerrar caja" onClick={() => setClosing(true)} />}
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <StatCell icon={Unlock} label="Fondo inicial" value={money(open.session.opening_amount)} />
                            <StatCell icon={ArrowUpRight} label="Efectivo entró" value={`+${money(open.cash_in)}`} accent="text-emerald-600" />
                            <StatCell icon={ArrowDownRight} label="Efectivo salió" value={`-${money(open.cash_out)}`} accent="text-rose-500" />
                            <StatCell icon={Scale} label="Esperado en caja" value={money(open.expected)} />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
                        <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center mb-4 shadow-sm">
                            <Wallet size={28} strokeWidth={1.5} className="text-navy-700" />
                        </div>
                        <h3 className="text-lg font-bold text-navy-900 tracking-tight">Caja cerrada</h3>
                        <p className="max-w-[280px] text-xs font-semibold mt-1 text-navy-900/60">
                            Abre la caja con el botón de la izquierda para empezar el día, o selecciona un cierre para ver su detalle.
                        </p>
                    </div>
                )}
            </div>

            {opening && <OpenModal onClose={() => setOpening(false)} onSubmit={cash.open} />}
            {closing && open && <CloseModal expected={open.expected} onClose={() => setClosing(false)} onSubmit={cash.close} />}
        </div>
    );
}
