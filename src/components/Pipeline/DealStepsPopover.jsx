import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Check, Bot, MessageCircle, User, CalendarCheck } from 'lucide-react';

// Portal en document.body — necesario porque el trigger vive dentro de una
// columna con overflow-y-auto: un popover posicionado en CSS normal se
// recortaría en el borde de la columna en vez de flotar por encima (mismo
// tipo de bug que ya se vio con los drawers de esta app).
//
// El ícono de la izquierda es SIEMPRE de solo lectura (cambia de estilo solo
// cuando el paso se completa, sea de IA o humano). El checkbox va aparte, a la
// derecha, chico y discreto — aparece en TODO paso con `stepId` (o sea, todo
// menos "Turno agendado" y "Encuesta respondida"): la secretaria puede marcar
// a mano incluso pasos que normalmente hace la IA, para cuando ella misma
// toma el rumbo del cliente (llama, ofrece la promo, confirma por teléfono)
// y ese contacto no pasó por WhatsApp.
//
// Footer de 3 accesos directos (Chat/Perfil/Turno): antes la ficha entera
// navegaba al perfil con un click, pero eso significaba que un mal tecleo o
// clic accidental te sacaba del Pipeline sin querer. Ahora la ficha no
// navega a ningún lado — estos 3 botones explícitos son la ÚNICA forma de
// salir del módulo desde aquí. "Turno" reusa el deep-link de Seguimiento
// (`getAppointmentById`, sin filtrar por estado) porque hoy es el único que
// sabe abrir el detalle de un turno específico por id — sirve igual para un
// turno programado que para uno de recuperación.
export default function DealStepsPopover({
    anchorRect, title, steps, dealId, canEdit, onToggleStep, onMouseEnter, onMouseLeave,
    patientId, appointmentId, canViewConversations = false, canViewPatients = false,
}) {
    const navigate = useNavigate();
    if (!anchorRect) return null;

    const width = 250;
    const gap = 8;
    const overflowsRight = anchorRect.right + gap + width > window.innerWidth - 8;
    const left = overflowsRight
        ? Math.max(8, anchorRect.left - width - gap)
        : anchorRect.right + gap;
    const hasFooter = (canViewConversations || canViewPatients || appointmentId);
    const maxTop = window.innerHeight - 8 - (32 + steps.length * 40 + (hasFooter ? 44 : 0));
    const top = Math.min(Math.max(8, anchorRect.top - 8), Math.max(8, maxTop));

    return createPortal(
        <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            // React hace burbujear los eventos de un portal por el árbol de
            // REACT (donde este popover SÍ es hijo de la ficha), no por el DOM
            // real (donde vive suelto en <body>) — este corte evita que un
            // clic aquí dentro arrastre cualquier handler futuro de la ficha
            // (drag/drop, etc.), aunque hoy la ficha ya no tiene onClick propio.
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top, left, width }}
            className="z-[300] bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md p-2 animate-fade-up"
        >
            <p className="text-[10px] font-bold text-navy-700/50 px-3 pt-1.5 pb-1.5 tracking-wide">{title}</p>
            <div className="space-y-0.5">
                {steps.map((s) => {
                    const Icon = s.icon;
                    const isCheckable = !!s.stepId;
                    return (
                        <div key={s.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-2xl">
                            {/* Ícono — siempre de solo lectura, cambia de estilo al completarse */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${s.done ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-white/50 border-white/70 text-navy-700/30'}`}>
                                <Icon size={13} strokeWidth={2.5} />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                    <p className={`text-[11px] font-bold leading-tight truncate ${s.done ? 'text-navy-900' : 'text-navy-700/40'}`}>
                                        {s.label}
                                    </p>
                                    {s.source === 'ai' && (
                                        <span title="Lo hace la IA por WhatsApp" className="shrink-0 flex items-center gap-0.5 text-navy-700/35">
                                            <Bot size={9} />
                                        </span>
                                    )}
                                </div>
                                <p className="text-[9px] font-semibold text-navy-700/40 truncate">
                                    {s.done ? (s.meta || 'Hecho') : (isCheckable ? 'Marcar cuando se haga' : 'Pendiente')}
                                </p>
                            </div>

                            {/* Checkbox — todo paso marcable, a la derecha, chico y discreto
                                (no compite visualmente con el ícono de la izquierda) */}
                            {isCheckable && (
                                <label className={`shrink-0 flex items-center ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`} title={s.done ? 'Marcado' : 'Marcar como hecho'}>
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={s.done}
                                        disabled={!canEdit}
                                        onChange={(e) => onToggleStep?.(dealId, s.stepId, e.target.checked)}
                                    />
                                    <span className={`w-[17px] h-[17px] rounded-full border flex items-center justify-center transition-colors ${s.done ? 'border-emerald-400/70 bg-emerald-50/80' : 'border-navy-700/25 bg-white/40'} ${canEdit ? 'peer-hover:border-emerald-400/70' : ''}`}>
                                        <Check size={9} strokeWidth={3} className={`text-emerald-600/80 transition-transform duration-150 ${s.done ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                                    </span>
                                </label>
                            )}
                        </div>
                    );
                })}
            </div>

            {hasFooter && (
                <div className="flex items-center justify-center gap-1.5 px-1 pt-2 mt-1 border-t border-white/40">
                    {canViewConversations && (
                        <button
                            onClick={() => navigate(`/conversations?patient=${patientId}`)}
                            className="relative overflow-hidden group/btn flex items-center justify-center gap-0 hover:gap-1 px-2 hover:px-2.5 py-1.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[10px] font-bold rounded-full shadow-sm hover:bg-white/70 transition-all duration-300"
                        >
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full blur-xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.06)' }} />
                            <MessageCircle size={12} strokeWidth={2.5} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover/btn:max-w-[40px] transition-all duration-300 whitespace-nowrap relative z-10">Chat</span>
                        </button>
                    )}
                    {canViewPatients && (
                        <button
                            onClick={() => navigate(`/patients?id=${patientId}`)}
                            className="relative overflow-hidden group/btn flex items-center justify-center gap-0 hover:gap-1 px-2 hover:px-2.5 py-1.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[10px] font-bold rounded-full shadow-sm hover:bg-white/70 transition-all duration-300"
                        >
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full blur-xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.06)' }} />
                            <User size={12} strokeWidth={2.5} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover/btn:max-w-[45px] transition-all duration-300 whitespace-nowrap relative z-10">Perfil</span>
                        </button>
                    )}
                    {appointmentId && (
                        <button
                            onClick={() => navigate(`/followup?apt=${appointmentId}`)}
                            className="relative overflow-hidden group/btn flex items-center justify-center gap-0 hover:gap-1 px-2 hover:px-2.5 py-1.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[10px] font-bold rounded-full shadow-sm hover:bg-white/70 transition-all duration-300"
                        >
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full blur-xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.06)' }} />
                            <CalendarCheck size={12} strokeWidth={2.5} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover/btn:max-w-[40px] transition-all duration-300 whitespace-nowrap relative z-10">Turno</span>
                        </button>
                    )}
                </div>
            )}
        </div>,
        document.body,
    );
}
