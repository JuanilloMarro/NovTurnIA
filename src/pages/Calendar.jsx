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
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Turnos</h1>
                    <p className="text-sm text-gray-500 mt-1">Gestión de citas de la clínica</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-navy-700 hover:bg-navy-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-btn hover:shadow-btn-hover transition-all duration-200">
                    + Nuevo Turno
                </button>
            </div>


            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 bg-white/90 backdrop-blur-card border border-white/90 rounded-full px-5 py-2 shadow-card">
                    <div className="flex items-center gap-2 text-navy-900 font-semibold text-sm">
                        <CalendarIcon size={16} className="text-navy-500" />
                        <span className="capitalize">{monthName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={handlePrev} className="w-7 h-7 flex flex-col items-center justify-center rounded-full border border-gray-100/50 hover:bg-gray-100 text-gray-400 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={handleNext} className="w-7 h-7 flex flex-col items-center justify-center rounded-full border border-gray-100/50 hover:bg-gray-100 text-gray-400 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-card text-sm">
                    <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-full transition-colors ${viewMode === 'day' ? 'bg-white text-navy-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-navy-700'}`}>Día</button>
                    <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 rounded-full transition-colors ${viewMode === 'week' ? 'bg-white text-navy-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-navy-700'}`}>Semana</button>
                    <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-full transition-colors ${viewMode === 'month' ? 'bg-white text-navy-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-navy-700'}`}>Mes</button>
                </div>
            </div>

            <div className="flex-1 relative">
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
