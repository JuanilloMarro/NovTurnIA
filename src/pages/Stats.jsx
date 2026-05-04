import { useState } from 'react';
import { BarChart2, Brain, Lock, CalendarDays, Users, MessageSquare, Send, ChevronLeft, ChevronRight, TrendingUp, Activity } from 'lucide-react';
import { useStats } from '../hooks/useStats';
import KpiCard from '../components/Stats/KpiCard';
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

// ── Contenido de métricas ────────────────────────────────
function StatsContent({ kpi, donut, period, selectedYear, selectedMonth }) {
    const labels = KPI_LABELS[period] ?? KPI_LABELS.month;
    return (
        <div className="h-full flex flex-col w-full overflow-y-auto md:overflow-hidden px-1 md:pb-0 pb-4">
            <div className="md:flex-1 md:overflow-hidden flex flex-col gap-3">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-1">
                    <KpiCard label={labels.apts} value={kpi.monthApts} icon={<CalendarDays size={14} strokeWidth={2.5} />} color="navy" index={0} />
                    <KpiCard label="Clientes totales" value={kpi.totalPatients} icon={<Users size={14} strokeWidth={2.5} />} color="navy" index={1} />
                    <KpiCard label="Mensajes recibidos" value={kpi.receivedMessages} icon={<MessageSquare size={14} strokeWidth={2.5} />} color="navy" index={2} />
                    <KpiCard label="Mensajes enviados" value={kpi.sentMessages} icon={<Send size={14} strokeWidth={2.5} />} color="navy" index={3} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:flex-1 md:min-h-0 pb-2 px-1">
                    <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] flex flex-col overflow-hidden p-6 min-h-[360px] md:min-h-0">
                        <MainChart period={period} selectedYear={selectedYear} selectedMonth={selectedMonth} />
                    </div>
                    <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] flex flex-col overflow-hidden p-6 min-h-[360px] md:min-h-0">
                        <AppointmentStatusChart data={donut.data} confRate={donut.confRate} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatsLoaded({ period, selectedYear, selectedMonth }) {
    const { stats } = useStats(period, selectedYear, selectedMonth);

    // Solo mostrar shimmer en la carga inicial; al navegar se mantiene el contenido anterior
    if (!stats) {
        return (
            <div className="h-full flex flex-col w-full">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {Array(4).fill(0).map((_, i) => (
                        <div key={i} className="animate-shimmer h-24 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px]" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                    <div className="animate-shimmer h-full bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] min-h-[300px]" />
                    <div className="animate-shimmer h-full bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] min-h-[300px]" />
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
        />
    );
}

// ── Export principal ─────────────────────────────────────
export default function Stats() {
    const { hasFeature, isLoading: planLoading } = usePlanLimits();
    const [activeTab, setActiveTab] = useState('metricas');
    const [period, setPeriod] = useState('month');
    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const hasIntelligence = hasFeature('stats_intelligence');

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
            <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-[11px] font-bold text-navy-900 shadow-sm h-10">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => handlePeriodChange(p.key)}
                        className={`px-4 h-8 rounded-full transition-all ${period === p.key
                            ? 'bg-white shadow-sm border border-white/80'
                            : 'hover:bg-white/40 text-navy-900/60'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Navegador de fecha */}
            <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-sm h-10">
                <button
                    onClick={handlePrev}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-white/80 text-navy-900 hover:bg-white/80 shadow-sm transition-all hover:scale-[1.05] active:scale-95"
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="h-8 flex items-center justify-center gap-1.5 px-3" style={{ minWidth: 110 }}>
                    <CalendarDays size={13} className="text-navy-900 shrink-0" />
                    <span className="text-[11px] font-bold text-navy-900 tracking-tight whitespace-nowrap leading-none capitalize">
                        {navLabel}
                    </span>
                </div>
                <button
                    onClick={handleNext}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-white/80 text-navy-900 hover:bg-white/80 shadow-sm transition-all hover:scale-[1.05] active:scale-95"
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
                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-[11px] font-bold text-navy-900 shadow-sm h-10">
                    <button
                        onClick={() => setActiveTab('metricas')}
                        className={`px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${activeTab === 'metricas' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40 text-navy-900/60'}`}
                    >
                        <BarChart2 size={12} />
                        Métricas
                    </button>
                    <button
                        onClick={() => setActiveTab('inteligencia')}
                        className={`px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${activeTab === 'inteligencia' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40 text-navy-900/60'}`}
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
                    <StatsContent kpi={MOCK_KPI} donut={MOCK_DONUT} period="month" selectedYear={selectedYear} selectedMonth={selectedMonth} />
                </div>
            </FeatureLock>
        );
    }

    return (
        <div className="h-full flex flex-col pt-2 px-2 overflow-hidden">
            {header}
            <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
                {activeTab === 'metricas'
                    ? <StatsLoaded period={period} selectedYear={selectedYear} selectedMonth={selectedMonth} />
                    : <StatsIntelligence period={period} anchorDate={anchorDate} />
                }
            </div>
        </div>
    );
}
