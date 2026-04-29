import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getAppointmentsByWeek } from '../services/supabaseService';
import { useRealtimeAppointments } from './useRealtime';
import { withTimeout } from '../utils/withTimeout';

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

    // T-58: memoizado para evitar recalcular en cada render cuando anchorDate/viewMode no cambian
    const { start: rangeStart, end: rangeEnd } = useMemo(
        () => getRange(anchorDate, viewMode),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [anchorDate.getTime(), viewMode]
    );
    const hasLoadedRef = useRef(false);
    const [reloading, setReloading] = useState(false);

    const load = useCallback(async (force = false) => {
        if (!hasLoadedRef.current || force) setLoading(true);
        try {
            // Timeout evita que la pantalla quede en skeleton/spinner si la petición
            // se cuelga (suspensión de pestaña, red intermitente, etc).
            const data = await withTimeout(
                getAppointmentsByWeek(
                    rangeStart.toISOString().slice(0, 10),
                    rangeEnd.toISOString().slice(0, 10)
                ),
                12_000,
                'getAppointmentsByWeek'
            );
            setAppointments(data);
            hasLoadedRef.current = true;
        } catch (err) {
            console.error("Error loading appointments:", err);
        } finally {
            setLoading(false);
        }
    }, [rangeStart.getTime(), rangeEnd.getTime()]);

    useEffect(() => { load(); }, [load]);

    const reload = useCallback(async () => {
        setReloading(true);
        try {
            const data = await withTimeout(
                getAppointmentsByWeek(
                    rangeStart.toISOString().slice(0, 10),
                    rangeEnd.toISOString().slice(0, 10)
                ),
                10_000,
                'reloadAppointments'
            );
            setAppointments(data);
        } catch (err) {
            console.error("Error reloading appointments:", err);
        } finally {
            setReloading(false);
        }
    }, [rangeStart.getTime(), rangeEnd.getTime()]);

    // Realtime Sync (Optimized: only re-fetch on Insert/Delete, Update locally)
    useRealtimeAppointments((payload) => {
        if (payload.eventType === 'UPDATE') {
            setAppointments(current =>
                current.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a)
            );
        } else {
            // T-47: invalidar cache de stats al crear/borrar citas — datos cambian
            useAppStore.getState().invalidateStatsCache();
            load();
        }
    });

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
        reloading,
        anchorDate,
        weekStart: getMonday(anchorDate),
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
        reload,
    };
}
