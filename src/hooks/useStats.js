import { useState, useEffect } from 'react';
import {
    getStatsOverview,
    getCurrentMonthAppointments,
    getMessageCounts,
} from '../services/supabaseService';
import { useAppStore } from '../store/useAppStore';

// T-29: Eliminadas las 3 llamadas directas a supabase — ahora pasan por supabaseService.js.
// T-50: getMessageCounts ahora recibe monthStart/monthEnd para evitar COUNT(*) sin fecha.
// T-51: getAppointmentTrend movido a MainChart — el gráfico hace su propio fetch agregado.
// Reducción: 7 queries → 3 queries por carga, más cache de 5 minutos.
// - getStatsOverview()              → mv_business_stats + mv_patient_stats  (RPCs)
// - getCurrentMonthAppointments()   → breakdown del mes actual (confirmed/bot/staff)
// - getMessageCounts()              → mensajes enviados/recibidos del mes

const STALE_MS = 5 * 60_000; // 5 minutos

export function useStats() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load(forceRefresh = false) {
        const cache = useAppStore.getState()._statsCache;
        if (!forceRefresh && cache.data && Date.now() - cache.fetchedAt < STALE_MS) {
            setStats(cache.data);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

            // 3 queries en paralelo vía service layer (T-29, T-51):
            const [overview, currentMonthApts, messageCounts] = await Promise.all([
                getStatsOverview(),
                getCurrentMonthAppointments(monthStart, monthEnd),
                getMessageCounts(monthStart, monthEnd),
            ]);

            const { apptStats, patientStats } = overview;
            const apts = currentMonthApts || [];

            // Mes pasado desde mv_business_stats (ya calculado por Postgres)
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthKey  = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
            const lastMonthRow  = (apptStats || []).find(r => String(r.month || '').startsWith(lastMonthKey));
            const lastMonthCount = lastMonthRow?.total_appointments ?? lastMonthRow?.count ?? 0;

            // KPIs del mes actual
            const monthApts           = apts.filter(a => a.status !== 'cancelled').length;
            const aptsChange          = lastMonthCount > 0
                ? (((monthApts - lastMonthCount) / lastMonthCount) * 100).toFixed(1)
                : undefined;
            const confirmedThisMonth  = apts.filter(a => a.confirmed).length;
            const scheduledThisMonth  = apts.filter(a => a.status === 'scheduled' && !a.confirmed).length;
            const cancelledThisMonth  = apts.filter(a => a.status === 'cancelled').length;
            const noShowThisMonth     = apts.filter(a => a.status === 'no_show').length;
            const createdByBot        = apts.filter(a => a.created_by === 'bot').length;
            const createdByStaff      = apts.filter(a => a.created_by === 'dashboard').length;

            const totalForDonut = confirmedThisMonth + scheduledThisMonth + cancelledThisMonth + noShowThisMonth;
            const confRate      = totalForDonut === 0 ? 0 : Math.round((confirmedThisMonth / totalForDonut) * 100);

            const result = {
                kpi: {
                    monthApts,
                    aptsChange,
                    totalPatients:    patientStats?.total_patients ?? 0,
                    activePatients:   patientStats?.active_patients ?? patientStats?.total_patients ?? 0,
                    newThisMonth:     patientStats?.new_this_month ?? 0,
                    sentMessages:     messageCounts.sent,
                    receivedMessages: messageCounts.received,
                    confirmedThisMonth,
                    noShowThisMonth,
                    createdByBot,
                    createdByStaff,
                },
                donut: {
                    confRate,
                    data: [
                        { name: 'Confirmados',       value: confirmedThisMonth },
                        { name: 'Pendientes',         value: Math.max(0, scheduledThisMonth) },
                        { name: 'Cancelados',         value: cancelledThisMonth },
                        { name: 'No se presentaron', value: noShowThisMonth },
                    ]
                }
            };

            useAppStore.getState().setStatsCache(result);
            setStats(result);
        } catch (err) {
            console.error('Error loading stats:', err);
            setStats({
                kpi: { monthApts: 0, totalPatients: 0, activePatients: 0, newThisMonth: 0, sentMessages: 0, receivedMessages: 0, confirmedThisMonth: 0, createdByBot: 0, createdByStaff: 0 },
                donut: { confRate: 0, data: [{ name: 'Confirmados', value: 0 }, { name: 'Pendientes', value: 0 }, { name: 'Cancelados', value: 0 }] },
            });
        } finally {
            setLoading(false);
        }
    }

    return { stats, loading, reload: () => load(true) };
}
