import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../store/useAppStore';
import {
    getPendingAppointmentsNext24h,
    getLastPendingReminderTime,
    insertPendingReminderNotification,
} from '../services/supabaseService';

// Intervalo de chequeo: 24 horas (solo notificar una vez al día para no apilar)
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Mutex a nivel de módulo: evita ejecuciones concurrentes por Strict Mode o remounts.
// Al ser module-level (no un ref), es compartido por todas las instancias del hook.
let _isChecking = false;

export function usePendingReminder() {
    const { profile } = useAuth();
    const businessId = profile?.business_id || useAppStore.getState().businessId;
    const timerRef = useRef(null);

    async function runCheck() {
        if (_isChecking || !businessId) return;
        _isChecking = true;
        try {
            // Evitar spam: omitir si ya se mandó un recordatorio en el último intervalo
            const lastTime = await getLastPendingReminderTime();
            if (lastTime) {
                const diffMs = Date.now() - new Date(lastTime).getTime();
                if (diffMs < CHECK_INTERVAL_MS) return;
            }

            const pending = await getPendingAppointmentsNext24h();
            if (pending.length > 0) {
                await insertPendingReminderNotification(pending);
            }
        } catch (err) {
            console.error('[usePendingReminder]', err.message);
        } finally {
            _isChecking = false;
        }
    }

    useEffect(() => {
        if (!businessId) return;

        // Chequeo inmediato al montar
        runCheck();

        // Chequeo cada hora
        timerRef.current = setInterval(runCheck, CHECK_INTERVAL_MS);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [businessId]);
}
