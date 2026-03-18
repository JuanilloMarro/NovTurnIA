import { useState } from 'react';
import { createAppointment, getPatients } from '../../services/supabaseService';
import { X, Search, Calendar, ChevronDown, Save } from 'lucide-react';
import { formatPhone } from '../../utils/format';
import { showSuccessToast, showErrorToast, useToastStore } from '../../store/useToastStore';

const TIME_SLOTS = [];
for (let h = 9; h <= 17; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
TIME_SLOTS.push('18:00'); // Allow ending at 18:00

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function NewAppointmentModal({ isOpen, onClose, onCreated }) {
    const [patientObj, setPatientObj] = useState(null);
    const [patientQ, setPatientQ] = useState('');
    const [patients, setPatients] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    async function searchPatients(q) {
        setPatientQ(q);
        if (q.length < 2) return setPatients([]);
        const data = await getPatients(q);
        setPatients(data);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!patientObj) return setError('Por favor, selecciona un paciente.');
        
        // Validación de fecha mínima (hoy)
        const selectedDate = new Date(date + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return setError('No se pueden agendar turnos en fechas pasadas. Por favor, ingresa una fecha válida.');
        }

        setError(''); setLoading(true);
        try {
            await createAppointment({ userId: patientObj.id, date, startTime, endTime });
            showSuccessToast(
                'Turno Creado Exitosamente',
                `${patientObj.display_name || 'Paciente'} : ${startTime} a ${endTime}`
            );
            useToastStore.getState().addActivity({
                type: 'appointment',
                title: 'Nuevo Turno Agendado',
                message: `${patientObj.display_name || 'Paciente'} : ${date} · ${startTime} a ${endTime}`,
            });
            onCreated();
            onClose();
        } catch (err) {
            console.error('Error creating appointment:', err);
            const errorMsg = err.message || 'Error al conectar con el servidor de citas.';
            setError(errorMsg);
            showErrorToast('Error al Crear Turno', errorMsg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full max-w-md overflow-hidden animate-fade-up">

                <div className="flex items-center justify-between px-5 py-4 border-b border-white/40 bg-white/20">
                    <h2 className="text-lg font-bold text-navy-900 tracking-tight">Nuevo Turno</h2>
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
                    <div className="p-5 space-y-5">
                        {/* Paciente */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-widest leading-none mb-3">Paciente</label>

                            {!patientObj ? (
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-800">
                                        <Search size={16} />
                                    </div>
                                    <input
                                        className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900"
                                        value={patientQ}
                                        onChange={e => searchPatients(e.target.value)}
                                        placeholder="Buscar por nombre o teléfono..."
                                    />
                                    {patients.length > 0 && (
                                        <div className="absolute z-10 mt-1.5 w-full bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-card overflow-hidden">
                                            {patients.map(p => (
                                                <button key={p.id} type="button"
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/50 transition-colors border-b border-white/40 last:border-0"
                                                    onClick={() => { setPatientObj(p); setPatientQ(''); setPatients([]); }}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-white text-xs font-bold border border-white/30 shadow-sm">
                                                        {getInitials(p.display_name)}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-bold text-navy-900 text-sm leading-tight">{p.display_name || '—'}</div>
                                                        <div className="text-xs text-navy-700/70 font-medium">{formatPhone(p.id)}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between bg-white/50 border border-white/60 py-1.5 px-2.5 rounded-full shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center text-white text-sm font-bold shadow-md border border-white/20">
                                            {getInitials(patientObj.display_name)}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-navy-900 text-sm leading-none">{patientObj.display_name || 'Sin nombre'}</span>
                                            <span className="text-xs font-medium text-navy-700/70 leading-none">{formatPhone(patientObj.id)}</span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setPatientObj(null)} className="text-navy-700 hover:text-navy-900 hover:bg-white/40 rounded-full p-1 transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
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

                    <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-white/40 bg-white/20 backdrop-blur-md">
                        <button type="button" onClick={onClose}
                            className="flex items-center gap-2 px-5 py-2 bg-white/40 border border-white/50 text-navy-800 text-xs font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm">
                            <X size={14} /> Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-white/80 rounded-full text-navy-900 text-xs font-bold shadow-sm hover:bg-white/80 transition-all disabled:opacity-50">
                            <Save size={14} />
                            {loading ? 'Guardando...' : 'Guardar turno'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
