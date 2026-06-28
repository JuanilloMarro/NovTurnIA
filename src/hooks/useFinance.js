import { useState, useCallback, useEffect } from 'react';
import {
    getFinanceSummary,
    getIncomeEntries,
    getExpenseEntries,
    getUnconfirmedDeliveries,
    recordIncome as recordIncomeAPI,
    recordExpense as recordExpenseAPI,
    updateIncome as updateIncomeAPI,
    updateExpense as updateExpenseAPI,
    voidIncome as voidIncomeAPI,
    voidExpense as voidExpenseAPI,
    confirmServiceDelivery as confirmDeliveryAPI,
} from '../services/supabaseService';

// Rango del mes actual (ISO). La página puede pasar otro { start, end, granularity }.
export function monthRange(d = new Date()) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start: start.toISOString(), end: end.toISOString(), granularity: 'day' };
}

const IGNORABLE = ['42P01', 'PGRST116', '42883'];

// Resumen + libros de ingresos/egresos + turnos por confirmar, para un rango dado.
export function useFinance(range) {
    const start = range?.start;
    const end = range?.end;
    const granularity = range?.granularity || 'day';

    const [summary, setSummary] = useState(null);
    const [income, setIncome] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!start || !end) return;
        setLoading(true);
        try {
            const [sum, inc, exp, pend] = await Promise.all([
                getFinanceSummary(start, end, granularity),
                getIncomeEntries({ start, end }),
                getExpenseEntries({ start, end }),
                getUnconfirmedDeliveries(),
            ]);
            setSummary(sum);
            setIncome(inc);
            setExpenses(exp);
            setPending(pend);
        } catch (err) {
            if (!IGNORABLE.includes(err.code)) console.error('[useFinance]', err.message);
            setSummary(null);
            setIncome([]);
            setExpenses([]);
            setPending([]);
        } finally {
            setLoading(false);
        }
    }, [start, end, granularity]);

    useEffect(() => { load(); }, [load]);

    // Acciones — recargan el estado para mantener KPIs y listas coherentes.
    async function confirmDelivery(args) { const r = await confirmDeliveryAPI(args); await load(); return r; }
    async function addIncome(fields) { const r = await recordIncomeAPI(fields); await load(); return r; }
    async function addExpense(fields) { const r = await recordExpenseAPI(fields); await load(); return r; }
    async function updateIncomeEntry(id, fields) { const r = await updateIncomeAPI(id, fields); await load(); return r; }
    async function updateExpenseEntry(id, fields) { const r = await updateExpenseAPI(id, fields); await load(); return r; }
    async function voidIncomeEntry(id, reason) { await voidIncomeAPI(id, reason); await load(); }
    async function voidExpenseEntry(id, reason) { await voidExpenseAPI(id, reason); await load(); }

    // KPIs derivados
    const totalIncome = Number(summary?.total_income || 0);
    const totalExpenses = Number(summary?.total_expenses || 0);
    const totalCost = Number(summary?.total_cost || 0);
    const netProfit = totalIncome - totalExpenses;
    const marginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
        summary, income, expenses, pending, loading,
        totalIncome, totalExpenses, totalCost, netProfit, marginPct,
        reload: load, confirmDelivery, addIncome, addExpense, updateIncomeEntry, updateExpenseEntry, voidIncomeEntry, voidExpenseEntry,
    };
}
