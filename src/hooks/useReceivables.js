import { useState, useCallback, useEffect } from 'react';
import { getPaymentPlans, createPaymentPlan, recordPlanPayment, cancelPaymentPlan } from '../services/supabaseService';

const PAGE_SIZE = 20;

// Por cobrar — planes de pago (abonos). El saldo lo calcula la DB en un solo
// round-trip (RPC get_payment_plans); paginación real (page/pageSize) igual
// que Ingresos/Egresos — "Cargar más" pide la siguiente página, no revela
// un array ya completo.
export function useReceivables(enabled = true) {
    const [plans, setPlans] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const load = useCallback(async () => {
        if (!enabled) { setLoading(false); return; }
        setLoading(true);
        try {
            const rows = await getPaymentPlans(null, { page: 0, pageSize: PAGE_SIZE });
            setPlans(rows);
            setHasMore(rows.length === PAGE_SIZE);
        } catch (err) {
            console.error('[useReceivables]', err.message);
            setPlans([]);
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
            const nextPage = Math.ceil(plans.length / PAGE_SIZE);
            const rows = await getPaymentPlans(null, { page: nextPage, pageSize: PAGE_SIZE });
            setPlans(prev => [...prev, ...rows]);
            setHasMore(rows.length === PAGE_SIZE);
        } catch (err) {
            console.error('[useReceivables:loadMore]', err.message);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, plans.length]);

    async function addPlan(fields) { const r = await createPaymentPlan(fields); await load(); return r; }
    async function addPayment(fields) { const r = await recordPlanPayment(fields); await load(); return r; }
    async function cancelPlan(id, reason) { const r = await cancelPaymentPlan(id, reason); await load(); return r; }

    const active = plans.filter(p => p.status === 'active');
    const totalBalance = active.reduce((s, p) => s + Number(p.balance || 0), 0);

    return { plans, active, totalBalance, loading, hasMore, loadingMore, loadMore, reload: load, addPlan, addPayment, cancelPlan };
}
