import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { updateAppointment, getServices } from '../../services/supabaseService';
import { X, Calendar, ChevronDown, Save } from 'lucide-react';
import { formatDuration } from '../../pages/Settings';
import { formatPhone } from '../../utils/format';
import { showWarningToast, showErrorToast } from '../../store/useToastStore';
import { useAppStore, generateTimeSlots } from '../../store/useAppStore';
import { useModalFocus } from '../../hooks/useModalFocus';

// T-38: TIME_SLOTS generado desde el horario real del negocio (no hardcodeado).

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function EditAppointmentModal({ appointment, onClose, onUpdated }) {
    // T-38: leer horario del negocio con fallback explícito (null-safe)
    const businessHoursRaw = useAppStore((state) => state.businessHours);
    const businessHours = businessHoursRaw ?? { schedule_start: '09:00', schedule_end: '18:00' };
    const schedule_start = businessHours.schedule_start || '09:00';
    const schedule_end   = businessHours.schedule_end   || '18:00';
    const TIME_SLOTS = generateTimeSlots(schedule_start, schedule_end, 30);

    const rawDate = appointment.date_start ? new Date(appointment.date_start).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    let rawStartTime = '09:00';
    let rawEndTime = '10:00';
    try {
        if (appointment.date_start) {
            rawStartTime = new Date(appointment.date_start).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        if (appointment.date_end) {
            rawEndTime = new Date(appointment.date_end).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
    } catch(e) {}

    const [date, setDate] = useState(rawDate);
    const [startTime, setStartTime] = useState(rawStartTime);
    const [endTime, setEndTime] = useState(rawEndTime);
    const [serviceId, setServiceId] = useState(appointment.service_id ?? null);
    const [services, setServices] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const modalRef = useRef(null);
    useModalFocus(modalRef, true, onClose);

    // Load active services on mount
    useEffect(() => {
        getServices()
            .then(data => setServices(data.filter(s => s.active)))
            .catch(() => setServices([]));
    }, []);

    // Derived: currently selected service object
    const selectedService = serviceId ? services.find(s => s.id === serviceId) ?? null : null;
    const hasServiceDuration = (selectedService?.duration_minutes ?? 0) > 0;

    function calcEnd(start, duration) {
        const [sh, sm] = start.split(':').map(Number);
        const endMin = sh * 60 + sm + duration;
        const eh = Math.floor(endMin / 60) % 24;
        const em = endMin % 60;
        return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    }

    function handleServiceChange(e) {
        const val = e.target.value;
        if (!val) {
            setServiceId(null);
            setEndTime(calcEnd(startTime, 60));
            return;
        }
        const svc = services.find(s => String(s.id) === val);
        setServiceId(Number(val));
        if (svc?.duration_minutes) {
            setEndTime(calcEnd(startTime, svc.duration_minutes));
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await updateAppointment(appointment.id, { date, startTime, endTime, serviceId: serviceId || null });
            showWarningToast(
                'Turno Actualizado',
                `${appointment.patients?.display_name || 'Paciente'} : ${startTime} a ${endTime}`,
                'appointment'
            );
            onUpdated();
            onClose();
        } catch (err) {
            console.error('Error updating appointment:', err);
            const errorMsg = err.message || 'Error al conectar con el servidor de citas.';
            setError(errorMsg);
            showErrorToast('Error al Actualizar Turno', errorMsg);
        } finally {
            setLoading(false);
        }
    }

    const { patients } = appointment;
    const phone = patients?.patient_phones?.[0]?.phone || '';

    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div ref={modalRef} className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full max-w-md overflow-hidden animate-fade-up">

                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <h2 className="text-lg font-bold text-navy-900 tracking-tight">Editar Turno</h2>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="px-6 py-4 space-y-5">
                        {/* Paciente — solo lectura */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">Paciente</label>
                            <div className="flex items-center justify-between bg-white/50 border border-white/60 py-1.5 px-2.5 rounded-full shadow-sm">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center text-white text-sm font-bold shadow-md border border-white/20">
                                        {getInitials(patients?.display_name)}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-navy-900 text-sm leading-none">{patients?.display_name || 'Sin nombre'}</span>
                                        <span className="text-xs font-medium text-navy-700/70 leading-none">{formatPhone(phone)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Servicio */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">Servicio</label>
                            <div className="relative">
                                <select
                                    value={serviceId ?? ''}
                                    onChange={handleServiceChange}
                                    className="w-full bg-white/40 border border-white/60 rounded-full px-4 pr-10 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all appearance-none shadow-sm"
                                >
                                    <option value="">Sin servicio</option>
                                    {services.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}{s.duration_minutes ? ` · ${formatDuration(s.duration_minutes)}` : ''}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-800">
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Fecha */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">Fecha</label>
                            <div className="relative">
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                                    className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm [&::-webkit-calendar-picker-indicator]:opacity-0"
                                />
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-800">
                                    <Calendar size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Horario */}
                        <div className="flex gap-4">
                            {/* Inicio — siempre editable */}
                            <div className="flex-1">
                                <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">Inicio</label>
                                <div className="relative">
                                    <select
                                        value={startTime}
                                        onChange={e => {
                                            const newStart = e.target.value;
                                            setStartTime(newStart);
                                            const duration = selectedService?.duration_minutes || 60;
                                            setEndTime(calcEnd(newStart, duration));
                                        }}
                                        className="w-full bg-white/40 border border-white/60 rounded-full pl-4 pr-10 py-2 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all appearance-none shadow-sm"
                                    >
                                        {TIME_SLOTS.filter(t => t !== schedule_end).map(t => <option key={t}>{t}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-800">
                                        <ChevronDown size={16} />
                                    </div>
                                </div>
                            </div>

                            {/* Fin — read-only si servicio con duración, editable si no */}
                            <div className="flex-1">
                                <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">
                                    Fin
                                    {hasServiceDuration && (
                                        <span className="normal-case tracking-normal font-semibold text-navy-700/40 ml-1">(auto)</span>
                                    )}
                                </label>
                                {hasServiceDuration ? (
                                    <div className="w-full bg-white/20 border border-white/30 rounded-full px-4 py-2 text-sm font-semibold text-navy-900/50 shadow-sm select-none">
                                        {endTime}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select value={endTime} onChange={e => setEndTime(e.target.value)}
                                            className="w-full bg-white/40 border border-white/60 rounded-full pl-4 pr-10 py-2 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all appearance-none shadow-sm">
                                            {TIME_SLOTS.filter(t => t > startTime).map(t => <option key={t}>{t}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-800">
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 px-6 pb-6 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/40 border border-white/60 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm min-w-[100px]">
                            <X size={13} /> Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/40 border border-white/60 rounded-full text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/60 transition-all disabled:opacity-50 min-w-[100px]">
                            <Save size={13} />
                            {loading ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
