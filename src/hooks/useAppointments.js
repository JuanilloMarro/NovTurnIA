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
    const [weekStart, setWeekStart] = useState(getMonday(new Date()));
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAppointmentsByWeek(
                weekStart.toISOString().slice(0, 10),
                weekEnd.toISOString().slice(0, 10)
            );
            setAppointments(data);
        } finally {
            setLoading(false);
        }
    }, [weekStart]);

    useEffect(() => { load(); }, [load]);

    // Recargar al recibir cambio en tiempo real
    useRealtimeAppointments(load);

    const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    const goToday = () => setWeekStart(getMonday(new Date()));

    return { appointments, loading, weekStart, weekEnd, prevWeek, nextWeek, goToday };
}
