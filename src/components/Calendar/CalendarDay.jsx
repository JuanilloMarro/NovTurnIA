import { isSameDay, getEventStyleWithColumns, layoutOverlappingEvents } from '../../utils/calendarUtils';
import CalendarEvent from './CalendarEvent';

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9 a 17

export default function CalendarDay({ appointments, selectedDate, loading, onEventClick }) {
    const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.date_start), selectedDate));
    const layoutEvents = layoutOverlappingEvents(dayAppointments);
    const isToday = isSameDay(selectedDate, new Date());

    return (
        <div className="bg-white border border-white/90 rounded-2xl shadow-card overflow-hidden flex flex-col h-full">
            {/* Header día */}
            <div className="grid grid-cols-[70px_1fr] border-b border-gray-100/50 bg-white">
                <div className="p-2 text-[10px] uppercase text-gray-400 font-bold text-center flex items-center justify-center border-r border-gray-100/50">
                    GMT-6
                </div>
                <div className="p-2 px-4 flex items-center gap-3">
                    <div className={`text-2xl font-bold flex items-center justify-center rounded-xl w-10 h-10 shadow-sm ${isToday ? 'bg-navy-900 text-white' : 'text-gray-600 bg-white border border-gray-100'}`}>
                        {selectedDate.getDate()}
                    </div>
                    <div>
                        <div className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? 'text-navy-700' : 'text-gray-400'}`}>
                            {selectedDate.toLocaleDateString('es-GT', { weekday: 'long' })}
                        </div>
                        <div className="text-xs font-medium text-gray-500 mt-0.5">
                            {selectedDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-hidden relative">
                {/* Fondo de líneas */}
                <div className="absolute inset-0 left-[70px] pointer-events-none flex flex-col">
                    {HOURS.map(h => (
                        <div key={`line-${h}`} className="flex-1 w-full border-t border-gray-100/50" />
                    ))}
                </div>

                <div className="grid grid-cols-[70px_1fr] h-full">
                    {/* Gutter de horas */}
                    <div className="border-r border-gray-100/50 bg-white relative z-10 w-full h-full flex flex-col">
                        {HOURS.map(h => (
                            <div key={h} className="flex-1 w-full pr-3 pt-1.5 text-right">
                                <span className="text-[12px] font-medium text-gray-400">{h}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Columna del día */}
                    <div className="relative h-full">
                        {layoutEvents.map(({ appointment: apt, column, totalColumns }) => (
                            <CalendarEvent
                                key={apt.id}
                                appointment={apt}
                                style={getEventStyleWithColumns(apt.date_start, apt.date_end, column, totalColumns)}
                                onClick={onEventClick}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
