import { useState } from 'react';
import { useServices } from '../hooks/useServices';
import { usePermissions } from '../hooks/usePermissions';
import { Layers, Plus, Save, ToggleLeft, ToggleRight, ChevronDown, Clock, DollarSign, Search, SlidersHorizontal } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../store/useToastStore';

const DURATION_OPTIONS = [
    { value: 30,  label: '30 min' },
    { value: 60,  label: '1 hora' },
    { value: 90,  label: '1h 30 min' },
    { value: 120, label: '2 horas' },
    { value: 150, label: '2h 30 min' },
    { value: 180, label: '3 horas' },
];

export function formatDuration(minutes) {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
}

export default function Settings() {
    const { services, loading, create, update, toggle } = useServices();
    const { canManageRoles } = usePermissions();

    const [selectedId, setSelectedId] = useState(null); // null | 'new' | number
    // price stored as integer cents internally (e.g. 350 = Q 3.50); null = no price
    const [form, setForm] = useState({ name: '', duration_minutes: 30, priceCents: null });
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
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
                showSuccessToast('Servicio creado', created.name, 'appointment');
            } else {
                await update(selectedId, payload);
                showSuccessToast('Cambios guardados', payload.name, 'appointment');
            }
        } catch (err) {
            showErrorToast('Error al guardar', err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggle() {
        if (!selectedService) return;
        setToggling(true);
        try {
            await toggle(selectedService.id, !selectedService.active);
            if (selectedService.active) {
                showErrorToast('Servicio desactivado', selectedService.name);
            } else {
                showSuccessToast('Servicio activado', selectedService.name);
            }
        } catch (err) {
            showErrorToast('Error', err.message);
        } finally {
            setToggling(false);
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="h-full flex flex-col mx-auto w-full max-w-4xl pt-2 px-0">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Servicios</h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Gestión de servicios del negocio</p>
                </div>
            </div>

            {/* Main card */}
            <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex overflow-hidden mb-4 lg:mb-6 animate-fade-up">

                {/* ── Left panel: service list ── */}
                <div className="w-[300px] xl:w-[320px] flex flex-col z-10">
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

                            {/* Filter */}
                            <div className="relative h-full">
                                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                                    <button
                                        onClick={() => setShowFilter(!showFilter)}
                                        className="group h-full flex items-center justify-center gap-0 hover:gap-1.5 px-2 hover:px-3 text-navy-900 text-[11px] font-bold transition-all duration-300 overflow-hidden outline-none rounded-full"
                                    >
                                        <SlidersHorizontal size={14} className="shrink-0" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Filtros</span>
                                    </button>
                                </div>
                                {showFilter && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-card z-50 py-2 animate-fade-up">
                                        <div className="px-3 pb-1 mb-1 border-b border-white/50">
                                            <span className="text-[10px] font-bold text-navy-700/50 uppercase tracking-wider">Estado</span>
                                        </div>
                                        {[
                                            { id: 'all', label: 'Todos' },
                                            { id: 'active', label: 'Activos' },
                                            { id: 'inactive', label: 'Inactivos' }
                                        ].map(opt => (
                                            <div
                                                key={opt.id}
                                                onClick={() => { setFilterStatus(opt.id); }}
                                                className={`mx-1 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${filterStatus === opt.id ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-white/60'}`}
                                            >
                                                {opt.label}
                                            </div>
                                        ))}

                                        <div className="px-3 pt-2 pb-1 mt-1 mb-1 border-y border-white/50">
                                            <span className="text-[10px] font-bold text-navy-700/50 uppercase tracking-wider">Orden</span>
                                        </div>
                                        {[
                                            { id: 'recent', label: 'Más recientes' },
                                            { id: 'a-z', label: 'De la A-Z' },
                                            { id: 'z-a', label: 'De la Z-A' }
                                        ].map(opt => (
                                            <div
                                                key={opt.id}
                                                onClick={() => { setSortOrder(opt.id); setShowFilter(false); }}
                                                className={`mx-1 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${sortOrder === opt.id ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-white/60'}`}
                                            >
                                                {opt.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* New Button */}
                            {canManageRoles && (
                                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                                    <button
                                        onClick={handleNewClick}
                                        className={`group h-full flex items-center justify-center gap-0 hover:gap-1.5 px-2 hover:px-3 text-[11px] font-bold transition-all duration-300 overflow-hidden outline-none rounded-full ${
                                            selectedId === 'new'
                                                ? 'bg-navy-900 text-white'
                                                : 'text-navy-900 hover:bg-white/80'
                                        }`}
                                    >
                                        <Plus size={14} className="shrink-0" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Nuevo</span>
                                    </button>
                                </div>
                            )}
                        </div>
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
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left group border ${
                                        isSelected
                                            ? 'bg-white/60 border-white/80'
                                            : 'hover:bg-white/40 border-transparent hover:border-white/40'
                                    }`}
                                >
                                    {/* Avatar inicial */}
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border ${
                                        isSelected
                                            ? 'bg-navy-900 border-navy-900 text-white shadow-md shadow-navy-900/10'
                                            : s.active
                                            ? 'bg-white/60 border-white/80 text-navy-900 group-hover:bg-navy-900 group-hover:text-white group-hover:border-navy-900'
                                            : 'bg-white/30 border-white/40 text-navy-900/30'
                                    }`}>
                                        {(s.name?.[0] || '?').toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${
                                            isSelected ? 'text-navy-900' : s.active ? 'text-navy-900/80' : 'text-navy-900/35'
                                        }`}>
                                            {s.name}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold tracking-tight text-navy-700/60">
                                            {s.price != null ? `Q ${Number(s.price).toFixed(2)}` : 'Sin precio'}
                                            <span className="opacity-40 text-[10px]">•</span>
                                            <span>{formatDuration(s.duration_minutes)}</span>
                                            {!s.active && (
                                                <span className="ml-1 px-1.5 py-0.5 bg-rose-50 text-rose-500 rounded-full border border-rose-100 text-[9px] leading-none">
                                                    Inactivo
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Right panel: form / empty state ── */}
                <div className="flex-1 flex flex-col relative min-w-0">
                    {isFormOpen ? (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Form header */}
                            <div className="p-8 pb-3 shrink-0 z-10 relative animate-fade-down">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
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
                                        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                                            selectedService.active
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-600 border-rose-200'
                                        }`}>
                                            {selectedService.active ? 'Activo' : 'Inactivo'}
                                        </span>
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
                                            value={form.name}
                                            onChange={e => setField('name', e.target.value)}
                                            placeholder="Ej: Consulta general"
                                            className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                                        />
                                    </div>

                                    {/* Duración */}
                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Duración
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-700/50">
                                                <Clock size={14} />
                                            </div>
                                            <select
                                                value={form.duration_minutes}
                                                onChange={e => setField('duration_minutes', Number(e.target.value))}
                                                className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-10 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all appearance-none shadow-sm"
                                            >
                                                {DURATION_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-800">
                                                <ChevronDown size={14} />
                                            </div>
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
                                                className={`w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm cursor-text select-none ${
                                                    form.priceCents ? 'text-navy-900' : 'text-navy-700/40'
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
                                            placeholder="Detalles sobre el servicio..."
                                            rows="3"
                                            className="w-full bg-white/40 border border-white/60 rounded-2xl px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 resize-none custom-scrollbar"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer actions */}
                            {canManageRoles && (
                                <div className="px-8 pb-10 flex items-center justify-end gap-3 z-20">
                                    {/* Activar / Desactivar — solo en modo edición */}
                                    {!isNew && selectedService && (
                                        <button
                                            onClick={handleToggle}
                                            disabled={toggling}
                                            className={`group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 border text-[11px] font-bold rounded-full shadow-card transition-all duration-300 overflow-hidden disabled:opacity-50 ${
                                                selectedService.active
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

                                    {/* Guardar */}
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !form.name.trim()}
                                        className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-card hover:bg-navy-50 hover:border-navy-100/50 transition-all duration-300 overflow-hidden disabled:opacity-50"
                                    >
                                        <Save size={14} className="shrink-0" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">
                                            {saving ? 'Guardando...' : isNew ? 'Crear servicio' : 'Guardar cambios'}
                                        </span>
                                    </button>
                                </div>
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
            </div>
        </div>
    );
}
