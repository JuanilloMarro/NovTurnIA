export default function CalendarEvent({ appointment, style, onClick }) {
    const borders = {
        confirmed: 'border-l-emerald-500',
        pending: 'border-l-navy-700',
        cancelled: 'border-l-gray-300 opacity-60',
    };

    const status = appointment.status === 'cancelled' ? 'cancelled'
        : appointment.confirmed ? 'confirmed' : 'pending';

    const start = new Date(appointment.date_start);
    const end = new Date(appointment.date_end);

    const formatTime = (d) => d.toLocaleTimeString('es-GT', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala', hour12: true
    });

    return (
        <div
            style={style}
            onClick={() => onClick?.(appointment)}
            className={`bg-white border-y border-r border-gray-100 shadow-sm hover:shadow-md border-l-[3px] rounded-r-xl rounded-l-sm p-2 cursor-pointer transition-all flex flex-col justify-start overflow-hidden ${borders[status]}`}
        >
            <div className="font-bold text-navy-900 text-[13px] tracking-tight truncate leading-tight">
                {appointment.users?.display_name || appointment.user_id}
            </div>
            <div className="text-[11px] font-medium text-gray-500 mt-1 truncate">
                {formatTime(start)} - {formatTime(end)}
            </div>
        </div>
    );
}
