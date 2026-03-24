import { useStats } from '../hooks/useStats';
import KpiCard from '../components/Stats/KpiCard';
import { AppointmentStatusChart } from '../components/Stats/AppointmentStatusChart';
import { MainChart } from '../components/Stats/MainChart';

export default function Stats() {
    const { stats, loading } = useStats();

    if (loading || !stats) {
        return (
            <div className="h-full flex flex-col w-full pt-2">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Estadísticas</h1>
                            <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Analizando el rendimiento de la clínica...</p>
                        </div>
                    </div>
                </div>
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

    const { kpi, donut, rawApts } = stats;

    return (
        <div className="h-full flex flex-col w-full pt-2 overflow-hidden px-2">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Estadísticas</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Rendimiento y métricas de la clínica</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col gap-4">
                {/* KPI Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-1">
                    <KpiCard
                        label="Turnos mensuales"
                        value={kpi.monthApts}
                        change={kpi.aptsChange}
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>}
                        color="navy"
                        index={0}
                    />
                    <KpiCard
                        label="Pacientes activos"
                        value={kpi.activePatients}
                        change={undefined}
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                        color="navy"
                        index={1}
                    />
                    <KpiCard
                        label="Tasa completitud"
                        value={`${kpi.completionPct}%`}
                        change={undefined}
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        color="navy"
                        index={2}
                    />
                    <KpiCard
                        label="Nuevos este mes"
                        value={kpi.newThisMonth}
                        change={undefined}
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></svg>}
                        color="navy"
                        index={3}
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 pb-2 px-1">
                    <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] flex flex-col overflow-hidden p-6">
                        <MainChart rawApts={rawApts} />
                    </div>
                    <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] flex flex-col overflow-hidden p-6">
                        <AppointmentStatusChart data={donut.data} confRate={donut.confRate} />
                    </div>
                </div>
            </div>
        </div>
    );
}
