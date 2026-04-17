import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MessageCircle, Bot, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import AIStar from '../components/Icons/AIStar';
import { usePermissions } from '../hooks/usePermissions';
import { getPatientHistory, setHumanTakeover, getPatientsForConversations } from '../services/supabaseService';
import { showErrorToast } from '../store/useToastStore';
import { formatPhone } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

const CONV_STALE_MS = 2 * 60_000; // 2 minutos

const FILTER_OPTIONS = [
    { id: 'all',        label: 'Todos' },
    { id: 'takeover',   label: 'Bot desactivado' },
    { id: 'bot_active', label: 'Bot activo' },
];

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Conversations() {
    const [searchParams, setSearchParams] = useSearchParams();
    const patientIdFromUrl = searchParams.get('patient');

    // T-31: query liviana — solo id, display_name, human_takeover y teléfono
    // Reemplaza usePatients() que traía 5 citas por paciente innecesariamente.
    // Cache de 2 min en store — evita re-fetch en cada navegación a /conversations.
    const [patients, setPatients] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('a-z');
    const [showFilter, setShowFilter] = useState(false);
    const filterRef = useRef(null);
    const { canToggleAi } = usePermissions();
    const humanTakeoverMap = useAppStore(s => s.humanTakeoverMap);

    // Cierra el dropdown al hacer click fuera
    useEffect(() => {
        if (!showFilter) return;
        function handleClickOutside(e) {
            if (filterRef.current && !filterRef.current.contains(e.target)) {
                setShowFilter(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilter]);

    useEffect(() => {
        const cache = useAppStore.getState()._conversationsCache;
        if (cache.data.length > 0 && Date.now() - cache.fetchedAt < CONV_STALE_MS) {
            setPatients(cache.data);
            return;
        }
        getPatientsForConversations()
            .then(data => {
                useAppStore.getState().setConversationsCache(data);
                setPatients(data);
            })
            .catch(() => {});
    }, []);

    function handleSearch(q) { setSearch(q); }
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyHasMore, setHistoryHasMore] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
    const messagesEndRef = useRef(null);

    // Mueve el scroll al final solo al terminar la carga inicial
    useEffect(() => {
        if (!loadingHistory && history.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [loadingHistory]);

    // Auto-select patient from URL if present
    useEffect(() => {
        if (patientIdFromUrl && patients.length > 0) {
            const p = patients.find(p => p.id === patientIdFromUrl);
            if (p) {
                // Remove patient param from URL to clean it
                setSearchParams({}, { replace: true });
                setSelectedPatient(p);
            }
        }
    }, [patientIdFromUrl, patients, setSearchParams]);

    useEffect(() => {
        if (selectedPatient) {
            loadHistory(selectedPatient.id);
        } else {
            setHistory([]);
        }
    }, [selectedPatient]);

    async function loadHistory(id) {
        setLoadingHistory(true);
        try {
            const { data, hasMore } = await getPatientHistory(id);
            setHistory(data);
            setHistoryHasMore(hasMore);
        } catch {
            setHistory([]);
            setHistoryHasMore(false);
        } finally {
            setLoadingHistory(false);
        }
    }

    async function loadMoreHistory() {
        if (!selectedPatient || loadingMoreHistory || !historyHasMore) return;
        setLoadingMoreHistory(true);
        try {
            const oldest = history[0]?.created_at;
            const { data, hasMore } = await getPatientHistory(selectedPatient.id, { before: oldest });
            setHistory(prev => [...data, ...prev]);
            setHistoryHasMore(hasMore);
        } catch {
            // no-op — mantener mensajes actuales
        } finally {
            setLoadingMoreHistory(false);
        }
    }

    async function handleReactivateIA() {
        if (!selectedPatient) return;

        // Verificar permiso antes de ejecutar — la ruta /conversations no verifica canToggleAi,
        // por lo que cualquier staff con acceso a esta página podría reactivar la IA
        // aunque su rol tenga toggle_ai: false. Esta comprobación es la defensa real.
        if (!canToggleAi) return;

        try {
            await setHumanTakeover(selectedPatient.id, false);
            useAppStore.getState().setPatientTakeover(selectedPatient.id, false);
            setSelectedPatient(prev => ({ ...prev, human_takeover: false }));
        } catch (err) {
            // Usar el sistema de toasts en lugar de alert():
            // alert() es bloqueante, inconsistente con el resto de la UI, y concatena
            // err.message directamente, potencialmente exponiendo stack traces o detalles
            // internos de la API al usuario final.
            showErrorToast('Error al reactivar IA', 'No se pudo reactivar el bot. Intenta nuevamente.');
        }
    }

    // Helper para obtener teléfono del paciente
    const getPhone = (p) => p.patient_phones?.[0]?.phone || '';

    // Filtrar por estado de bot + búsqueda de texto, luego ordenar
    // Aplica overrides del store global para reflejar cambios hechos desde otros componentes
    const filteredPatients = patients
        .map(p => p.id in humanTakeoverMap ? { ...p, human_takeover: humanTakeoverMap[p.id] } : p)
        .filter(p => {
            if (search && !p.display_name?.toLowerCase().includes(search.toLowerCase())) return false;
            if (filter === 'takeover') return p.human_takeover;
            if (filter === 'bot_active') return !p.human_takeover;
            return true;
        })
        .sort((a, b) => {
            const na = (a.display_name || '').toLowerCase();
            const nb = (b.display_name || '').toLowerCase();
            return sortOrder === 'z-a' ? nb.localeCompare(na) : na.localeCompare(nb);
        });

    const isFiltering = filter !== 'all' || sortOrder !== 'a-z';
    const filterLabel = FILTER_OPTIONS.find(o => o.id === filter)?.label || 'Todos';

    // Paciente seleccionado con override del mapa global aplicado
    const selectedPatientEffective = selectedPatient
        ? (selectedPatient.id in humanTakeoverMap
            ? { ...selectedPatient, human_takeover: humanTakeoverMap[selectedPatient.id] }
            : selectedPatient)
        : null;

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto w-full pt-2">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Conversaciones</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Atención directa vía WhatsApp</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex overflow-hidden mb-4 lg:mb-6 animate-fade-up">
                {/* Left Panel: Contacts */}
                <div className="w-[320px] flex flex-col z-10">
                    <div className="p-4 pb-3 space-y-2">
                        {/* Barra búsqueda + botón filtro */}
                        <div className="flex items-center gap-2">
                            <div className="relative h-10 flex-1">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-900">
                                    <Search size={14} strokeWidth={2.5} />
                                </div>
                                <input
                                    className="w-full h-full bg-white/60 backdrop-blur-card border border-white/90 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-sm"
                                    placeholder="Buscar paciente..."
                                    value={search}
                                    onChange={e => handleSearch(e.target.value)}
                                />
                            </div>
                            {/* Botón filtro */}
                            <div className="relative" ref={filterRef}>
                                <button
                                    onClick={() => setShowFilter(v => !v)}
                                    className={`h-10 w-10 flex items-center justify-center rounded-full border shadow-sm transition-all ${isFiltering ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white/60 border-white/90 text-navy-900 hover:bg-white/80'}`}
                                    title={`Filtro: ${filterLabel}`}
                                >
                                    <SlidersHorizontal size={14} strokeWidth={2.5} />
                                </button>

                                {/* Dropdown filtro */}
                                {showFilter && (
                                    <div className="absolute right-0 top-12 w-48 bg-white/80 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-lg overflow-hidden z-50 py-2 animate-fade-up">
                                        {/* Header limpiar */}
                                        {isFiltering && (
                                            <div className="flex items-center justify-between px-4 pb-2 mb-1 border-b border-white/50">
                                                <span className="text-[10px] font-bold text-navy-700/50 uppercase tracking-wider">Filtros</span>
                                                <button onClick={() => { setFilter('all'); setSortOrder('a-z'); setShowFilter(false); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-600">Limpiar</button>
                                            </div>
                                        )}
                                        {/* Sección Estado */}
                                        <div className="px-4 pt-1 pb-1">
                                            <span className="text-[10px] font-bold text-navy-700/40 uppercase tracking-wider">Estado</span>
                                        </div>
                                        {FILTER_OPTIONS.map(opt => (
                                            <div
                                                key={opt.id}
                                                onClick={() => setFilter(opt.id)}
                                                className={`mx-1 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${filter === opt.id ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-white/60'}`}
                                            >
                                                {opt.label}
                                            </div>
                                        ))}
                                        {/* Separador */}
                                        <div className="mx-4 my-2 border-t border-white/50" />
                                        {/* Sección Orden */}
                                        <div className="px-4 pb-1">
                                            <span className="text-[10px] font-bold text-navy-700/40 uppercase tracking-wider">Orden</span>
                                        </div>
                                        {[{ id: 'a-z', label: 'De la A-Z' }, { id: 'z-a', label: 'De la Z-A' }].map(opt => (
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
                        </div>

                        {/* Contador cuando hay filtro activo */}
                        {isFiltering && (
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[11px] font-semibold text-navy-700/70">
                                    {filteredPatients.length} de {patients.length} pacientes
                                </span>
                                <button
                                    onClick={() => { setFilter('all'); setSortOrder('a-z'); }}
                                    className="text-[11px] font-bold text-navy-900 hover:underline"
                                >
                                    Limpiar
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 space-y-1">
                        {filteredPatients.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                <SlidersHorizontal size={22} strokeWidth={1.5} className="text-navy-900/30 mb-2" />
                                <p className="text-xs font-bold text-navy-900/50">Sin resultados</p>
                                <p className="text-[11px] font-semibold text-navy-700/40 mt-0.5">
                                    {isFiltering ? 'Prueba otro filtro' : 'No hay pacientes que coincidan'}
                                </p>
                            </div>
                        ) : filteredPatients.map(p => {
                            const isSelected = selectedPatient?.id === p.id;
                            const name = p.display_name || 'Sin nombre';
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPatient(p)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left group ${isSelected ? 'bg-white/60 border border-white/80 shadow-sm' : 'hover:bg-white/40 border border-transparent'}`}
                                >
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border ${isSelected ? 'bg-navy-900 border-navy-900 text-white shadow-md' : 'bg-white border-white/60 text-navy-900 group-hover:bg-navy-900 group-hover:text-white group-hover:border-navy-900 shadow-sm'}`}>
                                        {getInitials(name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${isSelected ? 'text-navy-900' : 'text-navy-900/80'}`}>{name}</div>
                                        <div className="flex items-center gap-2">
                                            <div className={`text-xs font-semibold tracking-wide truncate mt-0.5 ${isSelected ? 'text-navy-700' : 'text-navy-700/60'}`}>{formatPhone(getPhone(p))}</div>
                                            {p.human_takeover && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" title="Intervención Humana Activa" />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Chat */}
                <div className="flex-1 flex flex-col relative min-w-0">
                    {selectedPatient ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-[72px] px-6 flex items-center justify-between shrink-0 z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-full bg-white border border-white/60 flex items-center justify-center text-navy-900 text-xs font-bold shadow-sm">
                                        {getInitials(selectedPatient.display_name)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-navy-900 text-sm">{selectedPatient.display_name || 'Sin nombre'}</div>
                                        <div className="text-xs font-semibold text-navy-700/60 tracking-wide mt-0.5">{formatPhone(getPhone(selectedPatient))}</div>
                                    </div>
                                </div>

                                {selectedPatientEffective?.human_takeover && canToggleAi && (
                                    <button
                                        onClick={handleReactivateIA}
                                        className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-[11px] font-bold shadow-sm hover:bg-amber-100 transition-all group/btn"
                                        title="El bot está desactivado para este paciente"
                                    >
                                        <div className="relative">
                                            <Bot size={13} strokeWidth={2.5} />
                                            <AIStar 
                                                size={7} 
                                                className="absolute -top-1.5 -left-1.5 text-amber-600 animate-pulse" 
                                                strokeWidth={2.5}
                                             />
                                        </div>
                                        <span>Reactivar IA</span>
                                    </button>
                                )}
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-transparent relative z-0">
                                {loadingHistory ? (
                                    <div className="flex justify-center flex-col gap-4">
                                        {Array(4).fill(0).map((_, i) => (
                                            <div key={i} className={`animate-shimmer h-12 w-3/4 rounded-2xl ${i % 2 === 0 ? 'ml-auto bg-white/60' : 'bg-white/40'}`} />
                                        ))}
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center flex-col text-navy-400">
                                        <MessageCircle size={32} strokeWidth={1.5} className="mb-3 opacity-30 text-navy-900" />
                                        <p className="font-bold text-sm text-navy-900/60">No hay mensajes anteriores</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pb-4">
                                        {historyHasMore && (
                                            <div className="flex justify-center pb-2">
                                                <button
                                                    onClick={loadMoreHistory}
                                                    disabled={loadingMoreHistory}
                                                    className="px-4 py-1.5 bg-white/50 border border-white/70 rounded-full text-[11px] font-bold text-navy-800 hover:bg-white/70 transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    {loadingMoreHistory ? 'Cargando...' : 'Cargar mensajes anteriores'}
                                                </button>
                                            </div>
                                        )}
                                        {history.map(msg => {
                                            const isBot = msg.role === 'assistant';
                                            return (
                                                <div key={msg.id} className={`flex w-full ${isBot ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[75%] px-4 py-2.5 text-[13px] leading-relaxed relative shadow-sm font-medium ${isBot
                                                        ? 'bg-navy-900 text-white rounded-[20px] rounded-br-[4px] border border-navy-800'
                                                        : 'bg-white/70 backdrop-blur-md border border-white/90 text-navy-900 rounded-[20px] rounded-bl-[4px]'
                                                        }`}>
                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                        <div className={`text-[9px] uppercase font-bold tracking-widest mt-1.5 ${isBot ? 'text-navy-300 text-right' : 'text-navy-500'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} className="h-1" />
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-transparent z-10">
                            <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center mb-4">
                                <MessageCircle size={28} strokeWidth={1.5} className="text-navy-900/60" />
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 tracking-tight">Tus conversaciones</h3>
                            <p className="text-xs font-semibold text-navy-700/60 mt-1">Selecciona un paciente para ver su historial</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
