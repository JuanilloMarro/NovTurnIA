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

    const monthName = anchorDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });

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
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-[11px] font-bold text-navy-900 shadow-sm h-10">
                        <button
                            onClick={() => setTab('calendar')}
                            className={`px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${tab === 'calendar' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}
                        >
                            <CalendarIcon size={12} />
                            Calendario
                        </button>
                        <button
                            onClick={() => setTab('kanban')}
                            className={`px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${tab === 'kanban' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}
                        >
                            <LayoutDashboard size={12} />
                            Kanban
                            {!kanbanUnlocked && <Lock size={10} className="text-navy-700/50" />}
                        </button>
                    </div>


                            {/* 2. Navegación de fecha */}
                            <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-sm h-10">
                                <button onClick={handlePrev} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-white/80 text-navy-900 hover:bg-white/80 shadow-sm transition-all hover:scale-[1.05] active:scale-95">
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="flex items-center gap-2 px-3 text-navy-900 font-bold">
                                    <CalendarIcon size={14} className="text-navy-900" />
                                    <span className="capitalize text-[11px] font-bold tracking-tight whitespace-nowrap">{monthName}</span>
                                </div>
                                <button onClick={handleNext} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-white/80 text-navy-900 hover:bg-white/80 shadow-sm transition-all hover:scale-[1.05] active:scale-95">
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            {/* 3. Switcher Día / Semana / Mes */}
                            <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-[11px] font-bold text-navy-900 shadow-sm h-10">
                                <button onClick={() => setViewMode('day')} className={`px-4 h-8 rounded-full transition-all ${viewMode === 'day' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}>Día</button>
                                <button onClick={() => setViewMode('week')} className={`px-4 h-8 rounded-full transition-all ${viewMode === 'week' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}>Semana</button>
                                <button onClick={() => setViewMode('month')} className={`px-4 h-8 rounded-full transition-all ${viewMode === 'month' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}>Mes</button>
                            </div>

                            {/* 4. Agregar Turno */}
                            {canCreateAppointments && (
                                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-sm h-10">
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden"
                                    >
                                        <Plus size={14} className="shrink-0" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[90px] transition-all duration-300 whitespace-nowrap">Agregar Turno</span>
                                    </button>
                                </div>
                            )}

                            {/* 5. Actualizar */}
                            <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-sm h-10">
                                <button onClick={reload} disabled={reloading} className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 active:scale-95 transition-all duration-300 overflow-hidden disabled:opacity-40">
                                    <RefreshCw size={14} className={`shrink-0 ${reloading ? 'animate-spin' : ''}`} />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">Actualizar</span>
                                </button>
                            </div>

                </div>
            </div>

            <div className="flex-1 relative min-h-0 overflow-hidden rounded-[24px]">
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
