import { useEffect } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';

export function useRealtimeAppointments(onUpdate) {
    useEffect(() => {
        const channel = supabase
            .channel('appointments-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',           // INSERT | UPDATE | DELETE | *
                    schema: 'public',
                    table: 'appointments',
                    filter: `business_id=eq.${BUSINESS_ID}`
                },
                (payload) => {
                    console.log('Cambio en appointments:', payload.eventType);
                    onUpdate(payload);
                }
            )
            .subscribe();

        // Limpiar suscripción al desmontar
        return () => supabase.removeChannel(channel);
    }, [onUpdate]);
}

export function useRealtimePatients(onUpdate) {
    useEffect(() => {
        const channel = supabase
            .channel('patients-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'users',
                    filter: `business_id=eq.${BUSINESS_ID}`
                },
                (payload) => {
                    console.log('Cambio en users:', payload.eventType);
                    onUpdate(payload);
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [onUpdate]);
}
