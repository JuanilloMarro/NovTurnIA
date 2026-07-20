import { useState, useEffect } from 'react';
import { Search, RefreshCw, Clock } from 'lucide-react';
import AIStar from '../Icons/AIStar';
import { useAuroraPulse } from '../../hooks/useAuroraPulse';
import { SCOPE_META, timeAgo } from './aiActions';

// Feed de análisis ya generados (cache de ai_insights). Leerlo no consume IA.
// Al tocar un item se abre el detalle de esa acción con su resultado guardado.
// `bare`: sin tarjeta/glows propios — para cuando vive dentro de otro panel
// que ya pone el cristal (p. ej. compartiendo tarjeta con el orbe).
export default function RecentInsights({ insights, patientNames = {}, loading, onSelect, onReload, bare = false }) {
    const [filter, setFilter] = useState('');
    const { className: auroraClass, pulse: pulseAurora } = useAuroraPulse();

    useEffect(() => { if (!loading) pulseAurora(4200); }, [loading, pulseAurora]);

    const term = filter.trim().toLowerCase();
    const filtered = term
        ? insights.filter(i => {
            const meta = SCOPE_META[i.scope];
            const title = i.content?.title || '';
            return (meta?.title || i.scope).toLowerCase().includes(term) || title.toLowerCase().includes(term);
        })
        : insights;

    // En modo bare, el padre ya pone el padding de la tarjeta — usar menos
    // margen propio para que no se sienta como "otro panel" pegado al lado.
    const body = (
        <>
            {/* Header */}
            <div className={`relative z-10 flex items-center gap-2.5 ${bare ? 'pb-2' : 'px-5 pt-5 pb-3'}`}>
                <div className="w-8 h-8 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                    <Clock size={14} className="text-navy-900" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-[12px] font-bold text-navy-900 tracking-tight leading-none">Actividad reciente</h3>
                    <p className="text-[9px] font-bold text-navy-900/40 mt-1 leading-none">Análisis guardados · verlos es gratis</p>
                </div>
                <button
                    onClick={onReload}
                    title="Actualizar"
                    className="w-7 h-7 rounded-full bg-white/40 border border-white/60 flex items-center justify-center text-navy-700/60 hover:text-navy-900 hover:bg-white/70 transition-colors shadow-sm shrink-0"
                >
                    <RefreshCw size={12} />
                </button>
            </div>

            {/* Lista */}
            <div className={`relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-2 ${bare ? '-mx-1.5 px-1.5' : 'px-3'}`}>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-5 h-5 border-2 border-navy-900/20 border-t-navy-900/60 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <div className="w-11 h-11 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mb-2.5">
                            <AIStar size={16} className="text-navy-700/50" />
                        </div>
                        <p className="text-[11px] font-semibold text-navy-700/50 max-w-[200px]">
                            {insights.length === 0
                                ? 'Aún no has generado análisis. Empieza con una de las acciones.'
                                : 'Sin coincidencias para tu búsqueda.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5 py-1">
                        {filtered.map((item, i) => {
                            const meta = SCOPE_META[item.scope];
                            const Icon = meta?.icon || AIStar;
                            // Los scopes por cliente nunca deben mostrarse "a secas" —
                            // sin el nombre, dos análisis distintos son indistinguibles.
                            const clientName = meta?.needsPatient ? (patientNames[item.ref_id] || 'Cliente') : null;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onSelect(item)}
                                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-2xl text-left border border-transparent hover:bg-white/50 hover:border-white/60 hover:shadow-sm transition-all duration-300 animate-fade-up"
                                    style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
                                >
                                    <div className="w-8 h-8 rounded-xl bg-white/60 border border-white/70 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                                        <Icon size={14} className="text-navy-900" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11.5px] font-bold text-navy-900 leading-snug line-clamp-2">
                                            {item.content?.title || meta?.title || item.scope}
                                        </p>
                                        <p className="text-[9px] font-bold text-navy-900/35 mt-0.5 truncate">
                                            {meta?.title || item.scope}{clientName && <> · {clientName}</>} · {timeAgo(item.generated_at)}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Buscador */}
            <div className={`relative z-10 pt-2 shrink-0 ${bare ? '' : 'px-4 pb-4'}`}>
                <div className="relative">
                    <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-700/40 pointer-events-none" />
                    <input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Buscar un análisis..."
                        className="w-full bg-white/50 border border-white/60 rounded-full pl-8 pr-3 py-2 text-[11px] font-semibold text-navy-900 outline-none focus:bg-white/70 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                    />
                </div>
            </div>
        </>
    );

    if (bare) {
        return <div className="relative h-full flex flex-col min-h-0">{body}</div>;
    }

    return (
        <div className={`ai-aurora rounded-[24px] h-full flex min-h-0 ${auroraClass}`}>
            <div className="relative flex-1 min-w-0 flex flex-col min-h-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden">
                <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                {body}
            </div>
        </div>
    );
}
