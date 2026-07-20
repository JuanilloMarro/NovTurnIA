import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Contact, Tag, Layers, Clock, Plus, Bot, Eye, ChevronUp, ChevronDown, Lock, Unlock, X } from 'lucide-react';
import WhatsApp from '../Icons/WhatsApp';
import AIStar from '../Icons/AIStar';
import WheelRow from '../ui/WheelRow';
import { useOffers, getOfferStatus } from '../../hooks/useOffers';
import { useServices } from '../../hooks/useServices';
import { getPatientAppointments } from '../../services/supabaseService';
import { formatPhone } from '../../utils/format';
import FeatureLock from '../FeatureLock';
import { usePlanLimits } from '../../hooks/usePlanLimits';

// Radio de borde alineado al box principal de Conversaciones
const PANEL = 'relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md animate-fade-up shrink-0';

// Degradado de esquinas (mismo lenguaje glass que los paneles de Ofertas)
function PanelGlow() {
    return (
        <>
            <div className="absolute -top-12 -right-12 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-12 -left-12 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-12 -right-12 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-12 -left-12 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
        </>
    );
}

// ── Helpers de formato (alineados al resto del sistema) ──────────────────────
function money(price) {
    if (price == null || price === '') return 'Sin precio';
    return `Q${Number(price).toFixed(2)}`;
}
function shortDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
}
function fullDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatAptDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')} · ${d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

// Color del punto de estado de la cita (mismo lenguaje visual que Ofertas)
const APPT_DOT = {
    scheduled: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    confirmed: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
    active: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
    completed: 'bg-navy-400',
    cancelled: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]',
    no_show: 'bg-gray-400 shadow-[0_0_8px_rgba(156,163,175,0.4)]',
};

// Encabezado de panel reutilizable
function PanelHeader({ icon: Icon, title, count }) {
    return (
        <div className="relative z-10 flex items-center gap-2 mb-2 px-1 shrink-0">
            <Icon size={14} strokeWidth={2.5} className="text-navy-700/70 shrink-0" />
            <span className="text-[12.5px] font-bold text-navy-800 tracking-wide truncate">{title}</span>
            {count != null && (
                <span className="ml-auto text-[10px] font-bold text-navy-700/40">{count}</span>
            )}
        </div>
    );
}

// Diálogo emergente de detalle (servicio/oferta) — sustituye la navegación a
// otro módulo para no perder el rastro del cliente ni el chat abierto.
function DetailDialog({ title, subtitle, rows, onClose }) {
    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[28px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] p-6 animate-fade-up">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <h3 className="text-base font-bold text-navy-900 truncate">{title}</h3>
                        {subtitle && <p className="text-[11px] font-semibold text-navy-700/50 mt-0.5 truncate">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 transition-colors">
                        <X size={14} />
                    </button>
                </div>
                <div className="space-y-2.5">
                    {rows.map(([k, v]) => (
                        <div key={k} className="flex items-start justify-between gap-3">
                            <span className="text-[10.5px] font-bold text-navy-700/50 shrink-0">{k}</span>
                            <span className="text-[12px] font-bold text-navy-900 text-right">{v}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}

// Botón estilo sistema: ícono visible, texto que aparece al hacer hover (mismo
// patrón blanco con borde que usamos en Ofertas/Pacientes).
function SysButton({ icon: Icon, label, onClick, title }) {
    return (
        <button
            onClick={onClick}
            title={title || label}
            className="group/sys relative overflow-hidden flex items-center justify-center gap-0 hover:gap-1.5 px-3.5 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[10px] font-bold rounded-full shadow-md hover:bg-white/60 transition-all duration-300"
        >
            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
            <Icon size={13} strokeWidth={2.5} className="shrink-0 relative z-10" />
            <span className="max-w-0 overflow-hidden group-hover/sys:max-w-[90px] transition-all duration-300 whitespace-nowrap relative z-10">{label}</span>
        </button>
    );
}

// Fila de turno — mismo lenguaje visual en la ficha
function AppointmentRow({ apt }) {
    return (
        <div className="flex gap-2.5 items-center">
            <div className={`w-2 h-2 rounded-full shrink-0 ${APPT_DOT[apt.status] || 'bg-navy-400'}`} />
            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-navy-900 tracking-wide truncate">
                    {formatAptDate(apt.date_start)}
                </div>
                <div className="text-[10px] font-semibold text-navy-700/60 truncate mt-0.5">
                    {apt.services?.name || 'Servicio no especificado'}
                </div>
            </div>
        </div>
    );
}

// 1. PatientInfoContent (Ficha del cliente — teléfono, alta, notas, turno, ventana 24h)
// Sin tarjeta propia: vive dentro del panel único ContextPanels.
function PatientInfoContent({ patient, windowOpen, hoursLeft }) {
    const [appointments, setAppointments] = useState([]);
    const [notesOpen, setNotesOpen] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!patient?.id) { setAppointments([]); return; }
        getPatientAppointments(patient.id)
            .then(data => { if (alive) setAppointments(data); })
            .catch(() => { if (alive) setAppointments([]); });
        return () => { alive = false; };
    }, [patient?.id]);

    // Al cambiar de cliente, colapsar las notas
    useEffect(() => { setNotesOpen(false); }, [patient?.id]);

    const lastApt = useMemo(() => appointments
        .filter(a => new Date(a.date_start).getTime() < Date.now())
        .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))[0] || null, [appointments]);

    const phone = patient?.patient_phones?.find(p => p.is_primary)?.phone
        || patient?.patient_phones?.[0]?.phone || '';

    return (
        <div className="relative">
            <PanelHeader icon={Contact} title="Ficha del cliente" />

            <div className="relative z-10 px-1 mt-2 space-y-2.5">
                {/* Teléfono */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-navy-700/60 tracking-wide shrink-0">Teléfono</span>
                    <span className="text-[11px] font-bold text-navy-900 flex items-center gap-1.5 min-w-0">
                        <WhatsApp size={11} className="text-emerald-600 shrink-0" />
                        <span className="truncate">{formatPhone(phone) || '—'}</span>
                    </span>
                </div>

                {/* Cliente desde (alta en la BD) */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-navy-700/60 tracking-wide shrink-0">Cliente desde</span>
                    <span className="text-[11px] font-bold text-navy-900">{fullDate(patient?.created_at)}</span>
                </div>

                {/* Notas — colapsadas por defecto, flecha para ampliar */}
                <div className="flex flex-col gap-1 pt-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-navy-700/60 tracking-wide">Notas u observaciones</span>
                        {patient?.notes && (
                            <button
                                onClick={() => setNotesOpen(v => !v)}
                                className="text-navy-700/50 hover:text-navy-900 transition-colors shrink-0"
                                title={notesOpen ? 'Contraer' : 'Ampliar'}
                                aria-label={notesOpen ? 'Contraer notas' : 'Ampliar notas'}
                            >
                                {notesOpen ? <ChevronUp size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
                            </button>
                        )}
                    </div>
                    <div className={notesOpen ? 'max-h-[200px] overflow-y-auto custom-scrollbar pr-1' : 'h-[34px] overflow-hidden'}>
                        <FeatureLock feature="patient_notes" requiredPlan="Pro" compact>
                            {patient?.notes ? (
                                <p className={`text-[11px] text-navy-700/80 font-medium leading-relaxed italic break-words ${notesOpen ? '' : 'line-clamp-2'}`}>
                                    "{patient.notes}"
                                </p>
                            ) : (
                                <p className="text-[11px] text-navy-700/50 font-semibold italic">Sin notas registradas</p>
                            )}
                        </FeatureLock>
                    </div>
                </div>

                {/* Último turno */}
                <div className="flex flex-col gap-1 pt-2.5">
                    <span className="text-[10px] font-bold text-navy-700/60 tracking-wide mb-1">Último turno</span>
                    <div className="min-h-[34px]">
                        {lastApt ? (
                            <AppointmentRow apt={lastApt} />
                        ) : (
                            <p className="text-[11px] font-semibold text-navy-700/50">Sin turnos previos</p>
                        )}
                    </div>
                </div>

                {/* Ventana de 24 horas de WhatsApp */}
                <div className="flex items-center justify-between gap-2 pt-2.5">
                    <span className="text-[10px] font-bold text-navy-700/60 tracking-wide shrink-0">Ventana 24h</span>
                    <span className="text-[10px] font-bold text-navy-700/40 truncate">
                        {windowOpen ? `Tiempo restante: ${hoursLeft} h` : ''}
                    </span>
                    <span className={`text-[11px] font-bold flex items-center gap-1 shrink-0 ${windowOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {windowOpen ? (
                            <>
                                <Unlock size={11} className="text-emerald-600 shrink-0" />
                                <span>Abierta</span>
                            </>
                        ) : (
                            <>
                                <Lock size={11} className="text-rose-600 shrink-0" />
                                <span>Cerrada</span>
                            </>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
}

// Ficha compacta del rollo (selección al centro, ítems laterales atenuados)
export function MiniCard({ title, subtitle, badge, badgeClass, isSelected, selectedClass }) {
    return (
        <div className={`w-full px-1 transition-all duration-300 ${isSelected ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
            <div className={`relative backdrop-blur-md rounded-2xl p-2.5 text-center transition-all duration-300 ${isSelected && selectedClass
                ? selectedClass
                : 'bg-white/70 border border-white/90 shadow-sm'
                }`}>
                <div className="font-bold text-[11px] text-navy-900 leading-tight line-clamp-2">{title}</div>
                <div className="text-[10px] font-semibold text-navy-700/70 truncate mt-0.5">{subtitle}</div>
                <div className={`flex items-center justify-center gap-1 mt-1.5 text-[9px] font-bold rounded-full px-2 py-0.5 w-fit mx-auto shadow-sm ${badgeClass}`}>
                    <Clock size={9} strokeWidth={2.5} /> {badge}
                </div>
            </div>
        </div>
    );
}

// 2. ActiveServicesContent (rollo horizontal — inicia en 0, botones Insertar / Ver)
// Sin tarjeta propia: vive dentro del panel único ContextPanels.
function ActiveServicesContent({ onInsert }) {
    const { services } = useServices();
    const [selectedService, setSelectedService] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const activeServices = useMemo(
        () => services.filter(s => s.active),
        [services]
    );

    useEffect(() => {
        if (activeServices.length > 0) {
            const exists = selectedService && activeServices.some(s => s.id === selectedService.id);
            if (!exists) setSelectedService(activeServices[0]);
        } else {
            setSelectedService(null);
        }
    }, [activeServices, selectedService]);

    function insertService(s) {
        if (!s) return;
        const price = s.price != null ? ` — ${money(s.price)}` : '';
        onInsert(`${s.name}${price} · ${s.duration_minutes} min.`);
    }

    const renderCard = (s, isSelected) => s ? (
        <MiniCard
            title={s.name}
            subtitle={money(s.price)}
            badge={`${s.duration_minutes} min`}
            badgeClass="text-navy-700/70 bg-white/60 border border-white/80"
            isSelected={isSelected}
            selectedClass="bg-gradient-to-br from-navy-50/10 via-white/90 to-white/80 border border-navy-500/15 shadow-[0_6px_15px_rgba(29,95,173,0.06)]"
        />
    ) : '—';

    const actions = (
        <div className="flex items-center justify-center gap-2 mt-1.5 shrink-0">
            <SysButton icon={Plus} label="Insertar servicio" onClick={() => insertService(selectedService)} />
            <SysButton icon={Eye} label="Ver servicio" onClick={() => setShowDetail(true)} title="Ver detalle del servicio" />
        </div>
    );

    return (
        <div className="relative">
            <div className="relative z-10 flex flex-col">
                <PanelHeader icon={Layers} title="Servicios activos" count={activeServices.length || null} />
                <FeatureLock feature="custom_prompt" requiredPlan="Pro">
                    {activeServices.length === 0 ? (
                        <div className="h-[156px] flex items-center justify-center">
                            <p className="text-[11px] font-semibold text-navy-700/40 text-center px-1">Sin servicios activos</p>
                        </div>
                    ) : activeServices.length === 1 ? (
                        <>
                            <div className="py-1 max-w-[220px] mx-auto w-full h-[116px] flex items-center">{renderCard(activeServices[0], true)}</div>
                            {actions}
                        </>
                    ) : (
                        <>
                            <WheelRow
                                items={activeServices}
                                selected={selectedService}
                                displayFn={s => renderCard(s, s?.id === selectedService?.id)}
                                onSelect={s => setSelectedService(s)}
                                itemWidth={170}
                                height={116}
                            />
                            {actions}
                        </>
                    )}
                </FeatureLock>
            </div>
            {showDetail && selectedService && (
                <DetailDialog
                    title={selectedService.name}
                    subtitle="Servicio"
                    rows={[
                        ['Precio', money(selectedService.price)],
                        ['Duración', `${selectedService.duration_minutes} min`],
                        ...(selectedService.description ? [['Descripción', selectedService.description]] : []),
                    ]}
                    onClose={() => setShowDetail(false)}
                />
            )}
        </div>
    );
}

// 3. ActiveOffersContent (rollo horizontal — inicia en 0, botones Insertar / Ver)
// Sin tarjeta propia: vive dentro del panel único ContextPanels.
function ActiveOffersContent({ onInsert }) {
    const { offers } = useOffers();
    const { hasFeature } = usePlanLimits();
    const offersUnlocked = hasFeature('dynamic_pricing');
    const [selectedOffer, setSelectedOffer] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const activeOffers = useMemo(
        () => offers.filter(o => getOfferStatus(o) === 'active'),
        [offers]
    );

    useEffect(() => {
        if (activeOffers.length > 0) {
            const exists = selectedOffer && activeOffers.some(o => o.id === selectedOffer.id);
            if (!exists) setSelectedOffer(activeOffers[0]);
        } else {
            setSelectedOffer(null);
        }
    }, [activeOffers, selectedOffer]);

    function insertOffer(o) {
        if (!o) return;
        const svc = o.services?.name ? ` en ${o.services.name}` : '';
        onInsert(`¡Tenemos una promoción para ti! ${o.name}: ${money(o.promo_price)}${svc}. Válida hasta el ${shortDate(o.ends_at)}.`);
    }

    const renderCard = (o, isSelected) => o ? (
        <MiniCard
            title={o.name}
            subtitle={`${money(o.promo_price)}${o.services?.name ? ` · ${o.services.name}` : ''}`}
            badge={`vence ${shortDate(o.ends_at)}`}
            badgeClass="text-amber-700 bg-amber-50 border border-amber-200/80"
            isSelected={isSelected}
            selectedClass="bg-gradient-to-br from-amber-50/10 via-white/90 to-white/80 border border-amber-500/15 shadow-[0_6px_15px_rgba(245,158,11,0.06)]"
        />
    ) : '—';

    const actions = (
        <div className="flex items-center justify-center gap-2 mt-1.5 shrink-0">
            <SysButton icon={Plus} label="Insertar oferta" onClick={() => insertOffer(selectedOffer)} />
            <SysButton icon={Eye} label="Ver oferta" onClick={() => setShowDetail(true)} title="Ver detalle de la oferta" />
        </div>
    );

    // Contenido real (plan Enterprise).
    const realContent = activeOffers.length === 0 ? (
        <div className="h-[156px] flex items-center justify-center">
            <p className="text-[11px] font-semibold text-navy-700/40 text-center px-1">Sin ofertas activas</p>
        </div>
    ) : activeOffers.length === 1 ? (
        <>
            <div className="py-1 max-w-[220px] mx-auto w-full h-[116px] flex items-center">{renderCard(activeOffers[0], true)}</div>
            {actions}
        </>
    ) : (
        <>
            <WheelRow
                items={activeOffers}
                selected={selectedOffer}
                displayFn={o => renderCard(o, o?.id === selectedOffer?.id)}
                onSelect={o => setSelectedOffer(o)}
                itemWidth={170}
                height={116}
            />
            {actions}
        </>
    );

    // Mock visual para planes sin ofertas (Pro/Basic): muestra los componentes del
    // panel detrás del candado, sin funcionalidad, para animar al upgrade.
    const mockContent = (
        <>
            <div className="py-1 max-w-[220px] mx-auto w-full h-[116px] flex items-center">
                <MiniCard
                    title="2x1 Corte de Cabello"
                    subtitle="Q80.00 · Corte Clásico"
                    badge="vence 15/5"
                    badgeClass="text-amber-700 bg-amber-50 border border-amber-200/80"
                    isSelected
                    selectedClass="bg-gradient-to-br from-amber-50/10 via-white/90 to-white/80 border border-amber-500/15 shadow-[0_6px_15px_rgba(245,158,11,0.06)]"
                />
            </div>
            {actions}
        </>
    );

    return (
        <div className="relative">
            <div className="relative z-10 flex flex-col">
                <PanelHeader icon={Tag} title="Ofertas activas" count={offersUnlocked ? (activeOffers.length || null) : 1} />
                {offersUnlocked ? realContent : (
                    <FeatureLock feature="dynamic_pricing" requiredPlan="Enterprise">
                        {mockContent}
                    </FeatureLock>
                )}
            </div>
            {showDetail && selectedOffer && (
                <DetailDialog
                    title={selectedOffer.name}
                    subtitle={selectedOffer.services?.name || 'Oferta'}
                    rows={[
                        ['Servicio', selectedOffer.services?.name || '—'],
                        ['Precio promocional', money(selectedOffer.promo_price)],
                        ['Inicio', fullDate(selectedOffer.starts_at)],
                        ['Fin', fullDate(selectedOffer.ends_at)],
                        ...(selectedOffer.description ? [['Descripción', selectedOffer.description]] : []),
                    ]}
                    onClose={() => setShowDetail(false)}
                />
            )}
        </div>
    );
}

// Panel único: junta Ficha del cliente + Servicios activos + Ofertas activas
// en una sola tarjeta de cristal, separadas por un divisor sutil en vez de
// tarjetas independientes — mismo lenguaje "todo flota junto" del resto del
// sistema (Centro IA, etc.).
export function ContextPanels({ patient, windowOpen, hoursLeft, onInsert }) {
    return (
        <div className={`${PANEL} h-full p-4 flex flex-col gap-4`}>
            <PanelGlow />
            <PatientInfoContent patient={patient} windowOpen={windowOpen} hoursLeft={hoursLeft} />
            <div className="relative z-10 h-px bg-navy-900/8 shrink-0" />
            <ActiveServicesContent onInsert={onInsert} />
            <div className="relative z-10 h-px bg-navy-900/8 shrink-0" />
            <ActiveOffersContent onInsert={onInsert} />
        </div>
    );
}

// 4. WhatsAppWindowPanel (estado de la Ventana 24h — el control de IA vive en el composer)
export function WhatsAppWindowPanel({ windowOpen, hoursLeft }) {
    return (
        <div className={`${PANEL} flex flex-col p-3`}>
            <PanelGlow />
            <PanelHeader icon={WhatsApp} title="Ventana 24 horas" />

            <div className="relative z-10 flex items-center justify-between gap-2 mt-2 px-1">
                <span className={`text-[12px] font-bold ${windowOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {windowOpen ? 'Abierta' : 'Cerrada'}
                </span>
                <span className="text-[10px] font-bold text-navy-700/60 tracking-wide text-right">
                    {windowOpen ? `${hoursLeft} h restantes` : 'El cliente debe escribir'}
                </span>
            </div>
        </div>
    );
}
