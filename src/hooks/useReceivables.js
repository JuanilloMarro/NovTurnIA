import { useState, useCallback, useEffect } from 'react';
import { getPaymentPlans, createPaymentPlan, recordPlanPayment, cancelPaymentPlan } from '../services/supabaseService';

// Por cobrar — planes de pago (abonos). El saldo lo calcula la DB en un solo
// round-trip (RPC get_payment_plans); las acciones recargan la lista.
export function useReceivables(enabled = true) {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!enabled) { setLoading(false); return; }
        setLoading(true);
        try {
            setPlans(await getPaymentPlans());
        } catch (err) {
            console.error('[useReceivables]', err.message);
            setPlans([]);
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => { load(); }, [load]);

    async function addPlan(fields) { const r = await createPaymentPlan(fields); await load(); return r; }
    async function addPayment(fields) { const r = await recordPlanPayment(fields); await load(); return r; }
    async function cancelPlan(id, reason) { const r = await cancelPaymentPlan(id, reason); await load(); return r; }

    const active = plans.filter(p => p.status === 'active');
    const totalBalance = active.reduce((s, p) => s + Number(p.balance || 0), 0);

    return { plans, active, totalBalance, loading, reload: load, addPlan, addPayment, cancelPlan };
}
