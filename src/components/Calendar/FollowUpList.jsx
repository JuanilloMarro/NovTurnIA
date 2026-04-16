import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLostAppointments } from '../../services/supabaseService';
import { formatPhone } from '../../utils/format';
import { usePermissions } from '../../hooks/usePermissions';
import { UserX, X, RotateCcw, MessageCircle, ChevronRight } from 'lucide-react';
import NewAppointmentModal from './NewAppointmentModal';
import AppointmentDrawer from './AppointmentDrawer';

function StatusBadge({ status }) {
    if (status === 'no_show') {
        return (
            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 px-2 py-[2px] rounded-md text-[9px] font-bold whitespace-nowrap">
                <UserX size={9} strokeWidth={3} />
                No se presentó
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-100 px-2 py-[2px] rounded-md text-[9px] font-bold whitespace-nowrap">
            <X size={9} strokeWidth={3} />
            Cancelado
        </span>
    );
}

export default function FollowUpList({ type = 'all', days = 30, reloadKey = 0 }) {
    const navigate = useNavigate();
    const { canViewConversations, canEditAppointments } = usePermissions();

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [rescheduleTarget, setRescheduleTarget] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getLostAppointments({ type, days });
            setAppointments(data);
        } catch {
            // silently ignore — user sees empty state
        } finally {
            setLoading(false);
        }
    }, [type, days]);

    useEffect(() => { load(); }, [load, reloadKey]);

    function formatDate(iso) {
        return new Date(iso).toLocaleDateString('es-GT', {
            day: 'numeric', month: 'short', year: 'numeric',
            timeZone: 'America/Guatemala',
        });
    }

    function formatTime(iso) {
        return new Date(iso).toLocaleTimeString('es-GT', {
            hour: '2-digit', minute: '2-digit',
            timeZone: 'America/Guatemala', hour12: true,
        });
    }

    return (
        <div className="h-full flex flex-col min-h-0">
            {/* Lista */}
            <div className="flex-1 min-h-0 overflow-y-auto rounded-[20px] bg-white/20 backdrop-blur-sm border border-white/40 shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center h-40 text-navy-700/40 text-xs font-semibold">
                        Cargando...
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-navy-700/40">
                        <UserX size={28} strokeWidth={1.5} />
                        <span className="text-xs font-semibold">Sin registros en este período</span>
                    </div>
                ) : (
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/40">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-navy-700/50 uppercase tracking-wider">Paciente</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-navy-700/50 uppercase tracking-wider hidden sm:table-cell">Teléfono</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-navy-700/50 uppercase tracking-wider">Fecha</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-navy-700/50 uppercase tracking-wider hidden md:table-cell">Estado</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-navy-700/50 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(apt => {
                                const patient = apt.patients;
                                const phone = patient?.patient_phones?.find(p => p.is_primary)?.phone
                                    ?? patient?.patient_phones?.[0]?.phone;
                                return (
                                    <tr
                                        key={apt.id}
                                        onClick={() => setSelectedAppointment(apt)}
                                        className="border-b border-white/20 hover:bg-white/30 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-navy-900 truncate max-w-[160px]">
                                                {patient?.display_name || 'Sin nombre'}
                                            </div>
                                            <div className="mt-1 md:hidden">
                                                <StatusBadge status={apt.status} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-navy-700/70 font-medium hidden sm:table-cell whitespace-nowrap">
                                            {formatPhone(phone) || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="font-semibold text-navy-900">{formatDate(apt.date_start)}</div>
                                            <div className="text-navy-700/50 text-[10px]">{formatTime(apt.date_start)}</div>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <StatusBadge status={apt.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {canEditAppointments && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setRescheduleTarget(apt); }}
                                                        title="Reagendar"
                                                        className="w-7 h-7 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white hover:text-navy-900 shadow-sm transition-all"
                                                    >
                                                        <RotateCcw size={12} />
                                                    </button>
                                                )}
                                                {canViewConversations && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); navigate(`/conversations?patient=${apt.patient_id}`); }}
                                                        title="Ir a conversación"
                                                        className="w-7 h-7 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white hover:text-navy-900 shadow-sm transition-all"
                                                    >
                                                        <MessageCircle size={12} />
                                                    </button>
                                                )}
                                                <ChevronRight size={12} className="text-navy-700/30 group-hover:text-navy-700/60 transition-colors ml-1" />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedAppointment && (
                <AppointmentDrawer
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    onUpdated={() => { load(); setSelectedAppointment(null); }}
                />
            )}

            {rescheduleTarget && (
                <NewAppointmentModal
                    isOpen={true}
                    initialPatient={{
                        id: rescheduleTarget.patient_id,
                        display_name: rescheduleTarget.patients?.display_name,
                        patient_phones: rescheduleTarget.patients?.patient_phones,
                    }}
                    onClose={() => setRescheduleTarget(null)}
                    onCreated={() => { setRescheduleTarget(null); load(); }}
                />
            )}
        </div>
    );
}
