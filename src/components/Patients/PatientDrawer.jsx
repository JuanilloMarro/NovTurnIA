import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, MessageCircle, Pencil, Trash2, Phone, Bot } from 'lucide-react';
import { formatPhone } from '../../utils/format';
import { deletePatient, setHumanTakeover } from '../../services/supabaseService';
import { showSuccessToast, showErrorToast, showBotToast } from '../../store/useToastStore';
import EditPatientModal from './EditPatientModal';
import AIStar from '../Icons/AIStar';

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

export default function PatientDrawer({ patient, onClose, onRefresh }) {
    const navigate = useNavigate();
    const [showEdit, setShowEdit] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [botPaused, setBotPaused] = useState(patient?.human_takeover || false);
    const name = patient.display_name || 'Sin nombre';

    async function handleDelete() {
        setDeleting(true);
        try {
            await deletePatient(patient.id);
            showErrorToast('Paciente Eliminado', name, 'patient');
            onClose();
            onRefresh?.();
        } catch (err) {
            showErrorToast('Error al Eliminar', err.message || 'No se pudo eliminar al paciente.');
        } finally {
            setDeleting(false);
        }
    }

    // Use modulo for consistent colors
    const colors = ['bg-amber-700', 'bg-navy-900', 'bg-emerald-700', 'bg-cyan-700'];
    const colorClass = colors[name.length % colors.length];

    const appointments = (patient.appointments || []).sort((a, b) => new Date(b.date_start) - new Date(a.date_start));

    return (
        <div className="absolute top-2 right-2 bottom-2 w-[360px] bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] z-50 flex flex-col animate-drawer-in overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-2 p-4">
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-sm text-center">Perfil del paciente</h3>
                <div className="w-7 h-7" />
            </div>
            {/* 1. Información del Cliente y Título (FIJA) */}
            <div className="px-6 pb-2">
                <div className="flex items-center gap-3 mb-6 px-1">
                    <div className="w-12 h-12 rounded-full bg-navy-900 flex items-center justify-center text-white text-base font-bold shadow-md border border-white/20">
                        {getInitials(name)}
                    </div>
                    <div className="overflow-hidden">
                        <div className="font-bold text-navy-900 text-base truncate">{name}</div>
                        <div className="flex items-center gap-1.5 text-navy-700/60 font-semibold tracking-wide text-[11px] mt-0.5 truncate">
                            <Phone size={11} className="shrink-0 opacity-60" />
                            {formatPhone(patient.patient_phones?.[0]?.phone)}
                        </div>
                        {patient.created_at && (
                            <div className="text-[10px] text-navy-700/60 font-medium mt-0.5 truncate">
                                Registrado: {formatDateLong(patient.created_at)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 px-1 mb-2">
                    <h4 className="text-[11px] font-bold text-navy-800 leading-none">
                        Turnos ({appointments.length})
                    </h4>
                    <div className="flex-1 h-px bg-navy-900/10"></div>
                </div>
            </div>

            {/* 2. Área Scrolleable (Solo los items del Turno) */}
            <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
                {appointments.length === 0 ? (
                    <div className="text-center text-navy-800/60 text-xs font-bold py-4">No hay turnos registrados</div>
                ) : (
                    <div className="space-y-4">
                        {appointments.map(apt => (
                            <div key={apt.id} className="flex gap-3 items-center">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                    apt.status === 'cancelled' 
                                        ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' 
                                        : apt.confirmed 
                                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                                            : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                                }`} />
                                <div>
                                    <div className="text-xs font-bold text-navy-900 tracking-wide">
                                        {formatAptDate(apt.date_start)}
                                    </div>
                                    <div className={`text-[10px] font-bold mt-0.5 ${
                                        apt.status === 'cancelled' ? 'text-rose-600/70' : 
                                        apt.confirmed ? 'text-emerald-600/70' : 'text-amber-600/70'
                                    }`}>
                                        {apt.status === 'cancelled' ? 'Cancelado' : apt.confirmed ? 'Confirmado' : 'Pendiente'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Fixed Buttons */}
            <div className="p-4 mt-auto">
                <div className="flex items-center justify-center gap-2">
                    {/* 1. Conversación */}
                    <button
                        onClick={() => {
                            onClose();
                            navigate(`/conversations?patient=${patient.id}`);
                        }}
                        className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-card hover:bg-white/80 transition-all duration-300 overflow-hidden"
                    >
                        <MessageCircle size={14} className="shrink-0" />
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Chat</span>
                    </button>

                    {/* 2. IA (Bot Toggle) */}
                    <button
                        onClick={async () => {
                            const newValue = !patient.human_takeover;
                            try {
                                await setHumanTakeover(patient.id, newValue);
                                setBotPaused(newValue);
                                patient.human_takeover = newValue;
                                onRefresh?.();
                            } catch (err) {
                                showErrorToast('Error al actualizar IA', err.message);
                            }
                        }}
                        className={`group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 border text-[11px] font-bold rounded-full shadow-card transition-all duration-300 overflow-hidden ${botPaused
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            : 'bg-white border-white/80 text-navy-900 hover:bg-white/80'
                            }`}
                    >
                        <div className="relative shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                            <Bot size={13} />
                            <AIStar
                                size={7}
                                className={`absolute -top-1 -left-1 animate-pulse ${botPaused ? 'text-amber-500' : 'text-navy-900'}`}
                                strokeWidth={2.5}
                            />
                        </div>
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap ml-0 group-hover:ml-0">
                            {botPaused ? 'Reactivar IA' : 'Pausar IA'}
                        </span>
                    </button>

                    {/* 3. Editar */}
                    <button
                        onClick={() => setShowEdit(true)}
                        className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-card hover:bg-white/80 transition-all duration-300 overflow-hidden"
                    >
                        <Pencil size={14} className="shrink-0" />
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-300 whitespace-nowrap">Editar</span>
                    </button>

                    {/* 4. Eliminar */}
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-rose-600 text-[11px] font-bold rounded-full shadow-card hover:bg-rose-50 transition-all duration-300 overflow-hidden"
                    >
                        <Trash2 size={14} className="shrink-0" />
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[70px] transition-all duration-300 whitespace-nowrap">Eliminar</span>
                    </button>
                </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white/30 backdrop-blur-xl border border-white/50 p-6 animate-fade-up shadow-[0_8px_32px_rgba(26,58,107,0.15)] rounded-[32px]">
                        <p className="text-sm font-bold text-navy-900 text-center mb-1">¿Eliminar paciente?</p>
                        <p className="text-xs text-navy-700/70 text-center mb-5 px-4">Esta acción no se puede deshacer. Se eliminará <span className="font-bold text-navy-900">{name}</span> y todos sus datos.</p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/40 border border-white/60 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm min-w-[100px]"
                            >
                                <X size={13} /> Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-500/80 border border-rose-400 text-white text-[11px] font-bold rounded-full hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50 min-w-[100px]"
                            >
                                <Trash2 size={13} /> {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}


            {showEdit && (
                <EditPatientModal
                    patient={patient}
                    onClose={() => setShowEdit(false)}
                    onUpdated={() => {
                        onRefresh?.();
                        onClose();
                    }}
                />
            )}
        </div>
    );
}
