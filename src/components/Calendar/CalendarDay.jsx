import { isSameDay, getEventStyle } from '../../utils/calendarUtils';
import CalendarEvent from './CalendarEvent';

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9 a 17

export default function CalendarDay({ appointments, selectedDate, loading, onEventClick }) {
    const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.date_start), selectedDate));
    const isToday = isSameDay(selectedDate, new Date());

    return (
        <div className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card overflow-hidden">
            {/* Header día */}
            <div className="grid grid-cols-[80px_1fr] border-b border-gray-100 bg-white/50">
                <div className="p-4 text-[11px] uppercase text-gray-400 font-semibold text-center flex items-center justify-center border-r border-gray-100">
                    GMT-6
                </div>
                <div className="p-4 flex items-center gap-4">
                    <div className={`text-3xl font-bold flex items-center justify-center rounded-2xl w-14 h-14 ${isToday ? 'bg-navy-900 text-white shadow-md' : 'text-navy-900 bg-white/60 shadow-sm border border-gray-100'}`}>
                        {selectedDate.getDate()}
                    </div>
                    <div>
                        <div className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-navy-700' : 'text-gray-400'}`}>
                            {selectedDate.toLocaleDateString('es-GT', { weekday: 'long' })}
                        </div>
                        <div className="text-sm font-medium text-gray-500 mt-0.5">
                            {selectedDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Cuerpo */}
            <div className="grid grid-cols-[80px_1fr] overflow-y-auto" style={{ height: '540px' }}>
                {/* Gutter de horas */}
                <div className="border-r border-gray-100 bg-gray-50/30">
                    {HOURS.map(h => (
                        <div key={h} className="h-[80px] flex items-start justify-end pr-4 pt-2 border-b border-transparent">
                            <span className="text-[13px] font-medium text-gray-400">{h}:00</span>
                        </div>
                    ))}
                </div>

                {/* Columna del día */}
                <div className="relative" style={{ minHeight: `${HOURS.length * 80}px` }}>
                    {/* Líneas de hora */}
                    {HOURS.map((h, i) => (
                        <div key={i} className="absolute w-full border-t border-gray-100/80" style={{ top: `${(h - 9) * 80}px` }} />
                    ))}

                    {/* Eventos */}
                    {dayAppointments.map(apt => (
                        <CalendarEvent
                            key={apt.id}
                            appointment={apt}
                            style={getEventStyle(apt.date_start, apt.date_end, 80)}
                            onClick={onEventClick}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
