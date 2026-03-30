import { useState } from 'react';
import { createPortal } from 'react-dom';
import { updateAppointment } from '../../services/supabaseService';
import { X, Calendar, ChevronDown, Save } from 'lucide-react';
import { formatPhone } from '../../utils/format';
import { showWarningToast, showErrorToast } from '../../store/useToastStore';

const TIME_SLOTS = [];
for (let h = 9; h <= 17; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
TIME_SLOTS.push('18:00');

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function EditAppointmentModal({ appointment, onClose, onUpdated }) {
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
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        
        setError(''); setLoading(true);
        try {
            await updateAppointment(appointment.id, { date, startTime, endTime });
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
            <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full max-w-md overflow-hidden animate-fade-up">

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
                        {/* Paciente Lectura Solamente */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-widest leading-none mb-3">Paciente</label>
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

                        {/* Fecha */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-widest leading-none mb-3">Fecha</label>
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
                            <div className="flex-1">
                                <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-widest leading-none mb-3">Inicio</label>
                                <div className="relative">
                                    <select value={startTime} onChange={e => { 
                                        const newStart = e.target.value;
                                        setStartTime(newStart);
                                        // Auto-set end time to 1 hour after start
                                        const [sh, sm] = newStart.split(':').map(Number);
                                        const endMinutes = sh * 60 + sm + 60; // +1 hour default
                                        const eh = Math.floor(endMinutes / 60);
                                        const em = endMinutes % 60;
                                        const autoEnd = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
                                        setEndTime(autoEnd);
                                    }}
                                        className="w-full bg-white/40 border border-white/60 rounded-full pl-4 pr-10 py-2 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all appearance-none shadow-sm">
                                        {TIME_SLOTS.filter(t => t !== '18:00').map(t => <option key={t}>{t}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-800">
                                        <ChevronDown size={16} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-widest leading-none mb-3">Fin</label>
                                <div className="relative">
                                    <select value={endTime} onChange={e => setEndTime(e.target.value)}
                                        className="w-full bg-white/40 border border-white/60 rounded-full pl-4 pr-10 py-2 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all appearance-none shadow-sm">
                                        {TIME_SLOTS.filter(t => t > startTime).map(t => <option key={t}>{t}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-800">
                                        <ChevronDown size={16} />
                                    </div>
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
