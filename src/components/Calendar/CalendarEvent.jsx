import { getDurationMinutes } from '../../utils/calendarUtils';

export default function CalendarEvent({ appointment, style, onClick, isCompact }) {
    const borders = {
        confirmed: 'border-l-emerald-500',
        pending: 'border-l-navy-700',
        cancelled: 'border-l-gray-300 opacity-60',
    };

    const status = appointment.status === 'cancelled' ? 'cancelled'
        : appointment.confirmed ? 'confirmed' : 'pending';

    const start = new Date(appointment.date_start);
    const end = new Date(appointment.date_end);
    const duration = getDurationMinutes(appointment.date_start, appointment.date_end);

    const formatTime = (d) => d.toLocaleTimeString('es-GT', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true
    });

    const name = appointment.users?.display_name || appointment.user_id;
    const timeText = `${formatTime(start)} - ${formatTime(end)}`;

    // Compact layout for short events (≤ 30min)
    if (duration <= 30 || isCompact) {
        return (
            <div
                style={style}
                onClick={() => onClick?.(appointment)}
                className={`bg-white border-y border-r border-gray-100 shadow-sm hover:shadow-md border-l-[3px] rounded-r-xl rounded-l-sm px-2 py-1 cursor-pointer transition-all flex items-center gap-2 overflow-hidden ${borders[status]}`}
            >
                <span className="font-bold text-navy-900 text-[11px] tracking-tight truncate leading-tight">
                    {name}
                </span>
                <span className="text-[10px] font-medium text-gray-400 truncate shrink-0">
                    {formatTime(start)}
                </span>
            </div>
        );
    }

    // Normal layout for 45min - 1h events
    if (duration <= 60) {
        return (
            <div
                style={style}
                onClick={() => onClick?.(appointment)}
                className={`bg-white border-y border-r border-gray-100 shadow-sm hover:shadow-md border-l-[3px] rounded-r-xl rounded-l-sm p-2 cursor-pointer transition-all flex flex-col justify-start overflow-hidden ${borders[status]}`}
            >
                <div className="font-bold text-navy-900 text-[12px] tracking-tight truncate leading-tight">
                    {name}
                </div>
                <div className="text-[10px] font-medium text-gray-500 mt-0.5 truncate">
                    {timeText}
                </div>
            </div>
        );
    }

    // Expanded layout for long events (> 1h)
    return (
        <div
            style={style}
            onClick={() => onClick?.(appointment)}
            className={`bg-white border-y border-r border-gray-100 shadow-sm hover:shadow-md border-l-[3px] rounded-r-xl rounded-l-sm p-2.5 cursor-pointer transition-all flex flex-col justify-start overflow-hidden ${borders[status]}`}
        >
            <div className="font-bold text-navy-900 text-[13px] tracking-tight truncate leading-tight">
                {name}
            </div>
            <div className="text-[11px] font-medium text-gray-500 mt-1 truncate">
                {timeText}
            </div>
            {duration >= 90 && (
                <div className="text-[10px] font-medium text-gray-400 mt-1">
                    {Math.floor(duration / 60)}h {duration % 60 > 0 ? `${duration % 60}min` : ''}
                </div>
            )}
        </div>
    );
}
