import { useEffect, useRef } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';
import { useAuth } from './useAuth';

export function useRealtimeAppointments(onUpdate) {
    const onUpdateRef = useRef(onUpdate);
    const { profile } = useAuth();
    const businessId = profile?.business_id || BUSINESS_ID;

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });

    useEffect(() => {
        if (!businessId) return; // No suscribirse si no hay business_id

        const channel = supabase
            .channel(`calendar-sync-${businessId}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'appointments',
                    filter: `business_id=eq.${businessId}` 
                },
                (payload) => {
                    onUpdateRef.current(payload);
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [businessId]); // Re-suscribirse cuando cambia el business_id
}

export function useRealtimePatients(onUpdate) {
    const onUpdateRef = useRef(onUpdate);
    const { profile } = useAuth();
    const businessId = profile?.business_id || BUSINESS_ID;

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });

    useEffect(() => {
        if (!businessId) return;

        const channel = supabase
            .channel(`patients-sync-${businessId}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'patients',
                    filter: `business_id=eq.${businessId}` 
                },
                (payload) => {
                    onUpdateRef.current(payload);
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [businessId]);
}
