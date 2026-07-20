import { useState, useEffect, useCallback } from 'react';
import { Tags, CreditCard, Target, Percent, Plus, Trash2, Save, ToggleLeft, ToggleRight, Banknote, Lock, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import CategoriesSection from './CategoriesSection';
import { getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod, getBusinessInfo, updatePriceRounding } from '../../services/supabaseService';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { money, TextInput, PercentInput, CentsAmountInput, decimalToTenths, tenthsToDecimal, decimalToCents, centsToDecimal } from './financeUi';

// Ajustes de Finanzas — cuatro sub-secciones: Categorías (ingresos/egresos),
// Métodos de pago (con % de comisión POS y marca "efectivo" para la caja),
// Meta mensual (alimenta la barra de avance y la proyección del Resumen) y
// Precios (redondeo aplicado al precio promocional calculado por % en Ofertas).

// Exportado — Finance.jsx dibuja estos sub-tabs en su propia cabecera (fila
// horizontal debajo de los tabs de Finanzas), no este componente.
export const AJUSTES_SUBTABS = [
    { id: 'categorias', label: 'Categorías', icon: Tags },
    { id: 'metodos', label: 'Métodos de pago', icon: CreditCard },
    { id: 'meta', label: 'Meta mensual', icon: Target },
    { id: 'precios', label: 'Precios', icon: Percent },
];

// Incrementos permitidos por el CHECK de la DB (chk_price_rounding_increment).
const ROUNDING_OPTIONS = [
    { value: 0.01, label: 'Exacto', hint: 'Sin aproximar (centavos)' },
    { value: 0.05, label: 'Q0.05', hint: 'Aproxima al 5 centavos más cercano' },
    { value: 0.10, label: 'Q0.10', hint: 'Aproxima al 10 centavos más cercano' },
    { value: 0.25, label: 'Q0.25', hint: 'Aproxima al cuarto más cercano' },
    { value: 0.50, label: 'Q0.50', hint: 'Aproxima al medio quetzal más cercano' },
    { value: 1, label: 'Q1', hint: 'Aproxima al quetzal más cercano' },
    { value: 5, label: 'Q5', hint: 'Aproxima a múltiplos de 5' },
    { value: 10, label: 'Q10', hint: 'Aproxima a múltiplos de 10' },
];

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const QUARTERS = [
    { label: 'Primer trimestre', months: [1, 2, 3] },
    { label: 'Segundo trimestre', months: [4, 5, 6] },
    { label: 'Tercer trimestre', months: [7, 8, 9] },
    { label: 'Cuarto trimestre', months: [10, 11, 12] },
];

// Contenedor con el mismo lenguaje visual (glass + 4 glows de esquina) de
// CategoriesSection/Settings, reutilizado por Métodos y Meta mensual.
function PanelShell({ children }) {
    return (
        <div className="relative h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex overflow-hidden animate-fade-up">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            {children}
        </div>
    );
}

// ── Métodos de pago — lista izquierda / detalle derecha (mismo patrón que Categorías) ──
function MethodsPanel({ canManage }) {
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null); // null | 'new' | id
    const [form, setForm] = useState({ label: '', feeTenths: null, is_cash: false });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setMethods(await getPaymentMethods()); }
        catch (err) { console.error('[methods]', err.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const selected = selectedId && selectedId !== 'new' ? methods.find(m => m.id === selectedId) : null;
    const isNew = selectedId === 'new';
    const isFormOpen = isNew || selectedId !== null;

    function handleSelect(m) {
        setSelectedId(m.id);
        setForm({ label: m.label, feeTenths: decimalToTenths(m.fee_pct ?? 0), is_cash: !!m.is_cash });
    }
    function handleNewClick() {
        setSelectedId('new');
        setForm({ label: '', feeTenths: null, is_cash: false });
    }
    const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

    async function handleSave() {
        if (!form.label.trim()) { showErrorToast('Falta nombre', 'Escribe el nombre del método.'); return; }
        setSaving(true);
        try {
            const fee = tenthsToDecimal(form.feeTenths) ?? 0;
            if (isNew) {
                const created = await createPaymentMethod({ label: form.label.trim(), fee_pct: fee });
                showSuccessToast('Método creado', `${form.label.trim()} disponible al cobrar.`);
                await load();
                setSelectedId(created.id);
            } else {
                await updatePaymentMethod(selected.id, { label: form.label.trim(), fee_pct: fee, is_cash: form.is_cash });
                showSuccessToast('Método actualizado', '');
                await load();
            }
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || '');
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive() {
        if (!selected) return;
        try {
            await updatePaymentMethod(selected.id, { active: !selected.active });
            showSuccessToast(selected.active ? 'Método desactivado' : 'Método activado', '');
            await load();
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || '');
        }
    }

    async function handleDelete() {
        if (!selected) return;
        setDeleting(true);
        try {
            await deletePaymentMethod(selected.id);
            showSuccessToast('Método eliminado', '');
            setSelectedId(null);
            setShowDeleteConfirm(false);
            await load();
        } catch (err) {
            showErrorToast('No se pudo eliminar', err.message || '');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <PanelShell>
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* ── Lista ── */}
                    <div className={`${isFormOpen ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] xl:w-[380px] flex-col z-10`}>
                        <div className="p-4 pb-3 flex items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-bold text-navy-900">Métodos de pago</h3>
                                <p className="text-[10px] font-semibold text-navy-700/45 mt-0.5">Aparecen al cobrar turnos, abonos e ingresos/egresos</p>
                            </div>
                            {canManage && (
                                <button onClick={handleNewClick}
                                    className="relative overflow-hidden group h-9 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 shrink-0">
                                    <Plus size={14} className="shrink-0 relative z-10" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[70px] transition-all duration-300 whitespace-nowrap relative z-10">Agregar</span>
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 flex flex-col gap-1.5">
                            {methods.length === 0 && (
                                <div className="px-4 py-8 text-center text-navy-900/40 text-xs font-bold">Sin métodos, crea el primero con +</div>
                            )}
                            {methods.map(m => {
                                const isSelected = selectedId === m.id;
                                return (
                                    <button key={m.id} onClick={() => handleSelect(m)}
                                        className={`relative w-full flex items-center gap-4 p-4 rounded-2xl overflow-hidden transition-all duration-200 text-left border ${isSelected ? 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-md' : 'border-transparent hover:bg-white/20'} ${m.active ? '' : 'opacity-50'}`}>
                                        <div className="w-11 h-11 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                                            {m.is_cash ? <Banknote size={16} className="text-emerald-600" /> : <CreditCard size={16} className="text-navy-900" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-sm text-navy-900 truncate">{m.label}</div>
                                            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-navy-700/60">
                                                <span>{Number(m.fee_pct)}% comisión</span>
                                                <div className={`w-1.5 h-1.5 rounded-full ml-1 shrink-0 ${m.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Detalle ── */}
                    <div className={`${isFormOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative min-w-0`}>
                        {isFormOpen ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="p-4 md:p-8 pb-3 shrink-0 z-10 relative animate-fade-down">
                                    <div className="flex items-start gap-2 md:gap-4">
                                        <button onClick={() => setSelectedId(null)}
                                            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white/80 shadow-sm shrink-0 mt-0.5">
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-lg font-bold text-navy-900 tracking-tight">{isNew ? 'Nuevo método' : (selected?.label || '—')}</h2>
                                            <p className="text-[11px] text-navy-700/50 font-semibold mt-1">
                                                {isNew ? 'Disponible al cobrar en cuanto lo guardes' : (selected?.is_cash ? 'Cuenta para la caja diaria' : 'No mueve la caja')}
                                            </p>
                                        </div>
                                        {!isNew && selected && (
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 border border-white/60 shadow-sm">
                                                <div className={`w-1.5 h-1.5 rounded-full ${selected.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                                                <span className="text-[10px] font-bold text-navy-900/60 tracking-wider">{selected.active ? 'Activo' : 'Inactivo'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar relative animate-fade-up">
                                    <div className="space-y-6 pb-12 pt-2 w-full max-w-[420px]">
                                        <div>
                                            <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">Nombre del método</label>
                                            <TextInput value={form.label} onChange={v => setField('label', v)} placeholder="Ej: Cheque, Link de pago…" autoFocus maxLength={40} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">% de comisión</label>
                                            <PercentInput tenths={form.feeTenths} onChange={v => setField('feeTenths', v)} />
                                            <p className="text-[10px] font-semibold text-navy-700/40 mt-2 px-1 leading-relaxed">Lo que descuenta el POS o la pasarela, resta del neto en el Resumen.</p>
                                        </div>
                                        {!isNew && (
                                            <div>
                                                <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">¿Es efectivo?</label>
                                                <button onClick={() => setField('is_cash', !form.is_cash)}
                                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-[11px] font-bold tracking-wide transition-all ${form.is_cash ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-navy-900/5 border-navy-900/10 text-navy-900/40 hover:text-navy-900/70'}`}>
                                                    <Banknote size={12} /> {form.is_cash ? 'Cuenta para la caja diaria' : 'No mueve la caja'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {canManage && (
                                    <div className="px-6 py-4 flex items-center justify-end gap-3 z-20 shrink-0">
                                        {!isNew && selected && (
                                            <button onClick={handleToggleActive}
                                                className={`relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 ${selected.active ? 'text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white' : 'text-emerald-600 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white'}`}>
                                                {selected.active ? <ToggleLeft size={14} className="shrink-0 relative z-10" /> : <ToggleRight size={14} className="shrink-0 relative z-10" />}
                                                <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">{selected.active ? 'Desactivar' : 'Activar'}</span>
                                            </button>
                                        )}
                                        <button onClick={handleSave} disabled={saving || !form.label.trim()}
                                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-md text-navy-900 text-[11px] font-bold rounded-full transition-all duration-300 disabled:opacity-50">
                                            <Save size={14} className="relative z-10 shrink-0" />
                                            <span className="relative z-10 max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">{saving ? 'Guardando...' : isNew ? 'Crear método' : 'Guardar cambios'}</span>
                                        </button>
                                        {!isNew && selected && (
                                            <button onClick={() => setShowDeleteConfirm(true)}
                                                className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-rose-500 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 hover:bg-rose-500 hover:border-rose-500 hover:text-white">
                                                <Trash2 size={14} className="shrink-0 relative z-10" />
                                                <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">Eliminar</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-navy-900/60 p-6 text-center animate-fade-in z-10">
                                <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center mb-4 shadow-sm">
                                    <CreditCard size={28} strokeWidth={1.5} className="text-navy-700" />
                                </div>
                                <h3 className="text-lg font-bold text-navy-900 tracking-tight">Métodos de pago</h3>
                                <p className="max-w-[280px] text-xs font-semibold mt-1">Selecciona un método para editarlo, o crea uno nuevo con <strong>Agregar</strong>.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            <ConfirmDialog open={showDeleteConfirm} danger loading={deleting}
                title={selected ? `¿Eliminar "${selected.label}"?` : ''}
                message="Los movimientos ya registrados con este método conservan su historial. Si solo quieres ocultarlo, mejor desactívalo."
                confirmLabel="Sí, eliminar" loadingLabel="Eliminando..."
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)} />
        </PanelShell>
    );
}

// ── Meta mensual — 12 meses (izquierda) + detalle del mes elegido (derecha).
// Solo el mes en curso es editable; los demás se muestran con candado. ──
function GoalPanel({ monthlyGoals, currentYear, currentMonth, onSaveMonth, canManage }) {
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [mobileDetail, setMobileDetail] = useState(false);
    const [cents, setCents] = useState(null);
    const [saving, setSaving] = useState(false);

    const [openQuarters, setOpenQuarters] = useState(() => {
        const initial = {};
        QUARTERS.forEach((q, idx) => {
            initial[idx] = q.months.includes(currentMonth);
        });
        return initial;
    });

    const toggleQuarter = (idx) => {
        setOpenQuarters(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const rowFor = (m) => monthlyGoals.find(g => g.month === m);

    useEffect(() => {
        setCents(decimalToCents(rowFor(selectedMonth)?.goal_amount || 0));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, monthlyGoals]);

    async function save() {
        const amt = centsToDecimal(cents) || 0;
        setSaving(true);
        try {
            await onSaveMonth(currentYear, selectedMonth, amt);
            showSuccessToast(amt > 0 ? 'Meta guardada' : 'Meta desactivada', amt > 0 ? `Objetivo de ${MONTHS_ES[selectedMonth - 1]}: ${money(amt)}.` : '');
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || '');
        } finally {
            setSaving(false);
        }
    }

    return (
        <PanelShell>
            {/* ── Lista de meses ── */}
            <div className={`${mobileDetail ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] xl:w-[380px] flex-col z-10 min-h-0`}>
                <div className="p-4 pb-3">
                    <h3 className="text-sm font-bold text-navy-900">Meta mensual {currentYear}</h3>
                    <p className="text-[10px] font-semibold text-navy-700/45 mt-0.5">Define la meta de cada mes</p>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 flex flex-col gap-3">
                    {QUARTERS.map((q, idx) => {
                        const isCurrentQuarter = q.months.includes(currentMonth);
                        const isOpen = !!openQuarters[idx];

                        return (
                            <div key={q.label}>
                                {/* Header del trimestre como botón colapsable */}
                                <button
                                    onClick={() => toggleQuarter(idx)}
                                    className="w-full px-3.5 py-3 flex items-center justify-between hover:bg-white/20 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10.5px] font-bold text-navy-900/60">
                                            {q.label}
                                        </span>
                                        {isCurrentQuarter && (
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-navy-900 text-white shadow-sm">
                                                Actual
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-navy-900/50">
                                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                </button>

                                {/* Lista de meses */}
                                {isOpen && (
                                    <div className="p-2 pt-0 flex flex-col gap-1.5 animate-fade-in">
                                        {q.months.map(m => {
                                            const row = rowFor(m);
                                            const isSelected = selectedMonth === m;
                                            const isCurrent = m === currentMonth;
                                            return (
                                                <button key={m} onClick={() => { setSelectedMonth(m); setMobileDetail(true); }}
                                                    className={`relative w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 text-left border ${isSelected ? 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-md' : 'border-transparent hover:bg-white/20'}`}>
                                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border bg-navy-900/5 border-navy-900/10">
                                                        <span className={`text-[11px] font-bold ${isCurrent ? 'text-navy-900' : 'text-navy-900/40'}`}>
                                                            {MONTHS_ES[m - 1].slice(0, 3)}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-sm text-navy-900 truncate">{MONTHS_ES[m - 1]}</div>
                                                        <div className="text-[11px] font-bold text-navy-700/60 mt-1">{Number(row?.goal_amount) > 0 ? money(row.goal_amount) : 'Sin definir'}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Detalle del mes seleccionado ── */}
            <div className={`${mobileDetail ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative min-w-0`}>
                <div className="p-4 md:p-8 pb-3 shrink-0 z-10 relative flex items-start gap-2 md:gap-4">
                    <button onClick={() => setMobileDetail(false)}
                        className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white/80 shadow-sm shrink-0 mt-0.5">
                        <ChevronLeft size={16} />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-navy-900 tracking-tight">{MONTHS_ES[selectedMonth - 1]} {currentYear}</h2>
                        <p className="text-[11px] text-navy-700/50 font-semibold mt-1">Define cuánto quieres facturar este mes</p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 custom-scrollbar relative">
                    <div className="max-w-[380px] space-y-4">
                        <CentsAmountInput cents={cents} onChange={setCents} autoFocus />
                        <p className="text-[10.5px] font-semibold text-navy-700/50 leading-relaxed px-1">
                            El Resumen muestra tu avance en tiempo real y la proyección te dice si vas a llegar según los turnos agendados. Pon 0 para desactivarla.
                        </p>
                    </div>
                </div>
                {canManage && (
                    <div className="px-6 py-4 flex items-center justify-end gap-3 z-20 shrink-0">
                        <button onClick={save} disabled={saving}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-md text-navy-900 text-[11px] font-bold rounded-full transition-all duration-300 disabled:opacity-50">
                            <Save size={14} className="relative z-10 shrink-0" />
                            <span className="relative z-10 max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">{saving ? 'Guardando...' : 'Guardar meta'}</span>
                        </button>
                    </div>
                )}
            </div>
        </PanelShell>
    );
}

// ── Precios — redondeo aplicado al precio promocional calculado por % de
// descuento en Ofertas (evita decimales feos tipo Q73.42). Política única
// por negocio, se lee vía getBusinessInfo() y se guarda en businesses. ──
function PricingPanel({ canManage }) {
    const [value, setValue] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let alive = true;
        getBusinessInfo().then(b => { if (alive) setValue(Number(b?.price_rounding_increment ?? 1)); })
            .catch(() => {})
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    async function choose(opt) {
        if (opt === value || !canManage) return;
        const prev = value;
        setValue(opt);
        setSaving(true);
        try {
            await updatePriceRounding(opt);
            showSuccessToast('Redondeo actualizado', `Los precios promocionales por % se aproximan a ${opt < 1 ? `Q${opt.toFixed(2)}` : `Q${opt}`}.`);
        } catch (err) {
            setValue(prev);
            showErrorToast('No se pudo guardar', err.message || '');
        } finally {
            setSaving(false);
        }
    }

    return (
        <PanelShell>
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-[520px]">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0"><Percent size={16} /></div>
                        <div>
                            <h3 className="text-sm font-bold text-navy-900">Redondeo de precios</h3>
                            <p className="text-[10.5px] font-semibold text-navy-700/45 mt-0.5">Aplica al calcular el precio promocional desde un % de descuento, en Ofertas</p>
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-navy-900/20 border-t-navy-900/60 rounded-full animate-spin" /></div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                            {ROUNDING_OPTIONS.map(opt => {
                                const active = value === opt.value;
                                return (
                                    <button key={opt.value} disabled={!canManage || saving} onClick={() => choose(opt.value)} title={opt.hint}
                                        className={`flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl border text-center transition-all disabled:opacity-50 ${active ? 'bg-white/70 backdrop-blur-sm border-white/90 shadow-md' : 'bg-navy-900/[0.03] border-navy-900/5 hover:bg-white/30'}`}>
                                        <span className={`text-sm font-bold ${active ? 'text-navy-900' : 'text-navy-900/60'}`}>{opt.label}</span>
                                        {active && <span className="text-[8.5px] font-bold text-emerald-600 uppercase tracking-wide">Activo</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <p className="text-[10.5px] font-semibold text-navy-700/40 mt-4 text-center leading-relaxed">
                        Ej. con Q5: un 15% de descuento sobre Q73 se redondea a Q60 en vez de Q62.05.
                    </p>
                </div>
            </div>
        </PanelShell>
    );
}

// Solo dibuja el panel del sub-tab activo — Finance.jsx es quien posee el
// estado `sub` y dibuja la barra de sub-tabs (debajo de los tabs de
// Finanzas, mismo estilo de pill), para que el panel quede siempre centrado.
// canManageCategories → categorías (permiso propio) · canManageSettings →
// métodos de pago + meta mensual + redondeo de precios (`manage_finance_settings`).
// Antes los tres compartían `manage_finance_categories`, lo cual mezclaba semánticas.
export default function AjustesSection({ canManageCategories, canManageSettings, categoryKind, setCategoryKind, monthlyGoals, currentYear, currentMonth, onSaveMonthGoal, sub }) {
    return (
        <div className="h-full">
            {sub === 'categorias' && (
                <CategoriesSection canManage={canManageCategories} activeKind={categoryKind} setActiveKind={setCategoryKind} />
            )}
            {sub === 'metodos' && <MethodsPanel canManage={canManageSettings} />}
            {sub === 'meta' && (
                <GoalPanel monthlyGoals={monthlyGoals} currentYear={currentYear} currentMonth={currentMonth} onSaveMonth={onSaveMonthGoal} canManage={canManageSettings} />
            )}
            {sub === 'precios' && <PricingPanel canManage={canManageSettings} />}
        </div>
    );
}
