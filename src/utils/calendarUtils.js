const BASE_HOUR = 9;
const TOTAL_HOURS = 9; // 9 to 17 (9 hours shown)

export function getEventStyle(dateStart, dateEnd, pxPerHour = 48) {
    const toDecimal = iso => {
        const d = new Date(iso);
        const h = parseInt(d.toLocaleTimeString('es-GT', { hour: '2-digit', hour12: false, timeZone: 'America/Guatemala' }));
        return h + d.getMinutes() / 60;
    };

    const start = toDecimal(dateStart);
    const end = toDecimal(dateEnd);

    if (pxPerHour === 'percent') {
        const top = ((start - BASE_HOUR) / TOTAL_HOURS) * 100;
        const height = ((end - start) / TOTAL_HOURS) * 100;
        return {
            top: `${Math.max(top, 0)}%`,
            height: `${Math.max(height, 2)}%`,
            position: 'absolute',
            left: '4px',
            right: '4px',
        };
    }

    const top = (start - BASE_HOUR) * pxPerHour;
    const height = (end - start) * pxPerHour;

    return {
        top: `${Math.max(top, 0)}px`,
        height: `${Math.max(height, 24)}px`,
        position: 'absolute',
        left: '4px',
        right: '4px',
    };
}

/**
 * Calculate duration between two ISO dates in minutes
 */
export function getDurationMinutes(dateStart, dateEnd) {
    return (new Date(dateEnd) - new Date(dateStart)) / (1000 * 60);
}

/**
 * Layout overlapping events into columns.
 * Returns an array of { appointment, column, totalColumns } objects.
 */
export function layoutOverlappingEvents(dayAppointments) {
    if (!dayAppointments.length) return [];

    // Sort by start time, then by duration (longer first)
    const sorted = [...dayAppointments].sort((a, b) => {
        const diff = new Date(a.date_start) - new Date(b.date_start);
        if (diff !== 0) return diff;
        return (new Date(b.date_end) - new Date(b.date_start)) - (new Date(a.date_end) - new Date(a.date_start));
    });

    const groups = []; // groups of overlapping events
    let currentGroup = [sorted[0]];
    let groupEnd = new Date(sorted[0].date_end);

    for (let i = 1; i < sorted.length; i++) {
        const eventStart = new Date(sorted[i].date_start);
        if (eventStart < groupEnd) {
            // Overlaps with group
            currentGroup.push(sorted[i]);
            const eEnd = new Date(sorted[i].date_end);
            if (eEnd > groupEnd) groupEnd = eEnd;
        } else {
            groups.push(currentGroup);
            currentGroup = [sorted[i]];
            groupEnd = new Date(sorted[i].date_end);
        }
    }
    groups.push(currentGroup);

    // For each group, assign columns
    const results = [];
    for (const group of groups) {
        const columns = []; // each column is an array of events

        for (const event of group) {
            let placed = false;
            for (let col = 0; col < columns.length; col++) {
                const lastInCol = columns[col][columns[col].length - 1];
                if (new Date(event.date_start) >= new Date(lastInCol.date_end)) {
                    columns[col].push(event);
                    results.push({ appointment: event, column: col, totalColumns: -1 });
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([event]);
                results.push({ appointment: event, column: columns.length - 1, totalColumns: -1 });
            }
        }

        // Set totalColumns for all events in this group
        const tc = columns.length;
        for (const r of results) {
            if (r.totalColumns === -1 && group.includes(r.appointment)) {
                r.totalColumns = tc;
            }
        }
    }

    return results;
}

/**
 * Get event style with column-aware positioning for overlapping events
 */
export function getEventStyleWithColumns(dateStart, dateEnd, column, totalColumns) {
    const toDecimal = iso => {
        const d = new Date(iso);
        const h = parseInt(d.toLocaleTimeString('es-GT', { hour: '2-digit', hour12: false, timeZone: 'America/Guatemala' }));
        return h + d.getMinutes() / 60;
    };

    const start = toDecimal(dateStart);
    const end = toDecimal(dateEnd);
    const top = ((start - BASE_HOUR) / TOTAL_HOURS) * 100;
    const height = ((end - start) / TOTAL_HOURS) * 100;

    const widthPercent = 100 / totalColumns;
    const leftPercent = column * widthPercent;

    return {
        top: `${Math.max(top, 0)}%`,
        height: `${Math.max(height, 2)}%`,
        position: 'absolute',
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
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
