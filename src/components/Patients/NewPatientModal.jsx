import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, Save } from 'lucide-react';
import { createPatient } from '../../services/supabaseService';
import { formatPhone } from '../../utils/format';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';

export default function NewPatientModal({ isOpen, onClose, onCreated }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length !== 8) {
            return setError('El número de WhatsApp debe tener exactamente 8 dígitos.');
        }
        if (!name.trim()) {
            return setError('El nombre es obligatorio.');
        }

        setLoading(true);
        try {
            await createPatient({
                display_name: name.trim(),
                phone: `+502${cleanPhone}`
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

    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full max-w-md overflow-hidden animate-fade-up">

                <div className="flex items-center justify-between px-6 pt-6 pb-2">
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
                    <div className="px-6 py-4 space-y-5">
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
                                    value={phone}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        if (val.length <= 8) setPhone(val);
                                    }}
                                    placeholder="Ej: 47989357"
                                    required
                                    type="tel"
                                    inputMode="numeric"
                                />
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
                            {loading ? 'Registrando...' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
