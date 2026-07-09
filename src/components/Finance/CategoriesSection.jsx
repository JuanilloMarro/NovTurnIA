import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFinanceCategories } from '../../hooks/useFinanceCategories';
import { Tags, Plus, Save, ToggleLeft, ToggleRight, ChevronLeft, Search, Trash2, X } from 'lucide-react';
import { showCategoryNewToast, showCategoryEditToast, showCategoryDeleteToast, showCategoryActivateToast, showCategoryDeactivateToast, showErrorToast } from '../../store/useToastStore';
import { TextInput } from './financeUi';

// Paleta de egresos: mismo rojo del sistema (rose-500), naranja intermedio (orange-500) y amarillo (yellow-500)
const EXPENSE_SWATCHES = [
    { hex: '#ef4444', label: 'Rojo' },    // rose-500 — mismo que el sistema
    { hex: '#f97316', label: 'Naranja' }, // orange-500 — intermedio entre rojo y amarillo
    { hex: '#eab308', label: 'Amarillo' }, // yellow-500 — mismo que el sistema
];
// Paleta de ingresos: el verde del sistema (emerald-500, mismo que las gráficas de finanzas)
const INCOME_SWATCHES = [
    { hex: '#10b981', label: 'Verde' }, // emerald-500 — mismo que las gráficas de finanzas
];

// Panel dividido de categorías dinámicas de finanzas (ingreso/egreso), mismo
// lenguaje visual y patrón de interacción que Settings.jsx (Servicios).
export default function CategoriesSection({ canManage, activeKind, setActiveKind }) {
    const { categories, loading, create, update, toggle, remove } = useFinanceCategories();

    const [selectedId, setSelectedId] = useState(null); // null | 'new' | uuid
    const [form, setForm] = useState({ name: '', color: null });
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [searchStr, setSearchStr] = useState('');

    const selectedCategory = selectedId && selectedId !== 'new'
        ? categories.find(c => c.id === selectedId)
        : null;
    const isNew = selectedId === 'new';
    const isFormOpen = isNew || selectedId !== null;

    const kindCategories = categories.filter(c => c.kind === activeKind);
    const filteredCategories = kindCategories
        .filter(c => !searchStr || c.name.toLowerCase().includes(searchStr.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    useEffect(() => {
        setSelectedId(null);
    }, [activeKind]);

    function handleSelect(cat) {
        setSelectedId(cat.id);
        setForm({ name: cat.name || '', color: cat.color || null });
    }

    function handleNewClick() {
        setSelectedId('new');
        setForm({ name: '', color: null });
    }

    const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

    async function handleSave() {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            if (isNew) {
                const created = await create({ kind: activeKind, name: form.name.trim(), color: form.color });
                setSelectedId(created.id);
                showCategoryNewToast(created.name);
            } else {
                await update(selectedId, { name: form.name.trim(), color: form.color });
                showCategoryEditToast(form.name.trim());
            }
        } catch (err) {
            showErrorToast('Error al guardar', err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!selectedCategory) return;
        setDeleting(true);
        try {
            await remove(selectedCategory.id);
            showCategoryDeleteToast(selectedCategory.name);
            setSelectedId(null);
            setShowDeleteConfirm(false);
        } catch (err) {
            showErrorToast('Error al eliminar', err.message);
        } finally {
            setDeleting(false);
        }
    }

    async function handleToggle() {
        if (!selectedCategory) return;
        setToggling(true);
        try {
            await toggle(selectedCategory.id, !selectedCategory.active);
            if (selectedCategory.active) showCategoryDeactivateToast(selectedCategory.name);
            else showCategoryActivateToast(selectedCategory.name);
        } catch (err) {
            showErrorToast('Error', err.message);
        } finally {
            setToggling(false);
        }
    }

    return (
        <div className="relative h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex overflow-hidden animate-fade-up">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* ── Left panel: kind switch + search + add + list ── */}
                    <div className={`${isFormOpen ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] xl:w-[380px] flex-col z-10`}>
                        <div className="p-4 pb-3">
                            <div className="flex items-center gap-2 h-9">
                                {/* Search bar */}
                                <div className="relative flex-1 h-full">
                                    <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute -top-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(29,95,173,0.05)' }} />
                                    <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                    <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-700">
                                        <Search size={14} strokeWidth={2.5} />
                                    </div>
                                    <input
                                        className="w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-md"
                                        placeholder="Buscar categoría..."
                                        value={searchStr}
                                        onChange={e => setSearchStr(e.target.value)}
                                    />
                                </div>

                                {/* New Button */}
                                {canManage && (
                                    <button
                                        onClick={handleNewClick}
                                        className="relative overflow-hidden group h-9 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none"
                                    >
                                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                        <Plus size={14} className="shrink-0 relative z-10" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap relative z-10">Nuevo</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 flex flex-col gap-1">
                            {filteredCategories.length === 0 && (
                                <div className="px-4 py-8 text-center text-navy-900/40 text-xs font-bold">
                                    {kindCategories.length === 0 ? 'Sin categorías, crea la primera con +' : 'No se encontraron categorías'}
                                </div>
                            )}

                            {filteredCategories.map(c => {
                                const isSelected = selectedId === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => handleSelect(c)}
                                        className={`relative w-full flex items-center gap-4 p-4 rounded-2xl overflow-hidden transition-all duration-200 text-left group border ${isSelected
                                            ? 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-md'
                                            : 'border-transparent hover:bg-white/20'
                                            }`}
                                    >
                                        {isSelected && <>
                                            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                            <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                        </>}
                                        {/* Avatar inicial (con color propio si tiene) */}
                                        <div
                                            className={`relative z-10 w-11 h-11 flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border rounded-full leading-none ${c.color ? 'text-white' : isSelected
                                                ? 'bg-gradient-to-b from-white to-gray-200 border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900'
                                                : c.active
                                                    ? 'bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900 group-hover:to-gray-200 group-hover:border-gray-200'
                                                    : 'bg-white/30 border-white/40 text-navy-900/30'
                                                }`}
                                            style={c.color ? { background: c.color, borderColor: c.color } : undefined}
                                        >
                                            <span className="block">{(c.name?.[0] || '?').toUpperCase()}</span>
                                        </div>

                                        <div className="relative z-10 flex-1 min-w-0">
                                            <div className={`font-bold text-sm truncate ${isSelected ? 'text-navy-900' : c.active ? 'text-navy-900/80' : 'text-navy-900/35'
                                                }`}>
                                                {c.name}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold tracking-tight text-navy-700/60">
                                                <span>{c.kind === 'income' ? 'Ingreso' : 'Egreso'}</span>
                                                <div className={`w-1.5 h-1.5 rounded-full ml-1 shrink-0 ${c.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} title={c.active ? 'Activa' : 'Inactiva'} />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Right panel: form / empty state ── */}
                    <div className={`${isFormOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative min-w-0`}>
                        {isFormOpen ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* Form header */}
                                <div className="p-4 md:p-8 pb-3 shrink-0 z-10 relative animate-fade-down">
                                    <div className="flex items-start gap-2 md:gap-4">
                                        <button
                                            onClick={() => setSelectedId(null)}
                                            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white/80 shadow-sm shrink-0 mt-0.5"
                                            aria-label="Volver al listado"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-lg font-bold text-navy-900 tracking-tight">
                                                {isNew ? 'Nueva Categoría' : (selectedCategory?.name || '—')}
                                            </h2>
                                            <p className="text-[11px] text-navy-700/50 font-semibold mt-1">
                                                {isNew
                                                    ? `Se creará como categoría de ${activeKind === 'income' ? 'Ingreso' : 'Egreso'}`
                                                    : (selectedCategory?.kind === 'income' ? 'Categoría de ingreso' : 'Categoría de egreso')
                                                }
                                            </p>
                                        </div>
                                        {!isNew && selectedCategory && (
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 border border-white/60 shadow-sm">
                                                <div className={`w-1.5 h-1.5 rounded-full ${selectedCategory.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                                                <span className="text-[10px] font-bold text-navy-900/60 uppercase tracking-wider">
                                                    {selectedCategory.active ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Form fields */}
                                <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar relative animate-fade-up">
                                    <div className="space-y-6 pb-12 pt-2 w-full">

                                        {/* Nombre */}
                                        <div>
                                            <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                                Nombre de la categoría
                                            </label>
                                            <TextInput
                                                value={form.name}
                                                onChange={v => setField('name', v)}
                                                placeholder="Ej. Insumos, Consulta médica..."
                                                autoFocus
                                                maxLength={60}
                                            />
                                        </div>

                                        {/* Color */}
                                        <div>
                                            <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                                Color <span className="font-semibold text-navy-700/40 text-[11px]">(opcional)</span>
                                            </label>
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <button type="button" onClick={() => setField('color', null)}
                                                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all bg-white/40 backdrop-blur-sm shadow-sm ${!form.color ? 'border-navy-900 scale-110' : 'border-white/60'}`}
                                                    title="Sin color"
                                                >
                                                    <X size={12} className="text-navy-700/50" />
                                                </button>
                                                {(activeKind === 'expense' ? EXPENSE_SWATCHES : INCOME_SWATCHES).map(({ hex, label }) => (
                                                    <button
                                                        key={hex}
                                                        type="button"
                                                        onClick={() => setField('color', hex)}
                                                        className={`w-8 h-8 rounded-full border-2 transition-all shadow-sm ${form.color === hex ? 'border-navy-900 scale-110' : 'border-white/60'}`}
                                                        style={{ background: hex }}
                                                        title={label}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer actions */}
                                {canManage && (
                                    <div className="px-6 py-4 flex items-center justify-end gap-3 z-20 shrink-0">
                                        {/* Desactivar / Activar — solo edición */}
                                        {!isNew && selectedCategory && (
                                            <button
                                                onClick={handleToggle}
                                                disabled={toggling}
                                                className={`relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 disabled:opacity-50 ${selectedCategory.active
                                                    ? 'text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white'
                                                    : 'text-emerald-600 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white'
                                                    }`}
                                            >
                                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                                {selectedCategory.active
                                                    ? <ToggleLeft size={14} className="shrink-0 relative z-10" />
                                                    : <ToggleRight size={14} className="shrink-0 relative z-10" />
                                                }
                                                <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">
                                                    {toggling ? '...' : selectedCategory.active ? 'Desactivar' : 'Activar'}
                                                </span>
                                            </button>
                                        )}

                                        {/* Guardar */}
                                        <button
                                            onClick={handleSave}
                                            disabled={saving || !form.name.trim()}
                                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-md text-navy-900 text-[11px] font-bold rounded-full transition-all duration-300 disabled:opacity-50"
                                        >
                                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                            <Save size={14} className="relative z-10 shrink-0" />
                                            <span className="relative z-10 max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">
                                                {saving ? 'Guardando...' : isNew ? 'Crear categoría' : 'Guardar cambios'}
                                            </span>
                                        </button>

                                        {/* Eliminar — solo edición */}
                                        {!isNew && selectedCategory && (
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                disabled={deleting}
                                                className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-rose-500 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 disabled:opacity-50 hover:bg-rose-500 hover:border-rose-500 hover:text-white"
                                            >
                                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                                <Trash2 size={14} className="shrink-0 relative z-10" />
                                                <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">
                                                    Eliminar
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Confirmación eliminar */}
                                {showDeleteConfirm && createPortal(
                                    <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                                        <div className="w-full max-w-sm bg-white/30 backdrop-blur-xl border border-white/50 p-6 animate-fade-up shadow-[0_8px_32px_rgba(26,58,107,0.15)] rounded-[32px] text-center">
                                            <p className="text-sm font-bold text-navy-900 mb-1">¿Eliminar categoría?</p>
                                            <p className="text-xs text-navy-700/60 font-semibold mb-5 px-4">
                                                Los movimientos que la usan quedarán sin categoría. Esta acción no se puede deshacer.
                                            </p>
                                            <div className="flex justify-center gap-3">
                                                <button
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/40 border border-white/60 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm min-w-[100px]"
                                                >
                                                    <X size={13} /> Cancelar
                                                </button>
                                                <button
                                                    onClick={handleDelete}
                                                    disabled={deleting}
                                                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-500/80 border border-rose-400 text-white text-[11px] font-bold rounded-full hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50 min-w-[100px]"
                                                >
                                                    <Trash2 size={13} /> {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>,
                                    document.body
                                )}
                            </div>
                        ) : (
                            /* Empty state */
                            <div className="flex-1 flex flex-col items-center justify-center text-navy-900/60 p-6 text-center animate-fade-in z-10">
                                <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center mb-4 shadow-sm">
                                    <Tags size={28} strokeWidth={1.5} className="text-navy-700" />
                                </div>
                                <h3 className="text-lg font-bold text-navy-900 tracking-tight">Gestión de Categorías</h3>
                                <p className="max-w-[280px] text-xs font-semibold mt-1">
                                    Selecciona una categoría para editarla, o crea una nueva con el botón <strong>+</strong>.
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
