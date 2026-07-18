import { useState, useCallback, useEffect } from 'react';
import {
    getFinanceSummary,
    getIncomeEntries,
    getExpenseEntries,
    getPendingValidations,
    getFinanceProjection,
    getFinanceSettings,
    saveFinanceSettings,
    getPaymentMethods,
    recordIncome as recordIncomeAPI,
    recordExpense as recordExpenseAPI,
    updateIncome as updateIncomeAPI,
    updateExpense as updateExpenseAPI,
    voidIncome as voidIncomeAPI,
    voidExpense as voidExpenseAPI,
    confirmIncomeValidation as confirmValidationAPI,
} from '../services/supabaseService';

// Rango del mes actual (ISO). La página puede pasar otro { start, end, granularity }.
export function monthRange(d = new Date()) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start: start.toISOString(), end: end.toISOString(), granularity: 'day' };
}

const IGNORABLE = ['42P01', 'PGRST116', '42883'];

// Resumen + libros + por confirmar + (v2) comparativa vs período anterior,
// proyección de cierre, meta mensual y métodos de pago del negocio.
// `prevRange` (opcional): mismo período desplazado hacia atrás — habilita las
// flechas "vs período anterior" en los KPIs.
export function useFinance(range, prevRange = null) {
    const start = range?.start;
    const end = range?.end;
    const granularity = range?.granularity || 'day';
    const prevStart = prevRange?.start || null;
    const prevEnd = prevRange?.end || null;

    const [summary, setSummary] = useState(null);
    const [prevSummary, setPrevSummary] = useState(null);
    const [projection, setProjection] = useState(null);
    const [settings, setSettings] = useState(null);
    const [methods, setMethods] = useState([]);
    const [income, setIncome] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!start || !end) return;
        setLoading(true);
        try {
            const [sum, prev, inc, exp, pend, proj, sett, meth] = await Promise.all([
                getFinanceSummary(start, end, granularity),
                prevStart ? getFinanceSummary(prevStart, prevEnd, granularity).catch(() => null) : Promise.resolve(null),
                getIncomeEntries({ start, end }),
                getExpenseEntries({ start, end }),
                getPendingValidations(),
                getFinanceProjection().catch(() => null),
                getFinanceSettings().catch(() => null),
                getPaymentMethods().catch(() => []),
            ]);
            setSummary(sum);
            setPrevSummary(prev);
            setIncome(inc);
            setExpenses(exp);
            setPending(pend);
            setProjection(proj);
            setSettings(sett);
            setMethods(meth);
        } catch (err) {
            if (!IGNORABLE.includes(err.code)) console.error('[useFinance]', err.message);
            setSummary(null);
            setPrevSummary(null);
            setIncome([]);
            setExpenses([]);
            setPending([]);
            setProjection(null);
        } finally {
            setLoading(false);
        }
    }, [start, end, granularity, prevStart, prevEnd]);

    useEffect(() => { load(); }, [load]);

    // Acciones — recargan el estado para mantener KPIs y listas coherentes.
    // confirmValidation: pending -> confirmed (el dueño valida que el dinero entró).
    async function confirmValidation(id) { const r = await confirmValidationAPI(id); await load(); return r; }
    async function addIncome(fields) { const r = await recordIncomeAPI(fields); await load(); return r; }
    async function addExpense(fields) { const r = await recordExpenseAPI(fields); await load(); return r; }
    async function updateIncomeEntry(id, fields) { const r = await updateIncomeAPI(id, fields); await load(); return r; }
    async function updateExpenseEntry(id, fields) { const r = await updateExpenseAPI(id, fields); await load(); return r; }
    async function voidIncomeEntry(id, reason) { await voidIncomeAPI(id, reason); await load(); }
    async function voidExpenseEntry(id, reason) { await voidExpenseAPI(id, reason); await load(); }
    async function saveGoal(monthlyGoal) {
        const r = await saveFinanceSettings({ monthly_goal: monthlyGoal });
        setSettings(r);
        return r;
    }

    // KPIs derivados
    const totalIncome = Number(summary?.total_income || 0);
    const totalExpenses = Number(summary?.total_expenses || 0);
    const totalCost = Number(summary?.total_cost || 0);
    const totalFees = Number(summary?.total_fees || 0);
    const netProfit = totalIncome - totalExpenses;
    const marginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    // Comparativa vs período anterior (null si no hay datos previos)
    const prevIncome = prevSummary ? Number(prevSummary.total_income || 0) : null;
    const prevExpenses = prevSummary ? Number(prevSummary.total_expenses || 0) : null;
    const prevNet = prevSummary ? Number(prevSummary.total_income || 0) - Number(prevSummary.total_expenses || 0) : null;

    return {
        summary, prevSummary, projection, settings, methods,
        income, expenses, pending, loading,
        totalIncome, totalExpenses, totalCost, totalFees, netProfit, marginPct,
        prevIncome, prevExpenses, prevNet,
        monthlyGoal: Number(settings?.monthly_goal || 0),
        reload: load, confirmValidation, addIncome, addExpense, updateIncomeEntry, updateExpenseEntry, voidIncomeEntry, voidExpenseEntry, saveGoal,
    };
}
