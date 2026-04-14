import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';
import { useAuth } from './useAuth';

// T-57: Hook genérico que elimina el 90% de código duplicado entre
// useRealtimeAppointments y useRealtimePatients.
function useRealtimeTable(table, channelPrefix, onUpdate) {
    const onUpdateRef = useRef(onUpdate);
    const { profile } = useAuth();
    const businessId = profile?.business_id || useAppStore.getState().businessId;

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });

    useEffect(() => {
        if (!businessId) return;

        const channel = supabase
            .channel(`${channelPrefix}-${businessId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table,
                    filter: `business_id=eq.${businessId}`,
                },
                (payload) => onUpdateRef.current(payload)
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [businessId, table, channelPrefix]);
}

export const useRealtimeAppointments = (onUpdate) =>
    useRealtimeTable('appointments', 'calendar-sync', onUpdate);

export const useRealtimePatients = (onUpdate) =>
    useRealtimeTable('patients', 'patients-sync', onUpdate);
