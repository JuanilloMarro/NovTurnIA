import { useState, useEffect } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';

export function useStats() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            const now = new Date();
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

            const [usersRes, aptsRes] = await Promise.all([
                supabase.from('users').select('created_at').eq('business_id', BUSINESS_ID),
                supabase.from('appointments').select('date_start, status, confirmed').eq('business_id', BUSINESS_ID)
            ]);

            const users = usersRes.data || [];
            const apts = aptsRes.data || [];

            // Patients KPI
            const totalPatients = users.length;
            const patientsUpToLastMonth = users.filter(u => new Date(u.created_at) < startOfThisMonth).length;
            const patientsUpToPreviousMonth = users.filter(u => new Date(u.created_at) < startOfLastMonth).length;

            const newPatientsThisMonth = users.length - patientsUpToLastMonth;
            const newPatientsLastMonth = patientsUpToLastMonth - patientsUpToPreviousMonth;

            // Protect against Infinity
            const patientsChange = patientsUpToLastMonth === 0
                ? (newPatientsThisMonth > 0 ? 100 : 0)
                : (newPatientsThisMonth / patientsUpToLastMonth) * 100;

            // Appointments KPI
            const aptsThisMonth = apts.filter(a => new Date(a.date_start) >= startOfThisMonth && a.status === 'active');
            const aptsLastMonth = apts.filter(a => new Date(a.date_start) >= startOfLastMonth && new Date(a.date_start) < startOfThisMonth && a.status === 'active');
            const aptsChange = aptsLastMonth.length === 0
                ? (aptsThisMonth.length > 0 ? 100 : 0)
                : ((aptsThisMonth.length - aptsLastMonth.length) / aptsLastMonth.length) * 100;

            // Confirmed KPI
            const confThisMonth = aptsThisMonth.filter(a => a.confirmed).length;
            const confLastMonth = aptsLastMonth.filter(a => a.confirmed).length;
            const confChange = confLastMonth === 0
                ? (confThisMonth > 0 ? 100 : 0)
                : ((confThisMonth - confLastMonth) / confLastMonth) * 100;

            // Donut Data
            const pendingThisMonth = aptsThisMonth.filter(a => !a.confirmed).length;
            const cancelledThisMonth = apts.filter(a => new Date(a.date_start) >= startOfThisMonth && a.status === 'cancelled').length;

            const totalForDonut = confThisMonth + pendingThisMonth + cancelledThisMonth;
            const confRate = totalForDonut === 0 ? 0 : Math.round((confThisMonth / totalForDonut) * 100);

            setStats({
                kpi: {
                    totalPatients,
                    patientsChange: patientsChange.toFixed(1),
                    monthApts: aptsThisMonth.length,
                    aptsChange: aptsChange.toFixed(1),
                    confThisMonth,
                    confChange: confChange.toFixed(1),
                },
                donut: {
                    confRate,
                    data: [
                        { name: 'Confirmados', value: confThisMonth },
                        { name: 'Pendientes', value: pendingThisMonth },
                        { name: 'Cancelados', value: cancelledThisMonth },
                    ]
                },
                rawApts: apts
            });

        } finally {
            setLoading(false);
        }
    }

    return { stats, loading };
}
