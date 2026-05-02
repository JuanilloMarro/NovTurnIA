import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, Save, Calendar } from 'lucide-react';
import { updatePatient } from '../../services/supabaseService';
import { showPatientEditToast, showErrorToast } from '../../store/useToastStore';
import { useModalFocus } from '../../hooks/useModalFocus';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import FeatureLock from '../FeatureLock';



export default function EditPatientModal({ patient, onClose, onUpdated }) {
    const [name, setName] = useState(patient.display_name || '');
    const rawPhone = (patient.patient_phones?.[0]?.phone || '').replace(/\D/g, '');
    const [phone, setPhone] = useState(rawPhone.length > 8 ? rawPhone.slice(-8) : rawPhone);
    const [notes, setNotes] = useState(patient.notes || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { hasFeature } = usePlanLimits();
    const modalRef = useRef(null);
    useModalFocus(modalRef, true, onClose);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length !== 8 || !/^[2-7]/.test(cleanPhone)) return setError('Ingresa un número válido de Guatemala: 8 dígitos comenzando con 2–7.');
        if (!name.trim()) return setError('El nombre es obligatorio.');

        setLoading(true);
        try {
            await updatePatient(patient.id, {
                display_name: name.trim(),
                phone: `+502${cleanPhone}`,
                notes: notes.trim() || null,
            });
            showPatientEditToast(name.trim());
            onUpdated();
            onClose();
        } catch (err) {
            const msg = err.message || 'Error al actualizar el paciente.';
            setError(msg);
            showErrorToast('Error al Actualizar', msg);
        } finally {
            setLoading(false);
        }
    }

    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div ref={modalRef} className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full max-w-md overflow-hidden animate-fade-up">

                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <h2 className="text-lg font-bold text-navy-900 tracking-tight">Editar Cliente</h2>
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
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 leading-none mb-3 px-1">Nombre completo</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-800/50">
                                    <User size={16} />
                                </div>
                                <input
                                    className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Nombre del cliente"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 leading-none mb-3 px-1">Teléfono (WhatsApp)</label>
                            <div className="flex items-center bg-white/40 border border-white/60 rounded-full shadow-sm focus-within:border-white focus-within:bg-white/60 focus-within:ring-1 focus-within:ring-white transition-all overflow-hidden">
                                <span className="pl-3.5 pr-2 flex items-center gap-1.5 text-navy-700/60 text-sm font-semibold whitespace-nowrap select-none">
                                    <Phone size={14} className="text-navy-800/50 shrink-0" />
                                    +502
                                </span>
                                <div className="w-px h-5 bg-navy-900/10 shrink-0" />
                                <input
                                    className="flex-1 bg-transparent pl-3 pr-4 py-2.5 text-sm font-semibold outline-none placeholder-navy-700/50 text-navy-900"
                                    value={phone}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        if (val.length <= 8) setPhone(val);
                                    }}
                                    placeholder="47989357"
                                    required
                                    type="tel"
                                    inputMode="numeric"
                                />
                            </div>
                        </div>


                        {/* Notas (opcional) */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 leading-none mb-3 px-1">Notas / Observaciones</label>
                            <FeatureLock feature="patient_notes" requiredPlan="Pro">
                                <textarea
                                    className="w-full bg-white/40 border border-white/60 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900 min-h-[100px] resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Ej: Prefiere corte con tijera, alérgico a..."
                                    disabled={!hasFeature('patient_notes')}
                                />
                            </FeatureLock>
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
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
