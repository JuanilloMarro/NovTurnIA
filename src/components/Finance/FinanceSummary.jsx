import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LabelList, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Coins, Percent, CreditCard, Layers, Award } from 'lucide-react';
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

// KPI con la distribución anterior (icono a la izquierda + label/valor apilados),
// manteniendo el estilo de icono de Estadísticas (círculo navy).
function FinKpi({ icon: Icon, label, value, index = 0 }) {
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
                    <div className="text-lg font-bold text-navy-900 tabular-nums truncate leading-tight mt-0.5">{value}</div>
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
                        <span className="text-[9px] font-bold text-navy-900/30">{r.n} {Number(r.n) === 1 ? 'movimiento' : 'movimientos'}</span>
                    </div>
                );
            })}
        </div>
    );
}

function TopServicesBar({ rows }) {
    const data = (rows || []).slice(0, 6).map(r => ({ name: r.name, revenue: Number(r.revenue) || 0 }));
    if (!data.length) return <p className="text-[11px] text-navy-900/30 font-bold flex-1 flex items-center justify-center">Aún no hay ingresos por servicio.</p>;
    const max = Math.max(...data.map(d => d.revenue), 1);
    const Label = ({ x, y, width, value, index }) => (
        <text x={x + width / 2} y={y - 6} fill={SEMAFORO[index % SEMAFORO.length]} textAnchor="middle" fontSize={9} fontWeight={900}>{moneyShort(value)}</text>
    );
    return (
        <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 18, right: 6, bottom: 4, left: 6 }} barSize={30}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 9 }} interval={0}
                        angle={data.length > 3 ? -20 : 0} textAnchor={data.length > 3 ? 'end' : 'middle'} height={data.length > 3 ? 44 : 24} />
                    <YAxis hide domain={[0, max * 1.15]} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {data.map((e, i) => <Cell key={i} fill={SEMAFORO[i % SEMAFORO.length]} />)}
                        <LabelList dataKey="revenue" content={<Label />} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function FinanceSummary({ fin, period, year, month, day }) {
    const s = fin.summary || {};
    const byMethod = (s.income_by_method || []).map(m => ({ label: METHOD_LABEL[m.method] || m.method, total: m.total, n: m.n }))
        .sort((a, b) => Number(b.total) - Number(a.total));
    const byCat = (s.expense_by_category || []).map(c => ({ label: CAT_LABEL[c.category] || c.category, total: c.total, n: c.n }))
        .sort((a, b) => Number(b.total) - Number(a.total));

    return (
        <div className="space-y-3 px-1 pb-2">
            {/* KPIs — distribución y estilo de iconos del módulo de Estadísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <FinKpi label="Ingresos" value={moneyShort(fin.totalIncome)} icon={TrendingUp} index={0} />
                <FinKpi label="Egresos" value={moneyShort(fin.totalExpenses)} icon={TrendingDown} index={1} />
                <FinKpi label="Utilidad neta" value={moneyShort(fin.netProfit)} icon={Coins} index={2} />
                <FinKpi label="Margen" value={`${fin.marginPct.toFixed(0)}%`} icon={Percent} index={3} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <GlassPanel className="min-h-[340px]">
                    <FinanceTrendChart period={period} year={year} month={month} day={day} />
                </GlassPanel>
                <GlassPanel className="min-h-[340px]">
                    <CardHeader icon={Award} title="Servicios más rentables" subtitle="Ingresos por servicio" />
                    <TopServicesBar rows={s.top_services} />
                </GlassPanel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <GlassPanel className="min-h-[220px]">
                    <CardHeader icon={CreditCard} title="Ingresos por método" subtitle={moneyFull(fin.totalIncome)} />
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
