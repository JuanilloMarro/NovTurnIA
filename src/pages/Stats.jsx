import { useStats } from '../hooks/useStats';
import KpiCard from '../components/Stats/KpiCard';
import { AppointmentStatusChart } from '../components/Stats/AppointmentStatusChart';
import { MainChart } from '../components/Stats/MainChart';

export default function Stats() {
    const { stats, loading } = useStats();

    if (loading || !stats) {
        return (
            <div className="h-full flex flex-col pt-2 max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Estadísticas</h1>
                        <p className="text-sm text-gray-500 mt-1">Rendimiento y métricas de la clínica</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {Array(3).fill(0).map((_, i) => <div key={i} className="animate-shimmer h-32 rounded-[20px]" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="animate-shimmer h-[400px] rounded-[20px]" />
                    </div>
                    <div className="lg:col-span-1">
                        <div className="animate-shimmer h-[400px] rounded-[20px]" />
                    </div>
                </div>
            </div>
        );
    }

    const { kpi, donut, rawApts } = stats;

    return (
        <div className="h-full flex flex-col pt-2 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Estadísticas</h1>
                    <p className="text-sm text-gray-500 mt-1">Rendimiento y métricas de la clínica</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <KpiCard
                    label="Pacientes Totales"
                    value={kpi.totalPatients}
                    change={kpi.patientsChange}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                    color="navy"
                    index={0}
                />
                <KpiCard
                    label="Turnos este mes"
                    value={kpi.monthApts}
                    change={kpi.aptsChange}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg>}
                    color="emerald"
                    index={1}
                />
                <KpiCard
                    label="Confirmados este mes"
                    value={kpi.confThisMonth}
                    change={kpi.confChange}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>}
                    color="amber"
                    index={2}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px] mb-6">
                <div className="lg:col-span-2 h-full">
                    <MainChart rawApts={rawApts} />
                </div>
                <div className="lg:col-span-1 h-full">
                    <AppointmentStatusChart data={donut.data} confRate={donut.confRate} />
                </div>
            </div>
        </div>
    );
}
