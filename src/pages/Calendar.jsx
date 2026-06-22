import { useState } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import CalendarWeek from '../components/Calendar/CalendarWeek';
import CalendarMonth from '../components/Calendar/CalendarMonth';
import CalendarDay from '../components/Calendar/CalendarDay';
import AppointmentDrawer from '../components/Calendar/AppointmentDrawer';
import NewAppointmentModal from '../components/Calendar/NewAppointmentModal';
import KanbanBoard from '../components/Calendar/KanbanBoard';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, Plus, LayoutDashboard, Lock } from 'lucide-react';
import FeatureLock from '../components/FeatureLock';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';

export default function Calendar() {
    const { canCreateAppointments } = usePermissions();
    const { hasFeature } = usePlanLimits();
    const kanbanUnlocked = hasFeature('kanban');
    const {
        appointments,
        loading,
        reloading,
        anchorDate,
        viewMode,
        setViewMode,
        weekStart,
        prevWeek,
        nextWeek,
        prevDay,
        nextDay,
        prevMonth,
        nextMonth,
        goToday,
        reload
    } = useAppointments();

    const [tab, setTab] = useState('calendar'); // 'calendar' | 'kanban'
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handlePrev = () => {
        if (viewMode === 'month') prevMonth();
        else if (viewMode === 'day') prevDay();
        else prevWeek();
    };

    const handleNext = () => {
        if (viewMode === 'month') nextMonth();
        else if (viewMode === 'day') nextDay();
        else nextWeek();
    };

    const navLabel = (() => {
        const dow    = anchorDate.getDay();
        const monday = new Date(anchorDate);
        monday.setDate(anchorDate.getDate() - dow + (dow === 0 ? -6 : 1));
        if (viewMode === 'day') {
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const fmt = d => d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }).replace('.', '');
            return `${fmt(monday)} – ${fmt(sunday)}`;
        }
        const ref   = viewMode === 'week' ? monday : anchorDate;
        const label = ref.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    })();

    return (
        <div className={`h-full flex flex-col px-2 relative transition-all duration-300`}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Turnos</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Gestión de citas de la clínica</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-start lg:justify-end overflow-x-auto lg:overflow-visible">
                    {/* 1. Tab Calendario / Kanban */}
                    <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10">
                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                        <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                        <button
                            onClick={() => setTab('calendar')}
                            className={`relative z-10 px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${tab === 'calendar' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}
                        >
                            <CalendarIcon size={12} />
                            Calendario
                        </button>
                        <button
                            onClick={() => setTab('kanban')}
                            className={`relative z-10 px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${tab === 'kanban' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}
                        >
                            <LayoutDashboard size={12} />
                            Kanban
                            {!kanbanUnlocked && <Lock size={10} className="text-navy-700/50" />}
                        </button>
                    </div>


                            {/* 2. Navegación de fecha */}
                            <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 h-10">
                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                <button onClick={handlePrev} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm border border-white/80 text-navy-900 hover:bg-white/80 shadow-md transition-all hover:scale-[1.05] active:scale-95">
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="relative z-10 h-8 flex items-center justify-center gap-1.5 px-3 min-w-[120px]">
                                    <CalendarIcon size={13} className="text-navy-900 shrink-0" />
                                    <span className="capitalize text-[11px] font-bold text-navy-900 tracking-tight whitespace-nowrap leading-none">{navLabel}</span>
                                </div>
                                <button onClick={handleNext} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 backdrop-blur-sm border border-white/80 text-navy-900 hover:bg-white/80 shadow-md transition-all hover:scale-[1.05] active:scale-95">
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            {/* 3. Switcher Día / Semana / Mes */}
                            <div className="relative overflow-hidden flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 text-[11px] font-bold text-navy-900 h-10">
                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                <button onClick={() => setViewMode('day')} className={`relative z-10 px-4 h-8 rounded-full transition-all ${viewMode === 'day' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}>Día</button>
                                <button onClick={() => setViewMode('week')} className={`relative z-10 px-4 h-8 rounded-full transition-all ${viewMode === 'week' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}>Semana</button>
                                <button onClick={() => setViewMode('month')} className={`relative z-10 px-4 h-8 rounded-full transition-all ${viewMode === 'month' ? 'bg-white/60 backdrop-blur-sm shadow-md border border-white/80 text-navy-900' : 'hover:bg-white/20 text-navy-900/60'}`}>Mes</button>
                            </div>

                            {/* 4. Agregar Turno */}
                            {canCreateAppointments && (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none"
                                >
                                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                    <Plus size={14} className="shrink-0 relative z-10" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[90px] transition-all duration-300 whitespace-nowrap relative z-10">Agregar Turno</span>
                                </button>
                            )}

                            {/* 5. Actualizar */}
                            <button onClick={reload} disabled={reloading} className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md active:scale-95 transition-all duration-300 overflow-hidden disabled:opacity-40 outline-none">
                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                <RefreshCw size={14} className={`shrink-0 relative z-10 ${reloading ? 'animate-spin' : ''}`} />
                                <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">Actualizar</span>
                            </button>

                </div>
            </div>

            <div className={`flex-1 relative min-h-0 overflow-hidden ${tab === 'kanban' ? '' : 'rounded-[24px] shadow-md'}`}>
                {tab === 'kanban' ? (
                    !kanbanUnlocked ? (
                        <FeatureLock
                            feature="kanban"
                            variant="blurred"
                            title="Tablero Kanban"
                            description="Visualizá y gestioná tus turnos por estados (Pendiente, Confirmado, Cancelado) arrastrando fichas de forma táctil. Disponible en Pro y Enterprise."
                            requiredPlan="Pro"
                        >
                            <KanbanBoard
                                appointments={[
                                    { id: 1, date_start: new Date().toISOString(), status: 'scheduled', confirmed: false, patients: { display_name: 'María García' }, services: { name: 'Corte Clásico' } },
                                    { id: 2, date_start: new Date().toISOString(), status: 'scheduled', confirmed: true, patients: { display_name: 'Juan Pérez' }, services: { name: 'Tinte Completo' } },
                                    { id: 3, date_start: new Date().toISOString(), status: 'cancelled', confirmed: false, patients: { display_name: 'Ana López' }, services: { name: 'Manicure' } },
                                ]}
                                viewMode="week"
                                anchorDate={anchorDate}
                                weekStart={weekStart}
                            />
                        </FeatureLock>
                    ) : (
                        <KanbanBoard
                            appointments={appointments}
                            onAppointmentClick={setSelectedAppointment}
                            reload={reload}
                            viewMode={viewMode}
                            anchorDate={anchorDate}
                            weekStart={weekStart}
                        />
                    )
                ) : viewMode === 'week' ? (
                    <CalendarWeek
                        appointments={appointments}
                        weekStart={weekStart}
                        loading={loading}
                        onEventClick={setSelectedAppointment}
                    />
                ) : viewMode === 'month' ? (
                    <CalendarMonth
                        appointments={appointments}
                        monthDate={anchorDate}
                        loading={loading}
                        onEventClick={setSelectedAppointment}
                    />
                ) : (
                    <CalendarDay
                        appointments={appointments}
                        selectedDate={anchorDate}
                        loading={loading}
                        onEventClick={setSelectedAppointment}
                    />
                )}
            </div>

            <NewAppointmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreated={() => {
                    reload();
                    setIsModalOpen(false);
                }}
            />

            {selectedAppointment && (
                <AppointmentDrawer
                    appointment={selectedAppointment}
                    variant={'calendar'}
                    onClose={() => setSelectedAppointment(null)}
                    onUpdated={() => {
                        reload();
                    }}
                />
            )}
        </div>
    );
}
