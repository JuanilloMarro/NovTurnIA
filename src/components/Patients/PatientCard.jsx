import { ChevronRight } from 'lucide-react';
import { formatPhone } from '../../utils/format';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PatientCard({ patient, index, onClick, isSelected }) {
    const name = patient.display_name || `Sin nombre`;

    return (
        <div
            onClick={() => onClick(patient)}
            className={`group relative overflow-hidden backdrop-blur-2xl rounded-2xl p-4 transition-all duration-300 cursor-pointer animate-fade-up flex flex-col md:flex-row md:items-center justify-between gap-4 border shadow-md ${
                isSelected
                ? 'bg-white/60 border-white/80'
                : 'bg-white/40 border-white/60 hover:bg-white/60'
            }`}
            style={{ animationDelay: `${index * 0.04}s` }}
        >
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
            <div className="flex items-center gap-4 relative z-10">
                <div className={`w-11 h-11 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 border rounded-full leading-none ${
                    isSelected
                    ? 'bg-gradient-to-b from-white to-gray-200 border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900'
                    : 'bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900 group-hover:to-gray-200 group-hover:border-gray-200'
                }`}>
                    <span className="block">{getInitials(patient.display_name)}</span>
                </div>
                <div>
                    <div className="font-bold text-navy-900 text-sm">{name}</div>
                    <div className="text-xs font-semibold text-navy-700/60 tracking-wide mt-0.5">{formatPhone(patient.patient_phones?.[0]?.phone)}</div>
                </div>
            </div>

            <div className="relative z-10 overflow-hidden hidden md:flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/40 backdrop-blur-2xl text-navy-700 group-hover:bg-white group-hover:scale-105 transition-all shadow-md">
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                <ChevronRight size={16} className="relative z-10" />
            </div>
        </div>
    );
}
