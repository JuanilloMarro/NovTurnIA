import { isSameDay, getEventStyleWithColumns, layoutOverlappingEvents } from '../../utils/calendarUtils';
import CalendarEvent from './CalendarEvent';
import { useAppStore } from '../../store/useAppStore';

export default function CalendarDay({ appointments, selectedDate, loading, onEventClick }) {
    const { businessHours } = useAppStore();
    const startH = parseInt((businessHours.schedule_start || '09:00').split(':')[0], 10);
    const endH   = parseInt((businessHours.schedule_end   || '18:00').split(':')[0], 10);
    const HOURS  = Array.from({ length: endH - startH + 1 }, (_, i) => i + startH);
    const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.date_start), selectedDate));
    const layoutEvents = layoutOverlappingEvents(dayAppointments);
    const isToday = isSameDay(selectedDate, new Date());

    return (
        <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden flex flex-col h-full">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            {/* Header día */}
            <div className="relative z-10 grid grid-cols-[70px_1fr] border-b border-gray-100/50 bg-transparent">
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
            <div className="relative z-10 flex-1 overflow-hidden">
                <div className="absolute inset-0">
                    {/* Fondo de líneas */}
                    <div className="absolute inset-0 left-[70px] pointer-events-none flex flex-col">
                        {HOURS.map(h => (
                            <div key={`line-${h}`} className="flex-1 w-full border-t border-gray-100/50" />
                        ))}
                    </div>

                    <div className="grid grid-cols-[70px_1fr] h-full">
                        {/* Gutter de horas */}
                        <div className="border-r border-gray-100/50 bg-transparent relative z-10 w-full h-full flex flex-col">
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
                                    style={getEventStyleWithColumns(apt.date_start, apt.date_end, column, totalColumns, startH, HOURS.length)}
                                    onClick={onEventClick}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
