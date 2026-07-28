import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';
import { useAuth } from './useAuth';
import { invalidateVisibilityCache } from '../services/supabaseService';

// T-57: Hook genérico que elimina el 90% de código duplicado entre
// useRealtimeAppointments y useRealtimePatients.
//
// T-11 / COD-4 (resuelto): el banner de estado estuvo desactivado porque CLOSED se
// dispara tanto en una desconexión real como al desmontar por navegación, así que
// activarlo daba falsos positivos. La distinción que faltaba: separar los estados
// inequívocos del ambiguo, y saber si el cierre lo provocamos nosotros.
//   · CHANNEL_ERROR / TIMED_OUT → fallo real, sin ambigüedad.
//   · CLOSED                    → sólo cuenta si NO somos nosotros los que cerramos
//                                 (tearingDownRef), que es el caso de navegación.
// Al desmontar se vuelve a 'connected': sin canal activo no hay nada que reportar,
// y así el banner no queda pegado al entrar a un módulo sin realtime.
function useRealtimeTable(table, channelPrefix, onUpdate) {
    const onUpdateRef = useRef(onUpdate);
    const tearingDownRef = useRef(false);
    const { profile } = useAuth();
    const businessId = profile?.business_id || useAppStore.getState().businessId;

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });

    useEffect(() => {
        if (!businessId) return;

        tearingDownRef.current = false;
        const setRealtimeStatus = useAppStore.getState().setRealtimeStatus;

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
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setRealtimeStatus('connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setRealtimeStatus('disconnected');
                } else if (status === 'CLOSED' && !tearingDownRef.current) {
                    // Cierre que NO provocamos nosotros: es una caída real.
                    setRealtimeStatus('disconnected');
                }
            });

        return () => {
            tearingDownRef.current = true;
            setRealtimeStatus('connected');
            supabase.removeChannel(channel);
        };
    }, [businessId, table, channelPrefix]);
}

export const useRealtimeAppointments = (onUpdate) =>
    useRealtimeTable('appointments', 'calendar-sync', onUpdate);

// El bot mueve las tarjetas del pipeline por su cuenta (pipeline_touch) — sin
// realtime el tablero se vería congelado, que es justo lo contrario de lo que
// vende el módulo ("ver a la IA trabajando en vivo").
export const useRealtimePipeline = (onUpdate) =>
    useRealtimeTable('pipeline_deals', 'pipeline-sync', onUpdate);

export const useRealtimePatients = (onUpdate) =>
    useRealtimeTable('patients', 'patients-sync', (payload) => {
        // M-010: cuando llegan altas/bajas externas (ej. agente n8n), el cache
        // local de IDs visibles queda stale. Invalidar antes de propagar al
        // consumer asegura que la próxima refetch pida la lista fresca al RPC.
        if (payload?.eventType === 'INSERT' || payload?.eventType === 'DELETE') {
            invalidateVisibilityCache();
        }
        onUpdate(payload);
    });
