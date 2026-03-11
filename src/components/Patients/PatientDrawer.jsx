import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, MessageCircle } from 'lucide-react';
import { formatPhone } from '../../utils/format';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDateLong(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatAptDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')} · ${d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

export default function PatientDrawer({ patient, onClose }) {
    const navigate = useNavigate();
    const name = patient.display_name || 'Sin nombre';

    // Use modulo for consistent colors
    const colors = ['bg-amber-700', 'bg-navy-900', 'bg-emerald-700', 'bg-cyan-700'];
    const colorClass = colors[name.length % colors.length];

    const appointments = (patient.appointments || []).sort((a, b) => new Date(b.date_start) - new Date(a.date_start));

    return (
        <div className="absolute top-2 right-2 bottom-2 w-[360px] bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] z-50 flex flex-col animate-drawer-in overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-2 p-4 bg-white/20 border-b border-white/40 backdrop-blur-md">
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-sm text-center">Perfil del paciente</h3>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                    <X size={16} />
                </button>
            </div>

            {/* Content scrolleable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">

                <div className="flex items-center gap-3 mb-6 bg-white/30 p-3 rounded-2xl border border-white/50 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-navy-900/90 flex items-center justify-center text-white text-base font-bold shadow-sm border border-white/50">
                        {getInitials(name)}
                    </div>
                    <div className="overflow-hidden">
                        <div className="font-bold text-navy-900 text-base truncate">{name}</div>
                        <div className="text-navy-700/80 font-semibold tracking-wide text-xs truncate">{formatPhone(patient.id)}</div>
                        {patient.created_at && (
                            <div className="text-[10px] text-navy-700/60 font-medium tracking-wide mt-0.5 truncate">
                                Registrado: {formatDateLong(patient.created_at)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Appointments List */}
                <div className="space-y-6">
                    <div className="bg-white/30 p-4 rounded-2xl border border-white/50 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <h4 className="text-[10px] font-bold text-navy-800 uppercase tracking-widest leading-none">
                                Turnos ({appointments.length})
                            </h4>
                            <div className="flex-1 h-px bg-navy-900/10"></div>
                        </div>

                        {appointments.length === 0 ? (
                            <div className="text-center text-navy-800/60 text-xs font-bold py-4">No hay turnos registrados</div>
                        ) : (
                            <div className="space-y-4">
                                {appointments.map(apt => (
                                    <div key={apt.id} className="flex gap-3 items-center">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${apt.status === 'active' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-gray-400'}`} />
                                        <div>
                                            <div className="text-xs font-bold text-navy-900 tracking-wide">
                                                {formatAptDate(apt.date_start)}
                                            </div>
                                            <div className="text-[10px] font-semibold text-navy-700/60 mt-0.5 uppercase tracking-widest">
                                                {apt.status === 'active' ? 'Pendiente' : 'Cancelado'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Fixed Button */}
            <div className="bg-white/30 backdrop-blur-2xl border-t border-white/50 p-4 flex flex-col items-center mt-auto">
                <button
                    onClick={() => {
                        onClose();
                        navigate(`/conversations?patient=${patient.id}`);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-white/80 text-navy-900 text-xs font-bold rounded-full shadow-card hover:bg-white/80 transition-colors"
                >
                    <MessageCircle size={14} /> Ver conversación WhatsApp
                </button>
            </div>
        </div>
    );
}
