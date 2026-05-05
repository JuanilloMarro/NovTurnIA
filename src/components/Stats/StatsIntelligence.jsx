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

// ── Paleta semáforo (emerald / amber / red) ───────────────
const SEMAFORO = ['#10B981', '#F59E0B', '#EF4444'];
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
function Card({ title, subtitle, icon, badge, children, minH = '' }) {
    return (
        <div className={`bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] px-6 py-[22px] flex flex-col gap-[12px] relative ${minH}`}>
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
    const TOP_N = 3;
    const rawTop = isEmpty ? [] : [...data].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, TOP_N);
    const chartData = Array.from({ length: TOP_N }, (_, i) =>
        rawTop[i] ?? { display_name: '–', total_appointments: 0, total_revenue: 0, last_visit: null }
    );

    const maxRevenue = Math.max(...chartData.map(d => Number(d.total_revenue)), 1);

    const CustomLabel = (props) => {
        const { x, y, width, value, index } = props;
        if (!value || value <= 0) return null;
        return (
            <text
                x={x + width / 2}
                y={y - 8}
                fill={SEMAFORO[index % SEMAFORO.length]}
                textAnchor="middle"
                fontSize={9}
                fontWeight={900}
            >
                {formatQ(value)}
            </text>
        );
    };

    return (
        <div className="flex items-center gap-6 h-full">
            <div className="w-[40%] h-full flex items-end">
                <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={chartData} margin={{ top: 15, right: 0, bottom: 0, left: 0 }} barSize={28}>
                        <XAxis dataKey="display_name" hide />
                        <YAxis hide domain={[0, maxRevenue * 1.1]} />
                        <Bar dataKey="total_revenue" radius={[6, 6, 0, 0]}>
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={SEMAFORO[index % SEMAFORO.length]} />)}
                            <LabelList dataKey="total_revenue" content={<CustomLabel />} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="w-[60%] flex flex-col gap-1.5">
                {chartData.map((p, i) => (
                    <div key={i} className="bg-navy-900/3 rounded-2xl p-3 flex flex-col border border-navy-900/5">
                        <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black text-white shrink-0 shadow-sm" style={{ backgroundColor: SEMAFORO[i % SEMAFORO.length] }}>{i + 1}</span>
                                <span className="text-[11px] font-black text-navy-900 truncate pr-2">{p.display_name}</span>
                            </div>
                            <span className="text-[11px] font-black text-navy-900 shrink-0">{Number(p.total_revenue) > 0 ? formatQ(p.total_revenue) : '–'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-navy-900/40">{p.total_appointments} citas</span>
                            <span className="text-navy-900/20 text-[10px]">·</span>
                            <span className="text-[9px] font-bold text-navy-900/40">Último: {formatDate(p.last_visit)}</span>
                        </div>
                    </div>
                ))}
            </div>
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

// ── 3. Análisis de Servicios ──────────────────────────────
function ServiceTreemap({ data, loading, error, ownServices = [] }) {
    if (loading) return <SectionLoader />;
    if (error) return <SectionError message={error} />;

    const TOP_N = 3;
    const rawTop = [...(data || [])].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, TOP_N);

    // Padding con servicios reales del negocio (ordenados por nombre) que aún no tengan stats
    const statsNames = new Set(rawTop.map(s => s.service_name));
    const paddingPool = ownServices
        .filter(s => !statsNames.has(s.name))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const chartData = Array.from({ length: TOP_N }, (_, i) => {
        if (rawTop[i]) return rawTop[i];
        const pad = paddingPool[i - rawTop.length];
        return pad
            ? { service_name: pad.name, appointment_count: 0, total_revenue: 0, pct_of_total: 0 }
            : { service_name: '–', appointment_count: 0, total_revenue: 0, pct_of_total: 0 };
    });
    const isEmpty = rawTop.length === 0 && ownServices.length === 0;

    const maxRevenue = Math.max(...chartData.map(d => Number(d.total_revenue)), 1);

    return (
        <div className="flex flex-col h-full justify-center gap-3">
            {chartData.map((s, i) => {
                const pct = maxRevenue > 0 ? (Number(s.total_revenue) / maxRevenue) * 100 : 0;
                const color = SEMAFORO[i % SEMAFORO.length];
                const hasData = Number(s.total_revenue) > 0;
                return (
                    <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-black text-white shadow-sm" style={{ backgroundColor: color }}>{i + 1}</span>
                                <span className="text-[11px] font-black text-navy-900 truncate">{s.service_name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[11px] font-black text-navy-900">{hasData ? formatQ(s.total_revenue) : '–'}</span>
                                {hasData && <span className="text-[10px] font-bold text-navy-900/30">{s.pct_of_total}%</span>}
                            </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-navy-900/5 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: hasData ? `${pct}%` : '8%', backgroundColor: color, opacity: hasData ? 1 : 0.2 }}
                            />
                        </div>
                        <span className="text-[9px] font-bold text-navy-900/30">{s.appointment_count} {s.appointment_count === 1 ? 'cita' : 'citas'}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ── 4. Predicción de Agenda ───────────────────────────────
function PredictionRadar({ data, loading, error }) {
    if (loading) return <SectionLoader />;
    if (error) return <SectionError message={error} />;
    if (!data?.length) return <SectionError message="Sin datos de agenda aún." />;

    const top3 = [...data].sort((a, b) => b.avg_appointments - a.avg_appointments).slice(0, 3);

    return (
        <div className="flex items-center gap-6 h-full">
            <div className="w-[45%] h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="90%">
                    <RadarChart data={data} cx="50%" cy="50%" outerRadius="80%">
                        <PolarGrid stroke="rgba(15,32,68,0.1)" />
                        <PolarAngleAxis dataKey="day_label" tick={{ fontSize: 10, fontWeight: 900, fill: '#0F2044' }} />
                        <Radar dataKey="avg_appointments" stroke="#0F2044" fill="#0F2044" fillOpacity={0.12} strokeWidth={2} dot={{ r: 3, fill: '#0F2044', stroke: 'white' }} />
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

    const { start: startDate, end: endDate } = getStatsDateRange(period, anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    const label = getDisplayRange(period, anchorDate);
    const { ltv, retention, services, prediction, ownServices } = useStatsIntelligence(unlocked, startDate, endDate);

    // Badge para avisos de datos insuficientes
    const predictionBadge = prediction.data?.some(d => !d.has_sufficient_data) ? (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 shrink-0">
            <AlertCircle size={10} className="text-amber-600" />
            <span className="text-[8px] font-black text-amber-600 tracking-tighter">Datos insuficientes</span>
        </div>
    ) : null;

    const GRID = "grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-3 px-1";
    const CARD_MIN = "min-h-[300px] lg:min-h-0";

    if (!unlocked) {
        return (
            <FeatureLock feature="stats_intelligence" variant="blurred" title="Inteligencia de Negocio" description="Análisis avanzados disponibles en plan Enterprise." requiredPlan="Enterprise">
                <div className={`${GRID} pb-4`}>
                    <Card title="Valor de vida paciente" subtitle={`LTV · ${label}`} icon={<TrendingUp size={18} />} minH={CARD_MIN}>
                        <LTVChart data={MOCK_LTV} loading={false} error={null} />
                    </Card>
                    <Card title="Tasa de retención" subtitle={label} icon={<Brain size={18} />} minH={CARD_MIN}>
                        <RetentionGauge data={MOCK_RETENTION} loading={false} error={null} />
                    </Card>
                    <Card title="Análisis de servicios" subtitle={`Ingresos · ${label}`} icon={<Layers size={18} />} minH={CARD_MIN}>
                        <ServiceTreemap data={MOCK_SERVICES} loading={false} error={null} />
                    </Card>
                    <Card title="Predicción de agenda" subtitle={`Patrón · ${label}`} icon={<CalendarDays size={18} />} minH={CARD_MIN}>
                        <PredictionRadar data={MOCK_PREDICTION} loading={false} error={null} />
                    </Card>
                </div>
            </FeatureLock>
        );
    }

    return (
        <div className={`${GRID} pb-4 lg:pb-0 lg:h-full`}>
            <Card title="Valor de vida paciente" subtitle={`LTV · ${label}`} icon={<TrendingUp size={18} />} minH={CARD_MIN}>
                <LTVChart data={ltv.data} loading={ltv.loading} error={ltv.error} />
            </Card>
            <Card title="Tasa de retención" subtitle={label} icon={<Brain size={18} />} minH={CARD_MIN}>
                <RetentionGauge data={retention.data} loading={retention.loading} error={retention.error} />
            </Card>
            <Card title="Análisis de servicios" subtitle={`Ingresos · ${label}`} icon={<Layers size={18} />} minH={CARD_MIN}>
                <ServiceTreemap data={services.data} loading={services.loading} error={services.error} ownServices={ownServices} />
            </Card>
            <Card
                title="Predicción de agenda"
                subtitle={`Patrón · ${label}`}
                icon={<CalendarDays size={18} />}
                badge={predictionBadge}
                minH={CARD_MIN}
            >
                <PredictionRadar data={prediction.data} loading={prediction.loading} error={prediction.error} />
            </Card>
        </div>
    );
}
