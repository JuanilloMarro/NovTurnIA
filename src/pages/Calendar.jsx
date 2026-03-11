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
    const { appointments, loading, weekStart, prevWeek, nextWeek, goToday } = useAppointments();

    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('week'); // 'day', 'week', 'month'
    const [selectedDate, setSelectedDate] = useState(new Date());

    const handleToday = () => {
        setSelectedDate(new Date());
        goToday();
    };

    const handlePrev = () => {
        if (viewMode === 'day') {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - 1);
            setSelectedDate(d);
            if (d < weekStart) prevWeek();
        } else {
            prevWeek();
        }
    };

    const handleNext = () => {
        if (viewMode === 'day') {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + 1);
            setSelectedDate(d);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            if (d >= weekEnd) nextWeek();
        } else {
            nextWeek();
        }
    };

    // Month navigation display
    const displayDate = viewMode === 'day' ? selectedDate : weekStart;
    const monthName = displayDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });

    return (
        <div className="h-full flex flex-col px-2">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Turnos</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Gestión de citas de la clínica</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-xs">
                        <button onClick={handlePrev} className="px-2 py-1.5 text-navy-900 hover:text-navy-800 transition-colors"><ChevronLeft size={14} /></button>
                        <div className="flex items-center gap-1.5 px-3 text-navy-900 font-bold border-x border-white/40">
                            <CalendarIcon size={14} className="text-navy-900" />
                            <span className="capitalize">{monthName}</span>
                        </div>
                        <button onClick={handleNext} className="px-2 py-1.5 text-navy-900 hover:text-navy-800 transition-colors"><ChevronRight size={14} /></button>
                    </div>

                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-xs font-bold text-navy-900">
                        <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-full transition-colors ${viewMode === 'day' ? 'bg-white' : 'hover:bg-white/40'}`}>Día</button>
                        <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 rounded-full transition-colors ${viewMode === 'week' ? 'bg-white' : 'hover:bg-white/40'}`}>Semana</button>
                        <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-full transition-colors ${viewMode === 'month' ? 'bg-white' : 'hover:bg-white/40'}`}>Mes</button>
                    </div>

                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-xs font-bold text-navy-900">
                        <button onClick={() => setIsModalOpen(true)} className="px-4 py-1.5 rounded-full bg-white hover:scale-[1.02] transition-transform flex items-center justify-center gap-1">
                            <span>+</span> Nuevo Turno
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
                        monthDate={weekStart}
                        loading={loading}
                        onEventClick={setSelectedAppointment}
                    />
                ) : (
                    <CalendarDay
                        appointments={appointments}
                        selectedDate={selectedDate}
                        loading={loading}
                        onEventClick={setSelectedAppointment}
                    />
                )}
            </div>

            <NewAppointmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreated={() => setIsModalOpen(false)}
            />

            {selectedAppointment && (
                <AppointmentDrawer
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    onUpdated={() => { }}
                />
            )}
        </div>
    );
}
