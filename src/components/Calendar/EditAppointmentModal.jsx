import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import WheelColumn from '../ui/WheelColumn';
import { createPortal } from 'react-dom';
import { updateAppointment, getServices } from '../../services/supabaseService';
import { X, Save } from 'lucide-react';
import { formatDuration } from '../../pages/Settings';
import { formatPhone } from '../../utils/format';
import { showAptEditToast, showErrorToast } from '../../store/useToastStore';
import { useAppStore, generateTimeSlots } from '../../store/useAppStore';
import { useModalFocus } from '../../hooks/useModalFocus';

// T-38: TIME_SLOTS generado desde el horario real del negocio (no hardcodeado).

// ── Wheel picker ─────────────────────────────────────────────────────────────
const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAYS       = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS_NUM = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const _cy        = new Date().getFullYear();
const YEARS      = Array.from({ length: 5  }, (_, i) => String(_cy + i));
const WH         = 26; // px por ítem



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

    // Use the appointment's own date as the initial value for the date picker
    const _aptDate = appointment.date_start ? new Date(appointment.date_start) : new Date();
    const _rawYear  = _aptDate.getFullYear().toString();
    const _rawMonth = (_aptDate.getMonth() + 1).toString().padStart(2, '0');
    const _rawDay   = _aptDate.getDate().toString().padStart(2, '0');
    const rawDate   = `${_rawYear}-${_rawMonth}-${_rawDay}`;

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
    const [dayVal,   setDayVal]   = useState(_rawDay   || '');
    const [monthVal, setMonthVal] = useState(_rawMonth || '');
    const [yearVal,  setYearVal]  = useState(_rawYear  || '');
    const [startTime, setStartTime] = useState(rawStartTime);
    const [endTime, setEndTime] = useState(rawEndTime);
    const [serviceId, setServiceId] = useState(appointment.service_id ?? null);
    const [services, setServices] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const modalRef = useRef(null);
    useModalFocus(modalRef, true, onClose);

    const daysInMonth = (monthVal && yearVal?.length === 4)
        ? new Date(Number(yearVal), Number(monthVal), 0).getDate()
        : 31;
    const DAYS_FOR_MONTH = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));

    function syncDate(d, m, y) {
        if (!d || !m || y?.length !== 4) return;
        const maxDay = new Date(Number(y), Number(m), 0).getDate();
        const clampedDay = String(Math.min(Number(d), maxDay)).padStart(2, '0');
        if (clampedDay !== d) setDayVal(clampedDay);
        setDate(`${y}-${m}-${clampedDay}`);
    }

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

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await updateAppointment(appointment.id, { date, startTime, endTime, serviceId: serviceId || null });
            showAptEditToast(`${appointment.patients?.display_name || 'Cliente'} : ${startTime} a ${endTime}`);
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
                            <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">Cliente</label>
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
                            <div className="bg-white/30 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                                <WheelColumn
                                    key={services.length}
                                    items={['', ...services.map(s => String(s.id))]}
                                    selected={serviceId ? String(serviceId) : ''}
                                    displayFn={id => {
                                        if (!id) return 'Sin servicio';
                                        const svc = services.find(s => String(s.id) === id);
                                        if (!svc) return '';
                                        return svc.name + (svc.duration_minutes ? ` · ${formatDuration(svc.duration_minutes)}` : '');
                                    }}
                                    onSelect={id => {
                                        if (!id) {
                                            setServiceId(null);
                                            setEndTime(calcEnd(startTime, 60));
                                        } else {
                                            const svc = services.find(s => String(s.id) === id);
                                            setServiceId(Number(id));
                                            if (svc?.duration_minutes) setEndTime(calcEnd(startTime, svc.duration_minutes));
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Fecha — wheel picker */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">Fecha</label>
                            <div className="flex bg-white/40 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                                <WheelColumn
                                    key={`day-edit-${daysInMonth}`}
                                    items={DAYS_FOR_MONTH}
                                    selected={dayVal}
                                    onSelect={d => { setDayVal(d); syncDate(d, monthVal, yearVal); }}
                                />
                                <div className="w-px bg-white/50" />
                                <WheelColumn
                                    key="month-edit"
                                    items={MONTHS_NUM}
                                    selected={monthVal}
                                    displayFn={m => MONTHS_ES[parseInt(m) - 1]}
                                    onSelect={m => { setMonthVal(m); syncDate(dayVal, m, yearVal); }}
                                />
                                <div className="w-px bg-white/50" />
                                <WheelColumn
                                    key="year-edit"
                                    items={YEARS}
                                    selected={yearVal}
                                    onSelect={y => { setYearVal(y); syncDate(dayVal, monthVal, y); }}
                                />
                            </div>
                        </div>

                        {/* Horario */}
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">Inicio</label>
                                <div className="flex bg-white/40 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                                    <WheelColumn
                                        items={TIME_SLOTS.filter(t => t !== schedule_end)}
                                        selected={startTime}
                                        onSelect={newStart => {
                                            setStartTime(newStart);
                                            const duration = selectedService?.duration_minutes || 60;
                                            setEndTime(calcEnd(newStart, duration));
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-3">
                                    Fin
                                    {hasServiceDuration && (
                                        <span className="normal-case tracking-normal font-semibold text-navy-700/40 ml-1">(auto)</span>
                                    )}
                                </label>
                                <div className="flex bg-white/40 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                                    <WheelColumn
                                        items={TIME_SLOTS.filter(t => t > startTime)}
                                        selected={endTime}
                                        onSelect={setEndTime}
                                        disabled={hasServiceDuration}
                                    />
                                </div>
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
