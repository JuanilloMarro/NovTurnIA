import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tag, Plus, Save, Pencil, ToggleLeft, ToggleRight, ChevronLeft, ChevronDown, Search, Trash2, X, Percent, SlidersHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getOfferStatus } from '../hooks/useOffers';
import { useServices } from '../hooks/useServices';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { usePermissions } from '../hooks/usePermissions';
import FeatureLock from '../components/FeatureLock';
import WheelColumn from '../components/ui/WheelColumn';
import WheelRow from '../components/ui/WheelRow';
import { MiniCard } from '../components/conversations/ContextSidebar';
import { getOffers, getOfferById, createOffer, updateOffer, toggleOfferActive, deleteOffer, getBusinessInfo } from '../services/supabaseService';
import { showOfferNewToast, showOfferEditToast, showOfferDeleteToast, showOfferActivateToast, showOfferDeactivateToast, showErrorToast } from '../store/useToastStore';

const PAGE_SIZE = 40;

// Redondea al incremento de precio configurado por el negocio (Ajustes → Precios).
function roundToIncrement(value, increment) {
    if (!increment || increment <= 0) return value;
    return Math.round(value / increment) * increment;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalInput(dateObjOrIso) {
    if (!dateObjOrIso) return '';
    const d = new Date(dateObjOrIso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}`;
}
function fromLocalInput(local) {
    if (!local) return null;
    // local format is YYYY-MM-DDTHH:mm
    const [datePart, timePart] = local.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm).toISOString();
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
const YEARS = Array.from({ length: 5 }, (_, i) => String(_cy + i));

function getDaysForMonth(m, y) {
    return Array.from({ length: new Date(Number(y), Number(m), 0).getDate() }, (_, i) => String(i + 1).padStart(2, '0'));
}

const nowForDefault = new Date();
const nextMonthForDefault = new Date();
nextMonthForDefault.setMonth(nowForDefault.getMonth() + 1);

const EMPTY_FORM = {
    service_id: null,
    name: '',
    description: '',
    promoPriceCents: null,
    discountPct: null, // calculadora, no se persiste — solo alimenta promoPriceCents
    starts_at: toLocalInput(nowForDefault),
    ends_at: toLocalInput(nextMonthForDefault),
    active: true,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Offers() {
    const { hasFeature, isLoading: planLoading } = usePlanLimits();
    const { canCreateOffers, canEditOffers, canToggleOffers, canDeleteOffers } = usePermissions();
    const { services } = useServices();

    // Paginación real (sin números de página) — igual patrón que Settings/Finanzas:
    // primera tanda vía .range(), "Cargar más" concatena la siguiente.
    const [offers, setOffers] = useState([]);
    const [offersCount, setOffersCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const hasMoreOffers = offers.length < offersCount;

    const loadFirstPage = useCallback(async () => {
        setLoading(true);
        try {
            const { data, count } = await getOffers({ page: 0, pageSize: PAGE_SIZE });
            setOffers(data);
            setOffersCount(count);
        } catch (err) {
            if (err.code !== 'PGRST116' && err.code !== '42P01') console.error('[Offers:load]', err.message);
            setOffers([]);
            setOffersCount(0);
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

    async function loadMoreOffers() {
        if (!hasMoreOffers || loadingMore) return;
        setLoadingMore(true);
        try {
            const nextPage = Math.ceil(offers.length / PAGE_SIZE);
            const { data, count } = await getOffers({ page: nextPage, pageSize: PAGE_SIZE });
            setOffers(prev => [...prev, ...data]);
            setOffersCount(count);
        } catch (err) {
            console.error('[Offers:loadMore]', err.message);
        } finally {
            setLoadingMore(false);
        }
    }

    async function create(fields) {
        const created = await createOffer(fields);
        setOffers(prev => [created, ...prev]);
        setOffersCount(c => c + 1);
        return created;
    }
    async function update(id, fields) {
        const updated = await updateOffer(id, fields);
        setOffers(prev => prev.map(o => o.id === id ? updated : o));
        return updated;
    }
    async function toggle(id, active) {
        await toggleOfferActive(id, active);
        const now = new Date().toISOString();
        setOffers(prev => prev.map(o => o.id === id ? { ...o, active, updated_at: now } : o));
    }
    async function remove(id) {
        await deleteOffer(id);
        setOffers(prev => prev.filter(o => o.id !== id));
        setOffersCount(c => Math.max(0, c - 1));
    }

    // Redondeo de precios del negocio (Ajustes → Precios) — alimenta la
    // calculadora de % de descuento.
    const [roundingIncrement, setRoundingIncrement] = useState(1);
    useEffect(() => {
        getBusinessInfo().then(b => setRoundingIncrement(Number(b?.price_rounding_increment ?? 1))).catch(() => {});
    }, []);

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
    const selectedService = services.find(s => s.id === form.service_id);

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
        const price = Number(offer.services?.price);
        const promo = Number(offer.promo_price);
        const impliedPct = price > 0 ? Math.round((1 - promo / price) * 100) : null;
        setForm({
            service_id: offer.service_id,
            name: offer.name,
            description: offer.description || '',
            promoPriceCents: toCents(offer.promo_price),
            discountPct: (impliedPct != null && impliedPct > 0 && impliedPct < 100) ? impliedPct : null,
            starts_at: toLocalInput(offer.starts_at),
            ends_at: toLocalInput(offer.ends_at),
            active: offer.active,
        });
    }

    // Deep-link: ?offer=<id> abre directamente esa oferta (desde Conversaciones).
    // Si no está entre lo ya cargado (paginación real), se busca puntualmente.
    const [searchParams, setSearchParams] = useSearchParams();
    const offerIdFromUrl = searchParams.get('offer');
    useEffect(() => {
        if (!offerIdFromUrl || loading) return;
        const clearParam = () => {
            const next = new URLSearchParams(searchParams);
            next.delete('offer');
            setSearchParams(next, { replace: true });
        };
        const local = offers.find(x => String(x.id) === String(offerIdFromUrl));
        if (local) { handleSelect(local); clearParam(); return; }
        getOfferById(offerIdFromUrl).then(o => {
            if (!o) return;
            setOffers(prev => prev.some(x => x.id === o.id) ? prev : [o, ...prev]);
            handleSelect(o);
        }).catch(() => {}).finally(clearParam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offerIdFromUrl, loading]);

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

    // % de descuento — calculadora sobre el precio del servicio elegido; el
    // precio promocional sigue siendo editable a mano en cualquier momento.
    function handleDiscountPctChange(pct) {
        setForm(f => {
            const next = { ...f, discountPct: pct };
            const svcPrice = Number(selectedService?.price);
            if (pct != null && svcPrice > 0) {
                const rounded = roundToIncrement(svcPrice * (1 - pct / 100), roundingIncrement);
                next.promoPriceCents = Math.max(0, Math.round(rounded * 100));
            }
            return next;
        });
    }

    function handleServiceSelect(id) {
        setForm(f => {
            const next = { ...f, service_id: id };
            if (f.discountPct != null) {
                const svc = services.find(s => s.id === id);
                const svcPrice = Number(svc?.price);
                if (svcPrice > 0) {
                    const rounded = roundToIncrement(svcPrice * (1 - f.discountPct / 100), roundingIncrement);
                    next.promoPriceCents = Math.max(0, Math.round(rounded * 100));
                }
            }
            return next;
        });
    }

    function handleNew() {
        setSelectedId('new');
        setForm({ ...EMPTY_FORM, service_id: services[0]?.id ?? null });
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
                    {/* Card principal igual al módulo real (4 glows de esquina) */}
                    <div className="relative flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex overflow-hidden mb-4">
                        <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                        <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                        <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                        <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                        {/* Panel izquierdo — lista (full-width en móvil, como el módulo real) */}
                        <div className="w-full md:w-[360px] xl:w-[380px] shrink-0 flex flex-col md:border-r border-white/40 relative z-10">
                            <div className="p-4 pb-3">
                                <div className="flex items-center gap-2 h-9">
                                    <div className="relative flex-1 h-full">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-navy-700/50 z-10"><Search size={14} strokeWidth={2.5} /></div>
                                        <div className="w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md flex items-center pl-10 text-[11px] font-bold text-navy-900/40">Buscar oferta…</div>
                                    </div>
                                    <div className="h-9 px-3 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md flex items-center justify-center text-navy-900"><Plus size={14} /></div>
                                    <div className="h-9 px-3 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md flex items-center justify-center text-navy-900"><SlidersHorizontal size={14} /></div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden p-2 pt-0 space-y-1">
                                {MO.map((o, i) => (
                                    <div key={o.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${i === 0 ? 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-md' : 'border-transparent'}`}>
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${i === 0 ? 'bg-gradient-to-b from-white to-gray-200 border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900' : 'bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900'}`}>
                                            {o.name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-bold text-sm truncate ${i === 0 ? 'text-navy-900' : 'text-navy-900/80'}`}>{o.name}</div>
                                            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold tracking-tight text-navy-700/60">
                                                <span className="truncate">{o.service}</span>
                                                <span className="opacity-40 text-[10px] shrink-0">•</span>
                                                <span className="shrink-0">Q{Number(o.price).toFixed(2)}</span>
                                                <div className={`w-1.5 h-1.5 rounded-full ml-1 shrink-0 ${o.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Panel derecho — formulario (oculto en móvil, igual que el módulo real) */}
                        <div className="hidden md:flex flex-1 flex-col overflow-hidden relative z-10">
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
                                        <div className="w-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl px-4 py-2.5 text-sm font-semibold text-navy-900">{val}</div>
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
            <div className="relative flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex overflow-hidden mb-4 lg:mb-6 animate-fade-up">
                <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

                {/* ── Left panel: offer list ── */}
                <div className={`${isFormOpen ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] xl:w-[380px] flex-col z-10`}>
                    <div className="p-4 pb-3">
                        <div className="flex items-center gap-2 h-9">
                            {/* Search bar */}
                            <div className="relative flex-1 h-full">
                                <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -top-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(29,95,173,0.05)' }} />
                                <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-navy-700">
                                    <Search size={14} strokeWidth={2.5} />
                                </div>
                                <input
                                    className="w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-md"
                                    placeholder="Buscar oferta..."
                                    value={searchStr}
                                    onChange={e => setSearchStr(e.target.value)}
                                />
                            </div>

                            {/* New Button — solo con permiso de crear ofertas */}
                            {canCreateOffers && (
                            <button
                                onClick={handleNew}
                                className="relative overflow-hidden group h-9 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none"
                            >
                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                <Plus size={14} className="shrink-0 relative z-10" />
                                <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap relative z-10">Nueva</span>
                            </button>
                            )}

                            {/* Filters */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowFilter(!showFilter)}
                                    className="relative overflow-hidden group h-9 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none"
                                >
                                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                    <SlidersHorizontal size={14} strokeWidth={2.5} className="shrink-0 relative z-10" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap text-[11px] relative z-10">Filtros</span>
                                </button>
                                {showFilter && (
                                    <div className="overflow-hidden absolute right-0 top-full mt-2 w-52 bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md z-50 p-2 animate-fade-up">
                                        <div className="absolute -top-8 -right-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="absolute -top-8 -left-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(29,95,173,0.05)' }} />
                                        <div className="absolute -bottom-8 -right-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(120,110,230,0.05)' }} />
                                        <div className="absolute -bottom-8 -left-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-white/20">
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
                                            <div className="px-2 pt-1 pb-0.5">
                                                <span className="text-[10px] font-bold text-navy-700/40 tracking-wide">Estado</span>
                                            </div>
                                            {[
                                                { id: 'all', label: 'Todas' },
                                                { id: 'active', label: 'Activas' },
                                                { id: 'scheduled', label: 'Programadas' },
                                                { id: 'expired', label: 'Expiradas' }
                                            ].map(opt => (
                                                <div
                                                    key={opt.id}
                                                    onClick={() => { setFilterStatus(opt.id); }}
                                                    className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${filterStatus === opt.id ? 'bg-white/60 backdrop-blur-sm border-white/80 shadow-md text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-white/20'}`}
                                                >
                                                    {opt.label}
                                                </div>
                                            ))}
                                            <div className="border-t border-white/20 mt-1 pt-1">
                                                <div className="px-2 pt-1 pb-0.5">
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
                                                    className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${sortOrder === opt.id ? 'bg-white/60 backdrop-blur-sm border-white/80 shadow-md text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-white/20'}`}
                                                >
                                                    {opt.label}
                                                </div>
                                            ))}
                                        </div>
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

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 flex flex-col gap-1">
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
                                    className={`relative w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 text-left group border overflow-hidden ${isSelected
                                        ? 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-md'
                                        : 'border-transparent hover:bg-white/30'
                                        }`}
                                >
                                    {isSelected && <>
                                        <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                    </>}
                                    {/* Avatar inicial */}
                                    <div className={`w-11 h-11 flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border rounded-full leading-none ${isSelected
                                            ? 'bg-gradient-to-b from-white to-gray-200 border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900'
                                            : offer.active
                                                ? 'bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900 group-hover:to-gray-200 group-hover:border-gray-200'
                                                : 'bg-white/30 border-white/40 text-navy-900/30'
                                        }`}>
                                        <span className="block">{(offer.name?.[0] || '?').toUpperCase()}</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${isSelected ? 'text-navy-900' : offer.active ? 'text-navy-900/80' : 'text-navy-900/35'}`}>
                                            <span className="truncate">{offer.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold tracking-tight text-navy-700/60">
                                            <span className="truncate">{offer.services?.name || 'Servicio eliminado'}</span>
                                            <span className="opacity-40 text-[10px] shrink-0">•</span>
                                            <span className="shrink-0">Q{Number(offer.promo_price).toFixed(2)}</span>
                                            <div className={`w-1.5 h-1.5 rounded-full ml-1 shrink-0 ${status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                                status === 'scheduled' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' :
                                                    (status === 'inactive' || status === 'expired') ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                                                        'bg-navy-400'
                                                }`} title={badge.label} />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        {hasMoreOffers && (
                            <button
                                onClick={loadMoreOffers}
                                disabled={loadingMore}
                                className="flex items-center justify-center gap-1.5 mx-2 mt-1 mb-2 py-2.5 rounded-2xl bg-white/30 border border-white/50 text-navy-700/70 text-[11px] font-bold hover:bg-white/50 transition-colors disabled:opacity-50"
                            >
                                <ChevronDown size={13} className={loadingMore ? 'animate-spin' : ''} /> {loadingMore ? 'Cargando…' : 'Cargar más'}
                            </button>
                        )}
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
                                        {!isNew && selected && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                                                <Pencil size={9} /> Editando
                                            </span>
                                        )}
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
                                                    (getOfferStatus(selected, now) === 'inactive' || getOfferStatus(selected, now) === 'expired') ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                                                        'bg-navy-400'
                                                }`} />
                                            <span className="text-[10px] font-bold text-navy-900/60 uppercase tracking-wider">
                                                {STATUS_BADGE[getOfferStatus(selected, now)].label}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Form fields — 2 columnas donde tiene sentido (Precio+%, Inicio+Fin)
                                para aprovechar el ancho y evitar scroll con el sidebar activo. */}
                            <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar relative animate-fade-up">
                                <div className="space-y-5 pb-8 pt-2 w-full">

                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Servicio
                                        </label>
                                        <div className="py-1">
                                            <WheelRow
                                                items={services}
                                                selected={services.find(s => s.id === form.service_id)}
                                                displayFn={s => s ? (
                                                    <MiniCard
                                                        title={s.name}
                                                        subtitle={s.price != null ? `Q${Number(s.price).toFixed(2)}` : 'Sin precio'}
                                                        badge={`${s.duration_minutes} min`}
                                                        badgeClass="text-navy-700/70 bg-white/60 border border-white/80"
                                                        isSelected={s.id === form.service_id}
                                                        selectedClass="bg-gradient-to-br from-navy-50/10 via-white/90 to-white/80 border border-navy-500/15 shadow-[0_6px_15px_rgba(29,95,173,0.06)]"
                                                    />
                                                ) : '—'}
                                                onSelect={s => handleServiceSelect(s?.id)}
                                                itemWidth={170}
                                                height={100}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                % de descuento <span className="font-semibold text-navy-700/40 text-[11px]">(calcula el precio)</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number" min="0" max="99" step="1"
                                                    value={form.discountPct ?? ''}
                                                    onChange={e => handleDiscountPctChange(e.target.value === '' ? null : Math.max(0, Math.min(99, Number(e.target.value))))}
                                                    disabled={!(Number(selectedService?.price) > 0)}
                                                    placeholder={Number(selectedService?.price) > 0 ? '0' : 'Servicio sin precio'}
                                                    className="w-full bg-white/40 border border-white/60 rounded-full pl-4 pr-9 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 disabled:opacity-50"
                                                />
                                                <span className="absolute inset-y-0 right-4 flex items-center text-navy-700/50 font-bold text-sm pointer-events-none">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                            Descripción <span className="font-semibold text-navy-700/40 text-[11px]">(la IA usará este texto al ofrecerla)</span>
                                        </label>
                                        <textarea
                                            maxLength={500}
                                            rows={2}
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
                                                className={`w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-navy-300/60 focus:bg-white/70 focus:ring-2 focus:ring-navy-200/30 transition-all shadow-sm cursor-text select-none ${form.promoPriceCents ? 'text-navy-900' : 'text-navy-700/40'
                                                    }`}
                                            />
                                        </div>
                                        <p className="mt-1.5 text-[10px] font-semibold text-navy-700/40 pl-1">
                                            {Number(selectedService?.price) > 0 && form.promoPriceCents
                                                ? `≈ ${Math.round((1 - (form.promoPriceCents / 100) / Number(selectedService.price)) * 100)}% de descuento sobre Q${Number(selectedService.price).toFixed(2)}`
                                                : 'Escribe los dígitos · Backspace para borrar'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[12px] font-bold text-navy-800 leading-none mb-3">
                                                Inicio
                                            </label>
                                            <div className="flex bg-white/30 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                                                <WheelColumn
                                                    key={`start-day-${selectedId}-${getDaysForMonth(form.starts_at.slice(5, 7) || '01', form.starts_at.slice(0, 4) || _cy).length}`}
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
                                                    key={`start-month-${selectedId}`}
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
                                                    key={`start-year-${selectedId}`}
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
                                                    key={`end-day-${selectedId}-${getDaysForMonth(form.ends_at.slice(5, 7) || '01', form.ends_at.slice(0, 4) || _cy).length}`}
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
                                                    key={`end-month-${selectedId}`}
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
                                                    key={`end-year-${selectedId}`}
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
                            <div className="px-6 py-4 flex items-center justify-end gap-3 z-20 shrink-0">

                                {/* 1. Activar / Desactivar — solo edición */}
                                {canToggleOffers && !isNew && selected && (
                                    <button
                                        onClick={handleToggle}
                                        className={`relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 ${selected.active ? 'text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white' : 'text-emerald-600 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white'}`}
                                    >
                                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                        {selected.active ? <ToggleLeft size={14} className="shrink-0 relative z-10" /> : <ToggleRight size={14} className="shrink-0 relative z-10" />}
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[90px] transition-all duration-300 whitespace-nowrap relative z-10">
                                            {selected.active ? 'Desactivar' : 'Activar'}
                                        </span>
                                    </button>
                                )}

                                {/* 2. Guardar cambios */}
                                {(isNew ? canCreateOffers : canEditOffers) && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 disabled:opacity-50"
                                >
                                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                    {isNew
                                        ? <Save size={14} className="shrink-0 relative z-10" />
                                        : <Pencil size={14} className="shrink-0 relative z-10" />
                                    }
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap relative z-10">
                                        {saving ? 'Guardando...' : isNew ? 'Crear oferta' : 'Guardar cambios'}
                                    </span>
                                </button>
                                )}

                                {/* 3. Eliminar — solo edición */}
                                {canDeleteOffers && !isNew && selected && (
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
                                <Tag size={28} strokeWidth={1.5} className="text-navy-700" />
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
