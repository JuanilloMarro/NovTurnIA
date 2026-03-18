import { useState, useEffect, useCallback } from 'react';
import { getAppointmentsByWeek } from '../services/supabaseService';
import { useRealtimeAppointments } from './useRealtime';

function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function useAppointments() {
    const [anchorDate, setAnchorDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('week'); // 'day', 'week', 'month'
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Calculate start and end dates based on viewMode
    const getRange = (date, mode) => {
        const start = new Date(date);
        const end = new Date(date);

        if (mode === 'day') {
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 1);
            end.setHours(0, 0, 0, 0);
        } else if (mode === 'week') {
            const monday = getMonday(date);
            start.setTime(monday.getTime());
            end.setTime(monday.getTime());
            end.setDate(end.getDate() + 7);
        } else if (mode === 'month') {
            // Fetch the whole month + padding (roughly 42 days)
            start.setDate(1);
            const mondayOfFirstWeek = getMonday(start);
            start.setTime(mondayOfFirstWeek.getTime());
            
            end.setTime(start.getTime());
            end.setDate(end.getDate() + 42); // 6 weeks
        }
        return { start, end };
    };

    const { start: rangeStart, end: rangeEnd } = getRange(anchorDate, viewMode);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAppointmentsByWeek(
                rangeStart.toISOString().slice(0, 10),
                rangeEnd.toISOString().slice(0, 10)
            );
            setAppointments(data);
        } catch (err) {
            console.error("Error loading appointments:", err);
        } finally {
            setLoading(false);
        }
    }, [rangeStart.getTime(), rangeEnd.getTime()]);

    useEffect(() => { load(); }, [load]);

    useRealtimeAppointments(load);

    const prevWeek = () => setAnchorDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    const nextWeek = () => setAnchorDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    
    const prevDay = () => setAnchorDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
    const nextDay = () => setAnchorDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });

    const prevMonth = () => setAnchorDate(d => { 
        const n = new Date(d); 
        n.setMonth(n.getMonth() - 1); 
        n.setDate(1); 
        return n; 
    });
    const nextMonth = () => setAnchorDate(d => { 
        const n = new Date(d); 
        n.setMonth(n.getMonth() + 1); 
        n.setDate(1);
        return n; 
    });

    const goToday = () => setAnchorDate(new Date());

    return { 
        appointments, 
        loading, 
        anchorDate, 
        weekStart: getMonday(anchorDate), // For backwards compatibility
        viewMode,
        setViewMode,
        setDate: setAnchorDate,
        prevWeek, 
        nextWeek, 
        prevDay,
        nextDay,
        prevMonth,
        nextMonth,
        goToday, 
        reload: load 
    };
}
