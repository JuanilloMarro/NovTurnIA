import { useState } from 'react';
import { X, User, Phone, Save } from 'lucide-react';
import { createPatient } from '../../services/supabaseService';
import { formatPhone } from '../../utils/format';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';

export default function NewPatientModal({ isOpen, onClose, onCreated }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [displayPhone, setDisplayPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 8) {
            return setError('El teléfono debe tener al menos 8 dígitos.');
        }
        if (!name.trim()) {
            return setError('El nombre es obligatorio.');
        }

        setLoading(true);
        try {
            await createPatient({
                id: cleanPhone,
                display_name: name.trim()
            });
            showSuccessToast(
                'Paciente Registrado',
                `${name.trim()} : ${formatPhone(cleanPhone)}`
            );
            // Note: Activity log notification is auto-created by DB trigger
            onCreated();
            onClose();
        } catch (err) {
            console.error('Error creating patient:', err);
            const errorMsg = err.message || 'Error al registrar al paciente.';
            setError(errorMsg);
            showErrorToast('Error al Registrar', errorMsg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full max-w-sm overflow-hidden animate-fade-up">

                <div className="flex items-center justify-between px-5 py-4 border-b border-white/40 bg-white/20">
                    <h2 className="text-lg font-bold text-navy-900 tracking-tight">Nuevo Paciente</h2>
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
                        {/* Nombre */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-widest leading-none mb-3">Nombre Completo</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-800/50">
                                    <User size={16} />
                                </div>
                                <input
                                    className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Nombre del paciente"
                                    required
                                />
                            </div>
                        </div>

                        {/* Teléfono */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-widest leading-none mb-3">Teléfono</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-800/50">
                                    <Phone size={16} />
                                </div>
                                <input
                                    className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900"
                                    value={displayPhone}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setPhone(val.replace(/\D/g, ''));
                                        setDisplayPhone(formatPhone(val));
                                    }}
                                    placeholder="Ej: 502 4798 9357"
                                    required
                                    type="tel"
                                />
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
                            {loading ? 'Registrando...' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
