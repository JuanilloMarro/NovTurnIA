import { useMemo, useState, useEffect } from 'react';
import { getFinanceTrend } from '../../services/supabaseService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

// ── Mismo modelo de slots que MainChart (claves calzan con get_finance_trend) ──
function formatWeekLabel(mondayStr) {
    const mon = new Date(mondayStr + 'T12:00:00');
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    const f = d => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${f(mon)} · ${f(sun)}`;
}
function buildSlots(period, year, month, day = null) {
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const anchor = new Date(day != null ? new Date(year, month, day) : (isCurrentMonth ? now : new Date(year, month, 15)));
    anchor.setHours(12, 0, 0, 0);
    if (period === 'day') {
        const dow = anchor.getDay();
        const monday = new Date(anchor); monday.setDate(anchor.getDate() - dow + (dow === 0 ? -6 : 1));
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday); d.setDate(monday.getDate() + i);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('es-GT', { weekday: 'short', day: '2-digit' }).replace('.', '');
            return { key, name: label, income: 0, expense: 0 };
        });
    }
    if (period === 'week') {
        const dow = anchor.getDay();
        const monday = new Date(anchor); monday.setDate(anchor.getDate() - dow + (dow === 0 ? -6 : 1));
        const start = new Date(monday); start.setDate(monday.getDate() - 28);
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(start); d.setDate(start.getDate() + i * 7);
            const key = d.toISOString().split('T')[0];
            return { key, name: formatWeekLabel(key), income: 0, expense: 0 };
        });
    }
    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(year, i, 15);
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        let label = d.toLocaleDateString('es-GT', { month: 'short' }).replace('.', '');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        return { key, name: label, income: 0, expense: 0 };
    });
}
function keyToDate(key) {
    return key.length === 7 ? new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1) : new Date(key + 'T00:00:00');
}
function windowFor(period, year, slots) {
    const start = keyToDate(slots[0].key);
    let end;
    if (period === 'day') { end = new Date(start); end.setDate(start.getDate() + 7); }
    else if (period === 'week') { end = keyToDate(slots[slots.length - 1].key); end.setDate(end.getDate() + 7); }
    else { end = new Date(year + 1, 0, 1); }
    return { start: start.toISOString(), end: end.toISOString() };
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function subtitle(period, year, month) {
    if (period === 'day') return `Semana · ${MONTH_NAMES[month]} ${year}`;
    if (period === 'week') return `6 semanas · ${MONTH_NAMES[month]} ${year}`;
    return `Año ${year}`;
}
const money = (n) => `Q${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FinanceTrendChart({ period = 'month', year, month, day = null, previewData = null }) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(!previewData);

    const slots = useMemo(() => buildSlots(period, y, m, day), [period, y, m, day]);

    useEffect(() => {
        if (previewData) return; // modo vista previa (FeatureLock): sin llamada a DB
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { start, end } = windowFor(period, y, slots);
                const data = await getFinanceTrend(period, start, end);
                if (!cancelled) setRows(data);
            } catch (err) {
                if (!cancelled) setRows([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [period, y, m, day, previewData]); // eslint-disable-line react-hooks/exhaustive-deps

    const data = useMemo(() => {
        if (previewData) return previewData;
        const map = Object.fromEntries(slots.map(s => [s.key, { ...s }]));
        rows.forEach(r => {
            if (map[r.period]) {
                map[r.period].income = Number(r.income) || 0;
                map[r.period].expense = Number(r.expense) || 0;
            }
        });
        return Object.values(map);
    }, [rows, slots, previewData]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                        <TrendingUp size={16} />
                    </div>
                    <div className="min-w-0 pt-[4px]">
                        <h3 className="text-[13px] font-bold text-navy-900 leading-none tracking-tight">Ingresos vs Egresos</h3>
                        <p className="text-[10px] font-bold text-navy-900/40 mt-0.5">{subtitle(period, y, m)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold shrink-0">
                    <span className="flex items-center gap-1 text-navy-900/55"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Ingresos</span>
                    <span className="flex items-center gap-1 text-navy-900/55"><span className="w-2 h-2 rounded-full bg-rose-500" /> Egresos</span>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                {loading ? (
                    <div className="h-full flex items-center justify-center"><div className="w-5 h-5 border-2 border-navy-900/20 border-t-navy-900/60 rounded-full animate-spin" /></div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                                <linearGradient id="finIncome" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="finExpense" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} dy={10}
                                interval={0} angle={period === 'day' ? -45 : 0} textAnchor={period === 'day' ? 'end' : 'middle'} height={period === 'day' ? 50 : 30} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <Tooltip
                                contentStyle={{ background: '#0F2044', border: 'none', borderRadius: 12, color: 'white', fontSize: 11, padding: '8px 12px', boxShadow: '0 10px 25px rgba(15,32,68,0.25)' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                labelStyle={{ color: '#cbd5e1', marginBottom: 4, fontSize: 11 }}
                                formatter={(v, n) => [money(v), n === 'income' ? 'Ingresos' : 'Egresos']}
                                cursor={{ stroke: 'rgba(15,32,68,0.15)', strokeWidth: 2 }}
                            />
                            <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} fill="url(#finIncome)" name="income" activeDot={{ r: 5, fill: '#10B981', stroke: 'white', strokeWidth: 2 }} />
                            <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={3} fill="url(#finExpense)" name="expense" activeDot={{ r: 5, fill: '#EF4444', stroke: 'white', strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
