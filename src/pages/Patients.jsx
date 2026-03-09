import { useState } from 'react';
import { usePatients } from '../hooks/usePatients';
import PatientCard from '../components/Patients/PatientCard';
import PatientDrawer from '../components/Patients/PatientDrawer';
import { Search, ChevronDown } from 'lucide-react';

export default function Patients() {
    const { patients, loading, search, handleSearch, sortOrder, setSortOrder } = usePatients();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showSort, setShowSort] = useState(false);

    const sortOptions = [
        { id: 'recent', label: 'Más reciente' },
        { id: 'oldest', label: 'Más antiguo' },
        { id: 'a-z', label: 'De la A-Z' },
        { id: 'z-a', label: 'De la Z-A' },
    ];
    const sortLabel = sortOptions.find(o => o.id === sortOrder)?.label || 'Ordenar';

    return (
        <div className="h-full flex flex-col pt-2 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Pacientes</h1>
                    <p className="text-sm text-gray-500 mt-1">{patients.length} pacientes registrados</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative w-80">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                            <Search size={18} />
                        </div>
                        <input
                            className="w-full bg-white border border-gray-200 rounded-full pl-11 pr-4 py-2.5 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition-all placeholder-gray-400 shadow-sm"
                            placeholder="Buscar por nombre o teléfono..."
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <div onClick={() => setShowSort(!showSort)} className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-2.5 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                            <span className="text-[13px] font-medium text-gray-600">Ordenar: <span className="font-semibold text-navy-900">{sortLabel}</span></span>
                            <ChevronDown size={16} className={`text-gray-400 transition-transform ${showSort ? 'rotate-180' : ''}`} />
                        </div>

                        {showSort && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 py-2 animate-fade-up">
                                {sortOptions.map(opt => (
                                    <div
                                        key={opt.id}
                                        onClick={() => { setSortOrder(opt.id); setShowSort(false); }}
                                        className={`px-5 py-2.5 text-[13.5px] cursor-pointer hover:bg-gray-50 transition-colors border-l-2 ${sortOrder === opt.id ? 'font-bold text-navy-900 border-navy-500 bg-navy-50/30' : 'text-gray-600 border-transparent font-medium'}`}
                                    >
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {Array(4).fill(0).map((_, i) => <div key={i} className="animate-shimmer h-20 rounded-2xl w-full" />)}
                </div>
            ) : patients.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
                        <Search size={24} className="text-gray-300" />
                    </div>
                    <p>No se encontraron pacientes para tu búsqueda.</p>
                </div>
            ) : (
                <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
                    {patients.map((p, i) => (
                        <PatientCard key={p.id} patient={p} index={i} onClick={setSelectedPatient} />
                    ))}
                </div>
            )}

            {selectedPatient && (
                <PatientDrawer patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
            )}
        </div>
    )
}
