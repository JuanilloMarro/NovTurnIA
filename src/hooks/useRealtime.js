import { useEffect } from 'react';
import { supabase, BUSINESS_ID } from '../config/supabase';

export function useRealtimeAppointments(onUpdate) {
    useEffect(() => {
        const channel = supabase
            .channel('calendar-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments' },
                (payload) => {
                    // Solo refrescar si pertenece al negocio
                    if (payload.new?.business_id == BUSINESS_ID || payload.old?.business_id == BUSINESS_ID) {
                        onUpdate(payload);
                    }
                }
            )
            .subscribe((status) => {
                console.log('🔌 Sync Calendar:', status);
            });

        return () => supabase.removeChannel(channel);
    }, [onUpdate]);
}

export function useRealtimePatients(onUpdate) {
    useEffect(() => {
        const channel = supabase
            .channel('patients-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                (payload) => {
                    if (payload.new?.business_id == BUSINESS_ID || payload.old?.business_id == BUSINESS_ID) {
                        onUpdate(payload);
                    }
                }
            )
            .subscribe((status) => console.log('🔌 Sync Patients:', status));

        return () => supabase.removeChannel(channel);
    }, [onUpdate]);
}
