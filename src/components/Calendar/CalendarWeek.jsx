import { getWeekDays, getEventStyleWithColumns, isSameDay, layoutOverlappingEvents } from '../../utils/calendarUtils';
import CalendarEvent from './CalendarEvent';

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9 a 17

export default function CalendarWeek({ appointments, weekStart, loading, onEventClick }) {
    const days = getWeekDays(weekStart);

    return (
        <div className="bg-white border border-white/90 rounded-2xl shadow-card flex flex-col h-full overflow-hidden">

            {/* Header días */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100/50 bg-white">
                <div className="py-2 text-[9px] uppercase text-gray-400 font-bold text-center flex items-center justify-center">GMT-6</div>
                {days.map((day, idx) => (
                    <div key={day} className={`py-1.5 text-center relative flex flex-col items-center justify-center gap-0.5 ${idx !== 0 ? 'border-l border-gray-100/50' : ''}`}>
                        <div className={`text-[9px] font-bold uppercase tracking-wider
                            ${isSameDay(day, new Date()) ? 'text-navy-700' : 'text-gray-400'}`}>
                            {day.toLocaleDateString('es-GT', { weekday: 'short' })}
                        </div>
                        <div className={`text-sm font-medium w-6 h-6 lg:w-7 lg:h-7 flex items-center justify-center rounded-full
                            ${isSameDay(day, new Date()) ? 'bg-navy-900 text-white shadow-sm' : 'text-gray-600'}`}>
                            {day.getDate()}
                        </div>
                    </div>
                ))}
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0">
                    {/* Fondo de líneas */}
                    <div className="absolute inset-0 left-[60px] pointer-events-none flex flex-col">
                        {HOURS.map(h => (
                            <div key={`line-${h}`} className="flex-1 w-full border-t border-gray-100/50" />
                        ))}
                    </div>

                    <div className="grid grid-cols-[60px_repeat(7,1fr)] h-full">
                        {/* Gutter de horas */}
                        <div className="border-r border-gray-100/50 bg-white relative z-10 w-full h-full flex flex-col">
                            {HOURS.map(h => (
                                <div key={h} className="flex-1 w-full pr-2 pt-1.5 text-right">
                                    <span className="text-[10px] sm:text-xs text-gray-400 font-medium">{h}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* Columnas de días */}
                        {days.map((day, idx) => {
                            const dayApts = appointments.filter(apt => isSameDay(new Date(apt.date_start), day));
                            const layoutEvents = layoutOverlappingEvents(dayApts);

                            return (
                                <div key={idx} className={`relative h-full ${idx !== 0 ? 'border-l border-gray-100/50' : ''}`}>
                                    {layoutEvents.map(({ appointment: apt, column, totalColumns }) => (
                                        <CalendarEvent
                                            key={apt.id}
                                            appointment={apt}
                                            style={getEventStyleWithColumns(apt.date_start, apt.date_end, column, totalColumns)}
                                            onClick={onEventClick}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
