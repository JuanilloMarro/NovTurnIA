import { useState } from 'react';
import { BarChart2, Brain, Lock, CalendarDays, Users, MessageSquare, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStats } from '../hooks/useStats';
import KpiCard, { KpiDelta } from '../components/Stats/KpiCard';
import { AppointmentStatusChart } from '../components/Stats/AppointmentStatusChart';
import { MainChart } from '../components/Stats/MainChart';
import { StatsIntelligence } from '../components/Stats/StatsIntelligence';
import FeatureLock from '../components/FeatureLock';
import { usePlanLimits } from '../hooks/usePlanLimits';

const PERIODS = [
    { key: 'day', label: 'Día' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
];

const KPI_LABELS = {
    day: { apts: 'Turnos hoy', msgs: 'Mensajes hoy' },
    week: { apts: 'Turnos esta semana', msgs: 'Mensajes esta semana' },
    month: { apts: 'Turnos este mes', msgs: 'Mensajes este mes' },
};

const MOCK_KPI = { monthApts: 142, totalPatients: 387, receivedMessages: 921, sentMessages: 884 };
const MOCK_DONUT = {
    data: [
        { name: 'Confirmados', value: 92 },
        { name: 'Pendientes', value: 31 },
        { name: 'Cancelados', value: 19 },
    ],
    confRate: 65,
};
// Serie de muestra para la gráfica real (MainChart) en el fondo del FeatureLock —
// alimenta el AreaChart sin tocar la base de datos.
const MOCK_TREND = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    .map((name, i) => ({ name, turnos: [12, 18, 15, 22, 19, 26, 24, 21, 28, 31, 27, 29][i], no_show: 0, cancelled: 0 }));

// ── Semana ISO ────────────────────────────────────────────
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ── Label del navegador ───────────────────────────────────
function getNavLabel(period, date) {
    if (period === 'day') {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return `${days[date.getDay()]} ${date.getDate()}`;
    }
    if (period === 'week') {
        return `Sem. ${getISOWeek(date)}`;
    }
    const label = date.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

// ── Panel de gráfica compacto (mismo lenguaje de cristal que las tarjetas de
// resumen, pero con menos padding/alto para que quepan 3 en una fila). ──
function ChartPanel({ children, minH = 260 }) {
    return (
        <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex flex-col overflow-hidden p-5" style={{ minHeight: minH }}>
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="relative z-10 flex flex-col h-full min-h-0">{children}</div>
        </div>
    );
}

// ── Contenido de métricas ────────────────────────────────
// Versión clásica: fila 1 con los 4 KPIs (alto reducido) y fila 2 con turnos
// por período + tasa de confirmación a mayor altura. Los KPIs de clientes
// nuevos/recurrentes y conversión viven ahora en la pestaña Inteligencia.
function StatsContent({ kpi, donut, period, selectedYear, selectedMonth, selectedDay, chartPreview = null }) {
    const labels = KPI_LABELS[period] ?? KPI_LABELS.month;
    return (
        <div className="h-full flex flex-col w-full overflow-y-auto md:overflow-hidden px-1 md:pb-0 pb-4">
            <div className="md:flex-1 md:overflow-hidden flex flex-col gap-3 md:pb-2 md:pr-0.5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-1">
                    <KpiCard label={labels.apts} value={kpi.monthApts} icon={<CalendarDays size={14} strokeWidth={2.5} />} index={0}
                        delta={<KpiDelta change={kpi.aptsChange} />} />
                    <KpiCard label="Clientes totales" value={kpi.totalPatients} icon={<Users size={14} strokeWidth={2.5} />} index={1} />
                    <KpiCard label="Mensajes recibidos" value={kpi.receivedMessages} icon={<MessageSquare size={14} strokeWidth={2.5} />} index={2} />
                    <KpiCard label="Mensajes enviados" value={kpi.sentMessages} icon={<Send size={14} strokeWidth={2.5} />} index={3} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:flex-1 md:min-h-0 pb-2 px-1">
                    <ChartPanel minH={320}>
                        <MainChart period={period} selectedYear={selectedYear} selectedMonth={selectedMonth} selectedDay={selectedDay} previewData={chartPreview} />
                    </ChartPanel>
                    <ChartPanel minH={320}>
                        <AppointmentStatusChart data={donut.data} confRate={donut.confRate} />
                    </ChartPanel>
                </div>
            </div>
        </div>
    );
}

function StatsLoaded({ period, selectedYear, selectedMonth, selectedDay }) {
    const { stats } = useStats(period, selectedYear, selectedMonth, selectedDay);

    // Solo mostrar shimmer en la carga inicial; al navegar se mantiene el contenido anterior
    if (!stats) {
        return (
            <div className="h-full flex flex-col w-full">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {Array(4).fill(0).map((_, i) => (
                        <div key={i} className="animate-shimmer h-24 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                    <div className="animate-shimmer h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md min-h-[240px]" />
                    <div className="animate-shimmer h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md min-h-[240px]" />
                </div>
            </div>
        );
    }

    return (
        <StatsContent
            kpi={stats.kpi}
            donut={stats.donut}
            period={period}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            selectedDay={selectedDay}
        />
    );
}

// ── Export principal ─────────────────────────────────────
export default function Stats() {
    const { hasFeature, isLoading: planLoading } = usePlanLimits();
    const [activeTab, setActiveTab] = useState('metricas');
    const [period, setPeriod] = useState('month');
    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const hasIntelligence = hasFeature('business_intelligence');

    const selectedYear = anchorDate.getFullYear();
    const selectedMonth = anchorDate.getMonth();
    const navLabel = getNavLabel(period, anchorDate);

    const handlePeriodChange = (p) => {
        setPeriod(p);
        setAnchorDate(new Date());
    };

    const handlePrev = () => setAnchorDate(prev => {
        const d = new Date(prev);
        if (period === 'day') d.setDate(d.getDate() - 1);
        if (period === 'week') d.setDate(d.getDate() - 7);
        if (period === 'month') d.setMonth(d.getMonth() - 1);
        return d;
    });

    const handleNext = () => setAnchorDate(prev => {
        const d = new Date(prev);
        if (period === 'day') d.setDate(d.getDate() + 1);
        if (period === 'week') d.setDate(d.getDate() + 7);
        if (period === 'month') d.setMonth(d.getMonth() + 1);
        return d;
    });

    if (planLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
            </div>
        );
    }

    // Controles compartidos entre ambas pestañas
    const sharedControls = (
        <>
            {/* Selector de período */}
            <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10">
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => handlePeriodChange(p.key)}
                        className={`relative z-10 px-4 h-8 rounded-full transition-all ${period === p.key
                            ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900'
                            : 'hover:bg-white/20 text-navy-900/60'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Navegador de fecha */}
            <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 h-10">
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                <button
                    onClick={handlePrev}
                    className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm border border-white/80 text-navy-900 hover:bg-white/80 shadow-md transition-all hover:scale-[1.05] active:scale-95"
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="relative z-10 h-8 flex items-center justify-center gap-1.5 px-3" style={{ minWidth: 110 }}>
                    <CalendarDays size={13} className="text-navy-900 shrink-0" />
                    <span className="text-[11px] font-bold text-navy-900 tracking-tight whitespace-nowrap leading-none capitalize">
                        {navLabel}
                    </span>
                </div>
                <button
                    onClick={handleNext}
                    className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm border border-white/80 text-navy-900 hover:bg-white/80 shadow-md transition-all hover:scale-[1.05] active:scale-95"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </>
    );

    const header = (
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
            <div>
                <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">
                    {activeTab === 'metricas' ? 'Estadísticas' : 'Inteligencia de negocio'}
                </h1>
                <p className="text-xs text-navy-700/60 font-semibold tracking-wide">
                    {activeTab === 'metricas' ? 'Rendimiento y métricas del negocio' : 'Análisis inteligente de datos históricos'}
                </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
                {sharedControls}

                {/* Tabs Métricas / Inteligencia */}
                <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10">
                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    <button
                        onClick={() => setActiveTab('metricas')}
                        className={`relative z-10 px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${activeTab === 'metricas' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}
                    >
                        <BarChart2 size={12} />
                        Métricas
                    </button>
                    <button
                        onClick={() => setActiveTab('inteligencia')}
                        className={`relative z-10 px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${activeTab === 'inteligencia' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}
                    >
                        <Brain size={12} />
                        Inteligencia
                        {!hasIntelligence && <Lock size={10} className="text-navy-700/50 ml-1" />}
                    </button>
                </div>
            </div>
        </div>
    );

    if (!hasFeature('dashboard')) {
        return (
            <FeatureLock
                feature="dashboard"
                variant="blurred"
                title="Estadísticas"
                description="El dashboard completo de métricas (turnos, clientes, tasa de confirmación, comparativas mensuales) está disponible en Pro y Enterprise."
                requiredPlan="Pro"
            >
                <div className="h-full flex flex-col pt-2 px-2">
                    {header}
                    <StatsContent kpi={MOCK_KPI} donut={MOCK_DONUT} period="month" selectedYear={selectedYear} selectedMonth={selectedMonth} chartPreview={MOCK_TREND} />
                </div>
            </FeatureLock>
        );
    }

    return (
        <div className="h-full flex flex-col pt-2 px-2 overflow-hidden">
            {header}
            <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${activeTab === 'metricas' ? 'lg:overflow-hidden' : ''}`}>
                {activeTab === 'metricas'
                    ? <StatsLoaded period={period} selectedYear={selectedYear} selectedMonth={selectedMonth} selectedDay={anchorDate.getDate()} />
                    : <StatsIntelligence period={period} anchorDate={anchorDate} />
                }
            </div>
        </div>
    );
}
