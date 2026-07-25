import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, X, UserX } from 'lucide-react';
import { cancelAppointment, markNoShow, scheduledAppointment, confirmAppointment } from '../../services/supabaseService';
import { showAptCancelToast, showAptNoShowToast, showAptPendingToast, showAptConfirmToast, showErrorToast } from '../../store/useToastStore';

const COLUMNS_CONFIG = [
    { id: 'pending', title: 'Pendiente', icon: AlertCircle, iconBg: 'bg-amber-500/10', iconBorder: 'border-amber-500/20', iconText: 'text-amber-600', dot: 'bg-amber-500' },
    { id: 'confirmed', title: 'Confirmados', icon: CheckCircle2, iconBg: 'bg-emerald-500/10', iconBorder: 'border-emerald-500/20', iconText: 'text-emerald-600', dot: 'bg-emerald-500' },
    { id: 'no_show', title: 'No se presentó', icon: UserX, iconBg: 'bg-gray-500/10', iconBorder: 'border-gray-500/20', iconText: 'text-gray-500', dot: 'bg-gray-500' },
    { id: 'cancelled', title: 'Cancelados', icon: X, iconBg: 'bg-rose-500/10', iconBorder: 'border-rose-500/20', iconText: 'text-rose-600', dot: 'bg-rose-500' },
];

function filterByPeriod(appointments, viewMode, anchorDate, weekStart) {
    if (!anchorDate) return appointments;
    return appointments.filter(a => {
        const d = new Date(a.date_start);
        if (viewMode === 'day') {
            return (
                d.getFullYear() === anchorDate.getFullYear() &&
                d.getMonth() === anchorDate.getMonth() &&
                d.getDate() === anchorDate.getDate()
            );
        }
        if (viewMode === 'week' && weekStart) {
            const end = new Date(weekStart);
            end.setDate(end.getDate() + 7);
            return d >= weekStart && d < end;
        }
        // month
        return (
            d.getFullYear() === anchorDate.getFullYear() &&
            d.getMonth() === anchorDate.getMonth()
        );
    });
}

export default function KanbanBoard({ appointments = [], onAppointmentClick, reload, viewMode = 'week', anchorDate, weekStart }) {
    const [localAppointments, setLocalAppointments] = useState([]);

    useEffect(() => {
        setLocalAppointments(appointments);
    }, [appointments]);

    const visible = filterByPeriod(localAppointments, viewMode, anchorDate, weekStart);

    const columns = COLUMNS_CONFIG.map(col => {
        let filtered = [];
        if (col.id === 'pending') filtered = visible.filter(a => a.status === 'scheduled' && !a.confirmed);
        else if (col.id === 'confirmed') filtered = visible.filter(a => (a.status === 'scheduled' && a.confirmed) || a.status === 'confirmed');
        else if (col.id === 'no_show') filtered = visible.filter(a => a.status === 'no_show');
        else if (col.id === 'cancelled') filtered = visible.filter(a => a.status === 'cancelled');

        // LIFO: último modificado arriba
        return {
            ...col,
            cards: filtered.sort((a, b) =>
                new Date(b.updated_at || b.created_at || b.date_start) -
                new Date(a.updated_at || a.created_at || a.date_start)
            ),
        };
    });

    const [draggedId, setDraggedId] = useState(null);

    const handleDragStart = (e, id) => {
        setDraggedId(id);
        e.dataTransfer.setData('appointmentId', id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            document.getElementById(`kanban-card-${id}`)?.classList.add('opacity-30', 'scale-95');
        }, 0);
    };

    const handleDragEnd = (e, id) => {
        setDraggedId(null);
        document.getElementById(`kanban-card-${id}`)?.classList.remove('opacity-30', 'scale-95');
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-white/60');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('bg-white/60');
    };

    const handleDrop = async (e, targetColId) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-white/60');

        const appointmentId = e.dataTransfer.getData('appointmentId');
        if (!appointmentId) return;

        const appointment = localAppointments.find(a => a.id === appointmentId);
        if (!appointment) return;

        // Determinar columna actual correctamente
        let currentColId = 'pending';
        if (appointment.status === 'cancelled') currentColId = 'cancelled';
        else if (appointment.status === 'no_show') currentColId = 'no_show';
        else if (appointment.status === 'confirmed' || (appointment.status === 'scheduled' && appointment.confirmed)) currentColId = 'confirmed';
        else if (appointment.status === 'scheduled' && !appointment.confirmed) currentColId = 'pending';

        // Regla: No se pueden mover fichas que ya están en estados finales (Seguimiento)
        if (currentColId === 'cancelled' || currentColId === 'no_show') {
            showErrorToast('Acción no permitida', 'Los turnos cancelados o ausentes se gestionan desde el módulo de Seguimiento.');
            return;
        }

        if (currentColId === targetColId) return;

        // Optimistic update
        const now = new Date().toISOString();
        let prevSnapshot;
        setLocalAppointments(prev => {
            prevSnapshot = prev;
            return prev.map(a => {
                if (a.id !== appointmentId) return a;
                let newStatus = a.status;
                let newConfirmed = a.confirmed;
                if (targetColId === 'cancelled') { newStatus = 'cancelled'; }
                else if (targetColId === 'no_show') { newStatus = 'no_show'; }
                else if (targetColId === 'confirmed') { newStatus = 'confirmed'; newConfirmed = true; }
                else if (targetColId === 'pending') { newStatus = 'scheduled'; newConfirmed = false; }
                return { ...a, status: newStatus, confirmed: newConfirmed, updated_at: now };
            });
        });

        try {
            if (targetColId === 'cancelled') { await cancelAppointment(appointmentId); showAptCancelToast(appointment.patients?.display_name); }
            else if (targetColId === 'no_show') { await markNoShow(appointmentId); showAptNoShowToast(appointment.patients?.display_name); }
            else if (targetColId === 'confirmed') { await confirmAppointment(appointmentId); showAptConfirmToast(appointment.patients?.display_name); }
            else if (targetColId === 'pending') { await scheduledAppointment(appointmentId); showAptPendingToast(appointment.patients?.display_name); }
            reload?.();
        } catch (err) {
            showErrorToast('Error al actualizar', err.message);
            if (prevSnapshot) setLocalAppointments(prevSnapshot); // revert
        }
    };

    return (
        <div className="h-full flex flex-col gap-3 px-4 pb-4 pt-2">

            <div className="flex-1 flex gap-3 overflow-x-auto custom-scrollbar min-h-0 pb-2">
                {columns.map(col => {
                    const Icon = col.icon;
                    return (
                        <div
                            key={col.id}
                            className="relative flex-1 min-w-[260px] flex flex-col bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden transition-colors duration-300"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                            <div className="relative z-10 px-4 pt-4 pb-3 border-b border-white/40">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${col.iconBg} border ${col.iconBorder} ${col.iconText}`}>
                                            <Icon size={13} strokeWidth={2.5} />
                                        </div>
                                        <h3 className="font-bold text-navy-900 text-[12px] tracking-tight truncate">{col.title}</h3>
                                    </div>
                                    <span className="bg-white border border-white/80 text-navy-700 font-bold text-[10px] px-2 py-0.5 rounded-full shadow-sm shrink-0 tabular-nums flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                                        {col.cards.length}
                                    </span>
                                </div>
                            </div>

                            <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2">
                                {col.cards.length === 0 ? (
                                    <div className="h-16 border-2 border-dashed border-white/60 rounded-2xl flex items-center justify-center text-navy-900/25 text-[10px] font-bold">
                                        Soltar aquí
                                    </div>
                                ) : (
                                    col.cards.map(card => {
                                        const time = new Date(card.date_start).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
                                        const date = new Date(card.date_start).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
                                        const name = card.patients?.display_name || 'Sin nombre';
                                        const service = card.services?.name || 'Turno manual';
                                        const isTerminal = col.id === 'no_show' || col.id === 'cancelled';
                                        const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
                                        return (
                                            <div
                                                id={`kanban-card-${card.id}`}
                                                key={card.id}
                                                draggable={!isTerminal}
                                                onDragStart={!isTerminal ? (e) => handleDragStart(e, card.id) : undefined}
                                                onDragEnd={!isTerminal ? (e) => handleDragEnd(e, card.id) : undefined}
                                                onClick={() => onAppointmentClick?.(card)}
                                                title={`${name} · ${service}`}
                                                className={`group/card relative w-full flex items-center gap-2.5 p-2.5 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-2xl shadow-md overflow-hidden hover:bg-white/60 transition-all duration-200 ${isTerminal ? 'cursor-default opacity-80' : 'cursor-grab active:cursor-grabbing'}`}
                                            >
                                                <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border bg-gradient-to-b from-white to-gray-100 border-gray-200/60 text-navy-900 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] group-hover/card:to-gray-200 group-hover/card:border-gray-200 transition-colors">
                                                    {initials}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-navy-900 text-[12px] leading-tight truncate">{name}</h4>
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-navy-700/50 mt-0.5">
                                                        <Clock size={9} className="shrink-0" />
                                                        <span className="shrink-0">{date} · {time}</span>
                                                        <span className="opacity-40 shrink-0">•</span>
                                                        <span className="truncate">{service}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
