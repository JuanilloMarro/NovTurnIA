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

                            <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar pr-2">
                                {dayAppointments.map(apt => {
                                    const timeStr = new Date(apt.date_start).toLocaleTimeString('es-GT', {
                                        hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true
                                    });
                                    const name = apt.patients?.display_name || 'Sin nombre';

                                    const status = apt.status === 'cancelled' ? 'cancelled'
                                        : apt.status === 'no_show' ? 'no_show'
                                        : apt.confirmed ? 'confirmed' : 'pending';

                                    const borderColor = {
                                        confirmed: 'border-l-emerald-500',
                                        pending:   'border-l-amber-400',
                                        cancelled: 'border-l-rose-400',
                                        no_show:   'border-l-gray-300',
                                    }[status];

                                    const nameColor = {
                                        confirmed: 'text-navy-900',
                                        pending:   'text-navy-900',
                                        cancelled: 'text-navy-900/60',
                                        no_show:   'text-navy-900/50',
                                    }[status];

                                    const timeColor = {
                                        confirmed: 'text-gray-500',
                                        pending:   'text-gray-500',
                                        cancelled: 'text-gray-400',
                                        no_show:   'text-gray-400',
                                    }[status];

                                    const faded = status === 'cancelled' || status === 'no_show' ? 'opacity-50' : '';

                                    return (
                                        <div
                                            key={apt.id}
                                            onClick={() => onEventClick?.(apt)}
                                            className={`flex items-center gap-1.5 cursor-pointer bg-white border-y border-r border-gray-100 border-l-[3px] rounded-r-xl rounded-l-sm px-2 py-1 shadow-sm hover:shadow-md transition-all overflow-hidden ${borderColor} ${faded}`}
                                        >
                                            <span className={`font-bold text-[11px] tracking-tight truncate leading-tight ${nameColor}`}>
                                                {name}
                                            </span>
                                            <span className={`text-[10px] font-medium shrink-0 ${timeColor}`}>
                                                {timeStr}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
