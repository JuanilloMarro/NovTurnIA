import { useState, useRef, useEffect, Fragment } from 'react';
import { Bot, Hand, Clock, MoreVertical } from 'lucide-react';
import { HEALTH, dealHealth, dealSteps, relativeTime } from '../../hooks/usePipeline';
import DealStepsPopover from './DealStepsPopover';
import DealActionsMenu from './DealActionsMenu';

const initials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// Ficha compacta (altura fija para TODAS, pensada para que quepan 5+ en
// alto de columna): avatar a la izquierda, centrado contra las 2 filas de
// texto de la derecha (nombre/estado/controles arriba, stepper abajo). Antes
// todo el detalle y las acciones vivían escondidos detrás de un hover sobre
// un chip "N/M" — ahora el progreso se ve de un vistazo (stepper de círculos)
// y las acciones son un clic directo en la ficha (3 puntos), no un hover.
export default function DealCard({
    deal, column, draggable = false, onDragStart, onDragEnd,
    canEditSteps = false, onToggleStep,
    canToggleAi = false, onToggleTakeover,
    canViewConversations = false, canViewPatients = false,
}) {
    const health = HEALTH[dealHealth(deal)];
    const steps = dealSteps(deal, column);

    const [showSteps, setShowSteps] = useState(false);
    const [stepsAnchor, setStepsAnchor] = useState(null);
    const closeTimer = useRef(null);

    const openSteps = (e) => {
        clearTimeout(closeTimer.current);
        setStepsAnchor(e.currentTarget.getBoundingClientRect());
        setShowSteps(true);
    };
    // Delay corto para que el cursor pueda viajar del stepper al popover sin
    // que se cierre a mitad de camino.
    const scheduleCloseSteps = () => {
        closeTimer.current = setTimeout(() => setShowSteps(false), 120);
    };
    const cancelCloseSteps = () => clearTimeout(closeTimer.current);

    // Menú de 3 puntos — click, no hover (acción explícita). Se cierra al
    // hacer clic fuera, igual que cualquier dropdown del sistema.
    const [showActions, setShowActions] = useState(false);
    const [actionsAnchor, setActionsAnchor] = useState(null);
    const dotsRef = useRef(null);
    useEffect(() => {
        if (!showActions) return;
        const onDocClick = (e) => {
            if (dotsRef.current?.contains(e.target)) return;
            setShowActions(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [showActions]);

    const hasActions = canViewConversations || canViewPatients || !!deal.appointment_id;

    const meta = deal.date_start
        ? `${new Date(deal.date_start).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', timeZone: 'America/Guatemala' })} · ${deal.service_name || 'Turno'}`
        : (deal.service_name || deal.phone || 'Sin turno');

    return (
        <div
            id={`deal-card-${deal.deal_id}`}
            draggable={draggable}
            onDragStart={draggable ? (e) => onDragStart?.(e, deal.deal_id) : undefined}
            onDragEnd={draggable ? (e) => onDragEnd?.(e, deal.deal_id) : undefined}
            className={`relative w-full flex items-center gap-2.5 p-2 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-2xl shadow-md overflow-hidden transition-all duration-200 group/card hover:bg-white/60 ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
            {/* Avatar — hijo directo de la raíz junto al bloque de contenido:
                `items-center` de la raíz lo centra verticalmente contra TODO
                el alto de las 2 filas de texto, no solo contra la primera. */}
            <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border bg-gradient-to-b from-white to-gray-100 border-gray-200/60 text-navy-900 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] group-hover/card:to-gray-200 group-hover/card:border-gray-200 transition-colors">
                {initials(deal.display_name)}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1">
                {/* Fila 1 — nombre/estado a la izquierda, controles pegados a
                    la esquina superior derecha de la ficha (sin fila propia). */}
                <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-navy-900 text-[12px] leading-tight truncate min-w-0">
                        {deal.display_name}
                    </h4>
                    {/* Badge explícito de salud — un punto de color no decía QUÉ
                        significaba (en curso/detenido/se cayó/logrado) */}
                    <span className={`shrink-0 text-[8px] font-bold leading-none px-1.5 py-[3px] rounded-full border whitespace-nowrap ${health.badgeBg} ${health.badgeBorder} ${health.badgeText}`}>
                        {health.label}
                    </span>

                    <div className="flex-1" />

                    {/* Tomar control — identificador explícito de quién está
                        llevando al cliente (IA vs. humano), y la acción para
                        cambiarlo en un clic. Reusa human_takeover (mismo campo
                        que Conversaciones/Turnos) para no duplicar estado. */}
                    <button
                        onClick={() => canToggleAi && onToggleTakeover?.(deal)}
                        disabled={!canToggleAi}
                        title={deal.human_takeover
                            ? 'Intervención humana activa — clic para reactivar la IA'
                            : 'La IA está llevando la conversación — clic para tomar control'}
                        className={`shrink-0 flex items-center gap-1 h-5 px-1.5 rounded-full border text-[9px] font-bold transition-colors ${deal.human_takeover
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-white/50 border-white/70 text-navy-700/45'} ${canToggleAi ? 'hover:brightness-95 cursor-pointer' : 'cursor-default opacity-70'}`}
                    >
                        {deal.human_takeover ? <Hand size={9} strokeWidth={2.5} /> : <Bot size={9} strokeWidth={2.5} />}
                        {deal.human_takeover ? 'Tú' : 'IA'}
                    </button>

                    {hasActions && (
                        <button
                            ref={dotsRef}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActionsAnchor(dotsRef.current.getBoundingClientRect());
                                setShowActions(v => !v);
                            }}
                            title="Más acciones"
                            className="shrink-0 -mr-0.5 w-5 h-5 rounded-full flex items-center justify-center text-navy-700/40 hover:bg-white/80 hover:text-navy-900 transition-colors"
                        >
                            <MoreVertical size={12} strokeWidth={2.5} />
                        </button>
                    )}

                    {showActions && (
                        <DealActionsMenu
                            anchorRect={actionsAnchor}
                            onClose={() => setShowActions(false)}
                            patientId={deal.patient_id}
                            appointmentId={deal.appointment_id}
                            canViewConversations={canViewConversations}
                            canViewPatients={canViewPatients}
                        />
                    )}
                </div>

                <div className="text-[10px] font-bold text-navy-700/50 truncate">{meta}</div>

                {/* Fila 2 — stepper de progreso, abarca casi todo el ancho
                    disponible (las líneas entre puntos son flex-1). Reemplaza
                    el chip "N/M"; el detalle de cada paso sigue viviendo en el
                    popover, ahora disparado desde aquí. */}
                <div className="relative flex items-center gap-2" onMouseEnter={openSteps} onMouseLeave={scheduleCloseSteps}>
                    <div className="flex items-center flex-1 min-w-0">
                        {steps.map((s, i) => (
                            <Fragment key={s.key}>
                                {i > 0 && (
                                    <span className={`flex-1 h-[2px] mx-0.5 rounded-full ${steps[i - 1].done ? 'bg-emerald-400/70' : 'bg-navy-700/15'}`} />
                                )}
                                <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${s.done ? 'bg-emerald-500' : 'bg-white border border-navy-700/20'}`}
                                />
                            </Fragment>
                        ))}
                    </div>
                    {deal.last_activity_at && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-navy-700/35 shrink-0">
                            <Clock size={8} className="shrink-0" /> {relativeTime(deal.last_activity_at)}
                        </span>
                    )}

                    {showSteps && (
                        <DealStepsPopover
                            anchorRect={stepsAnchor}
                            title={`Pasos · ${column?.title || ''}`}
                            steps={steps}
                            dealId={deal.deal_id}
                            canEdit={canEditSteps}
                            onToggleStep={onToggleStep}
                            onMouseEnter={cancelCloseSteps}
                            onMouseLeave={scheduleCloseSteps}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
