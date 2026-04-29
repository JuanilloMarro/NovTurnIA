import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLostAppointments } from '../../services/supabaseService';
import { formatPhone } from '../../utils/format';
import { usePermissions } from '../../hooks/usePermissions';
import { withTimeout } from '../../utils/withTimeout';
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
            const data = await withTimeout(
                getLostAppointments({ type, days }),
                12_000,
                'getLostAppointments'
            );
            setAppointments(data);
        } catch (err) {
            console.error('[FollowUpList] load error:', err);
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
        <div className={`h-full flex flex-col min-h-0 w-full pt-2 transition-all duration-300 ${selectedAppointment ? 'sm:pr-[380px]' : ''}`}>
            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 space-y-2 pr-3">
                {loading ? (
                    Array(4).fill(0).map((_, i) => (
                        <div key={i} className="animate-shimmer h-[76px] rounded-2xl bg-white/40 w-full" />
                    ))
                ) : appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-navy-900/40 py-16">
                        <div className="w-14 h-14 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center shadow-sm">
                            <UserX size={24} strokeWidth={1.5} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-navy-900/60">Sin registros</p>
                            <p className="text-[11px] font-semibold text-navy-700/40 mt-0.5">No hay clientes perdidos en este período</p>
                        </div>
                    </div>
                ) : (
                    appointments.map((apt, index) => {
                        const patient = apt.patients;
                        const phone = patient?.patient_phones?.find(p => p.is_primary)?.phone
                            ?? patient?.patient_phones?.[0]?.phone;
                        const name = patient?.display_name || 'Sin nombre';
                        
                        const isCancelled = apt.status === 'cancelled';
                        const iconBg = isCancelled 
                            ? 'bg-rose-500/10 text-rose-700 border-rose-500/20' 
                            : 'bg-gray-100 text-gray-500 border-gray-200';
                        const Icon = isCancelled ? X : UserX;

                        return (
                            <div
                                key={apt.id}
                                onClick={() => setSelectedAppointment(apt)}
                                className="group bg-white/40 backdrop-blur-sm border border-white/60 rounded-2xl p-4 hover:bg-white/60 transition-all duration-300 cursor-pointer animate-fade-up shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                                style={{ animationDelay: `${index * 0.04}s` }}
                            >
                                <div className="flex items-center gap-3.5">
                                    {/* Icon Avatar matching Activity Log */}
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${iconBg}`}>
                                        <Icon size={16} strokeWidth={2.5} />
                                    </div>
                                    
                                    <div className="flex-1">
                                        <p className="text-[13px] font-semibold text-navy-900 leading-snug">
                                            <span className="font-bold text-navy-900/60 text-[10px] tracking-wider block mb-0.5">
                                                {isCancelled ? 'Cancelado' : 'No se presentó'}
                                            </span>
                                            {name}
                                        </p>
                                        <div className="flex items-center mt-1.5 flex-wrap text-[10px] font-bold text-navy-900/40 tracking-wider">
                                            <span>{formatDate(apt.date_start)}</span>
                                            <span className="mx-1.5 opacity-60">•</span>
                                            <span>{formatTime(apt.date_start)}</span>
                                            {phone && (
                                                <>
                                                    <span className="mx-1.5 opacity-60">•</span>
                                                    <span>{formatPhone(phone)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-2 shrink-0">
                                    <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/40 text-navy-700 group-hover:bg-white group-hover:scale-105 transition-all shadow-sm">
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedAppointment && (
                <AppointmentDrawer
                    appointment={selectedAppointment}
                    variant="followup"
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