import { ChevronRight } from 'lucide-react';
import { formatPhone } from '../../utils/format';

const AVATAR_GRADIENTS = [
    'from-navy-700 to-navy-500',
    'from-emerald-700 to-emerald-500',
    'from-cyan-700 to-cyan-500',
    'from-amber-700 to-amber-500',
    'from-rose-700 to-rose-500',
];

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PatientCard({ patient, index, onClick }) {
    // Force amber gradient for the mockup look, or keep it dynamic
    const gradient = 'from-amber-700 to-amber-500'; // Hardcoded for mockup consistency as per "Avatar marrón/naranja"
    const name = patient.display_name || `Sin nombre`;

    return (
        <div
            onClick={() => onClick(patient)}
            className="group bg-white/40 backdrop-blur-sm border border-white/60 rounded-2xl p-4 hover:bg-white/60 transition-all duration-300 cursor-pointer animate-fade-up shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            style={{ animationDelay: `${index * 0.04}s` }}
        >
            <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-white border border-white/60 group-hover:bg-navy-900 flex items-center justify-center text-navy-900 group-hover:text-white text-xs font-bold flex-shrink-0 shadow-sm transition-all duration-300">
                    {getInitials(patient.display_name)}
                </div>
                <div>
                    <div className="font-bold text-navy-900 text-sm">{name}</div>
                    <div className="text-xs font-semibold text-navy-700/60 tracking-wide mt-0.5">{formatPhone(patient.patient_phones?.[0]?.phone)}</div>
                </div>
            </div>

            <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/40 text-navy-700 group-hover:bg-white group-hover:scale-105 transition-all shadow-sm">
                <ChevronRight size={16} />
            </div>
        </div>
    );
}
