import { useState, useCallback, useEffect } from 'react';
import {
    getFinanceSummary,
    getIncomeEntries,
    getExpenseEntries,
    getPendingValidations,
    getFinanceProjection,
    getMonthlyGoals,
    saveMonthlyGoal,
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
const LIST_PAGE_SIZE = 30;

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
    const [monthlyGoals, setMonthlyGoals] = useState([]); // filas del año en curso (finance_monthly_goals)
    const [methods, setMethods] = useState([]);
    const [income, setIncome] = useState([]);
    const [incomeHasMore, setIncomeHasMore] = useState(false);
    const [loadingMoreIncome, setLoadingMoreIncome] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [expenseHasMore, setExpenseHasMore] = useState(false);
    const [loadingMoreExpenses, setLoadingMoreExpenses] = useState(false);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!start || !end) return;
        setLoading(true);
        // Cada lectura se aísla: si una falla (p. ej. el RPC del resumen), las
        // demás igual se muestran. Antes un solo fallo vaciaba TODO el módulo y
        // parecía que nada se había guardado (bug 2026-07-18).
        const safe = (p, fallback, tag) => p.catch(err => {
            if (!IGNORABLE.includes(err.code)) console.error(`[useFinance:${tag}]`, err.message);
            return fallback;
        });
        const [sum, prev, incRes, expRes, pend, proj, goals, meth] = await Promise.all([
            safe(getFinanceSummary(start, end, granularity), null, 'summary'),
            prevStart ? safe(getFinanceSummary(prevStart, prevEnd, granularity), null, 'prev') : Promise.resolve(null),
            safe(getIncomeEntries({ start, end, page: 0, pageSize: LIST_PAGE_SIZE }), { data: [], count: 0 }, 'income'),
            safe(getExpenseEntries({ start, end, page: 0, pageSize: LIST_PAGE_SIZE }), { data: [], count: 0 }, 'expenses'),
            safe(getPendingValidations(), [], 'pending'),
            safe(getFinanceProjection(), null, 'projection'),
            safe(getMonthlyGoals(new Date().getFullYear()), [], 'goals'),
            safe(getPaymentMethods(), [], 'methods'),
        ]);
        setSummary(sum);
        setPrevSummary(prev);
        setIncome(incRes.data);
        setIncomeHasMore(incRes.data.length < incRes.count);
        setExpenses(expRes.data);
        setExpenseHasMore(expRes.data.length < expRes.count);
        setPending(pend);
        setProjection(proj);
        setMonthlyGoals(goals);
        setMethods(meth);
        setLoading(false);
    }, [start, end, granularity, prevStart, prevEnd]);

    useEffect(() => { load(); }, [load]);

    // "Cargar más" ingresos/egresos — agrega la siguiente página sin re-pedir
    // todo el período. Paginación real (no el `slice` client-side de antes).
    const loadMoreIncome = useCallback(async () => {
        if (!incomeHasMore || loadingMoreIncome || !start || !end) return;
        setLoadingMoreIncome(true);
        try {
            const nextPage = Math.ceil(income.length / LIST_PAGE_SIZE);
            const res = await getIncomeEntries({ start, end, page: nextPage, pageSize: LIST_PAGE_SIZE });
            setIncome(prev => [...prev, ...res.data]);
            setIncomeHasMore(income.length + res.data.length < res.count);
        } catch (err) {
            console.error('[useFinance:loadMoreIncome]', err.message);
        } finally {
            setLoadingMoreIncome(false);
        }
    }, [incomeHasMore, loadingMoreIncome, start, end, income.length]);

    const loadMoreExpenses = useCallback(async () => {
        if (!expenseHasMore || loadingMoreExpenses || !start || !end) return;
        setLoadingMoreExpenses(true);
        try {
            const nextPage = Math.ceil(expenses.length / LIST_PAGE_SIZE);
            const res = await getExpenseEntries({ start, end, page: nextPage, pageSize: LIST_PAGE_SIZE });
            setExpenses(prev => [...prev, ...res.data]);
            setExpenseHasMore(expenses.length + res.data.length < res.count);
        } catch (err) {
            console.error('[useFinance:loadMoreExpenses]', err.message);
        } finally {
            setLoadingMoreExpenses(false);
        }
    }, [expenseHasMore, loadingMoreExpenses, start, end, expenses.length]);

    // Acciones — recargan el estado para mantener KPIs y listas coherentes.
    // confirmValidation: pending -> confirmed (el dueño valida que el dinero entró).
    async function confirmValidation(id) { const r = await confirmValidationAPI(id); await load(); return r; }
    async function addIncome(fields) { const r = await recordIncomeAPI(fields); await load(); return r; }
    async function addExpense(fields) { const r = await recordExpenseAPI(fields); await load(); return r; }
    async function updateIncomeEntry(id, fields) { const r = await updateIncomeAPI(id, fields); await load(); return r; }
    async function updateExpenseEntry(id, fields) { const r = await updateExpenseAPI(id, fields); await load(); return r; }
    async function voidIncomeEntry(id, reason) { await voidIncomeAPI(id, reason); await load(); }
    async function voidExpenseEntry(id, reason) { await voidExpenseAPI(id, reason); await load(); }
    // Meta mensual REAL por mes — guarda el mes indicado (Ajustes solo permite
    // editar el mes en curso) y actualiza el array local sin recargar todo.
    async function saveMonthGoal(year, month, amount) {
        const r = await saveMonthlyGoal(year, month, amount);
        setMonthlyGoals(prev => [...prev.filter(g => !(g.year === year && g.month === month)), r]);
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

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentGoalRow = monthlyGoals.find(g => g.year === currentYear && g.month === currentMonth);

    return {
        summary, prevSummary, projection, methods,
        income, incomeHasMore, loadingMoreIncome, loadMoreIncome,
        expenses, expenseHasMore, loadingMoreExpenses, loadMoreExpenses,
        pending, loading,
        totalIncome, totalExpenses, totalCost, totalFees, netProfit, marginPct,
        prevIncome, prevExpenses, prevNet,
        monthlyGoal: Number(currentGoalRow?.goal_amount || 0),
        monthlyGoals, currentYear, currentMonth,
        reload: load, confirmValidation, addIncome, addExpense, updateIncomeEntry, updateExpenseEntry, voidIncomeEntry, voidExpenseEntry, saveMonthGoal,
    };
}
