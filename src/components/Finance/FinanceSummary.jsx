import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Coins, Percent, CreditCard, Layers, Award, Telescope, ArrowUpRight, ArrowDownRight, CalendarClock, Flag } from 'lucide-react';
import FinanceTrendChart from './FinanceTrendChart';
import { getServices, getFinanceCategories } from '../../services/supabaseService';

const SEMAFORO = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
const moneyShort = (n) => `Q${Math.round(Number(n || 0)).toLocaleString('es-GT')}`;
const moneyFull = (n) => `Q${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const METHOD_LABEL = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };
const CAT_LABEL = { insumo: 'Insumos', renta: 'Renta', salario: 'Salarios', servicios: 'Servicios', marketing: 'Marketing', general: 'General', otro: 'Otro' };

function GlassPanel({ children, className = '' }) {
    return (
        <div className={`relative bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex flex-col overflow-hidden p-5 ${className}`}>
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
                    <div className="text-[10px] font-bold tracking-wider text-navy-700/50 leading-tight">{label}</div>
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
        <div className="flex items-start gap-2.5 mb-3 shrink-0">
            <div className="w-8 h-8 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0"><Icon size={16} /></div>
            <div className="min-w-0 pt-[4px]">
                <h3 className="text-[12.5px] font-bold text-navy-900 leading-none tracking-tight">{title}</h3>
                <p className="text-[9.5px] font-bold text-navy-900/40 mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}

// Semáforo de avance de la meta: rojo <40%, amarillo 40-75%, verde >75%
// (mismo criterio que "por cobrar" — mientras más completo, mejor).
function goalColor(pct) {
    if (pct < 40) return '#f43f5e';
    if (pct < 75) return '#f59e0b';
    return '#10b981';
}

// Meta mensual — 5to panel de la fila 1 (35% del ancho), misma altura que los
// KPIs por flex-stretch: icono/título arriba, monto vs objetivo y % a la
// derecha, barra de progreso abajo.
function GoalPanel({ goal, projection, index = 4 }) {
    const confirmed = Number(projection?.confirmed_income || 0);
    const pct = goal > 0 ? Math.min(100, Math.round((confirmed / goal) * 100)) : 0;
    return (
        <div className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] p-4 shadow-md animate-fade-up h-full flex flex-col justify-center gap-2.5" style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="absolute -top-6 -right-6 pointer-events-none z-0" style={{ width: '50%', height: '70%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-6 -left-6 pointer-events-none z-0" style={{ width: '50%', height: '70%', borderRadius: '50%', filter: 'blur(30px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                    <Flag size={16} strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold tracking-wider text-navy-700/50 leading-tight">Meta del mes</div>
                    <div className="flex items-baseline gap-1.5 mt-0.5 min-w-0">
                        <span className="text-lg font-bold text-navy-900 tabular-nums leading-tight truncate">{moneyShort(confirmed)}</span>
                        <span className="text-[10px] font-bold text-navy-900/35 shrink-0">/ {moneyShort(goal)}</span>
                    </div>
                </div>
                <span className={`text-[13px] font-bold tabular-nums shrink-0 ${pct >= 100 ? 'text-emerald-600' : 'text-navy-900/50'}`}>{pct}%</span>
            </div>
            <div className="relative z-10 w-full h-2 rounded-full bg-navy-900/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: goalColor(pct) }} />
            </div>
        </div>
    );
}

// Proyección de cierre — velocímetro semicircular con degradado semáforo
// (rosa → ámbar → verde). Escala: 0 → 125% de la meta; el knob marca el
// ingreso proyectado y el tick oscuro la meta. Fallback numérico sin meta.
function ProjectionGauge({ projection }) {
    const p = projection;
    const projected = Number(p.projected_income || 0);
    const goal = Number(p.monthly_goal || 0);
    const reach = goal > 0 ? projected >= goal : null;
    const pctOfGoal = goal > 0 ? Math.round((projected / goal) * 100) : null;

    const stats = (
        <div className="flex flex-col gap-1.5 text-[10px] font-bold text-navy-900/45">
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <CalendarClock size={11} className="shrink-0" />
                <span>{p.future_appointments} {Number(p.future_appointments) === 1 ? 'turno pendiente' : 'turnos pendientes'} ≈ {moneyShort(p.expected_future_income)}</span>
                <span>· asistencia {Math.round(Number(p.attendance_rate || 1) * 100)}%</span>
            </div>
            <p className="text-center">
                Utilidad proyectada: <span className={Number(p.projected_net) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{moneyShort(p.projected_net)}</span> (con egresos actuales)
            </p>
        </div>
    );

    if (goal <= 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <span className="text-3xl font-bold text-navy-900 tabular-nums leading-none">{moneyShort(projected)}</span>
                {stats}
                <p className="text-[9.5px] font-bold text-navy-900/30 text-center">Define una meta mensual en Ajustes para ver el velocímetro.</p>
            </div>
        );
    }

    const R = 86, CX = 110, CY = 110, LEN = Math.PI * R;
    const scaleMax = Math.max(goal * 1.25, projected, 1);
    const frac = Math.min(1, projected / scaleMax);
    const goalFrac = Math.min(1, goal / scaleMax);
    const tipAngle = Math.PI * (1 - frac);
    const tip = { x: CX + R * Math.cos(tipAngle), y: CY - R * Math.sin(tipAngle) };
    const gAngle = Math.PI * (1 - goalFrac);
    const tickIn = { x: CX + (R - 13) * Math.cos(gAngle), y: CY - (R - 13) * Math.sin(gAngle) };
    const tickOut = { x: CX + (R + 13) * Math.cos(gAngle), y: CY - (R + 13) * Math.sin(gAngle) };
    const statusColor = goalColor(Math.min(100, pctOfGoal));

    return (
        <div className="flex-1 flex flex-col justify-center gap-3">
            <div className="relative text-navy-900 max-w-[300px] w-full mx-auto">
                <svg viewBox="0 0 220 128" className="w-full">
                    <defs>
                        <linearGradient id="projGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f43f5e" />
                            <stop offset="55%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                    </defs>
                    <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="rgba(16,42,82,0.08)" strokeWidth="16" strokeLinecap="round" />
                    <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="url(#projGaugeGrad)" strokeWidth="16" strokeLinecap="round"
                        strokeDasharray={`${frac * LEN} ${LEN}`} style={{ transition: 'stroke-dasharray 0.7s ease' }} />
                    <line x1={tickIn.x} y1={tickIn.y} x2={tickOut.x} y2={tickOut.y} stroke="rgba(16,42,82,0.55)" strokeWidth="2.5" strokeLinecap="round">
                        <title>Meta: {moneyFull(goal)}</title>
                    </line>
                    <circle cx={tip.x} cy={tip.y} r="7.5" fill="white" stroke={statusColor} strokeWidth="3.5" />
                    <text x={CX} y={CY - 22} textAnchor="middle" fontSize="23" fontWeight="700" fill="currentColor" style={{ fontVariantNumeric: 'tabular-nums' }}>{moneyShort(projected)}</text>
                    <text x={CX} y={CY - 6} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor" opacity="0.4" letterSpacing="1">Proyectado</text>
                    <text x={CX - R} y={CY + 14} textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" opacity="0.35">Q0</text>
                    <text x={CX + R} y={CY + 14} textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" opacity="0.35">{moneyShort(scaleMax)}</text>
                </svg>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${reach ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-amber-500/10 border-amber-500/20 text-amber-700'}`}>
                    {reach ? 'Alcanza la meta' : 'Bajo la meta'}
                </span>
                <span className="text-[10px] font-bold text-navy-900/45 tabular-nums">{pctOfGoal}% de la meta ({moneyShort(goal)})</span>
            </div>
            {stats}
        </div>
    );
}

// Rellena a exactamente TOP_N filas con candidatos del negocio (métodos,
// categorías o servicios configurados) que aún no tengan movimiento — mismo
// patrón que el "Análisis de servicios" viejo de Inteligencia: siempre se ve
// el top 3 completo, atenuado cuando el valor es 0.
const TOP_N = 3;
function padTop3(realRows, poolLabels, makeEmptyRow) {
    const real = realRows.slice(0, TOP_N);
    const used = new Set(real.map(r => r.label ?? r.name));
    const pool = (poolLabels || []).filter(l => l && !used.has(l));
    let i = 0;
    const out = [...real];
    while (out.length < TOP_N) out.push(makeEmptyRow(pool[i++] ?? '—'));
    return out;
}

// Desglose tipo "Análisis de servicios" (rank + label + valor + % + barra)
function BreakdownBars({ rows }) {
    if (!rows.length) return <p className="text-[11px] text-navy-900/30 font-bold flex-1 flex items-center justify-center">Sin datos en este período.</p>;
    const data = rows.slice(0, TOP_N);
    const total = data.reduce((s, r) => s + Number(r.total || 0), 0);
    const max = Math.max(1, ...data.map(r => Number(r.total) || 0));
    return (
        <div className="flex flex-col justify-center gap-2 flex-1">
            {data.map((r, i) => {
                const val = Number(r.total) || 0;
                const isEmpty = val === 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                const color = SEMAFORO[i % SEMAFORO.length];
                return (
                    <div key={i} className={`flex flex-col gap-1 transition-opacity ${isEmpty ? 'opacity-40' : ''}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-bold text-white shadow-sm" style={{ backgroundColor: color }}>{i + 1}</span>
                                <span className="text-[11px] font-bold text-navy-900 truncate">{r.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[11px] font-bold text-navy-900">{isEmpty ? '—' : moneyShort(val)}</span>
                                {!isEmpty && <span className="text-[10px] font-bold text-navy-900/30">{pct}%</span>}
                            </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-navy-900/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: isEmpty ? '6%' : `${(val / max) * 100}%`, backgroundColor: color, opacity: isEmpty ? 0.3 : 1 }} />
                        </div>
                        <span className="text-[9px] font-bold text-navy-900/30">
                            {isEmpty ? 'Sin movimientos' : `${r.n} ${Number(r.n) === 1 ? 'movimiento' : 'movimientos'}${r.extra ? ` · ${r.extra}` : ''}`}
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
    const data = (rows || []).slice(0, TOP_N).map(r => {
        const revenue = Number(r.revenue) || 0;
        const cost = Number(r.cost) || 0;
        const margin = revenue - cost;
        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
        return { name: r.name, n: r.n, revenue, cost, margin, marginPct };
    });
    if (!data.length) return <p className="text-[11px] text-navy-900/30 font-bold flex-1 flex items-center justify-center">Aún no hay ingresos por servicio.</p>;
    const max = Math.max(1, ...data.map(d => d.revenue));
    return (
        <div className="flex flex-col justify-center gap-2 flex-1">
            {data.map((d, i) => {
                const isEmpty = d.revenue === 0;
                const color = SEMAFORO[i % SEMAFORO.length];
                const chip = d.marginPct >= 50 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                    : d.marginPct >= 20 ? 'bg-amber-500/10 border-amber-500/20 text-amber-700'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600';
                return (
                    <div key={i} className={`flex flex-col gap-1 transition-opacity ${isEmpty ? 'opacity-40' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-bold text-white shadow-sm" style={{ backgroundColor: color }}>{i + 1}</span>
                                <span className="text-[11px] font-bold text-navy-900 truncate">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] font-bold text-navy-900 tabular-nums">{isEmpty ? '—' : moneyShort(d.revenue)}</span>
                                {!isEmpty && (
                                    <span className={`px-1.5 py-0.5 rounded-full border text-[8.5px] font-bold tabular-nums ${chip}`} title={`Utilidad: ${moneyFull(d.margin)} (costo insumos ${moneyFull(d.cost)})`}>
                                        {d.cost > 0 ? `${Math.round(d.marginPct)}% util.` : '100% util.'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-navy-900/5 overflow-hidden flex">
                            <div className="h-full transition-all duration-700" style={{ width: isEmpty ? '6%' : `${(d.margin / max) * 100}%`, backgroundColor: color, opacity: isEmpty ? 0.3 : 1 }} />
                            {!isEmpty && d.cost > 0 && <div className="h-full transition-all duration-700 opacity-30" style={{ width: `${(d.cost / max) * 100}%`, backgroundColor: color }} />}
                        </div>
                        <span className="text-[9px] font-bold text-navy-900/30">
                            {isEmpty ? 'Sin cobros' : `${d.n} ${Number(d.n) === 1 ? 'cobro' : 'cobros'}${d.cost > 0 ? ` · utilidad ${moneyShort(d.margin)}` : ''}`}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default function FinanceSummary({ fin, period, year, month, day, isCurrentMonth = false }) {
    const [ownServices, setOwnServices] = useState([]);
    const [expenseCats, setExpenseCats] = useState([]);
    useEffect(() => {
        getServices().then(v => setOwnServices(v || [])).catch(() => {});
        getFinanceCategories().then(v => setExpenseCats(v || [])).catch(() => {});
    }, []);

    const s = fin.summary || {};
    const byMethodRaw = (s.income_by_method || []).map(m => ({
        label: m.label || METHOD_LABEL[m.method] || m.method,
        total: m.total,
        n: m.n,
        extra: Number(m.fee_total) > 0 ? `comisión ${moneyShort(m.fee_total)} (${Number(m.fee_pct)}%)` : null,
    })).sort((a, b) => Number(b.total) - Number(a.total));
    const byCatRaw = (s.expense_by_category || []).map(c => ({ label: CAT_LABEL[c.category] || c.category, total: c.total, n: c.n }))
        .sort((a, b) => Number(b.total) - Number(a.total));
    const topServicesRaw = (s.top_services || []).sort((a, b) => Number(b.revenue) - Number(a.revenue));

    // Siempre top 3 completo: se rellena con métodos/categorías/servicios ya
    // configurados en el negocio que aún no tuvieron movimiento este período.
    const byMethod = padTop3(byMethodRaw, (fin.methods || []).map(m => m.label), (label) => ({ label, total: 0, n: 0 }));
    const byCat = padTop3(byCatRaw, expenseCats.filter(c => c.kind === 'expense' && c.active).map(c => c.name), (label) => ({ label, total: 0, n: 0 }));
    const topServices = padTop3(topServicesRaw, ownServices.map(sv => sv.name), (name) => ({ name, revenue: 0, cost: 0, n: 0 }));

    const totalFees = Number(fin.totalFees || 0);
    const showGoal = isCurrentMonth && Number(fin.monthlyGoal) > 0;
    const showProjection = isCurrentMonth && fin.projection && Number(fin.projection.future_appointments) >= 0;

    const kpiIngresos = <FinKpi label="Ingresos" value={moneyShort(fin.totalIncome)} icon={TrendingUp} index={0}
        delta={<Delta now={fin.totalIncome} prev={fin.prevIncome} />} />;
    const kpiEgresos = <FinKpi label="Egresos" value={moneyShort(fin.totalExpenses)} icon={TrendingDown} index={1}
        delta={<Delta now={fin.totalExpenses} prev={fin.prevExpenses} invert />} />;
    const kpiNeta = <FinKpi label="Utilidad neta" value={moneyShort(fin.netProfit)} icon={Coins} index={2}
        delta={<Delta now={fin.netProfit} prev={fin.prevNet} />} />;
    const kpiMargen = <FinKpi label="Margen" value={`${fin.marginPct.toFixed(0)}%`} icon={Percent} index={3} />;

    return (
        <div className="space-y-3 px-1 pb-2">
            {/* Fila 1: mismo grid de 3 columnas que la fila 2 (método/categoría/servicios)
                para que ambas filas queden alineadas en ancho — cada columna trae un
                par de KPIs, salvo la 3ra que es la meta del mes. */}
            {showGoal ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="grid grid-cols-2 gap-3">{kpiIngresos}{kpiEgresos}</div>
                    <div className="grid grid-cols-2 gap-3">{kpiNeta}{kpiMargen}</div>
                    <GoalPanel goal={Number(fin.monthlyGoal)} projection={fin.projection} />
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {kpiIngresos}{kpiEgresos}{kpiNeta}{kpiMargen}
                </div>
            )}

            {/* Fila 2: desgloses método / categoría / servicios rentables — siempre top 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
                <GlassPanel className="min-h-[220px]">
                    <CardHeader icon={Award} title="Servicios más rentables" subtitle="Ingreso y utilidad real por servicio" />
                    <TopServicesMargin rows={topServices} />
                </GlassPanel>
            </div>

            {/* Fila 3: tendencia con más altura + velocímetro de proyección */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <GlassPanel className={`min-h-[340px] ${showProjection ? '' : 'lg:col-span-2'}`}>
                    <FinanceTrendChart period={period} year={year} month={month} day={day} previewData={fin.trendPreview} />
                </GlassPanel>
                {showProjection && (
                    <GlassPanel className="min-h-[340px]">
                        <CardHeader icon={Telescope} title="Proyección de cierre" subtitle="Si se cumplen los turnos agendados" />
                        <ProjectionGauge projection={fin.projection} />
                    </GlassPanel>
                )}
            </div>
        </div>
    );
}
