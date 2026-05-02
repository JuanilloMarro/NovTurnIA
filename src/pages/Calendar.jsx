import { useState } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import CalendarWeek from '../components/Calendar/CalendarWeek';
import CalendarMonth from '../components/Calendar/CalendarMonth';
import CalendarDay from '../components/Calendar/CalendarDay';
import AppointmentDrawer from '../components/Calendar/AppointmentDrawer';
import NewAppointmentModal from '../components/Calendar/NewAppointmentModal';
import FollowUpList from '../components/Calendar/FollowUpList';
import Button from '../components/ui/Button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, UserX, Plus, SlidersHorizontal } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { Lock } from 'lucide-react';

const TYPE_OPTIONS = [
    { value: 'all',       label: 'Todos' },
    { value: 'no_show',   label: 'No se presentó' },
    { value: 'cancelled', label: 'Cancelados' },
];

const DAYS_OPTIONS = [
    { value: 7,  label: '7 días' },
    { value: 30, label: '30 días' },
    { value: 60, label: '60 días' },
    { value: 90, label: '90 días' },
];

export default function Calendar() {
    const { canCreateAppointments, canViewFollowUp } = usePermissions();
    const { hasFeature } = usePlanLimits();
    const followUpUnlocked = hasFeature('followup');
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

    const [tab, setTab] = useState('calendar'); // 'calendar' | 'followup'
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filtros de Seguimiento
    const [followUpType, setFollowUpType] = useState('all');
    const [followUpDays, setFollowUpDays] = useState(30);
    const [showFollowUpFilters, setShowFollowUpFilters] = useState(false);
    const [followUpReloadKey, setFollowUpReloadKey] = useState(0);
    const [followUpLoading, setFollowUpLoading] = useState(false);

    const hasActiveFilters = followUpType !== 'all' || followUpDays !== 30;

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
        <div className={`h-full flex flex-col px-2 relative transition-all duration-300 ${tab === 'followup' && selectedAppointment ? 'sm:pr-[380px]' : ''}`}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Turnos</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Gestión de citas de la clínica</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-start lg:justify-end overflow-x-auto lg:overflow-visible">
                    {/* 1. Tab Calendario / Seguimiento */}
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-[11px] font-bold text-navy-900 shadow-sm h-10">
                        <button
                            onClick={() => setTab('calendar')}
                            className={`px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${tab === 'calendar' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}
                        >
                            <CalendarIcon size={12} />
                            Calendario
                        </button>
                        {canViewFollowUp && (
                            <button
                                onClick={() => followUpUnlocked && setTab('followup')}
                                disabled={!followUpUnlocked}
                                title={followUpUnlocked ? '' : 'Función disponible en Pro — sube de plan para activar Seguimiento'}
                                className={`px-4 h-8 rounded-full transition-all flex items-center gap-1.5 ${tab === 'followup' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'} ${!followUpUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {followUpUnlocked ? <UserX size={12} /> : <Lock size={11} className="text-navy-900" />}
                                Seguimiento
                            </button>
                        )}
                    </div>

                    {tab === 'calendar' && (
                        <>
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
                        </>
                    )}

                    {/* Actualizar + Filtros — solo en Seguimiento */}
                    {tab === 'followup' && (
                        <>
                        <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-sm h-10">
                            <button
                                onClick={() => setFollowUpReloadKey(k => k + 1)}
                                disabled={followUpLoading}
                                className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 active:scale-95 transition-all duration-300 overflow-hidden disabled:opacity-40"
                            >
                                <RefreshCw size={14} className={`shrink-0 ${followUpLoading ? 'animate-spin' : ''}`} />
                                <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">Actualizar</span>
                            </button>
                        </div>
                        <div className="relative">
                            <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-10 shadow-sm">
                                <button
                                    onClick={() => setShowFollowUpFilters(v => !v)}
                                    className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden outline-none"
                                >
                                    <SlidersHorizontal size={14} className="shrink-0" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Filtros</span>
                                </button>
                            </div>

                            {showFollowUpFilters && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-3xl shadow-[0_8px_32px_rgba(26,58,107,0.16),0_2px_8px_rgba(0,0,0,0.06)] z-50 p-2 animate-fade-up">
                                    {hasActiveFilters && (
                                        <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-gray-100">
                                            <span className="text-[10px] font-bold text-navy-700/50 tracking-wide">Filtros</span>
                                            <button onClick={() => { setFollowUpType('all'); setFollowUpDays(30); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-600">Limpiar</button>
                                        </div>
                                    )}
                                    <p className="px-2 pt-2 pb-1 text-[10px] font-bold text-navy-700/40 tracking-wide">Estado</p>
                                    {TYPE_OPTIONS.map(opt => (
                                        <div
                                            key={opt.value}
                                            onClick={() => setFollowUpType(opt.value)}
                                            className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${followUpType === opt.value ? 'bg-white border-white shadow-[0_4px_14px_rgba(0,0,0,0.09)] text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-gray-50'}`}
                                        >
                                            {opt.label}
                                        </div>
                                    ))}
                                    <div className="border-t border-gray-100 mt-1 pt-1">
                                        <p className="px-2 pt-1 pb-1 text-[10px] font-bold text-navy-700/40 tracking-wide">Período</p>
                                        {DAYS_OPTIONS.map(opt => (
                                            <div
                                                key={opt.value}
                                                onClick={() => setFollowUpDays(opt.value)}
                                                className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${followUpDays === opt.value ? 'bg-white border-white shadow-[0_4px_14px_rgba(0,0,0,0.09)] text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-gray-50'}`}
                                            >
                                                {opt.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 relative min-h-0 overflow-hidden rounded-[24px]">
                {tab === 'followup' ? (
                    <FollowUpList
                        type={followUpType}
                        days={followUpDays}
                        reloadKey={followUpReloadKey}
                        onAppointmentSelected={setSelectedAppointment}
                        onLoadingChange={setFollowUpLoading}
                    />
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
                    variant={tab === 'followup' ? 'followup' : 'calendar'}
                    onClose={() => setSelectedAppointment(null)}
                    onUpdated={() => {
                        reload();
                        setFollowUpReloadKey(k => k + 1);
                    }}
                />
            )}
        </div>
    );
}
