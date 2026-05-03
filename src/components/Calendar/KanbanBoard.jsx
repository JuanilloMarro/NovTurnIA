import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, X, UserX } from 'lucide-react';
import { cancelAppointment, markNoShow, scheduledAppointment, confirmAppointment } from '../../services/supabaseService';
import { showAptCancelToast, showAptNoShowToast, showAptPendingToast, showAptConfirmToast, showErrorToast } from '../../store/useToastStore';

const COLUMNS_CONFIG = [
    { id: 'pending',   title: 'Pendiente',        color: 'text-amber-600',  bg: 'bg-amber-50',  icon: AlertCircle  },
    { id: 'confirmed', title: 'Confirmados',       color: 'text-emerald-600',bg: 'bg-emerald-50',icon: CheckCircle2 },
    { id: 'no_show',   title: 'No se presentó',   color: 'text-gray-500',   bg: 'bg-gray-100',  icon: UserX        },
    { id: 'cancelled', title: 'Cancelados',        color: 'text-rose-600',   bg: 'bg-rose-50',   icon: X            },
];

function filterByPeriod(appointments, viewMode, anchorDate, weekStart) {
    if (!anchorDate) return appointments;
    return appointments.filter(a => {
        const d = new Date(a.date_start);
        if (viewMode === 'day') {
            return (
                d.getFullYear() === anchorDate.getFullYear() &&
                d.getMonth()    === anchorDate.getMonth()    &&
                d.getDate()     === anchorDate.getDate()
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
            d.getMonth()    === anchorDate.getMonth()
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
        if (col.id === 'pending')        filtered = visible.filter(a => a.status === 'scheduled' && !a.confirmed);
        else if (col.id === 'confirmed') filtered = visible.filter(a => (a.status === 'scheduled' && a.confirmed) || a.status === 'confirmed');
        else if (col.id === 'no_show')   filtered = visible.filter(a => a.status === 'no_show');
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
        setLocalAppointments(prev => prev.map(a => {
            if (a.id !== appointmentId) return a;
            let newStatus = a.status;
            let newConfirmed = a.confirmed;
            if (targetColId === 'cancelled')  { newStatus = 'cancelled'; }
            else if (targetColId === 'no_show')   { newStatus = 'no_show'; }
            else if (targetColId === 'confirmed') { newStatus = 'confirmed'; newConfirmed = true; }
            else if (targetColId === 'pending')   { newStatus = 'scheduled'; newConfirmed = false; }
            return { ...a, status: newStatus, confirmed: newConfirmed, updated_at: now };
        }));

        try {
            if (targetColId === 'cancelled')  { await cancelAppointment(appointmentId);    showAptCancelToast(appointment.patients?.display_name); }
            else if (targetColId === 'no_show')   { await markNoShow(appointmentId);           showAptNoShowToast(appointment.patients?.display_name); }
            else if (targetColId === 'confirmed') { await confirmAppointment(appointmentId);   showAptConfirmToast(appointment.patients?.display_name); }
            else if (targetColId === 'pending')   { await scheduledAppointment(appointmentId); showAptPendingToast(appointment.patients?.display_name); }
            reload?.();
        } catch (err) {
            showErrorToast('Error al actualizar', err.message);
            setLocalAppointments(appointments); // revert
        }
    };

    return (
        <div className="h-full flex flex-col gap-3">

            <div className="flex-1 flex gap-4 overflow-x-auto custom-scrollbar pb-4 px-1 min-h-0">
            {columns.map(col => {
                const Icon = col.icon;
                return (
                    <div
                        key={col.id}
                        className="flex-1 min-w-[280px] flex flex-col bg-white/40 backdrop-blur-md border border-white/60 rounded-[24px] shadow-[0_8px_32px_rgba(26,58,107,0.04)] overflow-hidden transition-colors duration-300"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.id)}
                    >
                        <div className="py-6 px-5 border-b border-white/50 bg-white/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${col.bg} ${col.color}`}>
                                        <Icon size={12} strokeWidth={3} />
                                    </div>
                                    <h3 className="font-bold text-navy-900 text-[13px] tracking-tight">{col.title}</h3>
                                </div>
                                <span className="bg-white border border-white/80 text-navy-700 font-bold text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                                    {col.cards.length}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                            {col.cards.length === 0 ? (
                                <div className="h-24 border-2 border-dashed border-white/60 rounded-2xl flex items-center justify-center text-navy-900/30 text-[11px] font-bold">
                                    Soltar aquí
                                </div>
                            ) : (
                                col.cards.map(card => {
                                    const time = new Date(card.date_start).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
                                    const date = new Date(card.date_start).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
                                    const name    = card.patients?.display_name || 'Sin nombre';
                                    const service = card.services?.name || 'Turno manual';
                                    const isTerminal = col.id === 'no_show' || col.id === 'cancelled';
                                    return (
                                        <div
                                            id={`kanban-card-${card.id}`}
                                            key={card.id}
                                            draggable={!isTerminal}
                                            onDragStart={!isTerminal ? (e) => handleDragStart(e, card.id) : undefined}
                                            onDragEnd={!isTerminal ? (e) => handleDragEnd(e, card.id) : undefined}
                                            onClick={() => onAppointmentClick?.(card)}
                                            className={`bg-white/80 backdrop-blur-sm border border-white/90 p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden ${isTerminal ? 'cursor-default opacity-80' : 'cursor-grab active:cursor-grabbing'}`}
                                        >
                                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-white/10 to-transparent" />
                                            <h4 className="font-bold text-navy-900 text-sm leading-tight mb-2 group-hover:text-navy-700 transition-colors">
                                                {name}
                                            </h4>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-navy-700/50 mb-3">
                                                <Clock size={10} className="shrink-0" />
                                                <span>{date}</span>
                                                <span className="opacity-40">•</span>
                                                <span>{time}</span>
                                            </div>
                                            <div className="inline-block bg-navy-50 text-navy-700 px-2 py-1 rounded-lg text-[10px] font-bold truncate max-w-full">
                                                {service}
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
