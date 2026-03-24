import { useState, useEffect } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';

export function useStats() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            // Inicio y fin del mes actual
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

            // Mes pasado
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            const lastMonthEnd = monthStart;

            // Consultas en paralelo
            const [
                { data: currentMonthApts },
                { data: lastMonthApts },
                { data: patientStats },
                { data: trendRaw }
            ] = await Promise.all([
                // Turnos del mes actual (todos los estados)
                supabase.from('appointments')
                    .select('id, status, confirmed, created_by, date_start, created_at')
                    .eq('business_id', BUSINESS_ID)
                    .gte('date_start', monthStart)
                    .lt('date_start', monthEnd),
                // Turnos del mes pasado
                supabase.from('appointments')
                    .select('id')
                    .eq('business_id', BUSINESS_ID)
                    .gte('date_start', lastMonthStart)
                    .lt('date_start', lastMonthEnd),
                // Pacientes (MV funciona porque no filtra por estado)
                supabase.from('mv_patient_stats')
                    .select('*')
                    .eq('business_id', BUSINESS_ID)
                    .single(),
                // Últimos 6 meses para el gráfico de tendencia (incluye MV + históricos)
                supabase.from('appointments')
                    .select('date_start, status')
                    .eq('business_id', BUSINESS_ID)
                    .gte('date_start', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString())
                    .order('date_start', { ascending: true })
            ]);

            const apts = (currentMonthApts || []);
            const lastMonthData = (lastMonthApts || []);

            const ps = patientStats || {};

            // KPIs del mes actual - Solo activos (no cancelados)
            const monthApts = apts.filter(a => a.status !== 'cancelled').length;
            const lastMonthCount = lastMonthData.filter(a => a.status !== 'cancelled').length;
            const aptsChange = lastMonthCount > 0
                ? (((monthApts - lastMonthCount) / lastMonthCount) * 100).toFixed(1)
                : undefined;

            const completedThisMonth = apts.filter(a => a.status === 'completed').length;
            const cancelledThisMonth = apts.filter(a => a.status === 'cancelled').length;
            const noShowThisMonth = apts.filter(a => a.status === 'no_show').length;
            const confirmedThisMonth = apts.filter(a => a.confirmed).length;
            const scheduledThisMonth = apts.filter(a => a.status === 'scheduled').length;
            const createdByBot = apts.filter(a => a.created_by === 'bot').length;
            const createdByStaff = apts.filter(a => a.created_by === 'dashboard').length;

            const completionPct = monthApts > 0 ? Math.round((completedThisMonth / monthApts) * 100) : 0;
            const cancellationPct = monthApts > 0 ? Math.round((cancelledThisMonth / monthApts) * 100) : 0;

            const totalPatients = Number(ps.total_patients) || 0;
            const activePatients = Number(ps.active_patients) || 0;
            const newThisMonth = Number(ps.new_this_month) || 0;

            // Donut data
            const totalForDonut = confirmedThisMonth + scheduledThisMonth + cancelledThisMonth;
            const confRate = totalForDonut === 0 ? 0 : Math.round((confirmedThisMonth / totalForDonut) * 100);

            // Raw appointments para que MainChart agrupe por día/semana/mes
            const rawApts = (trendRaw || []).map(a => ({ date_start: a.date_start, status: a.status }));

            setStats({
                kpi: {
                    monthApts,
                    aptsChange,
                    totalPatients,
                    activePatients,
                    newThisMonth,
                    completionPct,
                    cancellationPct,
                    confirmedThisMonth,
                    createdByBot,
                    createdByStaff,
                    avgDaysAdvance: 0,
                    inTakeover: Number(ps.in_takeover) || 0,
                },
                donut: {
                    confRate,
                    data: [
                        { name: 'Confirmados', value: confirmedThisMonth },
                        { name: 'Pendientes', value: Math.max(0, scheduledThisMonth) },
                        { name: 'Cancelados', value: cancelledThisMonth },
                    ]
                },
                rawApts
            });

        } finally {
            setLoading(false);
        }
    }

    return { stats, loading };
}
