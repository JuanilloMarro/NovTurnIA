import { TrendingUp, TrendingDown, Coins, Percent, CreditCard, Layers, Award, Target, Telescope, ArrowUpRight, ArrowDownRight, CalendarClock } from 'lucide-react';
import FinanceTrendChart from './FinanceTrendChart';

const SEMAFORO = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
const moneyShort = (n) => `Q${Math.round(Number(n || 0)).toLocaleString('es-GT')}`;
const moneyFull = (n) => `Q${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const METHOD_LABEL = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };
const CAT_LABEL = { insumo: 'Insumos', renta: 'Renta', salario: 'Salarios', servicios: 'Servicios', marketing: 'Marketing', general: 'General', otro: 'Otro' };

function GlassPanel({ children, className = '' }) {
    return (
        <div className={`relative bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex flex-col overflow-hidden p-6 ${className}`}>
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="relative z-10 flex flex-col h-full">{children}</div>
        </div>
    );
}

// Chip de variación vs período anterior. `invert`: en egresos, subir es malo.
function Delta({ now, prev, invert = false }) {
    if (prev == null || Number(prev) === 0) return null;
    const pct = ((Number(now) - Number(prev)) / Math.abs(Number(prev))) * 100;
    if (!isFinite(pct)) return null;
    const up = pct >= 0;
    const good = invert ? !up : up;
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    return (
        <span
            title={`Período anterior: ${moneyShort(prev)}`}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-bold tabular-nums ${good ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'}`}
        >
            <Icon size={9} strokeWidth={3} /> {Math.abs(pct).toFixed(0)}%
        </span>
    );
}

function FinKpi({ icon: Icon, label, value, delta, index = 0 }) {
    return (
        <div className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] p-4 shadow-md animate-fade-up" style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="absolute -top-6 -right-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-6 -left-6 pointer-events-none z-0" style={{ width: '60%', height: '60%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                    <Icon size={16} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-navy-700/50 leading-tight">{label}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        <span className="text-lg font-bold text-navy-900 tabular-nums truncate leading-tight">{value}</span>
                        {delta}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CardHeader({ icon: Icon, title, subtitle }) {
    return (
        <div className="flex items-start gap-3 mb-4 shrink-0">
            <div className="w-9 h-9 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0"><Icon size={18} /></div>
            <div className="min-w-0 pt-[5px]">
                <h3 className="text-[13px] font-bold text-navy-900 leading-none tracking-tight">{title}</h3>
                <p className="text-[10px] font-bold text-navy-900/40 mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}

// Meta mensual: avance de ingresos del mes vs objetivo definido en Ajustes.
function GoalCard({ goal, projection }) {
    const confirmed = Number(projection?.confirmed_income || 0);
    const pct = goal > 0 ? Math.min(100, Math.round((confirmed / goal) * 100)) : 0;
    const daysLeft = (() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    })();
    return (
        <GlassPanel className="min-h-[150px]">
            <CardHeader icon={Target} title="Meta del mes" subtitle={`Objetivo: ${moneyFull(goal)}`} />
            <div className="flex-1 flex flex-col justify-center gap-2.5">
                <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold text-navy-900 tabular-nums leading-none">{moneyShort(confirmed)}</span>
                    <span className={`text-[13px] font-bold tabular-nums ${pct >= 100 ? 'text-emerald-600' : 'text-navy-900/50'}`}>{pct}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-navy-900/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: pct >= 100 ? '#10B981' : 'linear-gradient(90deg, rgba(64,98,200,1), rgba(120,110,230,1))' }} />
                </div>
                <p className="text-[10px] font-bold text-navy-900/40">
                    {pct >= 100
                        ? '¡Meta alcanzada! 🎉'
                        : `Faltan ${moneyShort(Math.max(goal - confirmed, 0))} · quedan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`}
                </p>
            </div>
        </GlassPanel>
    );
}

// Proyección de cierre: agenda futura × precio efectivo × asistencia histórica.
function ProjectionCard({ projection }) {
    const p = projection;
    const projected = Number(p.projected_income || 0);
    const goal = Number(p.monthly_goal || 0);
    const reach = goal > 0 ? projected >= goal : null;
    return (
        <GlassPanel className="min-h-[150px]">
            <CardHeader icon={Telescope} title="Proyección de cierre" subtitle="Si se cumplen los turnos agendados" />
            <div className="flex-1 flex flex-col justify-center gap-2">
                <div className="flex items-end justify-between gap-2">
                    <span className="text-2xl font-bold text-navy-900 tabular-nums leading-none">{moneyShort(projected)}</span>
                    {reach != null && (
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${reach ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-amber-500/10 border-amber-500/20 text-amber-700'}`}>
                            {reach ? 'Alcanza la meta' : 'Bajo la meta'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-navy-900/45 flex-wrap">
                    <CalendarClock size={11} className="shrink-0" />
                    <span>{p.future_appointments} {Number(p.future_appointments) === 1 ? 'turno pendiente' : 'turnos pendientes'} ≈ {moneyShort(p.expected_future_income)}</span>
                    <span>· asistencia {Math.round(Number(p.attendance_rate || 1) * 100)}%</span>
                </div>
                <p className="text-[10px] font-bold text-navy-900/40">
                    Utilidad proyectada: <span className={Number(p.projected_net) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{moneyShort(p.projected_net)}</span> (con egresos actuales)
                </p>
            </div>
        </GlassPanel>
    );
}

// Desglose tipo "Análisis de servicios" (rank + label + valor + % + barra)
function BreakdownBars({ rows }) {
    if (!rows.length) return <p className="text-[11px] text-navy-900/30 font-bold flex-1 flex items-center justify-center">Sin datos en este período.</p>;
    const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    const max = Math.max(1, ...rows.map(r => Number(r.total) || 0));
    return (
        <div className="flex flex-col justify-center gap-3 flex-1">
            {rows.map((r, i) => {
                const val = Number(r.total) || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                const color = SEMAFORO[i % SEMAFORO.length];
                return (
                    <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-bold text-white shadow-sm" style={{ backgroundColor: color }}>{i + 1}</span>
                                <span className="text-[11px] font-bold text-navy-900 truncate">{r.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[11px] font-bold text-navy-900">{moneyShort(val)}</span>
                                <span className="text-[10px] font-bold text-navy-900/30">{pct}%</span>
                            </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-navy-900/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(val / max) * 100}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-[9px] font-bold text-navy-900/30">
                            {r.n} {Number(r.n) === 1 ? 'movimiento' : 'movimientos'}{r.extra ? ` · ${r.extra}` : ''}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// Servicios más rentables — ahora con utilidad REAL (ingreso − costo snapshot
// de la receta, congelado al confirmar cada cobro).
function TopServicesMargin({ rows }) {
    const data = (rows || []).slice(0, 6).map(r => {
        const revenue = Number(r.revenue) || 0;
        const cost = Number(r.cost) || 0;
        const margin = revenue - cost;
        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
        return { name: r.name, n: r.n, revenue, cost, margin, marginPct };
    });
    if (!data.length) return <p className="text-[11px] text-navy-900/30 font-bold flex-1 flex items-center justify-center">Aún no hay ingresos por servicio.</p>;
    const max = Math.max(1, ...data.map(d => d.revenue));
    return (
        <div className="flex flex-col justify-center gap-3 flex-1">
            {data.map((d, i) => {
                const color = SEMAFORO[i % SEMAFORO.length];
                const chip = d.marginPct >= 50 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                    : d.marginPct >= 20 ? 'bg-amber-500/10 border-amber-500/20 text-amber-700'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600';
                return (
                    <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-bold text-white shadow-sm" style={{ backgroundColor: color }}>{i + 1}</span>
                                <span className="text-[11px] font-bold text-navy-900 truncate">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] font-bold text-navy-900 tabular-nums">{moneyShort(d.revenue)}</span>
                                <span className={`px-1.5 py-0.5 rounded-full border text-[8.5px] font-bold tabular-nums ${chip}`} title={`Utilidad: ${moneyFull(d.margin)} (costo insumos ${moneyFull(d.cost)})`}>
                                    {d.cost > 0 ? `${Math.round(d.marginPct)}% util.` : '100% util.'}
                                </span>
                            </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-navy-900/5 overflow-hidden flex">
                            <div className="h-full transition-all duration-700" style={{ width: `${(d.margin / max) * 100}%`, backgroundColor: color }} />
                            {d.cost > 0 && <div className="h-full transition-all duration-700 opacity-30" style={{ width: `${(d.cost / max) * 100}%`, backgroundColor: color }} />}
                        </div>
                        <span className="text-[9px] font-bold text-navy-900/30">
                            {d.n} {Number(d.n) === 1 ? 'cobro' : 'cobros'}{d.cost > 0 ? ` · utilidad ${moneyShort(d.margin)}` : ''}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default function FinanceSummary({ fin, period, year, month, day, isCurrentMonth = false }) {
    const s = fin.summary || {};
    const byMethod = (s.income_by_method || []).map(m => ({
        label: m.label || METHOD_LABEL[m.method] || m.method,
        total: m.total,
        n: m.n,
        extra: Number(m.fee_total) > 0 ? `comisión ${moneyShort(m.fee_total)} (${Number(m.fee_pct)}%)` : null,
    })).sort((a, b) => Number(b.total) - Number(a.total));
    const byCat = (s.expense_by_category || []).map(c => ({ label: CAT_LABEL[c.category] || c.category, total: c.total, n: c.n }))
        .sort((a, b) => Number(b.total) - Number(a.total));

    const totalFees = Number(fin.totalFees || 0);
    const showGoal = isCurrentMonth && Number(fin.monthlyGoal) > 0;
    const showProjection = isCurrentMonth && fin.projection && Number(fin.projection.future_appointments) >= 0;

    return (
        <div className="space-y-3 px-1 pb-2">
            {/* KPIs con variación vs período anterior */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <FinKpi label="Ingresos" value={moneyShort(fin.totalIncome)} icon={TrendingUp} index={0}
                    delta={<Delta now={fin.totalIncome} prev={fin.prevIncome} />} />
                <FinKpi label="Egresos" value={moneyShort(fin.totalExpenses)} icon={TrendingDown} index={1}
                    delta={<Delta now={fin.totalExpenses} prev={fin.prevExpenses} invert />} />
                <FinKpi label="Utilidad neta" value={moneyShort(fin.netProfit)} icon={Coins} index={2}
                    delta={<Delta now={fin.netProfit} prev={fin.prevNet} />} />
                <FinKpi label="Margen" value={`${fin.marginPct.toFixed(0)}%`} icon={Percent} index={3} />
            </div>

            {/* Meta y proyección — solo viendo el mes en curso */}
            {(showGoal || showProjection) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {showGoal && <GoalCard goal={Number(fin.monthlyGoal)} projection={fin.projection} />}
                    {showProjection && <ProjectionCard projection={fin.projection} />}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <GlassPanel className="min-h-[340px]">
                    <FinanceTrendChart period={period} year={year} month={month} day={day} previewData={fin.trendPreview} />
                </GlassPanel>
                <GlassPanel className="min-h-[340px]">
                    <CardHeader icon={Award} title="Servicios más rentables" subtitle="Ingreso y utilidad real por servicio" />
                    <TopServicesMargin rows={s.top_services} />
                </GlassPanel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <GlassPanel className="min-h-[220px]">
                    <CardHeader icon={CreditCard} title="Ingresos por método"
                        subtitle={totalFees > 0
                            ? `${moneyFull(fin.totalIncome)} · neto tras comisiones ${moneyFull(fin.totalIncome - totalFees)}`
                            : moneyFull(fin.totalIncome)} />
                    <BreakdownBars rows={byMethod} />
                </GlassPanel>
                <GlassPanel className="min-h-[220px]">
                    <CardHeader icon={Layers} title="Egresos por categoría" subtitle={moneyFull(fin.totalExpenses)} />
                    <BreakdownBars rows={byCat} />
                </GlassPanel>
            </div>
        </div>
    );
}
