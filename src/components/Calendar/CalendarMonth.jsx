import { useMemo } from 'react';
import { isSameDay } from '../../utils/calendarUtils';

const DAYS_ES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

export default function CalendarMonth({ appointments, monthDate, loading, onEventClick }) {
    // Basic calendar logic to get all days to display in the grid (including padding days)
    const calendarDays = useMemo(() => {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const days = [];
        // Day of week: 0 is Sunday, so we adjust to make Monday = 0
        let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
        if (startingDayOfWeek === -1) startingDayOfWeek = 6;

        // Pading from previous month
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            days.push(new Date(year, month, -i));
        }

        // Days of current month
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        // Padding to complete rows (let's say 5 or 6 rows of 7 days = 35 or 42 days total)
        const remainingCells = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) {
            days.push(new Date(year, month + 1, i));
        }

        return days;
    }, [monthDate]);

    return (
        <div className="bg-white border border-white/90 rounded-2xl shadow-card overflow-hidden h-full flex flex-col">
            {/* Header días */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-white">
                {DAYS_ES.map((dayName, idx) => (
                    <div key={idx} className="p-3 text-xs text-gray-400 font-semibold uppercase relative">
                        {dayName}
                        {idx !== 0 && <div className="absolute left-0 top-3 bottom-3 w-px bg-gray-100" />}
                    </div>
                ))}
            </div>

            {/* Grid del mes */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-white">
                {calendarDays.map((date, idx) => {
                    const isCurrentMonth = date.getMonth() === monthDate.getMonth();
                    const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.date_start), date));
                    const isToday = isSameDay(date, new Date());

                    return (
                        <div key={idx} className={`border-b border-r border-gray-100 p-2 overflow-hidden bg-white hover:bg-gray-50/30 transition-colors
                            ${!isCurrentMonth ? 'opacity-40' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-navy-700 text-white' : 'text-gray-700'}`}>
                                    {date.getDate()}
                                </span>
                            </div>

                            <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                                {dayAppointments.map(apt => {
                                    const timeStr = new Date(apt.date_start).toLocaleTimeString('es-GT', {
                                        hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true
                                    });
                                    const name = apt.users?.display_name || apt.user_id;

                                    return (
                                        <div
                                            key={apt.id}
                                            onClick={() => onEventClick?.(apt)}
                                            className="text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-navy-50 rounded pl-1 py-0.5 text-gray-600 truncate border-l-2 border-navy-300"
                                        >
                                            <span className="font-medium text-navy-700 shrink-0">{timeStr}</span>
                                            <span className="truncate">{name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
