import { useState } from 'react';
import { useAppointments } from '../hooks/useAppointments';
import CalendarWeek from '../components/Calendar/CalendarWeek';
import CalendarMonth from '../components/Calendar/CalendarMonth';
import CalendarDay from '../components/Calendar/CalendarDay';
import AppointmentDrawer from '../components/Calendar/AppointmentDrawer';
import NewAppointmentModal from '../components/Calendar/NewAppointmentModal';
import Button from '../components/ui/Button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Calendar() {
    const { 
        appointments, 
        loading, 
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

    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleToday = () => {
        goToday();
    };

    const handlePrev = () => {
        if (viewMode === 'month') {
            prevMonth();
        } else if (viewMode === 'day') {
            prevDay();
        } else {
            prevWeek();
        }
    };

    const handleNext = () => {
        if (viewMode === 'month') {
            nextMonth();
        } else if (viewMode === 'day') {
            nextDay();
        } else {
            nextWeek();
        }
    };

    // Month navigation display
    const monthName = anchorDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });

    return (
        <div className="h-full flex flex-col px-2 relative">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Turnos</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Gestión de citas de la clínica</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
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

                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-[11px] font-bold text-navy-900 shadow-sm h-10">
                    <button onClick={() => setViewMode('day')} className={`px-4 h-8 rounded-full transition-all ${viewMode === 'day' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}>Día</button>
                    <button onClick={() => setViewMode('week')} className={`px-4 h-8 rounded-full transition-all ${viewMode === 'week' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}>Semana</button>
                    <button onClick={() => setViewMode('month')} className={`px-4 h-8 rounded-full transition-all ${viewMode === 'month' ? 'bg-white shadow-sm border border-white/80' : 'hover:bg-white/40'}`}>Mes</button>
                </div>

                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-[11px] font-bold text-navy-900 shadow-sm h-10">
                    <button onClick={() => setIsModalOpen(true)} className="px-5 h-8 rounded-full bg-white border border-white/80 hover:bg-white/80 shadow-sm hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5 font-bold">
                        <span className="text-[14px]">+</span> Agregar Turno
                    </button>
                </div>
                </div>
            </div>

            <div className="flex-1 relative min-h-0 overflow-hidden rounded-[24px]">
                {viewMode === 'week' ? (
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
                    onClose={() => setSelectedAppointment(null)}
                    onUpdated={() => reload()}
                />
            )}
        </div>
    );
}
