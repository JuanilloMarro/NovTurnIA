import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Target } from 'lucide-react';
import AIStar from '../Icons/AIStar';
import FeatureLock from '../FeatureLock';
import InsightDrawer from './InsightDrawer';
import { SCOPE_META } from './aiActions';
import { generateAIInsight } from '../../services/supabaseService';

// Acceso rápido a Centro IA desde la ficha del cliente (doc "Automatización
// Agente IA" · Parte B §B.3.3: PatientAIBlock bajo las notas). Reusa el mismo
// InsightDrawer + schemas de Centro IA — no duplica lógica de generación.
export default function PatientAIBlock({ patient }) {
    const [openScope, setOpenScope] = useState(null);
    const action = openScope ? SCOPE_META[openScope] : null;

    return (
        <FeatureLock feature="stats_intelligence" requiredPlan="Enterprise" compact>
            <div className="flex items-center gap-3 px-1 mb-2">
                <h4 className="text-[11px] font-bold text-navy-900 leading-none flex items-center gap-1.5">
                    <AIStar size={11} /> Centro IA
                </h4>
                <div className="flex-1 h-px bg-navy-900/10" />
            </div>
            <div className="flex items-center gap-2 px-1 mb-4">
                <button
                    onClick={() => setOpenScope('patient_summary')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[10.5px] font-bold rounded-full shadow-sm hover:bg-white/60 transition-all duration-300"
                >
                    <FileText size={12} className="shrink-0" /> Resumen IA
                </button>
                <button
                    onClick={() => setOpenScope('patient_strategy')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[10.5px] font-bold rounded-full shadow-sm hover:bg-white/60 transition-all duration-300"
                >
                    <Target size={12} className="shrink-0" /> Estrategia
                </button>
            </div>

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
