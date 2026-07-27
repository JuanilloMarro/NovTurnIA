import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, User, CalendarCheck } from 'lucide-react';

// Portal en document.body por la misma razón que DealStepsPopover: el
// trigger (los 3 puntos) vive dentro de una columna con overflow-y-auto.
// Antes estos 3 accesos vivían como footer del popover de pasos (solo
// aparecían al pasar el hover sobre el chip "N/M"); ahora son un menú propio
// detrás de un botón explícito en la ficha — acción directa en un clic, sin
// depender de hover.
export default function DealActionsMenu({ anchorRect, onClose, patientId, appointmentId, canViewConversations, canViewPatients }) {
    const navigate = useNavigate();
    if (!anchorRect) return null;

    const width = 172;
    const gap = 6;
    const overflowsRight = anchorRect.right + gap > window.innerWidth - width - 8;
    const left = overflowsRight ? Math.max(8, anchorRect.right - width) : anchorRect.left;
    const rowCount = (canViewConversations ? 1 : 0) + (canViewPatients ? 1 : 0) + (appointmentId ? 1 : 0);
    const top = Math.min(anchorRect.bottom + gap, window.innerHeight - 8 - (rowCount * 34 + 12));

    const go = (path) => { onClose(); navigate(path); };

    return createPortal(
        <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top, left, width }}
            className="z-[300] bg-white/70 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-md p-1.5 animate-fade-up"
        >
            {canViewConversations && (
                <button
                    onClick={() => go(`/conversations?patient=${patientId}`)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-bold text-navy-900 hover:bg-white/70 transition-colors"
                >
                    <MessageCircle size={13} strokeWidth={2.5} className="text-navy-700/50" /> Ver chat
                </button>
            )}
            {canViewPatients && (
                <button
                    onClick={() => go(`/patients?id=${patientId}`)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-bold text-navy-900 hover:bg-white/70 transition-colors"
                >
                    <User size={13} strokeWidth={2.5} className="text-navy-700/50" /> Ver perfil
                </button>
            )}
            {appointmentId && (
                <button
                    onClick={() => go(`/followup?apt=${appointmentId}`)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-bold text-navy-900 hover:bg-white/70 transition-colors"
                >
                    <CalendarCheck size={13} strokeWidth={2.5} className="text-navy-700/50" /> Ver turno
                </button>
            )}
        </div>,
        document.body,
    );
}
