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
        <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-white border-l border-gray-100 shadow-2xl z-50 flex flex-col animate-drawer-in">
            {/* Header */}
            <div className="flex items-center gap-3 p-5 bg-gray-50/50 border-b border-gray-100">
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-navy-700 hover:bg-gray-50 transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight">Detalle del turno</h3>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-navy-50 text-navy-700 hover:bg-navy-100 transition-colors">
                    <X size={16} />
                </button>
            </div>

            {/* Content scrolleable */}
            <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
                {/* Paciente hero */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-full bg-amber-700 flex items-center justify-center text-white text-lg font-bold shadow-sm">
                        {getInitials(users?.display_name)}
                    </div>
                    <div>
                        <div className="font-bold text-navy-900 text-lg">{users?.display_name || 'Sin nombre'}</div>
                        <div className="text-gray-500 font-medium tracking-wide text-sm">{formatPhone(appointment.user_id)}</div>
                    </div>
                </div>

                {/* Secciones */}
                <div className="space-y-8">
                    {/* Fecha y hora */}
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Fecha y hora</h4>
                            <div className="flex-1 h-px bg-gray-100"></div>
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

                    {/* Estado */}
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Estado</h4>
                            <div className="flex-1 h-px bg-gray-100"></div>
                        </div>

                        <div className="space-y-4">
                            <div className="relative w-48">
                                <select
                                    className="w-full appearance-none bg-white border border-gray-200 text-gray-700 font-medium rounded-full px-4 py-2.5 outline-none focus:border-navy-500 transition-colors shadow-sm"
                                    value={status === 'cancelled' ? 'cancelado' : 'activo'}
                                    disabled
                                >
                                    <option value="activo">Activo</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-navy-900">
                                    <ChevronDown size={16} />
                                </div>
                            </div>

                            <div className="space-y-3 mt-6">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-gray-500 text-sm">Notificado 24hs</span>
                                    <span className="text-sm font-bold text-gray-400 flex items-center gap-1">
                                        <X size={14} className="stroke-[3px]" /> No
                                    </span>
                                </div>
                                <div className="w-full border-b border-dashed border-gray-200"></div>
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-gray-500 text-sm">Confirmado</span>
                                    <span className={`text-sm font-bold flex items-center gap-1 ${confirmed ? 'text-emerald-500' : 'text-gray-400'}`}>
                                        {confirmed ? '✓ Sí' : <><X size={14} className="stroke-[3px]" /> No</>}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer de Acciones fijo abajo */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-5 space-y-3 z-10">
                <button
                    onClick={() => navigate(`/conversations?patient=${appointment.user_id}`)}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-navy-700 font-semibold py-3 rounded-full hover:bg-navy-50 transition-colors shadow-sm text-sm"
                >
                    <MessageSquare size={16} /> Ver conversación WhatsApp
                </button>
                {status === 'active' && (
                    <button onClick={handleCancel}
                        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-semibold py-3 rounded-full hover:bg-red-100 transition-colors text-sm">
                        <Trash2 size={16} /> Cancelar turno
                    </button>
                )}
            </div>
        </div>
    );
}
