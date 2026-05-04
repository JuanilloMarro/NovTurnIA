import {
    ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, Cell,
    RadialBarChart, RadialBar, PolarAngleAxis,
    Treemap,
    RadarChart, Radar, PolarGrid, PolarRadiusAxis,
} from 'recharts';
import { Brain, TrendingUp, Layers, CalendarDays, AlertCircle, Activity } from 'lucide-react';
import FeatureLock from '../FeatureLock';
import { useStats, getStatsDateRange } from '../../hooks/useStats';
import { useStatsIntelligence } from '../../hooks/useStatsIntelligence';
import { usePlanLimits } from '../../hooks/usePlanLimits';

// ── Paleta navy ──────────────────────────────────────────
const NAVY = ['#0F2044', '#1A3A6B', '#1D5FAD', '#5B8AC4', '#8EB3D9', '#C0D8F0'];
const ACCENT = { emerald: '#10B981', amber: '#F59E0B', red: '#EF4444' };

function getDisplayRange(period, anchorDate) {
    if (period === 'day') return 'Hoy';
    if (period === 'week') return 'Esta semana';
    const label = anchorDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

// ── Mock data ─────────────────────────────────────────────
const MOCK_LTV = [
    { display_name: 'Ana García', total_appointments: 12, total_revenue: 3600, last_visit: null },
    { display_name: 'Carlos López', total_appointments: 9, total_revenue: 2700, last_visit: null },
    { display_name: 'María Rodríguez', total_appointments: 7, total_revenue: 2100, last_visit: null },
];
const MOCK_RETENTION = {
    total_patients: 48, retained_patients: 34,
    retention_pct: 70.8, period_label: 'Últimos 6 meses',
};
const MOCK_SERVICES = [
    { service_name: 'Consulta General', appointment_count: 45, total_revenue: 13500, pct_of_total: 52.3 },
    { service_name: 'Limpieza', appointment_count: 28, total_revenue: 8400, pct_of_total: 32.5 },
    { service_name: 'Radiografía', appointment_count: 12, total_revenue: 3600, pct_of_total: 13.9 },
];
const MOCK_PREDICTION = [
    { day_label: 'Dom', avg_appointments: 0.2, has_sufficient_data: true },
    { day_label: 'Lun', avg_appointments: 4.1, has_sufficient_data: true },
    { day_label: 'Mar', avg_appointments: 3.8, has_sufficient_data: true },
    { day_label: 'Mié', avg_appointments: 5.0, has_sufficient_data: true },
    { day_label: 'Jue', avg_appointments: 3.2, has_sufficient_data: true },
    { day_label: 'Vie', avg_appointments: 4.6, has_sufficient_data: true },
    { day_label: 'Sáb', avg_appointments: 1.5, has_sufficient_data: true },
];

// ── Helpers ──────────────────────────────────────────────
function retentionColor(pct) {
    if (pct >= 65) return ACCENT.emerald;
    if (pct >= 40) return ACCENT.amber;
    return ACCENT.red;
}

function formatQ(v) {
    return `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso) {
    if (!iso) return '·';
    return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
}

// ── Spinner ───────────────────────────────────────────────
function SectionLoader() {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-navy-900/20 border-t-navy-900/60 rounded-full animate-spin" />
        </div>
    );
}

function SectionError({ message }) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertCircle size={20} className="text-red-400" />
            <p className="text-[11px] font-bold text-navy-900/40">{message || 'Error al cargar'}</p>
        </div>
    );
}

// ── Card wrapper con Badge en esquina superior derecha ──
function Card({ title, subtitle, icon, badge, children }) {
    return (
        <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] px-6 py-[22px] flex flex-col gap-[12px] md:flex-1 md:min-h-0 relative">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                        {icon}
                    </div>
                    <div className="min-w-0 pt-[5px]">
                        <p className="text-[13px] font-black text-navy-900 leading-none tracking-tight">{title}</p>
                        <p className="text-[10px] font-bold text-navy-900/40 mt-0.5">{subtitle}</p>
                    </div>
                </div>
                {badge && <div className="shrink-0">{badge}</div>}
            </div>
            <div className="flex-1 min-h-0">
                {children}
            </div>
        </div>
    );
}

// ── 1. LTV de Pacientes ───────────────────────────────────
function LTVChart({ data, loading, error }) {
    if (loading) return <SectionLoader />;
    if (error) return <SectionError message={error} />;

    const isEmpty = !data?.length;
    const chartData = isEmpty
        ? [{ display_name: 'Sin datos', total_revenue: 0 }]
        : [...data].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 3);

    const maxRevenue = Math.max(...chartData.map(d => Number(d.total_revenue)), 1);

    return (
        <div className="flex items-center gap-6 h-full">
            {isEmpty ? (
                <p className="w-full text-[11px] text-navy-900/40 font-bold text-center py-8">Sin datos suficientes.</p>
            ) : (
                <>
                    <div className="w-[40%] h-full flex items-end">
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={chartData} margin={{ top: 15, right: 0, bottom: 0, left: 0 }} barSize={28}>
                                <XAxis dataKey="display_name" hide />
                                <YAxis hide domain={[0, maxRevenue * 1.1]} />
                                <Bar dataKey="total_revenue" radius={[6, 6, 0, 0]}>
                                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={NAVY[index % NAVY.length]} />)}
                                    <LabelList dataKey="total_revenue" position="top" formatter={v => formatQ(v)} style={{ fontSize: 9, fontWeight: 800, fill: '#1A3A6B' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-[60%] flex flex-col gap-1.5">
                        {chartData.map((p, i) => (
                            <div key={i} className="bg-navy-900/3 rounded-2xl p-3 flex flex-col border border-navy-900/5">
                                <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black text-white shrink-0 shadow-sm" style={{ backgroundColor: NAVY[i % NAVY.length] }}>{i + 1}</span>
                                        <span className="text-[11px] font-black text-navy-900 truncate pr-2">{p.display_name}</span>
                                    </div>
                                    <span className="text-[11px] font-black text-navy-900 shrink-0">{formatQ(p.total_revenue)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-navy-900/40">{p.total_appointments} citas</span>
                                    <span className="text-navy-900/20 text-[10px]">·</span>
                                    <span className="text-[9px] font-bold text-navy-900/40">Último: {formatDate(p.last_visit)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ── 2. Tasa de Retención ──────────────────────────────────
function RetentionGauge({ data, loading, error }) {
    if (loading) return <SectionLoader />;
    if (error) return <SectionError message={error} />;

    const rawPct = Number(data?.retention_pct ?? 0);
    const pct = Number(rawPct.toFixed(1));
    const total = Number(data?.total_patients ?? 0);
    const retained = Number(data?.retained_patients ?? 0);
    const color = retentionColor(pct);

    const gaugeData = [{ name: 'Retención', value: pct, fill: color }];

    return (
        <div className="flex items-center gap-6 h-full">
            <div className="relative w-[45%] h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={210} endAngle={-30} data={gaugeData} barSize={18}>
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar dataKey="value" background={{ fill: 'rgba(15,32,68,0.06)' }} cornerRadius={10} />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[32px] font-black leading-none" style={{ color }}>{pct}%</span>
                    <span className="text-[10px] font-bold text-navy-900/40 tracking-widest mt-1">Ratio</span>
                </div>
            </div>
            <div className="w-[55%] flex flex-col gap-3">
                <div className="bg-navy-900/3 rounded-2xl p-5 flex flex-col border border-navy-900/5">
                    <span className="text-2xl font-black text-navy-900 leading-none">{retained}</span>
                    <span className="text-[11px] font-bold text-navy-900/40 mt-1">Retornaron</span>
                </div>
                <div className="bg-navy-900/3 rounded-2xl p-5 flex flex-col border border-navy-900/5">
                    <span className="text-2xl font-black text-navy-900 leading-none">{total}</span>
                    <span className="text-[11px] font-bold text-navy-900/40 mt-1">Activos</span>
                </div>
            </div>
        </div>
    );
}

// ── 3. Análisis de Servicios (Listado Estilo Métricas con puntos w-2) ──────────────────────────────
function ServiceTreemap({ data, loading, error }) {
    if (loading) return <SectionLoader />;
    if (error) return <SectionError message={error} />;

    const isEmpty = !data?.length;
    const chartData = [...(data || [])].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 3);

    const CustomContent = ({ x, y, width, height, index, service_name }) => (
        <g>
            <rect x={x} y={y} width={width} height={height} rx={10} ry={10} fill={NAVY[index % NAVY.length]} fillOpacity={0.85 - index * 0.15} stroke="white" strokeWidth={2} />
            {width > 50 && height > 30 && <text x={x + 10} y={y + 20} fill="white" fontSize={10} fontWeight={800}>{service_name?.slice(0, 14)}</text>}
        </g>
    );

    return (
        <div className="flex flex-col h-full">
            {isEmpty ? (
                <p className="text-[11px] text-navy-900/40 font-bold text-center py-8">Sin datos.</p>
            ) : (
                <>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <Treemap data={chartData} dataKey="total_revenue" nameKey="service_name" content={<CustomContent />} />
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col mt-4 gap-2 shrink-0">
                        {chartData.map((s, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: NAVY[i % NAVY.length] }} />
                                    <span className="text-[11px] font-bold text-navy-900 truncate">{s.service_name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-right">
                                    <span className="text-[11px] font-black text-navy-900">{formatQ(s.total_revenue)}</span>
                                    <span className="text-[10px] font-bold text-navy-900/30">{s.pct_of_total}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ── 4. Predicción de Agenda ───────────────────────────────
function PredictionRadar({ data, loading, error }) {
    if (loading) return <SectionLoader />;
    if (error) return <SectionError message={error} />;

    const top3 = [...data].sort((a, b) => b.avg_appointments - a.avg_appointments).slice(0, 3);

    return (
        <div className="flex items-center gap-6 h-full">
            <div className="w-[45%] h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="90%">
                    <RadarChart data={data} cx="50%" cy="50%" outerRadius="80%">
                        <PolarGrid stroke="rgba(15,32,68,0.06)" />
                        <PolarAngleAxis dataKey="day_label" tick={{ fontSize: 10, fontWeight: 800, fill: '#1A3A6B' }} />
                        <Radar dataKey="avg_appointments" stroke="#1A3A6B" fill="#1A3A6B" fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: '#1D5FAD', stroke: 'white' }} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            <div className="w-[55%] flex flex-col gap-2">
                {top3.map((d, i) => (
                    <div key={i} className="bg-navy-900/3 rounded-2xl p-3.5 flex items-center justify-between border border-navy-900/5">
                        <span className="text-[11px] font-black text-navy-900/40">{d.day_label}</span>
                        <div className="text-right">
                            <span className="text-xl font-black text-navy-900 block leading-none">{d.avg_appointments}</span>
                            <span className="text-[9px] font-bold text-navy-900/20 tracking-tighter mt-1 block">citas/sem</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Export principal ──────────────────────────────────────
export function StatsIntelligence({ period = 'month', anchorDate = new Date() }) {
    const { hasFeature } = usePlanLimits();
    const unlocked = hasFeature('stats_intelligence');

    const { start: startDate, end: endDate } = getStatsDateRange(period, anchorDate.getFullYear(), anchorDate.getMonth());
    const label = getDisplayRange(period, anchorDate);
    const { ltv, retention, services, prediction } = useStatsIntelligence(unlocked, startDate, endDate);

    // Badge para avisos de datos insuficientes
    const predictionBadge = prediction.data?.some(d => !d.has_sufficient_data) ? (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 shrink-0">
            <AlertCircle size={10} className="text-amber-600" />
            <span className="text-[8px] font-black text-amber-600 tracking-tighter">Datos insuficientes</span>
        </div>
    ) : null;

    if (!unlocked) {
        return (
            <FeatureLock feature="stats_intelligence" variant="blurred" title="Inteligencia de Negocio" description="Análisis avanzados disponibles en plan Enterprise." requiredPlan="Enterprise">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px] md:flex-1 md:min-h-0 px-1 pb-[2px]">
                    <Card title="Valor de vida paciente" subtitle={`LTV · ${label}`} icon={<TrendingUp size={18} />}>
                        <LTVChart data={MOCK_LTV} loading={false} error={null} />
                    </Card>
                    <Card title="Tasa de retención" subtitle={label} icon={<Brain size={18} />}>
                        <RetentionGauge data={MOCK_RETENTION} loading={false} error={null} />
                    </Card>
                    <Card title="Análisis de servicios" subtitle={`Ingresos · ${label}`} icon={<Layers size={18} />}>
                        <ServiceTreemap data={MOCK_SERVICES} loading={false} error={null} />
                    </Card>
                    <Card title="Predicción de agenda" subtitle={`Patrón · ${label}`} icon={<CalendarDays size={18} />}>
                        <PredictionRadar data={MOCK_PREDICTION} loading={false} error={null} />
                    </Card>
                </div>
            </FeatureLock>
        );
    }

    return (
        <div className="flex flex-col flex-1 md:min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px] md:flex-1 md:min-h-0 px-1 pb-[2px]">
                <Card title="Valor de vida paciente" subtitle={`LTV · ${label}`} icon={<TrendingUp size={18} />}>
                    <LTVChart data={ltv.data} loading={ltv.loading} error={ltv.error} />
                </Card>
                <Card title="Tasa de retención" subtitle={label} icon={<Brain size={18} />}>
                    <RetentionGauge data={retention.data} loading={retention.loading} error={retention.error} />
                </Card>
                <Card title="Análisis de servicios" subtitle={`Ingresos · ${label}`} icon={<Layers size={18} />}>
                    <ServiceTreemap data={services.data} loading={services.loading} error={services.error} />
                </Card>
                <Card
                    title="Predicción de agenda"
                    subtitle={`Patrón · ${label}`}
                    icon={<CalendarDays size={18} />}
                    badge={predictionBadge}
                >
                    <PredictionRadar data={prediction.data} loading={prediction.loading} error={prediction.error} />
                </Card>
            </div>
        </div>
    );
}
