import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePatients } from '../hooks/usePatients';
import PatientCard from '../components/Patients/PatientCard';
import PatientDrawer from '../components/Patients/PatientDrawer';
import NewPatientModal from '../components/Patients/NewPatientModal';
import { Search, SlidersHorizontal, Download, Plus, RefreshCw, Lock } from 'lucide-react';
import SearchField from '../components/ui/SearchField';
import Popover from '../components/ui/Popover';
import Tooltip from '../components/ui/Tooltip';
import { exportAllPatients, getPatientById } from '../services/supabaseService';
import { downloadCSV } from '../utils/export';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useAppStore } from '../store/useAppStore';

export default function Patients() {
    const { canCreatePatients, canExportPatients } = usePermissions();
    const { hasFeature, maxPatients, patientsUsed } = usePlanLimits();
    const exportUnlocked = hasFeature('export_patients');
    const { patients, loading, loadingMore, hasMore, search, handleSearch, sortOrder, setSortOrder, reload, loadMore } = usePatients();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showSort, setShowSort] = useState(false);
    const sortBtnRef = useRef(null);
    const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [searchParams, setSearchParams] = useSearchParams();
    const patientIdFromUrl = searchParams.get('id');

    useEffect(() => {
        if (!patientIdFromUrl) return;
        const p = patients.find(x => x.id === patientIdFromUrl);
        if (p) {
            setSelectedPatient(p);
            setSearchParams({}, { replace: true });
        } else if (patients.length > 0) {
            // Not on current page — fetch directly
            getPatientById(patientIdFromUrl)
                .then(fetched => { if (fetched) setSelectedPatient(fetched); })
                .catch(() => { })
                .finally(() => setSearchParams({}, { replace: true }));
        }
    }, [patientIdFromUrl, patients, setSearchParams]);

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
        <div className={`h-full flex flex-col w-full pt-2 relative transition-all duration-300 ${selectedPatient ? 'px-2 sm:pl-0 sm:pr-[380px]' : 'px-4'}`}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Clientes</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">
                            {maxPatients !== null && patientsUsed > maxPatients ? (
                                `${patientsUsed} clientes registrados (mostrando últimos ${maxPatients})`
                            ) : (
                                `${patientsUsed || patients.length} clientes registrados`
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 md:h-10 flex-wrap w-full lg:w-auto max-sm:flex-nowrap max-sm:[&>*]:shrink-0 max-sm:overflow-x-auto mobile-strip">
                    {/* T22/T23 — en móvil colapsa a lupa para no comerse la fila entera.
                        Desde `sm` renderiza exactamente la misma barra de antes. */}
                    <SearchField
                        value={search}
                        onChange={handleSearch}
                        placeholder="Buscar por nombre o teléfono..."
                        className="sm:w-72"
                    />

                    {canCreatePatients && (
                        <button
                            onClick={() => { setSelectedPatient(null); setIsNewPatientModalOpen(true); }}
                            className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none"
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Plus size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[110px] transition-all duration-300 whitespace-nowrap relative z-10">Agregar Cliente</span>
                        </button>
                    )}

                    {/* Refresh */}
                    <button
                        onClick={() => reload(search, true, 0)}
                        disabled={loading}
                        className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 disabled:opacity-40"
                    >
                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                        <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                        <RefreshCw size={14} className={`shrink-0 ${loading ? 'animate-spin' : ''}`} />
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">Actualizar</span>
                    </button>


                    {/* Export CSV */}
                    {canExportPatients && (
                        /* T21 — el `title=` nativo NO existe en táctil: en el teléfono el
                           cliente veía el botón apagado sin ninguna explicación. Y este
                           texto en concreto es de venta, así que es el que más importa
                           que se lea. */
                        <Tooltip label={exportUnlocked ? '' : 'Exportación de clientes disponible en Enterprise'}>
                        <button
                            onClick={exportUnlocked ? handleExport : undefined}
                            disabled={exporting || !exportUnlocked}
                            className={`relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 disabled:opacity-50 ${!exportUnlocked ? 'cursor-not-allowed' : ''}`}
                        >
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            {exportUnlocked ? <Download size={14} className="shrink-0" /> : <Lock size={13} className="shrink-0 text-navy-700" />}
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-300 whitespace-nowrap">Exportar</span>
                        </button>
                        </Tooltip>
                    )}

                    {/* Sort funnel button */}
                    {(() => {
                        const hasActiveSort = sortOrder !== 'recent';
                        return (
                            <div className="relative">
                                <button
                                    ref={sortBtnRef}
                                    onClick={() => setShowSort(!showSort)}
                                    className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none"
                                >
                                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                    <SlidersHorizontal size={14} className="shrink-0" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Filtros</span>
                                </button>

                                {/* T12/T13 — por portal. Antes era `absolute` dentro de la fila,
                                    y desde que la fila es tira deslizable en teléfono
                                    (`overflow-x-auto`) el navegador la recorta también en
                                    vertical: el menú quedaba encerrado en 40px de alto. */}
                                <Popover open={showSort} onClose={() => setShowSort(false)} anchorRef={sortBtnRef} align="right" className="w-52">
                                    {hasActiveSort && (
                                        <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-white/20">
                                            <span className="text-[10px] font-bold text-navy-700/50 tracking-wide">Orden</span>
                                            <button onClick={() => { setSortOrder('recent'); setShowSort(false); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-600">Limpiar</button>
                                        </div>
                                    )}
                                    {sortOptions.map(opt => (
                                        <div
                                            key={opt.id}
                                            onClick={() => setSortOrder(opt.id)}
                                            className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${sortOrder === opt.id ? 'bg-white/60 backdrop-blur-sm border-white/80 shadow-md text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-white/20'}`}
                                        >
                                            {opt.label}
                                        </div>
                                    ))}
                                </Popover>
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
                    <p>No se encontraron clientes para tu búsqueda.</p>
                </div>
            ) : (
                <div className="space-y-3 flex-1 overflow-y-auto px-2 custom-scrollbar pb-10">
                    {patients.map((p, i) => (
                        <PatientCard key={p.id} patient={p} index={i} onClick={setSelectedPatient} isSelected={selectedPatient?.id === p.id} />
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
                        useAppStore.getState().invalidatePlanLimitsCache();
                        useAppStore.getState().invalidateConversationsCache();
                        reload(search, true);
                        setIsNewPatientModalOpen(false);
                    }}
                />
            )}

            {selectedPatient && (
                <PatientDrawer
                    patient={selectedPatient}
                    onClose={() => setSelectedPatient(null)}
                    onRefresh={async () => {
                        useAppStore.getState().invalidatePlanLimitsCache();
                        useAppStore.getState().invalidateConversationsCache();
                        const data = await reload(search, true);
                        const updated = data.find(p => p.id === selectedPatient.id);
                        if (updated) setSelectedPatient(updated);
                    }}
                />
            )}
        </div>
    )
}
