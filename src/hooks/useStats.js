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

            const [usersRes, aptsRes, historyRes] = await Promise.all([
                supabase.from('users').select('*').eq('business_id', BUSINESS_ID),
                supabase.from('appointments').select('*').eq('business_id', BUSINESS_ID),
                supabase.from('history').select('*').eq('business_id', BUSINESS_ID)
            ]);

            const users = usersRes.data || [];
            const apts = aptsRes.data || [];
            const history = historyRes.data || [];

            // Patients KPI (Users table)
            const totalPatients = users.length;
            const newPatientsThisMonth = users.filter(u => new Date(u.created_at) >= startOfThisMonth).length;
            const newPatientsLastMonth = users.filter(u => new Date(u.created_at) >= startOfLastMonth && new Date(u.created_at) < startOfThisMonth).length;

            const patientsChange = newPatientsLastMonth === 0
                ? (newPatientsThisMonth > 0 ? 100 : 0)
                : ((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth) * 100;

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

            // History KPI (Messages) - Strict filtering to match user visible messages
            // We only count messages that belong to an existing user and have content
            const validUserIds = new Set(users.map(u => u.id));
            
            const sentHistory = history.filter(h => 
                h.role === 'assistant' && 
                validUserIds.has(h.user_id) && 
                h.content && h.content.trim().length > 0
            );
            const totalSent = sentHistory.length;
            const sentThisMonth = sentHistory.filter(h => new Date(h.created_at) >= startOfThisMonth).length;
            const sentLastMonth = sentHistory.filter(h => new Date(h.created_at) >= startOfLastMonth && new Date(h.created_at) < startOfThisMonth).length;
            const sentChange = sentLastMonth === 0
                ? (sentThisMonth > 0 ? 100 : 0)
                : ((sentThisMonth - sentLastMonth) / sentLastMonth) * 100;

            const receivedHistory = history.filter(h => 
                h.role === 'user' && 
                validUserIds.has(h.user_id) && 
                h.content && h.content.trim().length > 0
            );
            const totalReceived = receivedHistory.length;
            const receivedThisMonth = receivedHistory.filter(h => new Date(h.created_at) >= startOfThisMonth).length;
            const receivedLastMonth = receivedHistory.filter(h => new Date(h.created_at) >= startOfLastMonth && new Date(h.created_at) < startOfThisMonth).length;
            const receivedChange = receivedLastMonth === 0
                ? (receivedThisMonth > 0 ? 100 : 0)
                : ((receivedThisMonth - receivedLastMonth) / receivedLastMonth) * 100;

            // Donut Data
            const pendingThisMonth = aptsThisMonth.filter(a => !a.confirmed).length;
            const cancelledThisMonth = apts.filter(a => new Date(a.date_start) >= startOfThisMonth && a.status === 'cancelled').length;

            const totalForDonut = confThisMonth + pendingThisMonth + cancelledThisMonth;
            const confRate = totalForDonut === 0 ? 0 : Math.round((confThisMonth / totalForDonut) * 100);

            setStats({
                kpi: {
                    totalPatients,
                    patientsChange: newPatientsLastMonth > 0 ? patientsChange.toFixed(1) : undefined,
                    monthApts: aptsThisMonth.length,
                    aptsChange: aptsLastMonth.length > 0 ? aptsChange.toFixed(1) : undefined,
                    sentMessages: totalSent.toLocaleString(),
                    sentChange: sentLastMonth > 0 ? sentChange.toFixed(1) : undefined,
                    receivedMessages: totalReceived.toLocaleString(),
                    receivedChange: receivedLastMonth > 0 ? receivedChange.toFixed(1) : undefined,
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
