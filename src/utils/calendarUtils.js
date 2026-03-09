const BASE_HOUR = 9;
const PX_PER_HOUR = 60;

export function getEventStyle(dateStart, dateEnd, pxPerHour = 60) {
    const toDecimal = iso => {
        const d = new Date(iso);
        const h = parseInt(d.toLocaleTimeString('es-GT', { hour: '2-digit', hour12: false, timeZone: 'America/Guatemala' }));
        return h + d.getMinutes() / 60;
    };

    const start = toDecimal(dateStart);
    const end = toDecimal(dateEnd);
    const top = (start - BASE_HOUR) * pxPerHour;
    const height = (end - start) * pxPerHour;

    return {
        top: `${Math.max(top, 0)}px`,
        height: `${Math.max(height, 28)}px`,
        position: 'absolute',
        left: '4px',
        right: '4px',
    };
}

export function getWeekDays(weekStart) {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    });
}

export function isSameDay(date1, date2) {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}
