import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useServices } from '../hooks/useServices';
import { usePermissions } from '../hooks/usePermissions';
import { Layers, Plus, Save, ToggleLeft, ToggleRight, ChevronLeft, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { showServiceNewToast, showServiceEditToast, showServiceDeleteToast, showServiceActivateToast, showServiceDeactivateToast, showErrorToast } from '../store/useToastStore';
import WheelColumn from '../components/ui/WheelColumn';

// Wheel picker durations: 15-min steps from 15 min to 4h
const DURATION_VALUES = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

export function formatDuration(minutes) {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
}

export default function Settings() {
    const { services, loading, create, update, toggle, remove } = useServices();
    const { canCreateServices, canEditServices, canToggleServices } = usePermissions();

    const [selectedId, setSelectedId] = useState(null); // null | 'new' | number
    // price stored as integer cents internally (e.g. 350 = Q 3.50); null = no price
    const [form, setForm] = useState({ name: '', duration_minutes: 30, priceCents: null });
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [searchStr, setSearchStr] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortOrder, setSortOrder] = useState('recent'); // 'recent', 'a-z', 'z-a'
    const [showFilter, setShowFilter] = useState(false);

    const selectedService = typeof selectedId === 'number'
        ? services.find(s => s.id === selectedId)
        : null;
    const isNew = selectedId === 'new';
    const isFormOpen = isNew || selectedId !== null;

    const filteredServices = services.filter(s => {
        if (searchStr && !s.name.toLowerCase().includes(searchStr.toLowerCase())) return false;
        if (filterStatus === 'active' && !s.active) return false;
        if (filterStatus === 'inactive' && s.active) return false;
        return true;
    }).sort((a, b) => {
        if (sortOrder === 'a-z') return a.name.localeCompare(b.name, 'es');
        if (sortOrder === 'z-a') return b.name.localeCompare(a.name, 'es');
        // si es 'recent', asumiendo el id en su defecto
        return b.id - a.id;
    });

    const isFiltering = searchStr !== '' || filterStatus !== 'all' || sortOrder !== 'recent';

    // Convert decimal price from DB → integer cents for the POS input
    function toCents(price) {
        if (price == null || price === '') return null;
        return Math.round(Number(price) * 100);
    }

    function handleSelect(service) {
        setSelectedId(service.id);
        setForm({
            name: service.name || '',
            description: service.description || '',
            duration_minutes: service.duration_minutes ?? 30,
            priceCents: toCents(service.price),
        });
    }

    function handleNewClick() {
        setSelectedId('new');
        setForm({ name: '', description: '', duration_minutes: 30, priceCents: null });
    }

    // POS-style digit entry: each digit shifts existing cents left one decimal place
    function handlePriceKey(e) {
        const key = e.key;
        if (key === 'Backspace') {
            e.preventDefault();
            setForm(f => {
                const next = Math.floor((f.priceCents ?? 0) / 10);
                return { ...f, priceCents: next === 0 ? null : next };
            });
            return;
        }
        if (!/^\d$/.test(key)) return;
        e.preventDefault();
        setForm(f => {
            const current = f.priceCents ?? 0;
            const next = current * 10 + Number(key);
            // Cap at Q 99999.99 (9999999 cents)
            return { ...f, priceCents: Math.min(next, 9999999) };
        });
    }

    function formatPriceDisplay(cents) {
        if (cents == null || cents === 0) return '0.00';
        return (cents / 100).toFixed(2);
    }

    const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

    async function handleSave() {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description ? form.description.trim() : null,
                duration_minutes: Number(form.duration_minutes) || 30,
                price: form.priceCents != null ? form.priceCents / 100 : null,
            };
            if (isNew) {
                const created = await create(payload);
                setSelectedId(created.id);
                showServiceNewToast(created.name);
            } else {
                await update(selectedId, payload);
                showServiceEditToast(payload.name);
            }
        } catch (err) {
            showErrorToast('Error al guardar', err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!selectedService) return;
        setDeleting(true);
        try {
            await remove(selectedService.id);
            showServiceDeleteToast(selectedService.name);
            setSelectedId(null);
            setShowDeleteConfirm(false);
        } catch (err) {
            showErrorToast('Error al eliminar', err.message);
        } finally {
            setDeleting(false);
        }
    }

    async function handleToggle() {
        if (!selectedService) return;
        setToggling(true);
        try {
            await toggle(selectedService.id, !selectedService.active);
            if (selectedService.active) {
                showServiceDeactivateToast(selectedService.name);
            } else {
                showServiceActivateToast(selectedService.name);
            }
        } catch (err) {
            showErrorToast('Error', err.message);
        } finally {
            setToggling(false);
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="h-full flex flex-col mx-auto w-full max-w-[1080px] pt-2 px-0">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Servicios</h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Gestión de servicios del negocio</p>
                </div>
            </div>

            {/* Main card */}
            <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex overflow-hidden mb-4 lg:mb-6 animate-fade-up">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* ── Left panel: service list — toggle con form en mobile ── */}
                <div className={`${isFormOpen ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] xl:w-[380px] flex-col z-10 border-r border-white/40 md:border-r-0`}>
                    <div className="p-4 pb-3">
                        <div className="flex items-center gap-2 h-9">
                            {/* Search bar */}
                            <div className="relative flex-1 h-full">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-navy-900">
                                    <Search size={14} strokeWidth={2.5} />
                                </div>
                                <input
                                    className="w-full h-full bg-white/60 backdrop-blur-card border border-white/90 rounded-full pl-9 pr-3 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-sm"
                                    placeholder="Buscar servicio..."
                                    value={searchStr}
                                    onChange={e => setSearchStr(e.target.value)}
                                />
                            </div>

                            {/* New Button */}
                            {canCreateServices && (
                                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                                    <button
                                        onClick={handleNewClick}
                                        className="group h-full flex items-center justify-center gap-0 hover:gap-1.5 px-2 hover:px-3 text-navy-900 text-[11px] font-bold transition-all duration-300 overflow-hidden outline-none rounded-full hover:bg-white/80"
                                    >
                                        <Plus size={14} className="shrink-0" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Nuevo</span>
                                    </button>
                                </div>
                            )}

                            <div className="relative">
                                <button
                                    onClick={() => setShowFilter(!showFilter)}
                                    className="group h-9 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/60 backdrop-blur-card border border-white/90 rounded-full text-navy-900 font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden outline-none"
                                >
                                    <SlidersHorizontal size={14} strokeWidth={2.5} className="shrink-0" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap text-[11px]">Filtros</span>
                                </button>
                                {showFilter && (
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-3xl shadow-[0_8px_32px_rgba(26,58,107,0.16),0_2px_8px_rgba(0,0,0,0.06)] z-50 p-2 animate-fade-up">
                                        <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-gray-100">
                                            <span className="text-[10px] font-bold text-navy-700/50 tracking-wide">Filtros</span>
                                            {isFiltering && (
                                                <button
                                                    onClick={() => { setSearchStr(''); setFilterStatus('all'); setSortOrder('recent'); setShowFilter(false); }}
                                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>
                                        <div className="px-2 pt-2 pb-1">
                                            <span className="text-[10px] font-bold text-navy-700/40 tracking-wide">Estado</span>
                                        </div>
                                        {[
                                            { id: 'all', label: 'Todos' },
                                            { id: 'active', label: 'Activos' },
                                            { id: 'inactive', label: 'Inactivos' }
                                        ].map(opt => (
                                            <div
                                                key={opt.id}
                                                onClick={() => { setFilterStatus(opt.id); }}
                                                className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${filterStatus === opt.id ? 'bg-white border-white shadow-[0_4px_14px_rgba(0,0,0,0.09)] text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-gray-50'}`}
                                            >
                                                {opt.label}
                                            </div>
                                        ))}

                                        <div className="border-t border-gray-100 mt-1 pt-1">
                                            <div className="px-2 pt-1 pb-1">
                                                <span className="text-[10px] font-bold text-navy-700/40 tracking-wide">Orden</span>
                                            </div>
                                        </div>
                                        {[
                                            { id: 'recent', label: 'Más recientes' },
                                            { id: 'a-z', label: 'De la A-Z' },
                                            { id: 'z-a', label: 'De la Z-A' }
                                        ].map(opt => (
                                            <div
                                                key={opt.id}
                                                onClick={() => { setSortOrder(opt.id); setShowFilter(false); }}
                                                className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${sortOrder === opt.id ? 'bg-white border-white shadow-[0_4px_14px_rgba(0,0,0,0.09)] text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-gray-50'}`}
                                            >
                                                {opt.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contador de resultados */}
                        {isFiltering && (
                            <div className="px-5 mb-2">
                                <span className="text-[11px] font-semibold text-navy-700/70">
                                    {filteredServices.length} de {services.length} servicios
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 space-y-1.5">
                        {filteredServices.length === 0 && (
                            <div className="px-4 py-8 text-center text-navy-900/40 text-xs font-bold">
                                {services.length === 0 ? 'Sin servicios — crea el primero con +' : 'No se encontraron servicios'}
                            </div>
                        )}

                        {filteredServices.map(s => {
                            const isSelected = selectedId === s.id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => handleSelect(s)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left group border ${isSelected
                                            ? 'bg-white/60 border-white/80'
                                            : 'hover:bg-white/40 border-transparent hover:border-white/40'
                                        }`}
                                >
                                    {/* Avatar inicial */}
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border ${isSelected
                                            ? 'bg-navy-900 border-navy-900 text-white shadow-md shadow-navy-900/10'
                                            : s.active
                                                ? 'bg-white/60 border-white/80 text-navy-900 group-hover:bg-navy-900 group-hover:text-white group-hover:border-navy-900'
                                                : 'bg-white/30 border-white/40 text-navy-900/30'
                                        }`}>
                                        {(s.name?.[0] || '?').toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${isSelected ? 'text-navy-900' : s.active ? 'text-navy-900/80' : 'text-navy-900/35'
                                            }`}>
                                            {s.name}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold tracking-tight text-navy-700/60">
                                            {s.price != null ? `Q ${Number(s.price).toFixed(2)}` : 'Sin precio'}
                                            <span className="opacity-40 text-[10px]">•</span>
                                            <span>{formatDuration(s.duration_minutes)}</span>
                                            <div className={`w-1.5 h-1.5 rounded-full ml-1 shrink-0 ${s.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} title={s.active ? 'Activo' : 'Inactivo'} />
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
                                            {isNew ? 'Nuevo Servicio' : (selectedService?.name || '—')}
                                        </h2>
                                        <p className="text-[11px] text-navy-700/50 font-semibold mt-1">
                                            {isNew
                                                ? 'Define nombre, duración y precio opcional'
                                                : `Duración: ${formatDuration(selectedService?.duration_minutes)}`
                                            }
                                        </p>
                                    </div>
                                    {!isNew && selectedService && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 border border-white/60 shadow-sm">
                                            <div className={`w-1.5 h-1.5 rounded-full ${selectedService.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                                            <span className="text-[10px] font-bold text-navy-900/60 uppercase tracking-wider">
                                                {selectedService.active ? 'Activo' : 'Inactivo'}
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
                                            Nombre del servicio
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={60}
                                            value={form.name}
                                            onChange={e => setField('name', e.target.value)}
                                            placeholder="Ej. Consulta Médica Especializada"
                                            className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                                        />
                                    </div>

                                    {/* Duración */}
                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Duración
                                        </label>
                                        <div className="bg-white/30 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                                            <WheelColumn
                                                items={DURATION_VALUES}
                                                selected={Number(form.duration_minutes) || 30}
                                                displayFn={formatDuration}
                                                onSelect={v => setField('duration_minutes', Number(v))}
                                            />
                                        </div>
                                    </div>

                                    {/* Precio — POS-style: escribe dígitos, se acumula de derecha a izquierda */}
                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Precio <span className="font-semibold text-navy-700/40 text-[11px]">(opcional)</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-700/60 font-bold text-sm select-none">
                                                Q
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="none"
                                                readOnly
                                                value={formatPriceDisplay(form.priceCents)}
                                                onKeyDown={handlePriceKey}
                                                placeholder="0.00"
                                                className={`w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm cursor-text select-none ${form.priceCents ? 'text-navy-900' : 'text-navy-700/40'
                                                    }`}
                                            />
                                        </div>
                                        <p className="mt-1.5 text-[10px] font-semibold text-navy-700/40 pl-1">
                                            Escribe los dígitos · Backspace para borrar
                                        </p>
                                    </div>

                                    {/* Descripción */}
                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Descripción <span className="font-semibold text-navy-700/40 text-[11px]">(opcional)</span>
                                        </label>
                                        <textarea
                                            value={form.description}
                                            onChange={e => setField('description', e.target.value)}
                                            placeholder="Ej. Evaluación completa de signos vitales e historial clínico para pacientes de primera vez..."
                                            rows="3"
                                            className="w-full bg-white/40 border border-white/60 rounded-2xl px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 resize-none custom-scrollbar"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer actions */}
                            {(canCreateServices || canEditServices || canToggleServices) && (
                                <div className="px-6 py-4 border-t border-white/60 flex items-center justify-end gap-3 z-20 shrink-0">
                                    {/* 1. Desactivar / Activar — solo edición */}
                                    {canToggleServices && !isNew && selectedService && (
                                        <button
                                            onClick={handleToggle}
                                            disabled={toggling}
                                            className={`group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 border text-[11px] font-bold rounded-full shadow-sm transition-all duration-300 overflow-hidden disabled:opacity-50 ${selectedService.active
                                                    ? 'bg-white border-white/80 text-rose-500 hover:bg-rose-50 hover:border-rose-100/50'
                                                    : 'bg-white border-white/80 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100/50'
                                                }`}
                                        >
                                            {selectedService.active
                                                ? <ToggleLeft size={14} className="shrink-0" />
                                                : <ToggleRight size={14} className="shrink-0" />
                                            }
                                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">
                                                {toggling ? '...' : selectedService.active ? 'Desactivar' : 'Activar'}
                                            </span>
                                        </button>
                                    )}

                                    {/* 2. Guardar cambios */}
                                    {(isNew ? canCreateServices : canEditServices) && (
                                        <button
                                            onClick={handleSave}
                                            disabled={saving || !form.name.trim()}
                                            className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-sm hover:bg-navy-50 hover:border-navy-100/50 transition-all duration-300 overflow-hidden disabled:opacity-50"
                                        >
                                            <Save size={14} className="shrink-0" />
                                            <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">
                                                {saving ? 'Guardando...' : isNew ? 'Crear servicio' : 'Guardar cambios'}
                                            </span>
                                        </button>
                                    )}

                                    {/* 3. Eliminar — solo edición */}
                                    {canEditServices && !isNew && selectedService && (
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            disabled={deleting}
                                            className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white border border-white/80 text-rose-600 text-[11px] font-bold rounded-full shadow-sm hover:bg-rose-50 hover:border-rose-100/50 transition-all duration-300 overflow-hidden disabled:opacity-50"
                                        >
                                            <Trash2 size={14} className="shrink-0" />
                                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">
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
                                        <p className="text-sm font-bold text-navy-900 mb-1">¿Eliminar servicio?</p>
                                        <p className="text-xs text-navy-700/60 font-semibold mb-5 px-4">
                                            Esta acción no se puede deshacer.
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
                                <Layers size={28} strokeWidth={1.5} className="text-navy-900" />
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 tracking-tight">Gestión de Servicios</h3>
                            <p className="max-w-[280px] text-xs font-semibold mt-1">
                                Selecciona un servicio para editarlo, o crea uno nuevo con el botón <strong>+</strong>.
                            </p>
                        </div>
                    )}
                </div>
            </>
        )}
    </div>
</div>
    );
}