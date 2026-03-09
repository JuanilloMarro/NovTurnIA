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
        <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-drawer-in">

            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-gray-100/60 bg-white">
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-navy-700 hover:bg-gray-100 transition-colors">
                    <ChevronLeft size={16} strokeWidth={2.5} />
                </button>
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-center text-lg">Perfil del paciente</h3>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-navy-700 hover:bg-gray-100 transition-colors">
                    <X size={16} strokeWidth={2.5} />
                </button>
            </div>

            {/* Content scrolleable */}
            <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">

                {/* Profile Info Center */}
                <div className="flex flex-col items-center text-center mb-10">
                    <div className={`w-[52px] h-[52px] rounded-full ${colorClass} flex items-center justify-center text-white text-[18px] font-bold shadow-sm mb-4 border border-white/20`}>
                        {getInitials(name)}
                    </div>
                    <h2 className="text-[22px] font-bold text-navy-900 mb-1 tracking-tight">{name}</h2>
                    <div className="text-[15px] font-medium text-gray-600 mb-2 tracking-wide">{formatPhone(patient.id)}</div>
                    {patient.created_at && (
                        <div className="text-[13px] text-gray-500 font-medium tracking-wide">
                            Registrado: {formatDateLong(patient.created_at)}
                        </div>
                    )}
                </div>

                {/* Appointments List */}
                <div className="mb-4">
                    <div className="flex items-center gap-4 mb-6">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                            Turnos ({appointments.length})
                        </h4>
                        <div className="flex-1 h-px bg-gray-100"></div>
                    </div>

                    {appointments.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-4">No hay turnos registrados</div>
                    ) : (
                        <div className="space-y-6 lg:space-y-5">
                            {appointments.map(apt => (
                                <div key={apt.id} className="flex gap-3">
                                    <div className="mt-1.5 shrink-0">
                                        <div className={`w-2.5 h-2.5 rounded-full ${apt.status === 'active' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-gray-300'}`} />
                                    </div>
                                    <div>
                                        <div className="text-[14px] font-medium text-navy-900 tracking-wide">
                                            {formatAptDate(apt.date_start)}
                                        </div>
                                        <div className="text-[13px] text-gray-500 mt-0.5">
                                            {apt.status === 'active' ? 'Pendiente' : 'Cancelado'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Fixed Button */}
            <div className="p-6 bg-white border-t border-gray-100">
                <button
                    onClick={() => {
                        onClose();
                        navigate(`/conversations?patient=${patient.id}`);
                    }}
                    className="w-full flex items-center justify-center gap-2 border border-gray-200 text-navy-700 font-semibold rounded-full py-2.5 hover:bg-gray-50 transition-colors shadow-sm text-[14px]"
                >
                    <MessageCircle size={18} strokeWidth={2.5} className="opacity-70" />
                    Ver conversación WhatsApp
                </button>
            </div>
        </div>
    );
}
