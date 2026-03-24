import { useNavigate } from 'react-router-dom';
import { setHumanTakeover, cancelAppointment, confirmAppointment } from '../../services/supabaseService';
import { X, ChevronLeft, Calendar as CalendarIcon, Clock, MessageCircle, Trash2, Bot, Check, Pencil } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import EditAppointmentModal from './EditAppointmentModal';
import AIStar from '../Icons/AIStar';
import { formatPhone } from '../../utils/format';
import { showSuccessToast, showBotToast } from '../../store/useToastStore';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AppointmentDrawer({ appointment, onClose, onUpdated }) {
    const navigate = useNavigate();
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [canceling, setCanceling] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [botPaused, setBotPaused] = useState(appointment?.patients?.human_takeover || false);

    if (!appointment) return null;
    const { id, date_start, date_end, status, confirmed, patients } = appointment;

    const statusLabel = status === 'cancelled' ? 'cancelled' : confirmed ? 'confirmed' : 'pending';

    async function handleCancel() {
        setCanceling(true);
        try {
            await cancelAppointment(id);
            onUpdated?.();
            onClose();
        } catch (error) {
            alert('Error al cancelar: ' + error.message);
        } finally {
            setCanceling(false);
            setShowCancelConfirm(false);
        }
    }

    async function handleConfirm() {
        await confirmAppointment(id);
        onUpdated?.();
    }

    return (
        <div className="absolute top-2 right-2 bottom-2 w-[360px] bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] z-50 flex flex-col animate-drawer-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 p-4">
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-sm text-center">Detalle del turno</h3>
                <div className="w-7 h-7" />
            </div>

            {/* Content scrolleable - but without scrolling */}
            <div className="flex-1 overflow-hidden px-5 py-4 flex flex-col justify-between">
                <div>
                    {/* Paciente hero */}
                    {/* Paciente hero */}
                    <div className="flex items-center gap-3 mb-6 px-1">
                        <div className="w-12 h-12 rounded-full bg-navy-900 flex items-center justify-center text-white text-base font-bold border border-white/20 shadow-md">
                            {getInitials(patients?.display_name)}
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-bold text-navy-900 text-base truncate">{patients?.display_name || 'Sin nombre'}</div>
                        </div>
                    </div>

                    {/* Secciones */}
                    <div className="space-y-6 px-1">
                        {/* Fecha y hora */}
                        <div>
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
            <div className="p-4 mt-auto">
                <div className="flex items-center justify-center gap-2">
                    {/* 1. Conversación */}
                    <button
                        onClick={() => navigate(`/conversations?patient=${appointment.patient_id}`)}
                        className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-card hover:bg-white/80 transition-all duration-300 overflow-hidden"
                    >
                        <MessageCircle size={14} className="shrink-0" />
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">Conversación</span>
                    </button>

                    {/* 2. IA (Bot Toggle) */}
                    {appointment.patients && (
                        <button
                            onClick={async () => {
                                const newValue = !appointment.patients.human_takeover;
                                try {
                                    await setHumanTakeover(appointment.patient_id, newValue);
                                    setBotPaused(newValue);
                                    if (appointment.patients) appointment.patients.human_takeover = newValue;
                                    onUpdated?.();
                                } catch (err) {
                                    alert('Error al actualizar bot: ' + err.message);
                                }
                            }}
                            className={`group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 border text-[11px] font-bold rounded-full shadow-card transition-all duration-300 overflow-hidden ${botPaused
                                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                : 'bg-white border-white/80 text-navy-900 hover:bg-white/80'
                                }`}
                        >
                            <div className="relative shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                <Bot size={13} />
                                <AIStar
                                    size={7}
                                    className={`absolute -top-1 -left-1 animate-pulse ${botPaused ? 'text-amber-500' : 'text-navy-900'}`}
                                    strokeWidth={2.5}
                                />
                            </div>
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap ml-0 group-hover:ml-0">
                                {botPaused ? 'Reactivar IA' : 'Pausar IA'}
                            </span>
                        </button>
                    )}

                    {/* 3. Editar */}
                    <button onClick={() => setShowEdit(true)}
                        className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-navy-800 text-[11px] font-bold rounded-full shadow-card hover:bg-white/80 transition-all duration-300 overflow-hidden"
                    >
                        <Pencil size={14} className="shrink-0" />
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">Editar</span>
                    </button>

                    {/* 4. Eliminar */}
                    {['scheduled', 'confirmed'].includes(status) && (
                        <button onClick={() => setShowCancelConfirm(true)}
                            className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-red-600 text-[11px] font-bold rounded-full shadow-card hover:bg-white/80 transition-all duration-300 overflow-hidden"
                        >
                            <Trash2 size={14} className="shrink-0" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[90px] transition-all duration-300 whitespace-nowrap">Eliminar</span>
                        </button>
                    )}
                </div>
            </div>


            {/* Cancel Confirmation */}
            {showCancelConfirm && createPortal(
                <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white/30 backdrop-blur-xl border border-white/50 p-6 animate-fade-up shadow-[0_8px_32px_rgba(26,58,107,0.15)] rounded-[32px]">
                        <p className="text-sm font-bold text-navy-900 text-center mb-1">¿Eliminar turno?</p>
                        <p className="text-xs text-navy-700/70 text-center mb-5 px-4">Esta acción no se puede deshacer. El turno pasará a estado cancelado.</p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/40 border border-white/60 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm min-w-[100px]"
                            >
                                <X size={13} /> Volver
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={canceling}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-500/80 border border-rose-400 text-white text-[11px] font-bold rounded-full hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50 min-w-[100px]"
                            >
                                <Trash2 size={13} /> {canceling ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showEdit && (
                <EditAppointmentModal
                    appointment={appointment}
                    onClose={() => setShowEdit(false)}
                    onUpdated={() => {
                        setShowEdit(false);
                        onUpdated?.();
                    }}
                />
            )}
        </div>
    );
}
