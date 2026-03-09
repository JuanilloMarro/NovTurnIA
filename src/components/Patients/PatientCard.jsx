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
            className="group bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-card-hover transition-all duration-300 cursor-pointer animate-fade-up shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            style={{ animationDelay: `${index * 0.04}s` }}
        >
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm`}>
                    {getInitials(patient.display_name)}
                </div>
                <div>
                    <div className="font-bold text-navy-900 text-[15px]">{name}</div>
                    <div className="text-sm font-medium text-gray-500 tracking-wide mt-0.5">{formatPhone(patient.id)}</div>
                </div>
            </div>

            <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-gray-400 group-hover:bg-navy-50 group-hover:border-navy-100 group-hover:text-navy-700 transition-colors">
                <ChevronRight size={20} />
            </div>
        </div>
    );
}
