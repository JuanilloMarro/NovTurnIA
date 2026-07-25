import { createPortal } from 'react-dom';
import { Check, Bot } from 'lucide-react';

// Portal en document.body — necesario porque el trigger vive dentro de una
// columna con overflow-y-auto: un popover posicionado en CSS normal se
// recortaría en el borde de la columna en vez de flotar por encima (mismo
// tipo de bug que ya se vio con los drawers de esta app).
//
// El ícono de la izquierda es SIEMPRE de solo lectura (cambia de estilo solo
// cuando el paso se completa, sea de IA o humano). El checkbox va aparte, a la
// derecha, chico y discreto — solo en los pasos humanos, porque hoy NINGÚN
// motor de n8n hace esas llamadas/recordatorios: los marca el staff.
export default function DealStepsPopover({ anchorRect, title, steps, dealId, canEdit, onToggleStep, onMouseEnter, onMouseLeave }) {
    if (!anchorRect) return null;

    const width = 250;
    const gap = 8;
    const overflowsRight = anchorRect.right + gap + width > window.innerWidth - 8;
    const left = overflowsRight
        ? Math.max(8, anchorRect.left - width - gap)
        : anchorRect.right + gap;
    const maxTop = window.innerHeight - 8 - (32 + steps.length * 40);
    const top = Math.min(Math.max(8, anchorRect.top - 8), Math.max(8, maxTop));

    return createPortal(
        <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            // React hace burbujear los eventos de un portal por el árbol de
            // REACT (donde este popover SÍ es hijo de la ficha), no por el DOM
            // real (donde vive suelto en <body>) — sin este corte, clickear el
            // checkbox también dispara el onClick de la tarjeta (abre el perfil).
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top, left, width }}
            className="z-[300] bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md p-2 animate-fade-up"
        >
            <p className="text-[10px] font-bold text-navy-700/50 px-3 pt-1.5 pb-1.5 tracking-wide">{title}</p>
            <div className="space-y-0.5">
                {steps.map((s) => {
                    const Icon = s.icon;
                    const isHuman = s.source === 'human';
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
                                    {s.done ? (s.meta || 'Hecho') : (isHuman ? 'Marcar cuando se haga' : 'Pendiente')}
                                </p>
                            </div>

                            {/* Checkbox — solo pasos humanos, a la derecha, chico y discreto
                                (no compite visualmente con el ícono de la izquierda) */}
                            {isHuman && (
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
        </div>,
        document.body,
    );
}
