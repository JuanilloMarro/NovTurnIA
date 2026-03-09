import { getWeekDays, getEventStyle, isSameDay } from '../../utils/calendarUtils';
import CalendarEvent from './CalendarEvent';

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9 a 17

export default function CalendarWeek({ appointments, weekStart, loading, onEventClick }) {
    const days = getWeekDays(weekStart);

    return (
        <div className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card overflow-hidden">

            {/* Header días */}
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-100 bg-white/50">
                <div className="p-3 text-[10px] uppercase text-gray-400 font-semibold text-center flex items-center justify-center">GMT-6</div>
                {days.map((day, idx) => (
                    <div key={day} className="p-3 text-center relative flex flex-col items-center justify-center gap-1">
                        {idx !== 0 && <div className="absolute left-0 top-3 bottom-3 w-px bg-gray-100" />}
                        <div className={`text-[10px] font-bold uppercase tracking-wide
                            ${isSameDay(day, new Date()) ? 'text-navy-700' : 'text-gray-400'}`}>
                            {day.toLocaleDateString('es-GT', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-medium w-8 h-8 flex items-center justify-center rounded-full
                            ${isSameDay(day, new Date()) ? 'bg-navy-900 text-white shadow-sm' : 'text-gray-600'}`}>
                            {day.getDate()}
                        </div>
                    </div>
                ))}
            </div>

            {/* Cuerpo */}
            <div className="grid grid-cols-[64px_1fr] overflow-y-auto" style={{ height: '540px' }}>

                {/* Gutter de horas */}
                <div>
                    {HOURS.map(h => (
                        <div key={h} className="h-[60px] flex items-start justify-end pr-2 pt-1 border-b border-transparent">
                            <span className="text-xs text-gray-400">{h}:00</span>
                        </div>
                    ))}
                </div>

                {/* Columnas de días */}
                <div className="grid grid-cols-7">
                    {days.map((day, idx) => (
                        <div key={idx} className={`relative ${idx !== 0 ? 'border-l border-gray-100' : ''}`} style={{ minHeight: '540px' }}>

                            {/* Líneas de hora */}
                            {HOURS.map((h, i) => (
                                <div key={i} className="absolute w-full border-t border-gray-100/80" style={{ top: `${(h - 9) * 60}px` }} />
                            ))}

                            {/* Eventos del día */}
                            {appointments
                                .filter(apt => isSameDay(new Date(apt.date_start), day))
                                .map(apt => (
                                    <CalendarEvent
                                        key={apt.id}
                                        appointment={apt}
                                        style={getEventStyle(apt.date_start, apt.date_end)}
                                        onClick={onEventClick}
                                    />
                                ))
                            }
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
