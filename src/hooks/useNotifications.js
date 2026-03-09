import { useState, useEffect, useCallback } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';

export function useNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const loadNotifications = useCallback(async () => {
        // Obtenemos los últimos 10 turnos pendientes como notificaciones
        const { data, error } = await supabase
            .from('appointments')
            .select('*, users(display_name)')
            .eq('business_id', BUSINESS_ID)
            .eq('status', 'active')
            .eq('confirmed', false)
            .order('created_at', { ascending: false })
            .limit(10);

        if (!error && data) {
            setNotifications(data);
            setUnreadCount(data.length);
        }
    }, []);

    useEffect(() => {
        loadNotifications();

        const channel = supabase
            .channel('notifications-channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'appointments',
                    filter: `business_id=eq.${BUSINESS_ID}`
                },
                () => {
                    loadNotifications();
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [loadNotifications]);

    return { notifications, unreadCount };
}
