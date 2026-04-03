import { useState } from 'react';
import { usePatients } from '../hooks/usePatients';
import PatientCard from '../components/Patients/PatientCard';
import PatientDrawer from '../components/Patients/PatientDrawer';
import NewPatientModal from '../components/Patients/NewPatientModal';
import { Search, SlidersHorizontal } from 'lucide-react';

export default function Patients() {
    const { patients, loading, search, handleSearch, sortOrder, setSortOrder, reload } = usePatients();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showSort, setShowSort] = useState(false);
    const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);

    const sortOptions = [
        { id: 'recent', label: 'Más reciente' },
        { id: 'oldest', label: 'Más antiguo' },
        { id: 'a-z', label: 'De la A-Z' },
        { id: 'z-a', label: 'De la Z-A' },
    ];
    const sortLabel = sortOptions.find(o => o.id === sortOrder)?.label || 'Ordenar';

    return (
        <div className={`h-full flex flex-col w-full pt-2 relative transition-all duration-300 ${selectedPatient ? 'pr-[380px]' : 'px-4'}`}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Pacientes</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">{patients.length} pacientes registrados</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 h-10">
                    <div className="relative w-72 h-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-900">
                            <Search size={14} strokeWidth={2.5} />
                        </div>
                        <input
                            className="w-full h-full bg-white/60 backdrop-blur-card border border-white/90 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-sm"
                            placeholder="Buscar por nombre o teléfono..."
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                        <button 
                            onClick={() => { setSelectedPatient(null); setIsNewPatientModalOpen(true); }}
                            className="px-4 h-full rounded-full bg-white border border-white/80 hover:bg-white/80 shadow-sm hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-navy-900 text-[11px] font-bold"
                        >
                            <span className="text-[14px]">+</span> Agregar Paciente
                        </button>
                    </div>

                    {/* Sort funnel button - moved to last position */}
                    <div className="relative h-full">
                        <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                            <button 
                                onClick={() => setShowSort(!showSort)}
                                className="w-8 h-8 rounded-full bg-white border border-white/80 hover:bg-white/80 shadow-sm hover:scale-[1.02] transition-all flex items-center justify-center text-navy-900"
                            >
                                <SlidersHorizontal size={14} />
                            </button>
                        </div>

                        {showSort && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-card z-50 py-2 animate-fade-up">
                                {sortOptions.map(opt => (
                                    <div
                                        key={opt.id}
                                        onClick={() => { setSortOrder(opt.id); setShowSort(false); }}
                                        className={`px-4 py-2.5 text-xs font-bold cursor-pointer hover:bg-white/60 transition-colors ${sortOrder === opt.id ? 'text-navy-900 bg-white/50' : 'text-navy-700'}`}
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


            {isNewPatientModalOpen && (
                <NewPatientModal
                    isOpen={isNewPatientModalOpen} 
                    onClose={() => setIsNewPatientModalOpen(false)} 
                    onCreated={() => {
                        handleSearch(search); // Refresh with current search
                        setIsNewPatientModalOpen(false);
                    }}
                />
            )}

            {selectedPatient && (
                <PatientDrawer 
                    patient={selectedPatient} 
                    onClose={() => setSelectedPatient(null)} 
                    onRefresh={async () => {
                        const data = await reload(search);
                        const updated = data.find(p => p.id === selectedPatient.id);
                        if (updated) setSelectedPatient(updated);
                    }} 
                />
            )}
        </div>
    )
}
