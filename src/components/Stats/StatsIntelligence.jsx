import {
    ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, LabelList, Cell,
    RadialBarChart, RadialBar, PolarAngleAxis,
    RadarChart, Radar, PolarGrid,
} from 'recharts';
import { Brain, TrendingUp, Users, UserPlus, Repeat, CalendarDays, AlertCircle } from 'lucide-react';
import FeatureLock from '../FeatureLock';
import KpiCard, { KpiDelta } from './KpiCard';
import { InquiryConversionCard } from './InquiryConversionCard';
import { ClientsTrendChart } from './ClientsTrendChart';
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
const MOCK_CLIENTS = {
    newCount: 24, recurringCount: 58, newChange: '12.0', recurringChange: '4.5',
    trend: ['Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'].map((_, i) => ({ month: `2026-0${i + 2}`, new_count: [14, 18, 20, 22, 19, 24][i], recurring_count: [30, 36, 41, 47, 52, 58][i] })),
};
const MOCK_INQUIRY = { asked: 34, booked: 24, notBooked: 10 };
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
        <div className={`relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md px-6 py-[22px] flex flex-col gap-[12px] ${minH}`}>
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="relative z-10 flex items-center justify-between shrink-0">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                        {icon}
                    </div>
                    <div className="min-w-0 pt-[5px]">
                        <p className="text-[13px] font-bold text-navy-900 leading-none tracking-tight">{title}</p>
                        <p className="text-[10px] font-bold text-navy-900/40 mt-0.5">{subtitle}</p>
                    </div>
                </div>
                {badge && <div className="shrink-0">{badge}</div>}
            </div>
            <div className="relative z-10 flex-1 min-h-0">
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
                                <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: SEMAFORO[i % SEMAFORO.length] }}>{i + 1}</span>
                                <span className="text-[11px] font-bold text-navy-900 truncate pr-2">{p.display_name}</span>
                            </div>
                            <span className="text-[11px] font-bold text-navy-900 shrink-0">{Number(p.total_revenue) > 0 ? formatQ(p.total_revenue) : '–'}</span>
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
                    <span className="text-[32px] font-bold leading-none" style={{ color }}>{pct}%</span>
                    <span className="text-[10px] font-bold text-navy-900/40 tracking-widest mt-1">Ratio</span>
                </div>
            </div>
            <div className="w-[55%] flex flex-col gap-3">
                <div className="bg-navy-900/3 rounded-2xl p-5 flex flex-col border border-navy-900/5">
                    <span className="text-2xl font-bold text-navy-900 leading-none">{retained}</span>
                    <span className="text-[11px] font-bold text-navy-900/40 mt-1">Retornaron</span>
                </div>
                <div className="bg-navy-900/3 rounded-2xl p-5 flex flex-col border border-navy-900/5">
                    <span className="text-2xl font-bold text-navy-900 leading-none">{total}</span>
                    <span className="text-[11px] font-bold text-navy-900/40 mt-1">Activos</span>
                </div>
            </div>
        </div>
    );
}

// ── 3. Predicción de Agenda ───────────────────────────────
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
                        <span className="text-[11px] font-bold text-navy-900/40">{d.day_label}</span>
                        <div className="text-right">
                            <span className="text-xl font-bold text-navy-900 block leading-none">{d.avg_appointments}</span>
                            <span className="text-[9px] font-bold text-navy-900/20 tracking-tighter mt-1 block">citas/sem</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Export principal ──────────────────────────────────────
// Layout 3 filas × 2 columnas: (1) KPIs de clientes nuevos/recurrentes +
// conversión de consultas, (2) LTV + retención, (3) curva de nuevos vs
// recurrentes + predicción de agenda.
export function StatsIntelligence({ period = 'month', anchorDate = new Date() }) {
    const { hasFeature } = usePlanLimits();
    const unlocked = hasFeature('business_intelligence');

    const { start: startDate, end: endDate } = getStatsDateRange(period, anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    const label = getDisplayRange(period, anchorDate);
    const { ltv, retention, prediction } = useStatsIntelligence(unlocked, startDate, endDate);
    // Clientes nuevos/recurrentes y conversión salen del mismo RPC que Métricas.
    const { stats } = useStats(period, anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());

    const sec = unlocked
        ? { ltv, retention, prediction }
        : {
            ltv: { data: MOCK_LTV, loading: false, error: null },
            retention: { data: MOCK_RETENTION, loading: false, error: null },
            prediction: { data: MOCK_PREDICTION, loading: false, error: null },
        };
    const clients = unlocked ? stats?.clients : MOCK_CLIENTS;
    const inquiry = unlocked ? (stats?.inquiry ?? { asked: 0, booked: 0, notBooked: 0 }) : MOCK_INQUIRY;

    // Badge para avisos de datos insuficientes
    const predictionBadge = sec.prediction.data?.some(d => !d.has_sufficient_data) ? (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 shrink-0">
            <AlertCircle size={10} className="text-amber-600" />
            <span className="text-[8px] font-bold text-amber-600 tracking-tighter">Datos insuficientes</span>
        </div>
    ) : null;

    const clientsLegend = (
        <div className="flex items-center gap-2.5 text-[9px] font-bold shrink-0">
            <span className="flex items-center gap-1 text-navy-900/55"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Nuevos</span>
            <span className="flex items-center gap-1 text-navy-900/55"><span className="w-2 h-2 rounded-full" style={{ background: '#4062C8' }} /> Recurrentes</span>
        </div>
    );

    const CARD_MIN = "min-h-[300px]";

    const grid = (
        <div className="flex flex-col gap-2 px-1 pb-4">
            {/* Fila 1: clientes del período + feedback de conversión */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="grid grid-cols-2 gap-2">
                    <KpiCard label="Clientes nuevos" value={clients ? clients.newCount : '…'} icon={<UserPlus size={14} strokeWidth={2.5} />} index={0}
                        delta={<KpiDelta change={clients?.newChange} />} />
                    <KpiCard label="Clientes recurrentes" value={clients ? clients.recurringCount : '…'} icon={<Repeat size={14} strokeWidth={2.5} />} index={1}
                        delta={<KpiDelta change={clients?.recurringChange} />} />
                </div>
                <InquiryConversionCard asked={inquiry.asked} booked={inquiry.booked} notBooked={inquiry.notBooked} index={2} />
            </div>

            {/* Fila 2: LTV + retención */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <Card title="Valor de vida paciente" subtitle={`LTV · ${label}`} icon={<TrendingUp size={18} />} minH={CARD_MIN}>
                    <LTVChart data={sec.ltv.data} loading={sec.ltv.loading} error={sec.ltv.error} />
                </Card>
                <Card title="Tasa de retención" subtitle={label} icon={<Brain size={18} />} minH={CARD_MIN}>
                    <RetentionGauge data={sec.retention.data} loading={sec.retention.loading} error={sec.retention.error} />
                </Card>
            </div>

            {/* Fila 3: curva de clientes + predicción */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <Card title="Nuevos vs recurrentes" subtitle="Últimos 6 meses" icon={<Users size={18} />} badge={clientsLegend} minH={CARD_MIN}>
                    <ClientsTrendChart trend={clients?.trend ?? []} />
                </Card>
                <Card title="Predicción de agenda" subtitle={`Patrón · ${label}`} icon={<CalendarDays size={18} />} badge={predictionBadge} minH={CARD_MIN}>
                    <PredictionRadar data={sec.prediction.data} loading={sec.prediction.loading} error={sec.prediction.error} />
                </Card>
            </div>
        </div>
    );

    if (!unlocked) {
        return (
            <FeatureLock feature="business_intelligence" variant="blurred" title="Inteligencia de Negocio" description="Análisis avanzados disponibles en plan Enterprise." requiredPlan="Enterprise">
                {grid}
            </FeatureLock>
        );
    }

    return grid;
}
