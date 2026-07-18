import { useState, useCallback, useEffect } from 'react';
import { getCashStatus, getCashSessions, openCashSession, closeCashSession } from '../services/supabaseService';

// Caja diaria — sesión abierta (con esperado vivo: apertura + efectivo que
// entró − efectivo que salió) e historial de cierres con diferencia.
export function useCashRegister(enabled = true) {
    const [status, setStatus] = useState(null); // { session, cash_in, cash_out, expected } | null
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!enabled) { setLoading(false); return; }
        setLoading(true);
        try {
            const [st, hist] = await Promise.all([getCashStatus(), getCashSessions(30)]);
            setStatus(st);
            setSessions(hist);
        } catch (err) {
            console.error('[useCashRegister]', err.message);
            setStatus(null);
            setSessions([]);
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => { load(); }, [load]);

    async function open(openingAmount, notes) { const r = await openCashSession(openingAmount, notes); await load(); return r; }
    async function close(countedAmount, notes) { const r = await closeCashSession(countedAmount, notes); await load(); return r; }

    return { status, sessions, loading, reload: load, open, close };
}
