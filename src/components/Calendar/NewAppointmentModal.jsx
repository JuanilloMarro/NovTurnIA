import { useState } from 'react';
import { createAppointment, getPatients } from '../../services/supabaseService';
import { X, Search, Calendar, ChevronDown, Save } from 'lucide-react';

const TIME_SLOTS = Array.from({ length: 9 }, (_, i) => {
    const h = i + 9;
    return `${String(h).padStart(2, '0')}:00`;
}); // ['09:00', '10:00', ... '17:00']

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function NewAppointmentModal({ isOpen, onClose, onCreated }) {
    const [patientObj, setPatientObj] = useState(null);
    const [patientQ, setPatientQ] = useState('');
    const [patients, setPatients] = useState([]);
    const [date, setDate] = useState('');
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
        if (!patientObj) return setError('Selecciona un paciente');
        setError(''); setLoading(true);
        try {
            await createAppointment({ userId: patientObj.id, date, startTime, endTime });
            onCreated();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-modal w-full max-w-lg overflow-hidden animate-fade-up">

                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-navy-900 tracking-tight">Nuevo Turno</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-navy-50 text-navy-700 hover:bg-navy-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-5">
                        {/* Paciente */}
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-2">Paciente</label>

                            {!patientObj ? (
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <Search size={18} />
                                    </div>
                                    <input
                                        className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition-all placeholder-gray-400"
                                        value={patientQ}
                                        onChange={e => searchPatients(e.target.value)}
                                        placeholder="Buscar paciente por nombre o teléfono..."
                                    />
                                    {patients.length > 0 && (
                                        <div className="absolute z-10 mt-1.5 w-full bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
                                            {patients.map(p => (
                                                <button key={p.id} type="button"
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-navy-50 transition-colors border-b border-gray-50 last:border-0"
                                                    onClick={() => { setPatientObj(p); setPatientQ(''); setPatients([]); }}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
                                                        {getInitials(p.display_name)}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-medium text-navy-900 text-sm">{p.display_name || '—'}</div>
                                                        <div className="text-xs text-gray-500">+{p.id}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between bg-white border border-gray-100 py-2 px-3 rounded-full shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-white text-xs font-bold">
                                            {getInitials(patientObj.display_name)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-navy-900 text-sm">{patientObj.display_name || 'Sin nombre'}</span>
                                            <span className="text-sm text-gray-500">+{patientObj.id}</span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setPatientObj(null)} className="text-gray-400 hover:text-gray-600 p-1">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Fecha */}
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-2">Fecha</label>
                            <div className="relative">
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                                    className="w-full bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition-all [&::-webkit-calendar-picker-indicator]:opacity-0"
                                />
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-900">
                                    <Calendar size={18} />
                                </div>
                            </div>
                        </div>

                        {/* Horario */}
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-500 mb-2">Hora inicio</label>
                                <div className="relative">
                                    <select value={startTime} onChange={e => { setStartTime(e.target.value); setEndTime(`${String(parseInt(e.target.value) + 1).padStart(2, '0')}:00`); }}
                                        className="w-full bg-white border border-gray-200 rounded-full pl-4 pr-10 py-2.5 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition-all appearance-none">
                                        {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-900">
                                        <ChevronDown size={18} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-500 mb-2">Hora fin</label>
                                <div className="relative">
                                    <select value={endTime} onChange={e => setEndTime(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-full pl-4 pr-10 py-2.5 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition-all appearance-none">
                                        {TIME_SLOTS.slice(1).concat(['18:00']).map(t => <option key={t}>{t}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-900">
                                        <ChevronDown size={18} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 px-6 py-5 border-t border-gray-100 bg-gray-50/50">
                        <button type="button" onClick={onClose}
                            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-full hover:bg-gray-50 transition-colors shadow-sm">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex items-center gap-2 px-6 py-2.5 bg-navy-900 hover:bg-navy-700 text-white text-sm font-semibold rounded-full shadow-btn transition-colors disabled:opacity-60">
                            <Save size={16} />
                            {loading ? 'Guardando...' : 'Guardar turno'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
