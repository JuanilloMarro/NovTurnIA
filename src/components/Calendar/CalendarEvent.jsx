import { getDurationMinutes } from '../../utils/calendarUtils';

export default function CalendarEvent({ appointment, style, onClick, isCompact }) {
    const status = appointment.status === 'cancelled' ? 'cancelled'
        : appointment.status === 'no_show' ? 'no_show'
        : appointment.confirmed ? 'confirmed' : 'pending';

    const borders = {
        confirmed: 'border-l-emerald-500',
        pending:   'border-l-amber-400',
        cancelled: 'border-l-rose-400 opacity-50',
        no_show:   'border-l-gray-300 opacity-50',
    };

    const nameColor = {
        confirmed: 'text-navy-900',
        pending:   'text-navy-900',
        cancelled: 'text-navy-900/60',
        no_show:   'text-navy-900/50',
    };

    const timeColor = {
        confirmed: 'text-gray-500',
        pending:   'text-gray-500',
        cancelled: 'text-gray-400',
        no_show:   'text-gray-400',
    };

    const start = new Date(appointment.date_start);
    const end = new Date(appointment.date_end);
    const duration = getDurationMinutes(appointment.date_start, appointment.date_end);

    const formatTime = (d) => d.toLocaleTimeString('es-GT', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true
    });

    const name = appointment.patients?.display_name || 'Sin nombre';
    const timeText = `${formatTime(start)} - ${formatTime(end)}`;

    // Mismo lenguaje glass que las fichas de Clientes/Kanban, conservando el
    // borde izquierdo de color como indicador de estado.
    const baseClass = `relative bg-white/40 backdrop-blur-2xl border-y border-r border-white/60 shadow-md hover:bg-white/60 border-l-[3px] cursor-pointer transition-all duration-300 overflow-hidden ${borders[status]}`;

    const glow = (
        <>
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
        </>
    );

    // Compact layout for short events (≤ 30min)
    if (duration <= 30 || isCompact) {
        return (
            <div
                style={style}
                onClick={() => onClick?.(appointment)}
                className={`${baseClass} rounded-r-xl rounded-l-sm px-2 py-1`}
            >
                {glow}
                <div className="relative z-10 flex items-center gap-2">
                    <span className={`font-bold text-[11px] tracking-tight truncate leading-tight ${nameColor[status]}`}>
                        {name}
                    </span>
                    <span className={`text-[10px] font-medium truncate shrink-0 ${timeColor[status]}`}>
                        {formatTime(start)}
                    </span>
                </div>
            </div>
        );
    }

    // Normal layout for 45min - 1h events
    if (duration <= 60) {
        return (
            <div
                style={style}
                onClick={() => onClick?.(appointment)}
                className={`${baseClass} rounded-r-xl rounded-l-sm p-2`}
            >
                {glow}
                <div className="relative z-10 flex flex-col justify-start">
                    <div className={`font-bold text-[12px] tracking-tight truncate leading-tight ${nameColor[status]}`}>
                        {name}
                    </div>
                    <div className={`text-[10px] font-medium mt-0.5 truncate ${timeColor[status]}`}>
                        {timeText}
                    </div>
                </div>
            </div>
        );
    }

    // Expanded layout for long events (> 1h)
    return (
        <div
            style={style}
            onClick={() => onClick?.(appointment)}
            className={`${baseClass} rounded-r-xl rounded-l-sm p-2.5`}
        >
            {glow}
            <div className="relative z-10 flex flex-col justify-start">
                <div className={`font-bold text-[13px] tracking-tight truncate leading-tight ${nameColor[status]}`}>
                    {name}
                </div>
                <div className={`text-[11px] font-medium mt-1 truncate ${timeColor[status]}`}>
                    {timeText}
                </div>
                {duration >= 90 && (
                    <div className={`text-[10px] font-medium mt-1 ${timeColor[status]}`}>
                        {Math.floor(duration / 60)}h {duration % 60 > 0 ? `${duration % 60}min` : ''}
                    </div>
                )}
            </div>
        </div>
    );
}
