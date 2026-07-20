import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Search, X, RefreshCw, AlertCircle, User } from 'lucide-react';
import AIStar from '../Icons/AIStar';
import InsightContent from './InsightContent';
import { timeAgo } from './aiActions';
import { getAIInsights, searchPatients } from '../../services/supabaseService';
import { formatPhone } from '../../utils/format';
import { showErrorToast, showSuccessToast } from '../../store/useToastStore';

// Detalle de una acción IA. Cache-first: al abrir muestra el último insight
// guardado (leerlo no consume IA); Generar/Regenerar es lo único que invoca
// la Edge Function. Para scopes por cliente, primero se elige el cliente.
export default function InsightDrawer({ action, initialRefId = null, initialPatient = null, onGenerate, onClose }) {
    const Icon = action.icon;

    // Cliente seleccionado (solo scopes needsPatient). Si venimos desde la
    // actividad reciente o el ref_id trae ficha completa (p. ej. PatientAIBlock)
    // arrancamos con ese cliente y nos saltamos el buscador.
    const [patient, setPatient] = useState(
        initialPatient || (initialRefId ? { id: initialRefId, display_name: null } : null)
    );
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef(null);

    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const refId = action.needsPatient ? (patient?.id ?? null) : null;
    const needsSelection = action.needsPatient && !patient;

    // Carga el último insight cacheado del scope (+cliente si aplica)
    useEffect(() => {
        if (needsSelection) { setInsight(null); setLoading(false); return; }
        let alive = true;
        setLoading(true);
        getAIInsights({ scope: action.scope, refId, limit: 1 })
            .then(rows => { if (alive) setInsight(rows[0] || null); })
            .catch(() => { if (alive) setInsight(null); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [action.scope, refId, needsSelection]);

    // Typeahead de clientes con debounce
    useEffect(() => {
        if (!action.needsPatient) return;
        clearTimeout(debounceRef.current);
        const term = query.trim();
        if (!term) { setResults([]); setSearching(false); return; }
        setSearching(true);
        debounceRef.current = setTimeout(() => {
            searchPatients(term, 8)
                .then(setResults)
                .catch(() => setResults([]))
                .finally(() => setSearching(false));
        }, 250);
        return () => clearTimeout(debounceRef.current);
    }, [query, action.needsPatient]);

    async function handleGenerate() {
        setGenerating(true);
        try {
            await onGenerate(action.scope, { refId });
            const rows = await getAIInsights({ scope: action.scope, refId, limit: 1 });
            setInsight(rows[0] || null);
            showSuccessToast('Análisis generado', `${action.title} actualizado.`);
        } catch (err) {
            showErrorToast('No se pudo generar', err.message || 'Inténtalo más tarde.');
        } finally {
            setGenerating(false);
        }
    }

    return (
        <>
            <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-[2px] z-[110]" onClick={onClose} />
            <div className="fixed inset-0 sm:absolute sm:top-3 sm:right-3 sm:bottom-3 sm:left-auto sm:w-[400px] bg-white/95 sm:bg-white/30 backdrop-blur-2xl border border-white/60 rounded-none sm:rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] z-[120] flex flex-col animate-drawer-in overflow-hidden">
                <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

                {/* Header — ícono, título y descripción en una sola fila (antes eran
                    dos bloques separados que dejaban un hueco vacío arriba del
                    contenido cuando el análisis era corto). */}
                <div className="relative z-10 flex items-center gap-3 p-4 pb-3">
                    <button onClick={onClose} className="relative overflow-hidden w-7 h-7 flex items-center justify-center rounded-full bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 hover:bg-white/60 shadow-md transition-colors shrink-0">
                        <ChevronLeft size={16} className="relative z-10" />
                    </button>
                    <div className="w-10 h-10 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0 shadow-inner">
                        <Icon size={18} className="text-navy-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-navy-900 tracking-tight text-[13px] leading-tight truncate">{action.title}</h3>
                        <p className="text-[10px] font-semibold text-navy-700/50 leading-snug truncate">{action.desc}</p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[8px] font-bold tracking-widest text-navy-900/40">
                        {action.mode}
                    </span>
                </div>

                {/* Selector de cliente (scopes por paciente) */}
                {action.needsPatient && (
                    <div className="relative z-20 px-6 pb-3">
                        {patient ? (
                            <div className="flex items-center justify-between gap-2 bg-white/50 border border-white/60 rounded-2xl px-3.5 py-2.5 shadow-sm">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                                        <User size={13} className="text-navy-900" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-bold text-navy-900 truncate leading-tight">{patient.display_name || 'Cliente del análisis'}</p>
                                        {patient.phone && <p className="text-[10px] font-semibold text-navy-700/50 leading-tight mt-0.5">{formatPhone(patient.phone)}</p>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setPatient(null); setQuery(''); }}
                                    className="w-6 h-6 rounded-full bg-white/60 border border-white/60 flex items-center justify-center text-navy-700/60 hover:text-navy-900 hover:bg-white transition-colors shrink-0"
                                    title="Cambiar de cliente"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-700/40 pointer-events-none" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Busca un cliente por nombre..."
                                    className="w-full bg-white/50 border border-white/60 rounded-2xl pl-9 pr-3 py-2.5 text-[12px] font-semibold text-navy-900 outline-none focus:bg-white/70 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                                />
                                {(results.length > 0 || searching) && (
                                    <div className="absolute top-full inset-x-0 mt-1.5 bg-white/95 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-[0_8px_32px_rgba(26,58,107,0.18)] overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                                        {searching && results.length === 0 && (
                                            <p className="px-4 py-3 text-[11px] font-semibold text-navy-700/50">Buscando...</p>
                                        )}
                                        {results.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => { setPatient(r); setResults([]); setQuery(''); }}
                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-navy-900/5 transition-colors"
                                            >
                                                <div className="w-6 h-6 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                                                    <User size={11} className="text-navy-900" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[12px] font-bold text-navy-900 truncate leading-tight">{r.display_name}</p>
                                                    {r.phone && <p className="text-[10px] font-semibold text-navy-700/50 leading-tight">{formatPhone(r.phone)}</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Resultado cacheado */}
                <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pb-4">
                    {needsSelection ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="w-12 h-12 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mb-3">
                                <Search size={18} className="text-navy-700/50" />
                            </div>
                            <p className="text-[11px] font-semibold text-navy-700/50 max-w-[220px]">
                                Elige un cliente para ver o generar su análisis.
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                        </div>
                    ) : insight ? (
                        <div className="bg-white/40 border border-white/60 rounded-3xl p-5 shadow-sm">
                            <InsightContent scope={action.scope} content={insight.content} />
                            <p className="flex items-center gap-1.5 text-[9px] font-bold text-navy-900/30 tracking-wide mt-4 pt-3 border-t border-navy-900/5">
                                <AIStar size={10} /> Generado {timeAgo(insight.generated_at)}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="w-12 h-12 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mb-3">
                                <AIStar size={18} className="text-navy-700/50" />
                            </div>
                            <p className="text-[12px] font-bold text-navy-900 mb-1">Aún no hay un análisis guardado</p>
                            <p className="text-[11px] font-semibold text-navy-700/50 max-w-[240px]">
                                Genera el primero: el resultado queda guardado y volver a verlo no consume IA.
                            </p>
                        </div>
                    )}
                </div>

                {/* Acción de generación — lo único que gasta tokens */}
                {!needsSelection && (
                    <div className="relative z-10 px-6 pb-5 pt-2 shrink-0">
                        <button
                            onClick={handleGenerate}
                            disabled={generating || loading}
                            className="relative overflow-hidden w-full flex items-center justify-center gap-2 px-4 py-3 bg-navy-900 border border-white/10 text-white text-[11px] font-bold rounded-2xl shadow-card hover:bg-navy-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {generating
                                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando análisis...</>
                                : insight
                                    ? <><RefreshCw size={13} /> Regenerar análisis</>
                                    : <><AIStar size={13} /> Generar análisis</>}
                        </button>
                        <p className="flex items-center justify-center gap-1 text-[9px] font-bold text-navy-900/30 mt-2">
                            <AlertCircle size={9} /> Ver el resultado guardado es gratis; {insight ? 'regenerar' : 'generar'} usa IA.
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
