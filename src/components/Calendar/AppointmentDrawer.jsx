import { useNavigate } from 'react-router-dom';
import { cancelAppointment, confirmAppointment } from '../../services/supabaseService';
import { X, ChevronLeft, Calendar as CalendarIcon, Clock, MessageSquare, Trash2, ChevronDown } from 'lucide-react';
import { formatPhone } from '../../utils/format';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AppointmentDrawer({ appointment, onClose, onUpdated }) {
    const navigate = useNavigate();
    if (!appointment) return null;
    const { id, date_start, date_end, status, confirmed, users } = appointment;

    const statusLabel = status === 'cancelled' ? 'cancelled' : confirmed ? 'confirmed' : 'pending';

    async function handleCancel() {
        if (!confirm('¿Cancelar este turno?')) return;
        await cancelAppointment(id);
        onUpdated?.();
        onClose();
    }

    async function handleConfirm() {
        await confirmAppointment(id);
        onUpdated?.();
    }

    return (
        <div className="absolute top-2 right-2 bottom-2 w-[360px] bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] z-50 flex flex-col animate-drawer-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 p-4 bg-white/20 border-b border-white/40 backdrop-blur-md">
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-sm text-center">Detalle del turno</h3>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                    <X size={16} />
                </button>
            </div>

            {/* Content scrolleable - but without scrolling */}
            <div className="flex-1 overflow-hidden px-5 py-4 flex flex-col justify-between">
                <div>
                    {/* Paciente hero */}
                <div className="flex items-center gap-3 mb-6 bg-white/30 p-3 rounded-2xl border border-white/50 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-amber-700/90 flex items-center justify-center text-white text-base font-bold shadow-sm border border-white/50">
                        {getInitials(users?.display_name)}
                    </div>
                    <div className="overflow-hidden">
                        <div className="font-bold text-navy-900 text-base truncate">{users?.display_name || 'Sin nombre'}</div>
                        <div className="text-navy-700/80 font-semibold tracking-wide text-xs truncate">{formatPhone(appointment.user_id)}</div>
                    </div>
                </div>

                {/* Secciones */}
                <div className="space-y-6">
                    {/* Fecha y hora */}
                    <div className="bg-white/30 p-4 rounded-2xl border border-white/50 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <h4 className="text-[10px] font-bold text-navy-800 uppercase tracking-widest leading-none">Fecha y hora</h4>
                            <div className="flex-1 h-px bg-navy-900/10"></div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center shrink-0">
                                    <CalendarIcon size={18} />
                                </div>
                                <div className="pt-0.5">
                                    <div className="text-xs font-semibold text-gray-400 mb-0.5">Fecha</div>
                                    <div className="font-semibold text-navy-900 text-[15px]">
                                        {new Date(date_start).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guatemala' })
                                            .replace(/^\w/, (c) => c.toUpperCase())}
                                    </div>
                                </div>
                            </div>

                            <div className="w-full border-b border-dashed border-gray-200 ml-[56px] w-[calc(100%-56px)]"></div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center shrink-0">
                                    <Clock size={18} />
                                </div>
                                <div className="pt-0.5">
                                    <div className="text-xs font-semibold text-gray-400 mb-0.5">Horario</div>
                                    <div className="font-semibold text-navy-900 text-[15px]">
                                        {new Date(date_start).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true })}
                                        {' — '}
                                        {new Date(date_end).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>

            {/* Footer de Acciones fijo abajo */}
            <div className="bg-white/30 backdrop-blur-2xl border-t border-white/50 p-4 space-y-3 mt-auto flex flex-col items-center">
                <button
                    onClick={() => navigate(`/conversations?patient=${appointment.user_id}`)}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-white/80 text-navy-900 text-xs font-bold rounded-full shadow-card hover:bg-white/80 transition-colors"
                >
                    <MessageSquare size={14} /> Ver conversación WhatsApp
                </button>
                {status === 'active' && (
                    <button onClick={handleCancel}
                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-white/80 text-red-600 text-xs font-bold rounded-full shadow-card hover:bg-white/80 transition-colors"
                    >
                        <Trash2 size={14} /> Cancelar turno
                    </button>
                )}
            </div>
        </div>
    );
}
