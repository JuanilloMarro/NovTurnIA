import { useState, useRef } from 'react';
import { Hand, Clock, ListChecks } from 'lucide-react';
import { HEALTH, dealHealth, dealSteps, relativeTime } from '../../hooks/usePipeline';
import DealStepsPopover from './DealStepsPopover';

const initials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// Ficha compacta (~62px, altura fija para TODAS) — el detalle de pasos ya NO
// se muestra dentro de la ficha (eso obligaba a un swap incómodo). Ahora vive
// en un popover flotante (DealStepsPopover) que aparece al pasar el mouse
// sobre el chip "N/M" — como el indicador de actividades de Pipedrive.
export default function DealCard({ deal, column, draggable = false, onDragStart, onDragEnd, canEditSteps = false, onToggleStep, canViewConversations = false, canViewPatients = false }) {
    const health = HEALTH[dealHealth(deal)];
    const steps = dealSteps(deal, column);
    const done = steps.filter(s => s.done).length;

    const [showSteps, setShowSteps] = useState(false);
    const [anchorRect, setAnchorRect] = useState(null);
    const closeTimer = useRef(null);

    const openPopover = (e) => {
        clearTimeout(closeTimer.current);
        setAnchorRect(e.currentTarget.getBoundingClientRect());
        setShowSteps(true);
    };
    // Delay corto para que el cursor pueda viajar del chip al popover sin que
    // se cierre a mitad de camino.
    const scheduleClose = () => {
        closeTimer.current = setTimeout(() => setShowSteps(false), 120);
    };
    const cancelClose = () => clearTimeout(closeTimer.current);

    const meta = deal.date_start
        ? `${new Date(deal.date_start).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', timeZone: 'America/Guatemala' })} · ${deal.service_name || 'Turno'}`
        : (deal.service_name || deal.phone || 'Sin turno');

    return (
        <div
            id={`deal-card-${deal.deal_id}`}
            draggable={draggable}
            onDragStart={draggable ? (e) => onDragStart?.(e, deal.deal_id) : undefined}
            onDragEnd={draggable ? (e) => onDragEnd?.(e, deal.deal_id) : undefined}
            className={`relative w-full flex items-center gap-2.5 p-2.5 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-2xl shadow-md overflow-hidden transition-all duration-200 text-left group/card hover:bg-white/60 ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >

            <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border bg-gradient-to-b from-white to-gray-100 border-gray-200/60 text-navy-900 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] group-hover/card:to-gray-200 group-hover/card:border-gray-200 transition-colors">
                {initials(deal.display_name)}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-navy-900 text-[12px] leading-tight truncate min-w-0">
                        {deal.display_name}
                    </h4>
                    {/* Badge explícito de salud — un punto de color no decía QUÉ
                        significaba (en curso/detenido/se cayó/logrado) */}
                    <span className={`shrink-0 text-[8px] font-bold leading-none px-1.5 py-[3px] rounded-full border whitespace-nowrap ${health.badgeBg} ${health.badgeBorder} ${health.badgeText}`}>
                        {health.label}
                    </span>
                    {deal.human_takeover && (
                        <Hand size={9} className="text-rose-600 shrink-0" strokeWidth={2.5} />
                    )}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-navy-700/50 mt-0.5">
                    <span className="truncate">{meta}</span>
                </div>
            </div>

            {/* Trigger del popover de pasos — hover, no click. La ficha entera
                ya NO navega a ningún lado (un mal tecleo/clic accidental
                mandaba a otro módulo sin querer); ahora los 3 destinos viven
                como botones explícitos dentro del popover. */}
            <div
                className="relative shrink-0 flex flex-col items-end gap-0.5"
                onMouseEnter={openPopover}
                onMouseLeave={scheduleClose}
            >
                <span className="flex items-center gap-1 bg-white/60 border border-white/70 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-navy-700/60 tabular-nums">
                    <ListChecks size={9} />
                    {done}/{steps.length}
                </span>
                {deal.last_activity_at && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-navy-700/35">
                        <Clock size={8} /> {relativeTime(deal.last_activity_at)}
                    </span>
                )}

                {showSteps && (
                    <DealStepsPopover
                        anchorRect={anchorRect}
                        title={`Pasos · ${column?.title || ''}`}
                        steps={steps}
                        dealId={deal.deal_id}
                        canEdit={canEditSteps}
                        onToggleStep={onToggleStep}
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                        patientId={deal.patient_id}
                        appointmentId={deal.appointment_id}
                        canViewConversations={canViewConversations}
                        canViewPatients={canViewPatients}
                    />
                )}
            </div>
        </div>
    );
}
