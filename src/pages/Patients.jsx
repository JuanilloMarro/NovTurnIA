import { useState } from 'react';
import { usePatients } from '../hooks/usePatients';
import PatientCard from '../components/Patients/PatientCard';
import PatientDrawer from '../components/Patients/PatientDrawer';
import NewPatientModal from '../components/Patients/NewPatientModal';
import { Search, SlidersHorizontal, Download, Plus, RefreshCw } from 'lucide-react';
import { exportAllPatients } from '../services/supabaseService';
import { downloadCSV } from '../utils/export';

export default function Patients() {
    const { patients, loading, loadingMore, hasMore, search, handleSearch, sortOrder, setSortOrder, reload, loadMore } = usePatients();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showSort, setShowSort] = useState(false);
    const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    async function handleExport() {
        setExporting(true);
        try {
            const rows = await exportAllPatients();
            const date = new Date().toISOString().split('T')[0];
            downloadCSV(rows, `pacientes_${date}.csv`);
        } catch (err) {
            console.error('Export error:', err);
        } finally {
            setExporting(false);
        }
    }

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
                            className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden"
                        >
                            <Plus size={14} className="shrink-0" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap">Agregar Paciente</span>
                        </button>
                    </div>

                    {/* Refresh */}
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                        <button
                            onClick={() => reload(search, true, 0)}
                            disabled={loading}
                            className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 active:scale-95 transition-all duration-300 overflow-hidden disabled:opacity-40"
                        >
                            <RefreshCw size={14} className={`shrink-0 ${loading ? 'animate-spin' : ''}`} />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">Actualizar</span>
                        </button>
                    </div>

                    {/* Export CSV */}
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden disabled:opacity-50"
                        >
                            <Download size={14} className="shrink-0" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-300 whitespace-nowrap">Exportar</span>
                        </button>
                    </div>

                    {/* Sort funnel button */}
                    {(() => {
                        const hasActiveSort = sortOrder !== 'recent';
                        return (
                            <div className="relative h-full">
                                <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-full shadow-sm">
                                    <button
                                        onClick={() => setShowSort(!showSort)}
                                        className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden outline-none"
                                    >
                                        <SlidersHorizontal size={14} className="shrink-0" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Filtros</span>
                                    </button>
                                </div>

                                {showSort && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-card z-50 py-2 animate-fade-up">
                                        {hasActiveSort && (
                                            <div className="flex items-center justify-between px-4 pb-2 mb-1 border-b border-white/50">
                                                <span className="text-[10px] font-bold text-navy-700/50 uppercase tracking-wider">Orden</span>
                                                <button onClick={() => { setSortOrder('recent'); setShowSort(false); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-600">Limpiar</button>
                                            </div>
                                        )}
                                        {sortOptions.map(opt => (
                                            <div
                                                key={opt.id}
                                                onClick={() => setSortOrder(opt.id)}
                                                className={`mx-1 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${sortOrder === opt.id ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-white/60'}`}
                                            >
                                                {opt.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
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
                <div className="space-y-3 flex-1 overflow-y-auto pr-3 custom-scrollbar pb-10">
                    {patients.map((p, i) => (
                        <PatientCard key={p.id} patient={p} index={i} onClick={setSelectedPatient} />
                    ))}
                    {hasMore && (
                        <div className="flex justify-center pt-2 pb-4">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="px-6 py-2 bg-white/50 border border-white/70 rounded-full text-xs font-bold text-navy-800 hover:bg-white/70 transition-colors shadow-sm disabled:opacity-50"
                            >
                                {loadingMore ? 'Cargando...' : 'Cargar más'}
                            </button>
                        </div>
                    )}
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
