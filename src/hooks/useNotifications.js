import { useEffect } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';
import { useToastStore, showAppointmentToast, showPatientToast } from '../store/useToastStore';

export function useNotifications() {
    const activityLog = useToastStore(s => s.activityLog);
    const unreadCount = useToastStore(s => s.unreadCount);
    const markAllRead = useToastStore(s => s.markAllRead);

    // Realtime listener — for external events (IA, WhatsApp bot, etc.)
    // Manual creations already log directly via addActivity in the modals
    useEffect(() => {
        const channel = supabase
            .channel('bell-realtime-v3')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'appointments' },
                async (payload) => {
                    if (Number(payload.new?.business_id) !== Number(BUSINESS_ID)) return;

                    // Check if this was already logged by the modal (within last 5 seconds)
                    const recentLogs = useToastStore.getState().activityLog;
                    const justLogged = recentLogs.some(entry => {
                        if (entry.type !== 'appointment') return false;
                        const age = Date.now() - new Date(entry.timestamp).getTime();
                        return age < 5000; // within 5s = likely from manual creation
                    });

                    if (justLogged) return; // Skip — already logged by the modal

                    let patientName = 'Paciente';
                    try {
                        const { data } = await supabase
                            .from('users')
                            .select('display_name')
                            .eq('id', payload.new.user_id)
                            .single();
                        if (data?.display_name) patientName = data.display_name;
                    } catch(_) {}

                    const dateStart = new Date(payload.new.date_start);
                    const timeStr = dateStart.toLocaleTimeString('es-GT', {
                        hour: '2-digit', minute: '2-digit', 
                        timeZone: 'America/Guatemala', hour12: true
                    });
                    const dateStr = dateStart.toLocaleDateString('es-GT', { 
                        day: 'numeric', month: 'short', weekday: 'short' 
                    }).replace(/\./g, '');

                    showAppointmentToast(patientName, `${dateStr} · ${timeStr}`);
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'users' },
                (payload) => {
                    if (Number(payload.new?.business_id) !== Number(BUSINESS_ID)) return;

                    // Check if already logged by modal
                    const recentLogs = useToastStore.getState().activityLog;
                    const justLogged = recentLogs.some(entry => {
                        if (entry.type !== 'patient') return false;
                        const age = Date.now() - new Date(entry.timestamp).getTime();
                        return age < 5000;
                    });

                    if (justLogged) return;

                    const name = payload.new.display_name || payload.new.full_name || 'Nuevo Paciente';
                    showPatientToast(name);
                }
            )
            .subscribe((status) => {
                console.log('📡 Realtime Notificaciones:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return { activityLog, unreadCount, markAllRead };
}
