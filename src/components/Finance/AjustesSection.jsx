import { useState, useEffect, useCallback } from 'react';
import { Tags, CreditCard, Target, Plus, Trash2, Save, ToggleLeft, ToggleRight, Banknote } from 'lucide-react';
import CategoriesSection from './CategoriesSection';
import { getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '../../services/supabaseService';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { money } from './financeUi';

// Ajustes de Finanzas — tres sub-secciones: Categorías (ingresos/egresos),
// Métodos de pago (con % de comisión POS y marca "efectivo" para la caja) y
// Meta mensual (alimenta la barra de avance y la proyección del Resumen).

const SUBTABS = [
    { id: 'categorias', label: 'Categorías', icon: Tags },
    { id: 'metodos', label: 'Métodos de pago', icon: CreditCard },
    { id: 'meta', label: 'Meta mensual', icon: Target },
];

// ── Métodos de pago ──────────────────────────────────────
function MethodsPanel({ canManage }) {
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newLabel, setNewLabel] = useState('');
    const [newFee, setNewFee] = useState('');
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState(null); // method
    const [deleteBusy, setDeleteBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setMethods(await getPaymentMethods()); }
        catch (err) { console.error('[methods]', err.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    async function add() {
        if (!newLabel.trim()) { showErrorToast('Falta nombre', 'Escribe el nombre del método.'); return; }
        const fee = Number(newFee) || 0;
        if (fee < 0 || fee > 100) { showErrorToast('Comisión inválida', 'El % debe estar entre 0 y 100.'); return; }
        setCreating(true);
        try {
            await createPaymentMethod({ label: newLabel, fee_pct: fee });
            showSuccessToast('Método creado', `${newLabel.trim()} disponible al cobrar.`);
            setNewLabel(''); setNewFee('');
            await load();
        } catch (err) {
            showErrorToast('No se pudo crear', err.message || '');
        } finally { setCreating(false); }
    }

    async function patch(m, fields, okMsg) {
        try {
            await updatePaymentMethod(m.id, fields);
            if (okMsg) showSuccessToast(okMsg, '');
            await load();
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || '');
        }
    }

    return (
        <div className="space-y-3 max-w-[720px]">
            <p className="text-[10.5px] font-semibold text-navy-700/50 px-1 leading-relaxed">
                Los métodos aparecen al cobrar turnos, abonos, ingresos y egresos. El <b>% de comisión</b> (POS, pasarela)
                descuenta del neto en el Resumen; <b>Efectivo</b> marca los métodos que mueven la caja diaria.
            </p>

            {loading ? (
                <div className="flex items-center justify-center py-10"><div className="w-5 h-5 border-2 border-navy-900/20 border-t-navy-900/60 rounded-full animate-spin" /></div>
            ) : (
                <div className="space-y-2">
                    {methods.map(m => (
                        <div key={m.id} className={`relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl px-4 py-3 shadow-md flex items-center justify-between gap-3 flex-wrap ${m.active ? '' : 'opacity-50'}`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                                    {m.is_cash ? <Banknote size={14} className="text-emerald-600" /> : <CreditCard size={14} className="text-navy-900" />}
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[13px] font-bold text-navy-900 leading-tight block truncate">{m.label}</span>
                                    <span className="text-[9px] font-bold text-navy-900/35 uppercase tracking-wide">{m.is_cash ? 'Cuenta para la caja diaria' : 'No mueve la caja'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                {canManage ? (
                                    <>
                                        <label className="flex items-center gap-1 text-[10px] font-bold text-navy-800" title="% que te descuenta el POS o la pasarela">
                                            <input type="number" min="0" max="100" step="0.1" defaultValue={Number(m.fee_pct)} key={`fee-${m.id}-${m.fee_pct}`}
                                                onBlur={e => { const v = Number(e.target.value) || 0; if (v !== Number(m.fee_pct) && v >= 0 && v <= 100) patch(m, { fee_pct: v }, 'Comisión actualizada'); }}
                                                className="w-16 bg-white/60 border border-white/70 rounded-full px-2.5 py-1 text-[11px] font-bold text-navy-900 outline-none focus:ring-1 focus:ring-white tabular-nums text-center" />
                                            % comisión
                                        </label>
                                        <button onClick={() => patch(m, { is_cash: !m.is_cash }, m.is_cash ? 'Ya no cuenta como efectivo' : 'Marcado como efectivo')}
                                            title="¿Este método es dinero físico que entra a la caja?"
                                            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wide transition-all ${m.is_cash ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-navy-900/5 border-navy-900/10 text-navy-900/40 hover:text-navy-900/70'}`}>
                                            <Banknote size={10} /> Efectivo
                                        </button>
                                        <button onClick={() => patch(m, { active: !m.active }, m.active ? 'Método desactivado' : 'Método activado')} title={m.active ? 'Desactivar' : 'Activar'}
                                            className="text-navy-700/50 hover:text-navy-900 transition-colors">
                                            {m.active ? <ToggleRight size={22} className="text-emerald-600" /> : <ToggleLeft size={22} />}
                                        </button>
                                        <button onClick={() => setDeleting(m)} title="Eliminar método"
                                            className="w-7 h-7 rounded-full bg-white/50 border border-white/60 flex items-center justify-center text-navy-700/50 hover:text-rose-600 hover:border-rose-200 transition-all">
                                            <Trash2 size={12} />
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-[10px] font-bold text-navy-900/45 tabular-nums">{Number(m.fee_pct)}% comisión</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {canManage && (
                <div className="flex items-center gap-2 flex-wrap bg-white/30 border border-white/50 rounded-2xl px-3.5 py-3">
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nuevo método (ej: Cheque, Link de pago…)" maxLength={40}
                        onKeyDown={e => { if (e.key === 'Enter') add(); }}
                        className="flex-1 min-w-[180px] bg-white/50 border border-white/60 rounded-full px-4 py-2 text-[12px] font-semibold text-navy-900 outline-none focus:bg-white/70 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/40 shadow-sm" />
                    <label className="flex items-center gap-1 text-[10px] font-bold text-navy-800">
                        <input type="number" min="0" max="100" step="0.1" value={newFee} onChange={e => setNewFee(e.target.value)} placeholder="0"
                            className="w-16 bg-white/50 border border-white/60 rounded-full px-2.5 py-1.5 text-[11px] font-bold text-navy-900 outline-none focus:ring-1 focus:ring-white tabular-nums text-center" />
                        % comisión
                    </label>
                    <button onClick={add} disabled={creating}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-navy-900 border border-white/10 text-white text-[11px] font-bold rounded-full shadow-card hover:bg-navy-800 transition-all disabled:opacity-50">
                        <Plus size={13} /> Agregar
                    </button>
                </div>
            )}

            <ConfirmDialog open={!!deleting} danger loading={deleteBusy}
                title={deleting ? `¿Eliminar "${deleting.label}"?` : ''}
                message="Los movimientos ya registrados con este método conservan su historial. Si solo quieres ocultarlo, mejor desactívalo."
                confirmLabel="Sí, eliminar" loadingLabel="Eliminando..."
                onConfirm={async () => {
                    setDeleteBusy(true);
                    try {
                        await deletePaymentMethod(deleting.id);
                        showSuccessToast('Método eliminado', '');
                        await load();
                    } catch (err) {
                        showErrorToast('No se pudo eliminar', err.message || '');
                    } finally {
                        setDeleteBusy(false);
                        setDeleting(null);
                    }
                }}
                onCancel={() => setDeleting(null)} />
        </div>
    );
}

// ── Meta mensual ─────────────────────────────────────────
function GoalPanel({ monthlyGoal, onSave, canManage }) {
    const [value, setValue] = useState(monthlyGoal > 0 ? String(monthlyGoal) : '');
    const [saving, setSaving] = useState(false);
    useEffect(() => { setValue(monthlyGoal > 0 ? String(monthlyGoal) : ''); }, [monthlyGoal]);

    async function save() {
        const amt = Number(value);
        if (!(amt >= 0)) { showErrorToast('Meta inválida', 'Ingresa un monto válido (0 la desactiva).'); return; }
        setSaving(true);
        try {
            await onSave(amt);
            showSuccessToast(amt > 0 ? 'Meta guardada' : 'Meta desactivada', amt > 0 ? `Objetivo del mes: ${money(amt)}.` : '');
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || '');
        } finally { setSaving(false); }
    }

    return (
        <div className="max-w-[480px] space-y-3">
            <p className="text-[10.5px] font-semibold text-navy-700/50 px-1 leading-relaxed">
                Define cuánto quieres facturar cada mes. El Resumen muestra tu avance en tiempo real y la
                proyección te dice si vas a llegar según los turnos agendados. Pon 0 para desactivarla.
            </p>
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-navy-700/60 font-bold text-sm pointer-events-none">Q</span>
                    <input type="number" min="0" step="100" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} placeholder="Ej: 50000"
                        disabled={!canManage}
                        className="w-full bg-white/40 border border-white/60 rounded-full pl-9 pr-4 py-2.5 text-sm font-semibold outline-none focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm text-navy-900 disabled:opacity-50" />
                </div>
                {canManage && (
                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-navy-900 border border-white/10 text-white text-[11px] font-bold rounded-full shadow-card hover:bg-navy-800 transition-all disabled:opacity-50">
                        <Save size={13} /> {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                )}
            </div>
            {monthlyGoal > 0 && (
                <p className="text-[10px] font-bold text-navy-900/40 px-1">Meta actual: {money(monthlyGoal)} al mes.</p>
            )}
        </div>
    );
}

export default function AjustesSection({ canManage, categoryKind, setCategoryKind, monthlyGoal, onSaveGoal }) {
    const [sub, setSub] = useState('categorias');

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="shrink-0 flex items-center gap-1.5 mb-3 px-1 flex-wrap">
                {SUBTABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button key={t.id} onClick={() => setSub(t.id)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold transition-all ${sub === t.id ? 'bg-white/60 border border-white/80 text-navy-900 shadow-md' : 'bg-white/25 border border-white/40 text-navy-900/55 hover:bg-white/40'}`}>
                            <Icon size={12} /> {t.label}
                        </button>
                    );
                })}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-1 py-1">
                {sub === 'categorias' && (
                    <CategoriesSection canManage={canManage} activeKind={categoryKind} setActiveKind={setCategoryKind} />
                )}
                {sub === 'metodos' && <MethodsPanel canManage={canManage} />}
                {sub === 'meta' && <GoalPanel monthlyGoal={monthlyGoal} onSave={onSaveGoal} canManage={canManage} />}
            </div>
        </div>
    );
}
