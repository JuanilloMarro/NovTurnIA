import { useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { useAuth } from './useAuth';

export function useNotifications() {
    const activityLog = useToastStore(s => s.activityLog);
    const unreadCount = useToastStore(s => s.unreadCount);
    const markAllRead = useToastStore(s => s.markAllRead);
    const loadFromDB = useToastStore(s => s.loadFromDB);
    const addActivity = useToastStore(s => s.addActivity);
    const { profile } = useAuth();
    const businessId = profile?.business_id || useAppStore.getState().businessId;

    // Load existing notifications from Supabase on mount
    useEffect(() => {
        if (businessId) loadFromDB();
    }, [businessId]);

    // Realtime listener — new rows in `notifications` table
    useEffect(() => {
        if (!businessId) return; // No suscribirse sin business_id

        const channel = supabase
            .channel(`notifications-realtime-${businessId}`)
            .on(
                'postgres_changes',
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `business_id=eq.${businessId}`
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [businessId]); // Re-suscribirse cuando cambia el business_id

    return { activityLog, unreadCount, markAllRead };
}
