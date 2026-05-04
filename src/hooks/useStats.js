import { useState, useEffect, useRef } from 'react';
import { getStatsDashboard } from '../services/supabaseService';
import { useAppStore } from '../store/useAppStore';
import { withTimeout } from '../utils/withTimeout';

const STALE_MS = 5 * 60_000;

// ── Helper de rango de fechas compartido con MainChart ────
// period: 'day' | 'week' | 'month'
// Ancla: hoy si es el mes actual, día 15 del mes seleccionado si es pasado.
export function getStatsDateRange(period, year, month) {
    const now            = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const anchor         = isCurrentMonth ? now : new Date(year, month, 15);

    if (period === 'month') {
        return {
            start: new Date(year, month, 1).toISOString(),
            end:   new Date(year, month + 1, 1).toISOString(),
        };
    }

    // Lunes de la semana que contiene el ancla
    const dow    = anchor.getDay();
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - dow + (dow === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);

    if (period === 'day') {
        const end = new Date(monday);
        end.setDate(monday.getDate() + 7);
        return { start: monday.toISOString(), end: end.toISOString() };
    }

    // week: 4 semanas antes del lunes ancla + 2 después
    const start = new Date(monday);
    start.setDate(monday.getDate() - 28);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 14);
    return { start: start.toISOString(), end: end.toISOString() };
}

export function useStats(period = 'month', year = new Date().getFullYear(), month = new Date().getMonth()) {
    const [stats, setStats]     = useState(null);
    const [loading, setLoading] = useState(true);
    const lastKey               = useRef(null);

    useEffect(() => { load(); }, [period, year, month]);

    async function load(forceRefresh = false) {
        const cacheKey     = `${period}-${year}-${month}`;
        const keyChanged   = lastKey.current !== cacheKey;
        const isCurrentMon = year === new Date().getFullYear() && month === new Date().getMonth();

        // Caché solo para mes actual en período 'month'
        if (!forceRefresh && !keyChanged && period === 'month' && isCurrentMon) {
            const cache = useAppStore.getState()._statsCache;
            if (cache.data && Date.now() - cache.fetchedAt < STALE_MS) {
                setStats(cache.data);
                setLoading(false);
                return;
            }
        }

        lastKey.current = cacheKey;
        setLoading(true);

        try {
            const { start, end } = getStatsDateRange(period, year, month);

            const dashboard = await withTimeout(
                getStatsDashboard(start, end),
                12_000,
                'getStatsDashboard'
            );

            const apptStats    = dashboard.appt_stats   || [];
            const patientStats = dashboard.patient_stats ?? null;
            const apts         = dashboard.month_appointments || [];

            // Variación vs período anterior (solo vista mensual en mes actual)
            let aptsChange;
            if (period === 'month' && year === new Date().getFullYear() && month === new Date().getMonth()) {
                const lastMonthDate  = new Date(year, month - 1, 1);
                const lastMonthKey   = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
                const lastMonthRow   = apptStats.find(r => String(r.month || '').startsWith(lastMonthKey));
                const lastMonthCount = lastMonthRow?.total_appointments ?? lastMonthRow?.count ?? 0;
                const monthApts      = apts.filter(a => a.status !== 'cancelled').length;
                aptsChange = lastMonthCount > 0
                    ? (((monthApts - lastMonthCount) / lastMonthCount) * 100).toFixed(1)
                    : undefined;
            }

            const monthApts          = apts.filter(a => a.status !== 'cancelled').length;
            const confirmedThisMonth = apts.filter(a => a.confirmed).length;
            const scheduledThisMonth = apts.filter(a => (a.status === 'scheduled' || a.status === 'pending') && !a.confirmed).length;
            const cancelledThisMonth = apts.filter(a => a.status === 'cancelled').length;
            const noShowThisMonth    = apts.filter(a => a.status === 'no_show').length;
            const createdByBot       = apts.filter(a => a.created_by === 'bot').length;
            const createdByStaff     = apts.filter(a => a.created_by === 'dashboard').length;

            const totalForDonut = confirmedThisMonth + scheduledThisMonth + cancelledThisMonth + noShowThisMonth;
            const confRate      = totalForDonut === 0 ? 0 : Math.round((confirmedThisMonth / totalForDonut) * 100);

            const result = {
                kpi: {
                    monthApts,
                    aptsChange,
                    totalPatients:    patientStats?.total_patients ?? 0,
                    activePatients:   patientStats?.active_patients ?? patientStats?.total_patients ?? 0,
                    newThisMonth:     patientStats?.new_this_month ?? 0,
                    sentMessages:     Number(dashboard.sent_count     ?? 0),
                    receivedMessages: Number(dashboard.received_count ?? 0),
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
                    ],
                },
            };

            if (period === 'month' && year === new Date().getFullYear() && month === new Date().getMonth()) {
                useAppStore.getState().setStatsCache(result);
            }
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
