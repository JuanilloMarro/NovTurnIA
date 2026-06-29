import { useNavigate } from 'react-router-dom';
import { setHumanTakeover, cancelAppointment, confirmAppointment, scheduledAppointment, markNoShow, deleteAppointment, markAsRescheduled, getAppointmentIncome, confirmServiceDelivery } from '../../services/supabaseService';
import { X, ChevronLeft, Calendar as CalendarIcon, Clock, MessageCircle, Trash2, Bot, Check, Pencil, Circle, Phone, UserX, RotateCcw, Tag, User, Wallet } from 'lucide-react';
import { formatDuration } from '../../pages/Settings';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import EditAppointmentModal from './EditAppointmentModal';
import NewAppointmentModal from './NewAppointmentModal';
import ConfirmDeliveryModal from '../Finance/ConfirmDeliveryModal';
import AIStar from '../Icons/AIStar';
import { formatPhone } from '../../utils/format';
import { showAptNoShowToast, showAptCancelToast, showAptConfirmToast, showAptPendingToast, showBotPauseToast, showBotReactivateToast, showErrorToast, showSuccessToast } from '../../store/useToastStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useVisiblePatients } from '../../hooks/useVisiblePatients';
import { useAppStore } from '../../store/useAppStore';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AppointmentDrawer({ appointment, onClose, onUpdated, variant }) {
    const navigate = useNavigate();
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [canceling, setCanceling] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showReschedule, setShowReschedule] = useState(false);
    const [markingNoShow, setMarkingNoShow] = useState(false);
    const humanTakeoverMap = useAppStore(s => s.humanTakeoverMap);
    const setPatientTakeover = useAppStore(s => s.setPatientTakeover);
    const patientId = appointment?.patient_id;
    const botPaused = patientId in humanTakeoverMap
        ? humanTakeoverMap[patientId]
        : (appointment?.patients?.human_takeover || false);

    const { canViewConversations, canToggleAi, canEditAppointments, canRescheduleAppointments, canConfirmAppointments, canSetPending, canMarkNoShow, canDeleteAppointments, canConfirmDelivery } = usePermissions();
    // M-010: si el paciente está fuera del top-N del plan (basic/pro) ocultamos
    // el acceso a su perfil y a su chat — la cita sigue visible en calendario,
    // pero el negocio no puede llegar al detalle hasta subir de plan.
    const { isPatientVisible } = useVisiblePatients();
    const patientWithinPlan = isPatientVisible(patientId);

    // Finanzas: ingreso confirmado de este turno (entrega del servicio)
    const [deliveredIncome, setDeliveredIncome] = useState(null);
    const [showDeliver, setShowDeliver] = useState(false);

    useEffect(() => {
        let alive = true;
        setDeliveredIncome(null);
        if (!appointment?.id || !canConfirmDelivery) return;
        getAppointmentIncome(appointment.id)
            .then(d => { if (alive) setDeliveredIncome(d); })
            .catch(() => { });
        return () => { alive = false; };
    }, [appointment?.id, canConfirmDelivery]);

    if (!appointment) return null;
    const { id, date_start, date_end, status, confirmed, patients } = appointment;

    const statusLabel = status === 'cancelled' ? 'cancelled' : status === 'no_show' ? 'no_show' : confirmed ? 'confirmed' : 'pending';

    async function handleNoShow() {
        setMarkingNoShow(true);
        try {
            await markNoShow(id);
            showAptNoShowToast(patients?.display_name || 'Cliente');
            onUpdated?.();
        } catch (err) {
            showErrorToast('Error al registrar', err.message);
        } finally {
            setMarkingNoShow(false);
        }
    }

    async function handleCancel() {
        setCanceling(true);
        try {
            await cancelAppointment(id);
            showAptCancelToast(patients?.display_name || 'Cliente');
            onUpdated?.();
            onClose();
        } catch (error) {
            showErrorToast('Error al cancelar', error.message);
        } finally {
            setCanceling(false);
            setShowCancelConfirm(false);
        }
    }

    async function handleConfirm() {
        try {
            await confirmAppointment(id);
            showAptConfirmToast(patients?.display_name);
            onUpdated?.();
        } catch (error) {
            showErrorToast('Error al confirmar', error.message);
        }
    }

    async function handleSetScheduled() {
        try {
            await scheduledAppointment(id);
            showAptPendingToast(patients?.display_name);
            onUpdated?.();
        } catch (error) {
            showErrorToast('Error al actualizar', error.message);
        }
    }

    // En mobile el drawer se vuelve un fullscreen overlay; en sm+ es un panel lateral.
    const drawerWidth = variant === 'followup' ? 'sm:w-[420px]' : 'sm:w-[540px]';

    return (
        <div className={`fixed inset-0 sm:absolute sm:top-2 sm:right-2 sm:bottom-2 sm:left-auto ${drawerWidth} bg-white/95 sm:bg-white/30 backdrop-blur-2xl border border-white/60 rounded-none sm:rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] z-[120] sm:z-50 flex flex-col animate-drawer-in overflow-hidden`}>
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

            {/* Header */}
            <div className="relative z-10 flex items-center gap-2 p-4">
                <button onClick={onClose} className="relative overflow-hidden w-7 h-7 flex items-center justify-center rounded-full bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-700 hover:bg-white/60 shadow-md transition-colors">
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    <ChevronLeft size={16} className="relative z-10" />
                </button>
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-sm text-center">Detalle del turno</h3>
                <div className="w-7 h-7" />
            </div>

            {/* Content scrolleable - but without scrolling */}
            <div className="relative z-10 flex-1 overflow-hidden px-5 py-4 flex flex-col justify-between">
                <div>
                    {/* Cliente hero */}
                    {/* Cliente hero */}
                    <div className="flex items-center gap-3 mb-6 px-1">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border leading-none bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900 text-base font-bold">
                            <span className="block translate-y-[1px] translate-x-[1px]">{getInitials(patients?.display_name)}</span>
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-bold text-navy-900 text-base truncate flex items-center gap-2">
                                {patients?.display_name || 'Sin nombre'}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-navy-700/50 font-semibold text-[11px]">
                                <Phone size={11} className="shrink-0 opacity-40 ml-0.5" />
                                {formatPhone(patients?.patient_phones?.[0]?.phone) || 'Sin teléfono'}
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                                {status === 'cancelled' ? (
                                    <div className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-100 px-2 py-[2px] rounded-md text-[9px] font-bold">
                                        <X size={10} strokeWidth={3} />
                                        Cancelado
                                    </div>
                                ) : status === 'no_show' ? (
                                    <div className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 px-2 py-[2px] rounded-md text-[9px] font-bold">
                                        <UserX size={10} strokeWidth={3} />
                                        Ausente
                                    </div>
                                ) : confirmed ? (
                                    <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-[2px] rounded-md text-[9px] font-bold">
                                        <Check size={10} strokeWidth={3} />
                                        Confirmado
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-[2px] rounded-md text-[9px] font-bold">
                                        <Circle size={10} strokeWidth={3} />
                                        Pendiente
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Secciones */}
                    <div className="space-y-6 px-1">
                        {/* Fecha y hora */}
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <h4 className="text-[11px] font-bold text-navy-800 leading-none">Fecha y hora</h4>
                                <div className="flex-1 h-px bg-navy-900/10"></div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-navy-900/5 border border-navy-900/10 text-navy-900 shadow-sm">
                                        <CalendarIcon size={18} />
                                    </div>
                                    <div className="pt-0.5">
                                        <div className="text-xs font-semibold text-gray-400 mb-0.5">Fecha</div>
                                        <div className="font-bold text-navy-900 text-xs">
                                            {new Date(date_start).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guatemala' })
                                                .replace(/^\w/, (c) => c.toUpperCase())}
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full border-b border-dashed border-gray-200 ml-[56px] w-[calc(100%-56px)]"></div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-navy-900/5 border border-navy-900/10 text-navy-900 shadow-sm">
                                        <Clock size={18} />
                                    </div>
                                    <div className="pt-0.5">
                                        <div className="text-xs font-semibold text-gray-400 mb-0.5">Horario</div>
                                        <div className="font-bold text-navy-900 text-xs">
                                            {new Date(date_start).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true })}
                                            {' — '}
                                            {new Date(date_end).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true })}
                                        </div>
                                    </div>
                                </div>

                                {/* Servicio — solo si el turno tiene uno asociado */}
                                {appointment.services?.name && (
                                    <>
                                        <div className="border-b border-dashed border-gray-200 ml-[56px]" />
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-navy-900/5 border border-navy-900/10 text-navy-900 shadow-sm">
                                                <Tag size={18} />
                                            </div>
                                            <div className="pt-0.5">
                                                <div className="text-xs font-semibold text-gray-400 mb-0.5">Servicio</div>
                                                <div className="font-bold text-navy-900 text-xs">
                                                    {appointment.services.name}
                                                    {appointment.services.duration_minutes > 0 && (
                                                        <span className="ml-1.5 text-navy-700/50 font-semibold">
                                                            · {formatDuration(appointment.services.duration_minutes)}
                                                        </span>
                                                    )}
                                                    {appointment.services.price != null && (
                                                        <span className="ml-1.5 text-navy-700/50 font-semibold">
                                                            · Q {Number(appointment.services.price).toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Footer de Acciones fijo abajo */}
            <div className="relative z-10 p-4 mt-auto">
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {/* 0. Reagendar (solo Cancelado y No se presentó) */}
                    {canRescheduleAppointments && (status === 'cancelled' || status === 'no_show') && (
                        <button
                            onClick={() => setShowReschedule(true)}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md hover:bg-white/60 transition-all duration-300"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <RotateCcw size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">Reagendar</span>
                        </button>
                    )}

                    {/* 1. Ver Perfil — oculto si el paciente está fuera del cupo del plan */}
                    {patientWithinPlan && (
                        <button
                            onClick={() => navigate(`/patients?id=${appointment.patient_id}`)}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md hover:bg-white/60 transition-all duration-300"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <User size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap relative z-10">Perfil</span>
                        </button>
                    )}

                    {/* 1. Chat */}
                    {canViewConversations && patientWithinPlan && (
                        <button
                            onClick={() => navigate(`/conversations?patient=${appointment.patient_id}`)}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md hover:bg-white/60 transition-all duration-300"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <MessageCircle size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">Chat</span>
                        </button>
                    )}

                    {/* 2. IA (Bot Toggle) */}
                    {canToggleAi && appointment.patients && (
                        <button
                            onClick={async () => {
                                const newValue = !botPaused;
                                try {
                                    await setHumanTakeover(appointment.patient_id, newValue);
                                    setPatientTakeover(appointment.patient_id, newValue);
                                    onUpdated?.();
                                    if (newValue) showBotPauseToast(patients?.display_name);
                                    else showBotReactivateToast(patients?.display_name);
                                } catch (err) {
                                    showErrorToast('Error al actualizar bot', err.message);
                                }
                            }}
                            className={`relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 border text-[11px] font-bold rounded-full shadow-md transition-all duration-300 ${botPaused
                                ? 'bg-amber-50/80 backdrop-blur-2xl border-amber-200/70 text-amber-700 hover:bg-amber-100/80'
                                : 'bg-white/40 backdrop-blur-2xl border-white/60 text-navy-900 hover:bg-white/60'
                                }`}
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <div className="relative z-10 shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                <Bot size={13} />
                                <AIStar
                                    size={5}
                                    className={`absolute -top-0.5 -left-0.5 ${botPaused ? 'text-amber-500' : 'text-navy-900'}`}
                                    strokeWidth={2.5}
                                />
                            </div>
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap ml-0 group-hover:ml-0 relative z-10">
                                {botPaused ? 'Reactivar' : 'Pausar IA'}
                            </span>
                        </button>
                    )}

                    {/* 3. Editar */}
                    {canEditAppointments && status !== 'cancelled' && status !== 'no_show' && variant !== 'followup' && (
                        <button onClick={() => setShowEdit(true)}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md hover:bg-white/60 transition-all duration-300"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Pencil size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-300 whitespace-nowrap relative z-10">Editar</span>
                        </button>
                    )}

                    {/* 4. No se presentó — visible en turnos pasados, no en seguimiento, no si ya es no_show */}
                    {canMarkNoShow && variant !== 'followup' && status !== 'no_show' && status !== 'cancelled' && (
                        <button onClick={handleNoShow} disabled={markingNoShow}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md hover:bg-white/60 transition-all duration-300 disabled:opacity-50"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <UserX size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[110px] transition-all duration-300 whitespace-nowrap relative z-10">
                                {markingNoShow ? 'Marcando...' : 'Ausente'}
                            </span>
                        </button>
                    )}

                    {/* 5. Pendiente (Amber Hover) */}
                    {canSetPending && status === 'confirmed' && (
                        <button onClick={handleSetScheduled}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-amber-600 text-[11px] font-bold rounded-full shadow-md hover:bg-amber-500 hover:border-amber-500 hover:text-white transition-all duration-300"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Circle size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">Pendiente</span>
                        </button>
                    )}

                    {/* 6. Confirmar (Emerald Hover) */}
                    {canConfirmAppointments && status === 'scheduled' && !confirmed && (
                        <button onClick={handleConfirm}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-emerald-600 text-[11px] font-bold rounded-full shadow-md hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all duration-300"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Check size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">Confirmar</span>
                        </button>
                    )}

                    {/* 6.5 Cobrar — pendiente de cobro (estilo guiado por Pendiente) */}
                    {canConfirmDelivery && status !== 'cancelled' && status !== 'no_show' && !deliveredIncome && (
                        <button onClick={() => setShowDeliver(true)}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-amber-600 text-[11px] font-bold rounded-full shadow-md hover:bg-amber-500 hover:border-amber-500 hover:text-white transition-all duration-300"
                            title="Confirmar cobro del servicio"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Wallet size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[70px] transition-all duration-300 whitespace-nowrap relative z-10">Cobrar</span>
                        </button>
                    )}
                    {/* Cobrado — servicio cobrado (estilo guiado por Confirmar) */}
                    {deliveredIncome && (
                        <div
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-emerald-600 text-[11px] font-bold rounded-full shadow-md hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all duration-300 cursor-default"
                            title="Servicio cobrado"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Wallet size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">Cobrado</span>
                        </div>
                    )}

                    {/* 7. Eliminar (Cancelación lógica para turnos activos) */}
                    {canDeleteAppointments && ['scheduled', 'confirmed'].includes(status) && (
                        <button onClick={() => setShowCancelConfirm(true)}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-rose-600 text-[11px] font-bold rounded-full shadow-md hover:bg-rose-600 hover:border-rose-600 hover:text-white transition-all duration-300"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Trash2 size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[70px] transition-all duration-300 whitespace-nowrap relative z-10">Eliminar</span>
                        </button>
                    )}

                    {/* 8. Borrar permanentemente (para No-show o Cancelados) */}
                    {canDeleteAppointments && (status === 'no_show' || status === 'cancelled') && (
                        <button
                            onClick={async () => {
                                if (window.confirm('¿Estás seguro de que deseas borrar permanentemente este registro de la base de datos?')) {
                                    try {
                                        await deleteAppointment(id);
                                        onUpdated?.();
                                        onClose();
                                    } catch (err) {
                                        showErrorToast('Error al borrar', err.message);
                                    }
                                }
                            }}
                            className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 text-rose-600 text-[11px] font-bold rounded-full shadow-md hover:bg-rose-600 hover:border-rose-600 hover:text-white transition-all duration-300"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Trash2 size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap relative z-10">Borrar registro</span>
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

            {/* Cobrar / Confirmar entrega del servicio (modal armonizado con Nuevo Turno) */}
            {showDeliver && (
                <ConfirmDeliveryModal
                    serviceName={appointment.services?.name}
                    clientName={patients?.display_name}
                    defaultAmount={appointment.services?.price}
                    onClose={() => setShowDeliver(false)}
                    onConfirm={async ({ amount, paymentMethod, notes }) => {
                        const row = await confirmServiceDelivery({ appointmentId: id, amount, paymentMethod, notes });
                        setDeliveredIncome(row);
                        showSuccessToast('Servicio cobrado', `Ingreso de Q${Number(amount).toFixed(2)} registrado.`);
                        onUpdated?.();
                    }}
                />
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

            {showReschedule && (
                <NewAppointmentModal
                    isOpen={true}
                    initialPatient={{
                        id: appointment.patient_id,
                        display_name: patients?.display_name,
                        patient_phones: patients?.patient_phones,
                    }}
                    initialServiceId={appointment.service_id ?? null}
                    onClose={() => setShowReschedule(false)}
                    onCreated={async () => {
                        try {
                            // M-021: Si se reagenda, marcamos el turno viejo como reagendado
                            // Esto lo quita de la lista de Seguimiento sin borrar el historial.
                            await markAsRescheduled(appointment.id);
                            setShowReschedule(false);
                            onUpdated?.();
                            onClose();
                        } catch (err) {
                            console.error('Error marking old appointment as rescheduled:', err);
                            setShowReschedule(false);
                            onUpdated?.();
                            onClose();
                        }
                    }}
                />
            )}
        </div>
    );
}