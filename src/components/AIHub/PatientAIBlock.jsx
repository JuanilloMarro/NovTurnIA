import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Target } from 'lucide-react';
import AIStar from '../Icons/AIStar';
import FeatureLock from '../FeatureLock';
import InsightDrawer from './InsightDrawer';
import { SCOPE_META } from './aiActions';
import { generateAIInsight } from '../../services/supabaseService';

const STATUS_META = {
    confirmed:  { label: 'Confirmados', dot: 'bg-emerald-500' },
    pending:    { label: 'Pendientes', dot: 'bg-amber-400' },
    cancelled:  { label: 'Cancelados', dot: 'bg-rose-500' },
    no_show:    { label: 'No se presentó', dot: 'bg-gray-400' },
};

// Acceso rápido a Centro IA desde la ficha del cliente (doc "Automatización
// Agente IA" · Parte B §B.3.3: PatientAIBlock bajo las notas). Reusa el mismo
// InsightDrawer + schemas de Centro IA — no duplica lógica de generación.
// Fichas con el mismo lenguaje del sistema: icono gris con borde + solo título
// (mismo patrón que VouchersSection/MethodsPanel).
export default function PatientAIBlock({ patient, appointments = [] }) {
    const [openScope, setOpenScope] = useState(null);
    const action = openScope ? SCOPE_META[openScope] : null;

    // Metadata útil para la IA: conteo de citas por estado.
    const statusCounts = useMemo(() => {
        const counts = { confirmed: 0, pending: 0, cancelled: 0, no_show: 0 };
        for (const apt of appointments) {
            if (apt.status === 'cancelled') counts.cancelled++;
            else if (apt.status === 'no_show') counts.no_show++;
            else if (apt.confirmed) counts.confirmed++;
            else counts.pending++;
        }
        return counts;
    }, [appointments]);
    const hasAppointments = appointments.length > 0;

    return (
        <FeatureLock feature="stats_intelligence" requiredPlan="Pro" compact>
            <div className="flex items-center gap-3 px-1 mb-2">
                <h4 className="text-[11px] font-bold text-navy-900 leading-none flex items-center gap-1.5">
                    <AIStar size={11} /> Centro IA
                </h4>
                <div className="flex-1 h-px bg-navy-900/10" />
            </div>
            <div className="flex items-center gap-2 px-1 mb-3">
                <button
                    onClick={() => setOpenScope('patient_summary')}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-sm hover:bg-white/60 transition-all duration-300"
                >
                    <div className="w-8 h-8 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0"><FileText size={14} /></div>
                    <span className="text-[11px] font-bold text-navy-900">Resumen IA</span>
                </button>
                <button
                    onClick={() => setOpenScope('patient_strategy')}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2.5 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-sm hover:bg-white/60 transition-all duration-300"
                >
                    <div className="w-8 h-8 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0"><Target size={14} /></div>
                    <span className="text-[11px] font-bold text-navy-900">Estrategia</span>
                </button>
            </div>

            {hasAppointments && (
                <div className="flex items-center gap-2.5 flex-wrap px-1 mb-4">
                    {Object.entries(statusCounts).filter(([, n]) => n > 0).map(([status, n]) => (
                        <span key={status} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-navy-900/50">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_META[status].dot}`} />
                            {n} {STATUS_META[status].label.toLowerCase()}
                        </span>
                    ))}
                </div>
            )}

            {/* Portal a document.body: PatientDrawer es sm:absolute + overflow-hidden,
                así que un InsightDrawer anidado directo quedaría recortado en desktop. */}
            {action && createPortal(
                <InsightDrawer
                    action={action}
                    initialPatient={{
                        id: patient.id,
                        display_name: patient.display_name,
                        phone: patient.patient_phones?.[0]?.phone,
                    }}
                    onGenerate={generateAIInsight}
                    onClose={() => setOpenScope(null)}
                />,
                document.body
            )}
        </FeatureLock>
    );
}
