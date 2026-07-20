import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLostAppointments } from '../../services/supabaseService';
import { formatPhone } from '../../utils/format';
import { usePermissions } from '../../hooks/usePermissions';
import { withTimeout } from '../../utils/withTimeout';
import { UserX, X, RotateCcw, MessageCircle, ChevronRight, ChevronDown, Search } from 'lucide-react';
import NewAppointmentModal from './NewAppointmentModal';

const PAGE_SIZE = 30;

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

export default function FollowUpList({ type = 'all', days = 30, reloadKey = 0, onLoadingChange, onAppointmentSelected }) {
    const navigate = useNavigate();
    const { canViewConversations, canEditAppointments } = usePermissions();

    const [appointments, setAppointments] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] = useState(null);
    const [searchStr, setSearchStr] = useState('');
    const hasMore = appointments.length < total;

    // Notificar al padre del estado loading para que pueda mostrar el spinner
    // del botón "Actualizar" en Calendar.jsx (que vive fuera de este componente).
    useEffect(() => { onLoadingChange?.(loading); }, [loading, onLoadingChange]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, count } = await withTimeout(
                getLostAppointments({ type, days, page: 0, pageSize: PAGE_SIZE }),
                12_000,
                'getLostAppointments'
            );
            setAppointments(data);
            setTotal(count);
        } catch (err) {
            console.error('[FollowUpList] load error:', err);
        } finally {
            setLoading(false);
        }
    }, [type, days]);

    useEffect(() => { load(); }, [load, reloadKey]);

    async function loadMore() {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const nextPage = Math.ceil(appointments.length / PAGE_SIZE);
            const { data, count } = await getLostAppointments({ type, days, page: nextPage, pageSize: PAGE_SIZE });
            setAppointments(prev => [...prev, ...data]);
            setTotal(count);
        } catch (err) {
            console.error('[FollowUpList] loadMore error:', err);
        } finally {
            setLoadingMore(false);
        }
    }

    // Filtra sobre lo ya cargado — mismo patrón que Finanzas/Servicios/Ofertas.
    const visible = useMemo(() => {
        const q = searchStr.trim().toLowerCase();
        if (!q) return appointments;
        return appointments.filter(apt => {
            const name = apt.patients?.display_name?.toLowerCase() || '';
            const phones = apt.patients?.patient_phones?.map(p => p.phone).join(' ') || '';
            return name.includes(q) || phones.includes(q);
        });
    }, [appointments, searchStr]);

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
        <div className="h-full flex flex-col min-h-0 w-full pt-2 transition-all duration-300">
            {/* Búsqueda por nombre o teléfono — filtra sobre lo ya cargado */}
            <div className="px-2 pb-3 shrink-0">
                <div className="relative max-w-xs">
                    <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-900/30 pointer-events-none" />
                    <input
                        value={searchStr}
                        onChange={e => setSearchStr(e.target.value)}
                        placeholder="Buscar por nombre o teléfono…"
                        className="w-full h-9 pl-9 pr-4 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full text-[11px] font-bold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/40 shadow-md"
                    />
                </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 space-y-3 px-2">
                {loading ? (
                    Array(4).fill(0).map((_, i) => (
                        <div key={i} className="animate-shimmer h-[76px] rounded-2xl bg-white/40 w-full" />
                    ))
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-navy-900/40 py-16">
                        <div className="w-14 h-14 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center shadow-sm">
                            <UserX size={24} strokeWidth={1.5} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-navy-900/60">Sin registros</p>
                            <p className="text-[11px] font-semibold text-navy-700/40 mt-0.5">
                                {searchStr ? 'Nadie coincide con esa búsqueda' : 'No hay clientes perdidos en este período'}
                            </p>
                        </div>
                    </div>
                ) : (
                    visible.map((apt, index) => {
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
                                onClick={() => onAppointmentSelected?.(apt)}
                                className="group relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl p-4 hover:bg-white/60 transition-all duration-300 cursor-pointer animate-fade-up shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                                style={{ animationDelay: `${index * 0.04}s` }}
                            >
                                <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                <div className="flex items-center gap-3.5 relative z-10">
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
                                <div className="flex items-center justify-end gap-2 shrink-0 relative z-10">
                                    <div className="relative overflow-hidden hidden md:flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/40 backdrop-blur-2xl text-navy-700 group-hover:bg-white group-hover:scale-105 transition-all shadow-md">
                                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                        <ChevronRight size={16} className="relative z-10" />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {!loading && hasMore && (
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-white/30 border border-white/50 text-navy-700/70 text-[11px] font-bold hover:bg-white/50 transition-colors disabled:opacity-50"
                    >
                        <ChevronDown size={13} className={loadingMore ? 'animate-spin' : ''} /> {loadingMore ? 'Cargando…' : 'Cargar más'}
                    </button>
                )}
            </div>

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