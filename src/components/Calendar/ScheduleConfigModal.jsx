import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarOff, Plus, Trash2, Save, Users as UsersIcon } from 'lucide-react';
import { getScheduleExceptions, createScheduleException, deleteScheduleException, updateDailyCap, getBusinessInfo } from '../../services/supabaseService';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import ConfirmDialog from '../ui/ConfirmDialog';

// Configuración de agenda avanzada (Turnos): festivos/cierres, horarios especiales
// por fecha y cupo diario de citas. Estas reglas las aplica la DB tanto al bot
// (get_available_slots) como al dashboard (trigger validate_appointment).
export default function ScheduleConfigModal({ onClose, onSaved }) {
    const [exceptions, setExceptions] = useState([]);
    const [cap, setCap] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingCap, setSavingCap] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    // Form de nueva excepción
    const [date, setDate] = useState('');
    const [closed, setClosed] = useState(true);
    const [start, setStart] = useState(9);
    const [end, setEnd] = useState(18);
    const [note, setNote] = useState('');
    const [adding, setAdding] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const [exc, biz] = await Promise.all([getScheduleExceptions(), getBusinessInfo()]);
            setExceptions(exc);
            setCap(biz?.max_appointments_per_day ?? '');
        } catch (err) {
            showErrorToast('Error al cargar', err.message || '');
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);

    async function handleSaveCap() {
        setSavingCap(true);
        try {
            await updateDailyCap(cap);
            showSuccessToast('Cupo actualizado', cap ? `Máximo ${cap} citas por día.` : 'Sin tope diario.');
            onSaved?.();
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || '');
        } finally {
            setSavingCap(false);
        }
    }

    async function handleAdd() {
        if (!date) { showErrorToast('Falta la fecha', 'Elige el día de la excepción.'); return; }
        if (!closed && Number(start) >= Number(end)) { showErrorToast('Horario inválido', 'La apertura debe ser antes del cierre.'); return; }
        setAdding(true);
        try {
            await createScheduleException({
                exception_date: date,
                is_closed: closed,
                custom_start: closed ? null : Number(start),
                custom_end: closed ? null : Number(end),
                note: note.trim() || null,
            });
            showSuccessToast('Excepción agregada', closed ? 'Día marcado como cerrado.' : 'Horario especial guardado.');
            setDate(''); setNote(''); setClosed(true);
            await load();
            onSaved?.();
        } catch (err) {
            showErrorToast('No se pudo agregar', err.message || '');
        } finally {
            setAdding(false);
        }
    }

    async function handleDelete() {
        if (!pendingDelete) return;
        try {
            await deleteScheduleException(pendingDelete.id);
            showSuccessToast('Excepción eliminada', '');
            setExceptions(prev => prev.filter(e => e.id !== pendingDelete.id));
            onSaved?.();
        } catch (err) {
            showErrorToast('No se pudo eliminar', err.message || '');
        } finally {
            setPendingDelete(null);
        }
    }

    const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const inputCls = 'w-full bg-white/60 border border-white/80 rounded-full px-4 py-2 text-sm font-semibold outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all text-navy-900';

    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div onClick={e => e.stopPropagation()}
                className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full max-w-3xl overflow-hidden animate-fade-up flex flex-col max-h-[85vh]">
                <div className="flex items-start justify-between px-6 pt-6 pb-3 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-navy-900 tracking-tight leading-tight">Configuración de citas</h2>
                        <p className="text-[11px] font-semibold text-navy-700/50 mt-1">Festivos, horarios especiales y cupo diario</p>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors shrink-0"><X size={16} /></button>
                </div>

                {/* Panel de 2 columnas: entrada de datos a la izquierda, listado de
                    excepciones registradas a la derecha (mismo lenguaje que un panel
                    de lista, aunque el flujo es distinto al de Ofertas). */}
                <div className="px-6 pb-6 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:min-h-0 flex-1 overflow-y-auto md:overflow-hidden custom-scrollbar">
                    {/* ── Columna izquierda: cupo diario + nueva excepción ── */}
                    <div className="space-y-4 md:overflow-y-auto md:custom-scrollbar md:pr-1 md:min-h-0">
                        {/* Cupo diario */}
                        <div className="bg-white/40 border border-white/60 rounded-2xl p-4">
                            <label className="text-[11px] font-bold text-navy-800 tracking-wide flex items-center gap-1.5 mb-2"><UsersIcon size={12} /> Cupo máximo de citas por día</label>
                            <div className="flex items-center gap-2">
                                <input type="number" min="0" value={cap} onChange={e => setCap(e.target.value)} placeholder="Sin tope" className={inputCls} />
                                <button onClick={handleSaveCap} disabled={savingCap}
                                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-navy-900 text-white text-[11px] font-bold hover:bg-navy-800 transition-colors disabled:opacity-50">
                                    <Save size={13} /> Guardar
                                </button>
                            </div>
                            <p className="text-[10px] font-semibold text-navy-700/40 mt-1.5 px-1">Deja vacío para no limitar. Aplica al bot y al dashboard.</p>
                        </div>

                        {/* Nueva excepción */}
                        <div className="bg-white/40 border border-white/60 rounded-2xl p-4 space-y-3">
                            <p className="text-[11px] font-bold text-navy-800 tracking-wide flex items-center gap-1.5"><CalendarOff size={12} /> Agregar festivo / horario especial</p>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                                <div className="flex items-center rounded-full bg-white/50 border border-white/70 p-1 text-[11px] font-bold">
                                    <button onClick={() => setClosed(true)} className={`flex-1 h-7 rounded-full transition-all ${closed ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-700/60'}`}>Cerrado</button>
                                    <button onClick={() => setClosed(false)} className={`flex-1 h-7 rounded-full transition-all ${!closed ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-700/60'}`}>Horario</button>
                                </div>
                            </div>
                            {!closed && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div><span className="text-[10px] font-bold text-navy-700/50 px-1">Apertura</span>
                                        <select value={start} onChange={e => setStart(e.target.value)} className={inputCls}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></div>
                                    <div><span className="text-[10px] font-bold text-navy-700/50 px-1">Cierre</span>
                                        <select value={end} onChange={e => setEnd(e.target.value)} className={inputCls}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></div>
                                </div>
                            )}
                            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (ej. Día de la Independencia)" maxLength={80} className={inputCls} />
                            <button onClick={handleAdd} disabled={adding}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-full bg-white/50 border border-white/70 text-navy-900 text-[11px] font-bold hover:bg-white/70 transition-colors disabled:opacity-50">
                                <Plus size={13} /> {adding ? 'Agregando…' : 'Agregar excepción'}
                            </button>
                        </div>
                    </div>

                    {/* ── Columna derecha: listado de excepciones registradas ── */}
                    <div className="flex flex-col md:min-h-0 bg-white/30 border border-white/50 rounded-2xl overflow-hidden">
                        <p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest px-4 pt-3.5 pb-2.5 shrink-0 border-b border-white/40">
                            Excepciones registradas ({exceptions.length})
                        </p>
                        <div className="md:flex-1 md:overflow-y-auto custom-scrollbar p-3 space-y-2">
                            {loading ? (
                                <p className="text-[11px] font-semibold text-navy-700/40 text-center py-8">Cargando…</p>
                            ) : exceptions.length === 0 ? (
                                <div className="h-full flex items-center justify-center py-8">
                                    <p className="text-[11px] font-semibold text-navy-700/40 text-center px-4">Sin excepciones.<br />El horario normal aplica todos los días.</p>
                                </div>
                            ) : (
                                exceptions.map(e => (
                                    <div key={e.id} className="flex items-center gap-3 bg-white/50 border border-white/60 rounded-2xl px-3 py-2.5">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${e.is_closed ? 'bg-rose-500/10 border-rose-500/20 text-rose-600' : 'bg-blue-500/10 border-blue-500/20 text-blue-600'}`}>
                                            <CalendarOff size={14} />
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-navy-900 truncate capitalize">{fmtDate(e.exception_date)}</p>
                                            <p className="text-[10px] font-semibold text-navy-700/50 truncate">
                                                {e.is_closed ? 'Cerrado todo el día' : `Horario especial ${String(e.custom_start).padStart(2, '0')}:00–${String(e.custom_end).padStart(2, '0')}:00`}{e.note ? ` · ${e.note}` : ''}
                                            </p>
                                        </div>
                                        <button onClick={() => setPendingDelete(e)} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/50 border border-white/70 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <ConfirmDialog open={!!pendingDelete} danger
                    title="¿Eliminar excepción?"
                    message={pendingDelete ? `Se quitará la excepción del ${fmtDate(pendingDelete.exception_date)}.` : ''}
                    confirmLabel="Sí, eliminar" onConfirm={handleDelete} onCancel={() => setPendingDelete(null)} />
            </div>
        </div>,
        document.body
    );
}
