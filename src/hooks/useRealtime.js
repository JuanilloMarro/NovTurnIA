import { useEffect, useRef } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';

export function useRealtimeAppointments(onUpdate) {
    const onUpdateRef = useRef(onUpdate);

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });

    useEffect(() => {
        const channel = supabase
            .channel('calendar-sync')
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'appointments',
                    filter: `business_id=eq.${BUSINESS_ID}` 
                },
                (payload) => {
                    onUpdateRef.current(payload);
                }
            )
            .subscribe((status) => {
                console.log('🔌 Sync Calendar:', status);
            });

        return () => supabase.removeChannel(channel);
    }, []);
}

export function useRealtimePatients(onUpdate) {
    const onUpdateRef = useRef(onUpdate);

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });

    useEffect(() => {
        const channel = supabase
            .channel('patients-sync')
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'patients',
                    filter: `business_id=eq.${BUSINESS_ID}` 
                },
                (payload) => {
                    onUpdateRef.current(payload);
                }
            )
            .subscribe((status) => console.log('🔌 Sync Patients:', status));

        return () => supabase.removeChannel(channel);
    }, []);
}
