import { useState, useCallback, useEffect } from 'react';
import { getCashStatus, getCashSessions, openCashSession, closeCashSession } from '../services/supabaseService';

const PAGE_SIZE = 20;

// Caja diaria — sesión abierta (con esperado vivo: apertura + efectivo que
// entró − efectivo que salió) e historial de cierres con diferencia.
// Paginación real (page/pageSize) para el historial, igual que Ingresos/
// Egresos/Por cobrar.
export function useCashRegister(enabled = true) {
    const [status, setStatus] = useState(null); // { session, cash_in, cash_out, expected } | null
    const [sessions, setSessions] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const load = useCallback(async () => {
        if (!enabled) { setLoading(false); return; }
        setLoading(true);
        try {
            const [st, hist] = await Promise.all([getCashStatus(), getCashSessions({ page: 0, pageSize: PAGE_SIZE })]);
            setStatus(st);
            setSessions(hist);
            setHasMore(hist.length === PAGE_SIZE);
        } catch (err) {
            console.error('[useCashRegister]', err.message);
            setStatus(null);
            setSessions([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => { load(); }, [load]);

    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const nextPage = Math.ceil(sessions.length / PAGE_SIZE);
            const hist = await getCashSessions({ page: nextPage, pageSize: PAGE_SIZE });
            setSessions(prev => [...prev, ...hist]);
            setHasMore(hist.length === PAGE_SIZE);
        } catch (err) {
            console.error('[useCashRegister:loadMore]', err.message);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, sessions.length]);

    async function open(openingAmount, notes) { const r = await openCashSession(openingAmount, notes); await load(); return r; }
    async function close(countedAmount, notes) { const r = await closeCashSession(countedAmount, notes); await load(); return r; }

    return { status, sessions, hasMore, loadingMore, loadMore, loading, reload: load, open, close };
}
