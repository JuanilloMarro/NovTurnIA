import { useEffect } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';
import { useToastStore } from '../store/useToastStore';

export function useNotifications() {
    const activityLog = useToastStore(s => s.activityLog);
    const unreadCount = useToastStore(s => s.unreadCount);
    const markAllRead = useToastStore(s => s.markAllRead);
    const loadFromDB = useToastStore(s => s.loadFromDB);
    const addActivity = useToastStore(s => s.addActivity);

    // Load existing notifications from Supabase on mount
    useEffect(() => {
        loadFromDB();
    }, []);

    // Realtime listener — new rows in `notifications` table
    useEffect(() => {
        const channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `business_id=eq.${BUSINESS_ID}`
                },
                (payload) => {

                    const entry = payload.new;

                    // Add to local state (the store deduplicates by id)
                    addActivity({
                        id: entry.id,
                        type: entry.type,
                        title: entry.title,
                        message: entry.message,
                        read: entry.read,
                        timestamp: entry.created_at,
                        created_at: entry.created_at,
                    });

                    // Only add to activity log, don't show second toast
                    // (Frontend components already show their own detailed toasts)
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
