import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Search, MessageCircle, Bot, ShieldAlert, SlidersHorizontal, Send, Clock, PanelRight, Trash2, X } from 'lucide-react';
import AIStar from '../components/Icons/AIStar';
import { ContextPanels } from '../components/conversations/ContextSidebar';
import { usePermissions } from '../hooks/usePermissions';
import { getPatientHistory, setHumanTakeover, getPatientsForConversations, sendHumanMessage, deletePatient, deleteHistoryMessage } from '../services/supabaseService';
import { showErrorToast } from '../store/useToastStore';
import { formatPhone } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { usePlanLimits } from '../hooks/usePlanLimits';

const CONV_STALE_MS = 2 * 60_000; // 2 minutos
const WINDOW_24H_MS = 24 * 60 * 60 * 1000; // ventana de servicio de WhatsApp

const FILTER_OPTIONS = [
    { id: 'all', label: 'Todos' },
    { id: 'takeover', label: 'Bot desactivado' },
    { id: 'bot_active', label: 'Bot activo' },
];

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// Separadores de fecha tipo WhatsApp ("Hoy", "Ayer", o la fecha completa)
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function dayLabel(iso) {
    const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    return new Date(iso).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
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
    const [sortOrder, setSortOrder] = useState('recent');
    const [showFilter, setShowFilter] = useState(false);
    const filterRef = useRef(null);
    const { canToggleAi, canDeletePatients, canReplyConversations, canDeleteConversations } = usePermissions();
    const { maxPatients, patientsUsed } = usePlanLimits();
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
            .catch(() => { });
    }, []);

    function handleSearch(q) { setSearch(q); }
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyHasMore, setHistoryHasMore] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesScrollRef = useRef(null);

    // Lleva el scroll al final SOLO dentro del contenedor de mensajes.
    // (No usar scrollIntoView: arrastra a los ancestros con overflow-hidden —
    //  como la tarjeta que envuelve ambas columnas— y "levanta" toda la UI.)
    function scrollMessagesToBottom() {
        const el = messagesScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [showContext, setShowContext] = useState(true);
    const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false);
    const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
    const [processingChat, setProcessingChat] = useState(false);
    const textareaRef = useRef(null);

    // Auto-expand textarea height as the user types (like WhatsApp)
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
            if (textarea.scrollHeight > textarea.clientHeight) {
                textarea.style.overflowY = 'auto';
            } else {
                textarea.style.overflowY = 'hidden';
            }
        }
    }, [draft]);

    // Eliminar UN mensaje individual (como en el chat de la IA)
    async function handleDeleteMessage(id) {
        if (!id) return;
        const prev = history;
        setHistory(h => h.filter(m => m.id !== id)); // optimista
        try {
            await deleteHistoryMessage(id);
        } catch {
            setHistory(prev); // revertir
            showErrorToast('No se pudo eliminar el mensaje', 'Intenta de nuevo.');
        }
    }

    // Eliminar el chat (soft-delete del cliente, igual que en el módulo de Clientes)
    async function handleDeleteChat() {
        if (!selectedPatient || processingChat) return;
        setProcessingChat(true);
        const id = selectedPatient.id;
        try {
            await deletePatient(id);
            setPatients(prev => prev.filter(p => p.id !== id));
            const cache = useAppStore.getState()._conversationsCache;
            useAppStore.getState().setConversationsCache((cache.data || []).filter(p => p.id !== id));
            setShowDeleteChatConfirm(false);
            setSelectedPatient(null);
        } catch {
            showErrorToast('No se pudo eliminar', 'Intenta nuevamente en unos segundos.');
        } finally {
            setProcessingChat(false);
        }
    }

    // Mueve el scroll al final solo al terminar la carga inicial
    useEffect(() => {
        if (!loadingHistory && history.length > 0) {
            scrollMessagesToBottom();
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
        setMobilePanelsOpen(false); // al cambiar de cliente, volver al chat
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

    async function handleToggleAI() {
        if (!selectedPatient) return;

        // Verificar permiso antes de ejecutar — la ruta /conversations no verifica canToggleAi,
        // por lo que cualquier staff con acceso a esta página podría togglear la IA
        // aunque su rol tenga toggle_ai: false. Esta comprobación es la defensa real.
        if (!canToggleAi) return;

        // Estado actual (con override del store) → pausar (true) o reactivar (false)
        const current = selectedPatient.id in humanTakeoverMap
            ? humanTakeoverMap[selectedPatient.id]
            : selectedPatient.human_takeover;
        const next = !current;

        try {
            await setHumanTakeover(selectedPatient.id, next);
            useAppStore.getState().setPatientTakeover(selectedPatient.id, next);
            setSelectedPatient(prev => ({ ...prev, human_takeover: next }));
        } catch {
            showErrorToast(
                next ? 'Error al pausar IA' : 'Error al reactivar IA',
                'No se pudo cambiar el estado del bot. Intenta nuevamente.'
            );
        }
    }

    async function handleSend() {
        const text = draft.trim();
        // canReplyConversations y windowOpen son la defensa real; el composer ya está oculto/deshabilitado
        if (!text || sending || !selectedPatient || !canReplyConversations || !windowOpen) return;

        setSending(true);
        const tempId = `temp-${Date.now()}`;
        // Optimistic append — n8n es el escritor canónico de history; esta fila es local
        setHistory(prev => [...prev, {
            id: tempId,
            role: 'agent',
            content: text,
            created_at: new Date().toISOString(),
            _pending: true,
        }]);
        setDraft('');
        requestAnimationFrame(scrollMessagesToBottom);

        try {
            const result = await sendHumanMessage(selectedPatient.id, text);
            if (result.code === 'WINDOW_EXPIRED') {
                setHistory(prev => prev.filter(m => m.id !== tempId));
                setDraft(text);
                showErrorToast('Ventana de 24h cerrada', 'El cliente debe escribirte primero para poder responderle.');
                return;
            }
            // Éxito — marca enviado y pausa la IA para este cliente
            setHistory(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false } : m));
            useAppStore.getState().setPatientTakeover(selectedPatient.id, true);
            setSelectedPatient(prev => ({ ...prev, human_takeover: true }));
            // Persiste el takeover (idempotente — n8n también lo hace; defensa en profundidad)
            setHumanTakeover(selectedPatient.id, true).catch(() => { });
        } catch {
            setHistory(prev => prev.filter(m => m.id !== tempId));
            setDraft(text);
            showErrorToast('No se pudo enviar', 'Intenta nuevamente en unos segundos.');
        } finally {
            setSending(false);
        }
    }

    // Inserta texto armado desde la barra de contexto (oferta/servicio) en el composer
    function handleInsert(text) {
        setDraft(prev => (prev.trim() ? `${prev.trim()} ${text}` : text));
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
            if (sortOrder === 'recent') {
                return new Date(b.created_at) - new Date(a.created_at);
            }
            const na = (a.display_name || '').toLowerCase();
            const nb = (b.display_name || '').toLowerCase();
            return sortOrder === 'z-a' ? nb.localeCompare(na) : na.localeCompare(nb);
        });

    const isFiltering = filter !== 'all' || sortOrder !== 'recent';
    const filterLabel = FILTER_OPTIONS.find(o => o.id === filter)?.label || 'Todos';

    // Paciente seleccionado con override del mapa global aplicado
    const selectedPatientEffective = selectedPatient
        ? (selectedPatient.id in humanTakeoverMap
            ? { ...selectedPatient, human_takeover: humanTakeoverMap[selectedPatient.id] }
            : selectedPatient)
        : null;

    // Ventana de 24h de WhatsApp: solo se puede responder en texto libre si el
    // cliente escribió (role 'user') en las últimas 24h. n8n re-valida igual.
    const lastInboundAt = useMemo(() => {
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'user') return history[i].created_at;
        }
        return null;
    }, [history]);
    const windowOpen = lastInboundAt
        ? Date.now() - new Date(lastInboundAt).getTime() < WINDOW_24H_MS
        : false;
    // Horas restantes de la ventana (para el aviso del composer)
    const hoursLeft = lastInboundAt
        ? Math.max(0, Math.ceil((WINDOW_24H_MS - (Date.now() - new Date(lastInboundAt).getTime())) / 3_600_000))
        : 0;

    // Intercala separadores de fecha entre los mensajes (estilo WhatsApp)
    const messageItems = useMemo(() => {
        const items = [];
        let lastDay = null;
        for (const msg of history) {
            const day = startOfDay(new Date(msg.created_at));
            if (day !== lastDay) {
                items.push({ type: 'sep', id: `sep-${day}`, label: dayLabel(msg.created_at) });
                lastDay = day;
            }
            items.push({ type: 'msg', id: msg.id, msg });
        }
        return items;
    }, [history]);

    return (
        <div className="h-full flex flex-col w-full pt-2 px-2 relative transition-all duration-300">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Conversaciones</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">
                            {maxPatients !== null && patientsUsed > maxPatients ? (
                                `Mostrando últimas ${maxPatients} conversaciones (límite del plan)`
                            ) : (
                                "Atención directa vía WhatsApp"
                            )}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0 mb-4 lg:mb-6">
                <div className="relative flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex overflow-hidden animate-fade-up">
                    <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                    <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                    <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                    {/* Left Panel: Contacts — en mobile se oculta cuando hay un paciente seleccionado */}
                    <div className={`${selectedPatient ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] flex-col relative z-10 min-h-0 bg-transparent`}>
                        <div className="p-4 pb-3 space-y-2">
                            {/* Barra búsqueda + botón filtro */}
                            <div className="flex items-center gap-2">
                                <div className="relative h-10 flex-1">
                                    <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute -top-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(29,95,173,0.05)' }} />
                                    <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                    <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-700 z-10">
                                        <Search size={14} strokeWidth={2.5} />
                                    </div>
                                    <input
                                        className="relative w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-md"
                                        placeholder="Buscar cliente..."
                                        value={search}
                                        onChange={e => handleSearch(e.target.value)}
                                    />
                                </div>
                                {/* Botón filtro */}
                                <div className="relative" ref={filterRef}>
                                    <button
                                        onClick={() => setShowFilter(v => !v)}
                                        className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full text-navy-900 font-bold shadow-md transition-all duration-300 outline-none"
                                    >
                                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                        <SlidersHorizontal size={14} strokeWidth={2.5} className="shrink-0 relative z-10" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap text-[11px] relative z-10">Filtros</span>
                                    </button>

                                    {/* Dropdown filtro */}
                                    {showFilter && (
                                        <div className="overflow-hidden absolute right-0 top-12 w-52 bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md z-50 p-2 animate-fade-up">
                                            <div className="absolute -top-8 -right-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(64,98,200,0.05)' }} />
                                            <div className="absolute -top-8 -left-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(29,95,173,0.05)' }} />
                                            <div className="absolute -bottom-8 -right-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(120,110,230,0.05)' }} />
                                            <div className="absolute -bottom-8 -left-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(64,98,200,0.05)' }} />
                                            <div className="relative z-10">
                                                {/* Header limpiar */}
                                                {isFiltering && (
                                                    <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-white/20">
                                                        <span className="text-[10px] font-bold text-navy-700/50 tracking-wide">Filtros</span>
                                                        <button onClick={() => { setFilter('all'); setSortOrder('recent'); setShowFilter(false); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-600">Limpiar</button>
                                                    </div>
                                                )}
                                                {/* Sección Estado */}
                                                <div className="px-2 pt-2 pb-1">
                                                    <span className="text-[10px] font-bold text-navy-700/40 tracking-wide">Estado</span>
                                                </div>
                                                {FILTER_OPTIONS.map(opt => (
                                                    <div
                                                        key={opt.id}
                                                        onClick={() => setFilter(opt.id)}
                                                        className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${filter === opt.id ? 'bg-white/60 backdrop-blur-sm border-white/80 shadow-md text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-white/20'}`}
                                                    >
                                                        {opt.label}
                                                    </div>
                                                ))}
                                                {/* Separador */}
                                                <div className="my-1 border-t border-white/20" />
                                                {/* Sección Orden */}
                                                <div className="px-2 pt-1 pb-1">
                                                    <span className="text-[10px] font-bold text-navy-700/40 tracking-wide">Orden</span>
                                                </div>
                                                {[{ id: 'recent', label: 'Más recientes' }, { id: 'a-z', label: 'De la A-Z' }, { id: 'z-a', label: 'De la Z-A' }].map(opt => (
                                                    <div
                                                        key={opt.id}
                                                        onClick={() => setSortOrder(opt.id)}
                                                        className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${sortOrder === opt.id ? 'bg-white/60 backdrop-blur-sm border-white/80 shadow-md text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-white/20'}`}
                                                    >
                                                        {opt.label}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contador cuando hay filtro activo */}
                            {isFiltering && (
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[11px] font-semibold text-navy-700/70">
                                        {filteredPatients.length} de {patients.length} clientes
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 flex flex-col gap-1">
                            {filteredPatients.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                    <SlidersHorizontal size={22} strokeWidth={1.5} className="text-navy-700/30 mb-2" />
                                    <p className="text-xs font-bold text-navy-900/50">Sin resultados</p>
                                    <p className="text-[11px] font-semibold text-navy-700/40 mt-0.5">
                                        {isFiltering ? 'Prueba otro filtro' : 'No hay clientes que coincidan'}
                                    </p>
                                </div>
                            ) : filteredPatients.map(p => {
                                const isSelected = selectedPatient?.id === p.id;
                                const name = p.display_name || 'Sin nombre';
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedPatient(p)}
                                        className={`relative w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 text-left group border overflow-hidden ${isSelected ? 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-md' : 'border-transparent hover:bg-white/30'}`}
                                    >
                                        {isSelected && <>
                                            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                            <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                        </>}
                                        <div className={`relative z-10 w-11 h-11 flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border rounded-full leading-none ${isSelected
                                            ? 'bg-gradient-to-b from-white to-gray-200 border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900'
                                            : 'bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900 group-hover:to-gray-200 group-hover:border-gray-200'
                                            }`}>
                                            <span className="block">{getInitials(name)}</span>
                                        </div>
                                        <div className="relative z-10 flex-1 min-w-0">
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

                    {/* Right Panel: Chat — en mobile solo se ve si hay paciente seleccionado */}
                    <div className={`${selectedPatient ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative z-10 min-w-0 min-h-0`}>
                        {selectedPatient ? (
                            <>
                                {/* Chat Header */}
                                <div className="h-[72px] px-4 md:px-6 flex items-center justify-between shrink-0 z-10">
                                    <div className="flex items-center gap-3">
                                        {/* Back button — solo mobile */}
                                        <button
                                            onClick={() => setSelectedPatient(null)}
                                            className="md:hidden w-9 h-9 rounded-full bg-white/60 border border-white/80 flex items-center justify-center text-navy-900 shadow-sm hover:bg-white/80 transition-colors"
                                            aria-label="Volver"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                                        </button>
                                        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border leading-none bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900 text-xs font-bold">
                                            <span className="block translate-y-[1px] translate-x-[1px]">{getInitials(selectedPatient.display_name)}</span>
                                        </div>
                                        <div>
                                            <div className="font-bold text-navy-900 text-sm">{selectedPatient.display_name || 'Sin nombre'}</div>
                                            <div className="text-xs font-semibold text-navy-700/60 tracking-wide mt-0.5">{formatPhone(getPhone(selectedPatient))}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Móvil/tablet: abrir los paneles a pantalla completa (sin sidebar) */}
                                        <button
                                            onClick={() => setMobilePanelsOpen(true)}
                                            className="group/op relative overflow-hidden flex xl:hidden items-center justify-center gap-0 hover:gap-1.5 h-9 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 rounded-full shadow-md transition-all duration-300"
                                            title="Ver paneles"
                                            aria-label="Ver paneles de contexto"
                                        >
                                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                            <PanelRight size={15} strokeWidth={2.5} className="shrink-0 relative z-10" />
                                            <span className="max-w-0 overflow-hidden group-hover/op:max-w-[80px] transition-all duration-300 whitespace-nowrap text-[11px] font-bold relative z-10">Paneles</span>
                                        </button>
                                        {/* Toggle del panel de contexto — mismo estilo que el de móvil */}
                                        <button
                                            onClick={() => setShowContext(v => !v)}
                                            className="group/op relative overflow-hidden hidden xl:flex items-center justify-center gap-0 hover:gap-1.5 h-9 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 rounded-full shadow-md transition-all duration-300"
                                            title={showContext ? 'Ocultar paneles' : 'Mostrar paneles'}
                                            aria-label="Alternar paneles de contexto"
                                        >
                                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                            <PanelRight size={15} strokeWidth={2.5} className="shrink-0 relative z-10" />
                                            <span className="max-w-0 overflow-hidden group-hover/op:max-w-[80px] transition-all duration-300 whitespace-nowrap text-[11px] font-bold relative z-10">Paneles</span>
                                        </button>
                                        {/* Eliminar chat — directo, sin menú intermedio */}
                                        {canDeleteConversations && (
                                            <button
                                                onClick={() => setShowDeleteChatConfirm(true)}
                                                className="relative overflow-hidden w-9 h-9 rounded-full bg-white/40 backdrop-blur-2xl border border-white/60 text-rose-500 flex items-center justify-center shadow-md hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-colors"
                                                title="Eliminar chat"
                                                aria-label="Eliminar chat"
                                            >
                                                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                                <Trash2 size={16} strokeWidth={2.5} className="relative z-10" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Chat Messages */}
                                <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-6 bg-transparent relative z-0">
                                    {loadingHistory ? (
                                        <div className="flex justify-center flex-col gap-4">
                                            {Array(4).fill(0).map((_, i) => (
                                                <div key={i} className={`animate-shimmer h-12 w-3/4 rounded-2xl ${i % 2 === 0 ? 'ml-auto bg-white/60' : 'bg-white/40'}`} />
                                            ))}
                                        </div>
                                    ) : history.length === 0 ? (
                                        <div className="absolute inset-0 flex items-center justify-center flex-col text-navy-400">
                                            <MessageCircle size={32} strokeWidth={1.5} className="mb-3 opacity-30 text-navy-700" />
                                            <p className="font-bold text-sm text-navy-900/60">No hay mensajes anteriores</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 pb-4">
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
                                            {messageItems.map(item => {
                                                // Separador de fecha
                                                if (item.type === 'sep') {
                                                    return (
                                                        <div key={item.id} className="flex justify-center py-1">
                                                            <span className="text-[10px] font-bold text-navy-700/50 bg-white/50 backdrop-blur-md border border-white/70 rounded-full px-3 py-1 shadow-sm capitalize">
                                                                {item.label}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                const msg = item.msg;
                                                const isAgent = msg.role === 'agent';   // respuesta de un humano
                                                const isBot = msg.role === 'assistant'; // respuesta de la IA
                                                const isOutgoing = isAgent || isBot;
                                                return (
                                                    <div key={item.id} className={`group/msg flex w-full items-center gap-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                                                        {/* Eliminar mensaje individual (izquierda para salientes) */}
                                                        {canDeleteConversations && !msg._pending && isOutgoing && (
                                                            <button onClick={() => handleDeleteMessage(msg.id)} title="Eliminar mensaje"
                                                                className="opacity-0 group-hover/msg:opacity-100 shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-all">
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                        <div className={`max-w-[75%] relative overflow-hidden px-4 py-2.5 text-[13px] leading-relaxed font-medium backdrop-blur-2xl shadow-md bg-white/40 border border-white/60 text-navy-900 rounded-[20px] ${isOutgoing ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'} ${msg._pending ? 'opacity-60' : ''}`}>
                                                            {/* degradado de panel (mismas esquinas que el resto del sistema) */}
                                                            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                            <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full blur-2xl pointer-events-none z-0" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                                            <div className="relative z-10">
                                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                                                <div className={`text-[9px] uppercase font-bold tracking-widest mt-1.5 flex items-center gap-1.5 text-navy-900/55 ${isOutgoing ? 'justify-end' : ''}`}>
                                                                    {isOutgoing && (
                                                                        <span className="relative overflow-hidden px-2 py-[2px] rounded-full tracking-wider shadow-sm border border-white/60 backdrop-blur-sm bg-white/50 text-navy-900/75">
                                                                            <span className="absolute inset-0 pointer-events-none" style={{ background: isAgent ? 'linear-gradient(120deg, rgba(26,58,107,0.12), rgba(26,58,107,0.02))' : 'linear-gradient(120deg, rgba(64,98,200,0.25), rgba(120,110,230,0.25))' }} />
                                                                            <span className="relative z-10">{isAgent ? 'Tú' : 'IA'}</span>
                                                                        </span>
                                                                    )}
                                                                    <span>
                                                                        {msg._pending
                                                                            ? 'Enviando…'
                                                                            : new Date(msg.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Eliminar mensaje entrante (a la derecha del cliente) */}
                                                        {canDeleteConversations && !msg._pending && !isOutgoing && (
                                                            <button onClick={() => handleDeleteMessage(msg.id)} title="Eliminar mensaje"
                                                                className="opacity-0 group-hover/msg:opacity-100 shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-all">
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            <div ref={messagesEndRef} className="h-1" />
                                        </div>
                                    )}
                                </div>

                                {/* Composer — pausar IA (toggle_ai) y/o responder (reply_conversations) */}
                                {(canToggleAi || canReplyConversations) && (
                                    <div className="px-4 md:px-6 pb-4 pt-2 shrink-0">
                                        <div className="flex items-end gap-2">
                                            {/* Control de IA — solo con permiso de pausar IA */}
                                            {canToggleAi && (
                                                <button
                                                    onClick={handleToggleAI}
                                                    title={selectedPatientEffective?.human_takeover ? 'La IA está pausada — reactivar' : 'Pausar la IA'}
                                                    className={`group/ia relative overflow-hidden shrink-0 flex items-center justify-center gap-0 hover:gap-1.5 h-10 px-3 hover:px-4 border rounded-full shadow-md transition-all duration-300 ${selectedPatientEffective?.human_takeover
                                                        ? 'bg-amber-50/80 backdrop-blur-2xl border-amber-200/70 text-amber-700 hover:bg-amber-100/80'
                                                        : 'bg-white/40 backdrop-blur-2xl border-white/60 text-navy-900 hover:bg-white/60'}`}
                                                >
                                                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                                    <div className="relative z-10 shrink-0 w-4 h-4 flex items-center justify-center">
                                                        <Bot size={14} strokeWidth={2.5} />
                                                        <AIStar size={6} className="absolute -top-1 -left-1" strokeWidth={2.5} />
                                                    </div>
                                                    <span className="max-w-0 overflow-hidden group-hover/ia:max-w-[90px] transition-all duration-300 whitespace-nowrap text-[11px] font-bold relative z-10">
                                                        {selectedPatientEffective?.human_takeover ? 'Reactivar IA' : 'Pausar IA'}
                                                    </span>
                                                </button>
                                            )}
                                            {canReplyConversations && (<>
                                                <textarea
                                                    ref={textareaRef}
                                                    value={draft}
                                                    onChange={e => setDraft(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSend();
                                                        }
                                                    }}
                                                    rows={1}
                                                    placeholder={windowOpen ? 'Escribe un mensaje…' : 'La ventana de 24h está cerrada'}
                                                    disabled={sending || !windowOpen}
                                                    className="flex-1 resize-none max-h-32 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-3xl px-4 py-2.5 text-[13px] font-medium text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-colors placeholder-navy-900/50 shadow-md disabled:opacity-50 disabled:cursor-not-allowed custom-scrollbar"
                                                />
                                                <button
                                                    onClick={handleSend}
                                                    disabled={sending || !draft.trim() || !windowOpen}
                                                    className="group/send relative overflow-hidden shrink-0 flex items-center justify-center gap-0 hover:gap-1.5 h-10 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 rounded-full shadow-md hover:bg-white/60 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    aria-label="Enviar mensaje"
                                                >
                                                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                                    <Send size={16} strokeWidth={2.5} className="shrink-0 relative z-10" />
                                                    <span className="max-w-0 overflow-hidden group-hover/send:max-w-[60px] transition-all duration-300 whitespace-nowrap text-[11px] font-bold relative z-10">Enviar</span>
                                                </button>
                                            </>)}
                                        </div>
                                        {windowOpen && selectedPatientEffective && !selectedPatientEffective.human_takeover && (
                                            <p className="text-[10px] font-semibold text-navy-700/40 text-center mt-1.5">
                                                Al enviar, se pausará la IA para este cliente.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Confirmación de eliminar chat — mismo UI que el borrado de cliente */}
                                {showDeleteChatConfirm && createPortal(
                                    <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                                        <div className="w-full max-w-sm bg-white/30 backdrop-blur-xl border border-white/50 p-6 animate-fade-up shadow-[0_8px_32px_rgba(26,58,107,0.15)] rounded-[32px]">
                                            <p className="text-sm font-bold text-navy-900 text-center mb-1">¿Eliminar el chat?</p>
                                            <p className="text-xs text-navy-700/70 text-center mb-5 px-4">Esta acción no se puede deshacer. Se eliminará <span className="font-bold text-navy-900">{selectedPatient?.display_name || 'este cliente'}</span> y toda su conversación.</p>
                                            <div className="flex justify-center gap-3">
                                                <button onClick={() => setShowDeleteChatConfirm(false)} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/40 border border-white/60 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm min-w-[100px]">
                                                    <X size={13} /> Cancelar
                                                </button>
                                                <button onClick={handleDeleteChat} disabled={processingChat} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-500/80 border border-rose-400 text-white text-[11px] font-bold rounded-full hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50 min-w-[100px]">
                                                    <Trash2 size={13} /> {processingChat ? 'Eliminando...' : 'Sí, eliminar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>,
                                    document.body
                                )}

                                {/* Móvil/tablet: paneles a pantalla completa (sin sidebar) */}
                                {mobilePanelsOpen && (
                                    <div className="xl:hidden absolute inset-0 z-40 bg-white/50 backdrop-blur-2xl flex flex-col animate-fade-up">
                                        <div className="h-[72px] px-4 flex items-center gap-3 shrink-0 border-b border-white/40">
                                            <button
                                                onClick={() => setMobilePanelsOpen(false)}
                                                className="w-9 h-9 rounded-full bg-white/60 border border-white/80 flex items-center justify-center text-navy-900 shadow-sm hover:bg-white/80 transition-colors"
                                                aria-label="Volver al chat"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                                            </button>
                                            <div className="font-bold text-navy-900 text-sm">Paneles</div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                                            <ContextPanels
                                                patient={selectedPatientEffective}
                                                windowOpen={windowOpen}
                                                hoursLeft={hoursLeft}
                                                onInsert={(t) => { handleInsert(t); setMobilePanelsOpen(false); }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-transparent z-10">
                                <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md border border-white/60 shadow-sm flex items-center justify-center mb-4">
                                    <MessageCircle size={28} strokeWidth={1.5} className="text-navy-700/60" />
                                </div>
                                <h3 className="text-lg font-bold text-navy-900 tracking-tight">Tus conversaciones</h3>
                                <p className="text-xs font-semibold text-navy-700/60 mt-1">Selecciona un cliente para ver su historial</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Context Panels — fuera del box principal, a la derecha */}
                {selectedPatient && showContext && (
                    <div className="hidden xl:flex w-[380px] flex-col shrink-0 min-h-0 overflow-y-auto no-scrollbar px-2">
                        <ContextPanels
                            patient={selectedPatientEffective}
                            windowOpen={windowOpen}
                            hoursLeft={hoursLeft}
                            onInsert={handleInsert}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

