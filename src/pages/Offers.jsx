import { useEffect, useMemo, useState } from 'react';
import { Tag, Plus, Save, ToggleLeft, ToggleRight, ChevronLeft, Search, Trash2, X, Repeat, Calendar as CalendarIcon, SlidersHorizontal, Layers } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useOffers, getOfferStatus } from '../hooks/useOffers';
import { useServices } from '../hooks/useServices';
import { usePlanLimits } from '../hooks/usePlanLimits';
import FeatureLock from '../components/FeatureLock';
import WheelColumn from '../components/ui/WheelColumn';
import { showOfferNewToast, showOfferEditToast, showOfferDeleteToast, showOfferActivateToast, showOfferDeactivateToast, showErrorToast } from '../store/useToastStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(local) {
    if (!local) return null;
    return new Date(local).toISOString();
}

function toCents(price) {
    if (price == null || price === '') return null;
    return Math.round(Number(price) * 100);
}

function formatPriceDisplay(cents) {
    if (cents == null || cents === 0) return '0.00';
    return (cents / 100).toFixed(2);
}

const STATUS_BADGE = {
    active: { label: 'Activa', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    scheduled: { label: 'Programada', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    expired: { label: 'Expirada', cls: 'bg-navy-900/5 text-navy-700/60 border-navy-900/10' },
    inactive: { label: 'Desactivada', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_NUM = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const _cy = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(_cy - 1 + i));

function getDaysForMonth(m, y) {
    return Array.from({ length: new Date(Number(y), Number(m), 0).getDate() }, (_, i) => String(i + 1).padStart(2, '0'));
}

const EMPTY_FORM = {
    service_id: null,
    name: '',
    description: '',
    promoPriceCents: null,
    starts_at: '',
    ends_at: '',
    active: true,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Offers() {
    const { hasFeature, isLoading: planLoading } = usePlanLimits();
    const { offers, loading, create, update, toggle, remove } = useOffers();
    const { services } = useServices();

    const [selectedId, setSelectedId] = useState(null); // null | 'new' | uuid
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Filtros y ordenamiento (como en Settings)
    const [searchStr, setSearchStr] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortOrder, setSortOrder] = useState('recent'); // 'recent', 'a-z', 'z-a'
    const [showFilter, setShowFilter] = useState(false);

    const selected = useMemo(
        () => typeof selectedId === 'string' && selectedId !== 'new'
            ? offers.find(o => o.id === selectedId)
            : null,
        [selectedId, offers]
    );
    const isNew = selectedId === 'new';
    const isFormOpen = isNew || selected !== null;

    const filtered = useMemo(() => {
        const now = new Date();
        let result = offers.filter(o => {
            if (searchStr && !o.name.toLowerCase().includes(searchStr.toLowerCase())) return false;
            if (filterStatus !== 'all' && getOfferStatus(o, now) !== filterStatus) return false;
            return true;
        });

        result.sort((a, b) => {
            if (sortOrder === 'a-z') return a.name.localeCompare(b.name, 'es');
            if (sortOrder === 'z-a') return b.name.localeCompare(a.name, 'es');
            // recent (ordenar por inicio o creación, usamos starts_at por defecto)
            return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
        });

        return result;
    }, [offers, searchStr, filterStatus, sortOrder]);

    const isFiltering = searchStr !== '' || filterStatus !== 'all' || sortOrder !== 'recent';

    function handleSelect(offer) {
        setSelectedId(offer.id);
        setForm({
            service_id: offer.service_id,
            name: offer.name,
            description: offer.description || '',
            promoPriceCents: toCents(offer.promo_price),
            starts_at: toLocalInput(offer.starts_at),
            ends_at: toLocalInput(offer.ends_at),
            active: offer.active,
        });
    }

    function handlePriceKey(e) {
        const key = e.key;
        if (key === 'Backspace') {
            e.preventDefault();
            setForm(f => {
                const next = Math.floor((f.promoPriceCents ?? 0) / 10);
                return { ...f, promoPriceCents: next === 0 ? null : next };
            });
            return;
        }
        if (!/^\d$/.test(key)) return;
        e.preventDefault();
        setForm(f => {
            const current = f.promoPriceCents ?? 0;
            const next = current * 10 + Number(key);
            // Cap at Q 99999.99 (9999999 cents)
            return { ...f, promoPriceCents: Math.min(next, 9999999) };
        });
    }

    function handleNew() {
        setSelectedId('new');
        setForm(EMPTY_FORM);
    }

    function handleReuse(offer) {
        setSelectedId('new');
        setForm({
            service_id: offer.service_id,
            name: offer.name,
            description: offer.description || '',
            promoPriceCents: toCents(offer.promo_price),
            starts_at: '',
            ends_at: '',
            active: true,
        });
    }

    function handleClose() {
        setSelectedId(null);
        setForm(EMPTY_FORM);
        setShowDeleteConfirm(false);
    }

    function setField(key, value) {
        setForm(f => ({ ...f, [key]: value }));
    }

    function validate() {
        if (!form.service_id) return 'Selecciona un servicio.';
        if (!form.name.trim()) return 'El nombre de la oferta es obligatorio.';
        if (form.promoPriceCents == null || form.promoPriceCents < 0) {
            return 'Ingresa un precio promocional válido.';
        }
        if (!form.starts_at || !form.ends_at) return 'Define fecha de inicio y fin.';
        if (new Date(form.ends_at) <= new Date(form.starts_at)) return 'La fecha de fin debe ser posterior al inicio.';
        return null;
    }

    async function handleSave() {
        const err = validate();
        if (err) { showErrorToast(err); return; }

        setSaving(true);
        try {
            const payload = {
                service_id: form.service_id,
                name: form.name,
                description: form.description,
                promo_price: form.promoPriceCents != null ? form.promoPriceCents / 100 : 0,
                starts_at: fromLocalInput(form.starts_at),
                ends_at: fromLocalInput(form.ends_at),
                active: form.active,
            };
            if (isNew) {
                const created = await create(payload);
                setSelectedId(created.id);
                showOfferNewToast(created.name);
            } else {
                await update(selected.id, payload);
                showOfferEditToast(payload.name);
            }
        } catch (e) {
            const msg = e?.code === '23P01'
                ? 'Ya existe otra oferta activa para este servicio en el mismo período. Desactiva la otra o ajusta las fechas.'
                : (e?.message || 'No se pudo guardar la oferta');
            showErrorToast(msg);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggle() {
        if (!selected) return;
        try {
            const nextActive = !selected.active;
            await toggle(selected.id, nextActive);
            setForm(f => ({ ...f, active: nextActive }));
            if (nextActive) showOfferActivateToast(selected.name);
            else showOfferDeactivateToast(selected.name);
        } catch (e) {
            showErrorToast(e?.message || 'No se pudo cambiar el estado');
        }
    }

    async function handleDelete() {
        if (!selected) return;
        setDeleting(true);
        try {
            const name = selected.name;
            await remove(selected.id);
            showOfferDeleteToast(name);
            handleClose();
        } catch (e) {
            showErrorToast(e?.message || 'No se pudo eliminar');
        } finally {
            setDeleting(false);
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────

    if (planLoading || loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
            </div>
        );
    }

    if (!hasFeature('dynamic_pricing')) {
        const MO = [
            { id: 1, name: '2x1 Corte de Cabello', service: 'Corte Clásico', price: 80, status: 'active', s: '1/5/2025', e: '15/5/2025' },
            { id: 2, name: 'Descuento Verano', service: 'Tinte Completo', price: 350, status: 'inactive', s: '20/5/2025', e: '5/6/2025' },
            { id: 3, name: 'Promo Flash 24h', service: 'Manicure', price: 50, status: 'inactive', s: '10/4/2025', e: '11/4/2025' },
        ];
        const sCls = { active: 'bg-emerald-50 text-emerald-700 border-emerald-200', scheduled: 'bg-amber-50 text-amber-700 border-amber-200', expired: 'bg-navy-900/5 text-navy-700/60 border-navy-900/10', inactive: 'bg-navy-900/5 text-navy-700/60 border-navy-900/10' };
        const sLbl = { active: 'Activa', scheduled: 'Programada', expired: 'Expirada', inactive: 'Pausada' };
        return (
            <FeatureLock
                feature="dynamic_pricing"
                variant="blurred"
                title="Ofertas y precios dinámicos"
                description="Programá promociones con descripción para la IA, fechas de aplicación y reutilizalas. Disponible en Enterprise."
                requiredPlan="Enterprise"
            >
                {/* Réplica exacta del layout del módulo real */}
                <div className="h-full flex flex-col mx-auto w-full max-w-[1080px] pt-2 px-0">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Ofertas</h1>
                            <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Promociones temporales impulsadas por Inteligencia Artificial</p>
                        </div>
                    </div>
                    {/* Card principal igual al módulo real */}
                    <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex overflow-hidden mb-4">
                        {/* Panel izquierdo — lista */}
                        <div className="w-[360px] shrink-0 flex flex-col border-r border-white/40">
                            <div className="p-4 pb-3">
                                <div className="flex items-center gap-2 h-9">
                                    <div className="relative flex-1 h-full">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-navy-900"><Search size={14} strokeWidth={2.5} /></div>
                                        <div className="w-full h-full bg-white/60 backdrop-blur-card border border-white/90 rounded-full" />
                                    </div>
                                    <div className="h-9 w-9 bg-white/60 border border-white/90 rounded-full shadow-sm flex items-center justify-center"><Plus size={14} className="text-navy-900" /></div>
                                    <div className="h-9 w-9 bg-white/60 border border-white/90 rounded-full shadow-sm flex items-center justify-center"><SlidersHorizontal size={14} className="text-navy-900" /></div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden p-2 pt-0 space-y-1">
                                {MO.map((o, i) => (
                                    <div key={o.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${i === 0 ? 'bg-white/60 border-white/80' : 'border-transparent'}`}>
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${i === 0 ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white/60 border-white/80 text-navy-900'}`}>
                                            {o.name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-navy-900/80 text-sm truncate">{o.name}</div>
                                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-bold text-navy-700/60">
                                                <span>Q{o.price}</span>
                                                <span className="opacity-40">•</span>
                                                <span>hasta {o.e}</span>
                                            </div>
                                        </div>
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Panel derecho — formulario de la oferta seleccionada */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-8 pb-3 shrink-0">
                                <div className="flex items-start justify-between gap-4 mb-1">
                                    <div>
                                        <h2 className="text-lg font-bold text-navy-900 tracking-tight">2x1 Corte de Cabello</h2>
                                        <p className="text-[11px] text-navy-700/50 font-semibold mt-1">Corte Clásico</p>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] shrink-0" />
                                </div>
                            </div>
                            <div className="flex-1 px-8 py-4 space-y-6">
                                {[
                                    { label: 'Servicio', val: 'Corte Clásico' },
                                    { label: 'Nombre de la oferta', val: '2x1 Corte de Cabello' },
                                    { label: 'Descripción para la IA', val: 'Promoción especial 2 por 1 en cortes de cabello clásico durante mayo.' },
                                    { label: 'Precio promocional', val: 'Q 80.00' },
                                    { label: 'Inicio', val: '01/05/2025, 08:00' },
                                    { label: 'Fin', val: '15/05/2025, 23:59' },
                                ].map(({ label, val }) => (
                                    <div key={label}>
                                        <div className="text-[12px] font-bold text-navy-800 mb-2">{label}</div>
                                        <div className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900">{val}</div>
                                    </div>
                                ))}
                            </div>
                            </div>
                        </div>
                </div>
            </FeatureLock>
        );
    }

    const now = new Date();

    return (
        <div className="h-full flex flex-col mx-auto w-full max-w-[1080px] pt-2 px-0">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Ofertas</h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">
                        Promociones temporales impulsadas por Inteligencia Artificial
                    </p>
                </div>
            </div>

            {/* Main card */}
            <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex overflow-hidden mb-4 lg:mb-6 animate-fade-up">

                {/* ── Left panel: offer list ── */}
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
                                    placeholder="Buscar oferta..."
                                    value={searchStr}
                                    onChange={e => setSearchStr(e.target.value)}
                                />
                            </div>

                            {/* New Button */}
                            <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                                <button
                                    onClick={handleNew}
                                    className="group h-full flex items-center justify-center gap-0 hover:gap-1.5 px-2 hover:px-3 text-navy-900 text-[11px] font-bold transition-all duration-300 overflow-hidden outline-none rounded-full hover:bg-white/80"
                                >
                                    <Plus size={14} className="shrink-0" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Nueva</span>
                                </button>
                            </div>

                            {/* Filters */}
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
                                            { id: 'all', label: 'Todas' },
                                            { id: 'active', label: 'Activas' },
                                            { id: 'scheduled', label: 'Programadas' },
                                            { id: 'expired', label: 'Expiradas' },
                                            { id: 'inactive', label: 'Pausadas' }
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
                                    {filtered.length} de {offers.length} ofertas
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 space-y-1.5">
                        {filtered.length === 0 && (
                            <div className="px-4 py-8 text-center text-navy-900/40 text-xs font-bold">
                                {offers.length === 0 ? 'Sin ofertas, creá la primera con +' : 'No se encontraron ofertas'}
                            </div>
                        )}

                        {filtered.map(offer => {
                            const status = getOfferStatus(offer, now);
                            const badge = STATUS_BADGE[status];
                            const isSelected = selectedId === offer.id;

                            return (
                                <button
                                    key={offer.id}
                                    onClick={() => handleSelect(offer)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left group border ${isSelected
                                        ? 'bg-white/60 border-white/80'
                                        : 'hover:bg-white/40 border-transparent hover:border-white/40'
                                        }`}
                                >
                                    {/* Avatar inicial */}
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border ${isSelected
                                        ? 'bg-navy-900 border-navy-900 text-white shadow-md shadow-navy-900/10'
                                        : offer.active
                                            ? 'bg-white/60 border-white/80 text-navy-900 group-hover:bg-navy-900 group-hover:text-white group-hover:border-navy-900'
                                            : 'bg-white/30 border-white/40 text-navy-900/30'
                                        }`}>
                                        {(offer.name?.[0] || '?').toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate flex items-center justify-between ${isSelected ? 'text-navy-900' : offer.active ? 'text-navy-900/80' : 'text-navy-900/35'
                                            }`}>
                                            <span>{offer.name}</span>
                                            {status === 'expired' && (
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); handleReuse(offer); }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-[10px] font-bold text-navy-900 hover:underline flex items-center gap-1 z-10"
                                                    title="Reutilizar"
                                                >
                                                    <Repeat size={12} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold tracking-tight text-navy-700/60 truncate">
                                            {offer.services?.name || 'Servicio eliminado'}
                                            <span className="opacity-40 text-[10px]">•</span>
                                            <span>Q{Number(offer.promo_price).toFixed(2)}</span>
                                            <div className={`w-1.5 h-1.5 rounded-full ml-1 shrink-0 ${status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                                status === 'scheduled' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' :
                                                    status === 'inactive' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                                                        'bg-navy-400'
                                                }`} title={badge.label} />
                                         </div>
                                        <div className="text-[10px] text-navy-700/50 font-semibold flex items-center gap-1 mt-0.5">
                                            <CalendarIcon size={9} className="shrink-0" />
                                            {new Date(offer.starts_at).toLocaleDateString('es-GT')} → {new Date(offer.ends_at).toLocaleDateString('es-GT')}
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
                                        onClick={handleClose}
                                        className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white/80 shadow-sm shrink-0 mt-0.5"
                                        aria-label="Volver al listado"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-bold text-navy-900 tracking-tight">
                                            {isNew ? 'Nueva Oferta' : (selected?.name || '—')}
                                        </h2>
                                        <p className="text-[11px] text-navy-700/50 font-semibold mt-1">
                                            {isNew
                                                ? 'Define servicio, fechas y precio promocional'
                                                : selected?.services?.name || 'Servicio eliminado'
                                            }
                                        </p>
                                    </div>
                                    {!isNew && selected && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 border border-white/60 shadow-sm">
                                            <div className={`w-1.5 h-1.5 rounded-full ${getOfferStatus(selected, now) === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                                getOfferStatus(selected, now) === 'scheduled' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' :
                                                    getOfferStatus(selected, now) === 'inactive' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                                                        'bg-navy-400'
                                                }`} />
                                            <span className="text-[10px] font-bold text-navy-900/60 uppercase tracking-wider">
                                                {STATUS_BADGE[getOfferStatus(selected, now)].label}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Form fields */}
                            <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar relative animate-fade-up">
                                <div className="space-y-6 pb-12 pt-2 w-full">

                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Servicio
                                        </label>
                                        <div className="bg-white/30 border border-white/60 rounded-[24px] overflow-hidden shadow-sm">
                                            <WheelColumn
                                                items={services}
                                                selected={services.find(s => s.id === form.service_id)}
                                                displayFn={s => s ? `${s.name} · Q${Number(s.price).toFixed(2)}` : '—'}
                                                onSelect={s => setField('service_id', s?.id)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Nombre de la oferta
                                        </label>
                                        <input
                                            maxLength={120}
                                            value={form.name}
                                            onChange={e => setField('name', e.target.value)}
                                            placeholder="Ej. 20% de descuento en tu primera cita"
                                            className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Descripción <span className="font-semibold text-navy-700/40 text-[11px]">(la IA usará este texto al ofrecerla)</span>
                                        </label>
                                        <textarea
                                            maxLength={500}
                                            rows={3}
                                            value={form.description}
                                            onChange={e => setField('description', e.target.value)}
                                            placeholder="Ej. Válido para pacientes nuevos que agenden su turno a través de la aplicación en horario matutino..."
                                            className="w-full bg-white/40 border border-white/60 rounded-2xl px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 resize-none custom-scrollbar"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Precio promocional
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-700/60 font-bold text-sm select-none">
                                                Q
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="none"
                                                readOnly
                                                value={formatPriceDisplay(form.promoPriceCents)}
                                                onKeyDown={handlePriceKey}
                                                placeholder="0.00"
                                                className={`w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm cursor-text select-none ${form.promoPriceCents ? 'text-navy-900' : 'text-navy-700/40'
                                                    }`}
                                            />
                                        </div>
                                        <p className="mt-1.5 text-[10px] font-semibold text-navy-700/40 pl-1">
                                            Escribe los dígitos · Backspace para borrar
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                                Inicio
                                            </label>
                                            <div className="flex bg-white/30 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                                                <WheelColumn
                                                    items={getDaysForMonth(form.starts_at.slice(5, 7) || '01', form.starts_at.slice(0, 4) || _cy)}
                                                    selected={form.starts_at.slice(8, 10) || '01'}
                                                    onSelect={d => {
                                                        const parts = (form.starts_at || toLocalInput(new Date())).split('T');
                                                        const [y, m] = parts[0].split('-');
                                                        setField('starts_at', `${y}-${m}-${d}T${parts[1] || '00:00'}`);
                                                    }}
                                                />
                                                <div className="w-px bg-white/50" />
                                                <WheelColumn
                                                    items={MONTHS_NUM}
                                                    selected={form.starts_at.slice(5, 7) || '01'}
                                                    displayFn={m => MONTHS_ES[parseInt(m) - 1]}
                                                    onSelect={m => {
                                                        const parts = (form.starts_at || toLocalInput(new Date())).split('T');
                                                        const [y, _, d] = parts[0].split('-');
                                                        setField('starts_at', `${y}-${m}-${d}T${parts[1] || '00:00'}`);
                                                    }}
                                                />
                                                <div className="w-px bg-white/50" />
                                                <WheelColumn
                                                    items={YEARS}
                                                    selected={form.starts_at.slice(0, 4) || String(_cy)}
                                                    onSelect={y => {
                                                        const parts = (form.starts_at || toLocalInput(new Date())).split('T');
                                                        const [_, m, d] = parts[0].split('-');
                                                        setField('starts_at', `${y}-${m}-${d}T${parts[1] || '00:00'}`);
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                                Fin
                                            </label>
                                            <div className="flex bg-white/30 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                                                <WheelColumn
                                                    items={getDaysForMonth(form.ends_at.slice(5, 7) || '01', form.ends_at.slice(0, 4) || _cy)}
                                                    selected={form.ends_at.slice(8, 10) || '01'}
                                                    onSelect={d => {
                                                        const parts = (form.ends_at || toLocalInput(new Date())).split('T');
                                                        const [y, m] = parts[0].split('-');
                                                        setField('ends_at', `${y}-${m}-${d}T${parts[1] || '23:59'}`);
                                                    }}
                                                />
                                                <div className="w-px bg-white/50" />
                                                <WheelColumn
                                                    items={MONTHS_NUM}
                                                    selected={form.ends_at.slice(5, 7) || '01'}
                                                    displayFn={m => MONTHS_ES[parseInt(m) - 1]}
                                                    onSelect={m => {
                                                        const parts = (form.ends_at || toLocalInput(new Date())).split('T');
                                                        const [y, _, d] = parts[0].split('-');
                                                        setField('ends_at', `${y}-${m}-${d}T${parts[1] || '23:59'}`);
                                                    }}
                                                />
                                                <div className="w-px bg-white/50" />
                                                <WheelColumn
                                                    items={YEARS}
                                                    selected={form.ends_at.slice(0, 4) || String(_cy)}
                                                    onSelect={y => {
                                                        const parts = (form.ends_at || toLocalInput(new Date())).split('T');
                                                        const [_, m, d] = parts[0].split('-');
                                                        setField('ends_at', `${y}-${m}-${d}T${parts[1] || '23:59'}`);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer actions */}
                            <div className="px-6 py-4 border-t border-white/60 flex items-center justify-end gap-3 z-20 shrink-0">
                                {/* 1. Desactivar / Activar — solo edición */}
                                {!isNew && selected && (
                                    <button
                                        onClick={handleToggle}
                                        className={`group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 border text-[11px] font-bold rounded-full shadow-sm transition-all duration-300 overflow-hidden ${selected.active
                                            ? 'bg-white border-white/80 text-rose-500 hover:bg-rose-50 hover:border-rose-100/50'
                                            : 'bg-white border-white/80 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100/50'
                                            }`}
                                    >
                                        {selected.active
                                            ? <ToggleLeft size={14} className="shrink-0" />
                                            : <ToggleRight size={14} className="shrink-0" />
                                        }
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">
                                            {selected.active ? 'Desactivar' : 'Activar'}
                                        </span>
                                    </button>
                                )}

                                {/* 2. Guardar cambios */}
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-sm hover:bg-navy-50 hover:border-navy-100/50 transition-all duration-300 overflow-hidden disabled:opacity-50"
                                >
                                    <Save size={14} className="shrink-0" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">
                                        {saving ? 'Guardando...' : isNew ? 'Crear oferta' : 'Guardar cambios'}
                                    </span>
                                </button>

                                {/* 3. Eliminar — solo edición */}
                                {!isNew && selected && (
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

                            {/* Confirmación eliminar */}
                            {showDeleteConfirm && createPortal(
                                <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                                    <div className="w-full max-w-sm bg-white/30 backdrop-blur-xl border border-white/50 p-6 animate-fade-up shadow-[0_8px_32px_rgba(26,58,107,0.15)] rounded-[32px] text-center">
                                        <p className="text-sm font-bold text-navy-900 mb-1">¿Eliminar oferta?</p>
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
                                <Tag size={28} strokeWidth={1.5} className="text-navy-900" />
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 tracking-tight">Gestión de Ofertas</h3>
                            <p className="max-w-[280px] text-xs font-semibold mt-1">
                                Selecciona una oferta para editarla, o crea una nueva con el botón <strong>+</strong>.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
