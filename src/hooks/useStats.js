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
                { count: totalPatients },
                { count: newThisMonth },
                { count: sentMessages },
                { count: receivedMessages },
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
                // Total Pacientes (consultando tabla real)
                supabase.from('patients')
                    .select('*', { count: 'exact', head: true })
                    .eq('business_id', BUSINESS_ID),
                // Nuevos este mes
                supabase.from('patients')
                    .select('*', { count: 'exact', head: true })
                    .eq('business_id', BUSINESS_ID)
                    .gte('created_at', monthStart),
                // Mensajes Enviados (Bot → User)
                supabase.from('history')
                    .select('*', { count: 'exact', head: true })
                    .eq('business_id', BUSINESS_ID)
                    .eq('role', 'assistant'),
                // Mensajes Recibidos (User → Bot)
                supabase.from('history')
                    .select('*', { count: 'exact', head: true })
                    .eq('business_id', BUSINESS_ID)
                    .eq('role', 'user'),
                // Últimos 6 meses para el gráfico de tendencia
                supabase.from('appointments')
                    .select('date_start, status')
                    .eq('business_id', BUSINESS_ID)
                    .gte('date_start', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString())
                    .order('date_start', { ascending: true })
            ]);

            const apts = (currentMonthApts || []);
            const lastMonthData = (lastMonthApts || []);

            // KPIs del mes actual - Solo activos (no cancelados)
            const monthApts = apts.filter(a => a.status !== 'cancelled').length;
            const lastMonthCount = lastMonthData.filter(a => a.status !== 'cancelled').length;
            const aptsChange = lastMonthCount > 0
                ? (((monthApts - lastMonthCount) / lastMonthCount) * 100).toFixed(1)
                : undefined;

            const confirmedThisMonth = apts.filter(a => a.confirmed).length;
            const scheduledThisMonth = apts.filter(a => a.status === 'scheduled').length;
            const cancelledThisMonth = apts.filter(a => a.status === 'cancelled').length;
            const createdByBot = apts.filter(a => a.created_by === 'bot').length;
            const createdByStaff = apts.filter(a => a.created_by === 'dashboard').length;

            // Donut data
            const totalForDonut = confirmedThisMonth + scheduledThisMonth + cancelledThisMonth;
            const confRate = totalForDonut === 0 ? 0 : Math.round((confirmedThisMonth / totalForDonut) * 100);

            // Raw appointments para que MainChart agrupe por día/semana/mes
            const rawApts = (trendRaw || []).map(a => ({ date_start: a.date_start, status: a.status }));

            setStats({
                kpi: {
                    monthApts,
                    aptsChange,
                    totalPatients: totalPatients || 0,
                    activePatients: totalPatients || 0, // Using total as active for now
                    newThisMonth: newThisMonth || 0,
                    sentMessages: sentMessages || 0,
                    receivedMessages: receivedMessages || 0,
                    confirmedThisMonth,
                    createdByBot,
                    createdByStaff,
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
