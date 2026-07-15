import { useState, useRef, useEffect } from 'react';
import { Send, Lock, X } from 'lucide-react';
import AIStar from '../components/Icons/AIStar';
import AIOrb from '../components/ui/AIOrb';
import FeatureLock from '../components/FeatureLock';
import InsightDrawer from '../components/AIHub/InsightDrawer';
import RecentInsights from '../components/AIHub/RecentInsights';
import { AI_ACTIONS, SCOPE_META, timeAgo } from '../components/AIHub/aiActions';
import { useAIInsights } from '../hooks/useAIInsights';
import { useAIChat } from '../hooks/useAIChat';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useAuth } from '../hooks/useAuth';
import { useAuroraPulse } from '../hooks/useAuroraPulse';
import { useAppStore } from '../store/useAppStore';

// Centro IA — módulo IA del sistema (doc "Automatización Agente IA" · Parte B).
// 3 paneles independientes (20/50/30), cada uno su propia tarjeta de cristal:
//   Actividad reciente · Orbe + acciones IA · Chat de negocio.
// La configuración del asistente y el listado de "IA pausada" salieron de acá
// (irán a un submódulo propio más adelante, dentro de IA — pendiente).
// Cache-first: la UI lee de ai_insights (0 tokens); solo Generar/Regenerar y
// el chat invocan la IA.

const HOURS_AGO = (h) => new Date(Date.now() - h * 3600_000).toISOString();

// Muestra para el fondo difuminado del FeatureLock (plan sin Enterprise)
const MOCK_INSIGHTS = [
    { id: 'm1', scope: 'weekly_digest', ref_id: null, content: { title: 'Semana estable: ingresos +8% y menos ausencias' }, generated_at: HOURS_AGO(2) },
    { id: 'm2', scope: 'retention', ref_id: null, content: { title: '4 clientes en riesgo de abandono este mes' }, generated_at: HOURS_AGO(26) },
    { id: 'm3', scope: 'kpi_narrative', ref_id: null, content: { title: 'El martes es tu día más fuerte: 32% de los turnos' }, generated_at: HOURS_AGO(50) },
    { id: 'm4', scope: 'content_offer', ref_id: null, content: { title: 'Promo sugerida: 2x1 en limpieza para los jueves' }, generated_at: HOURS_AGO(120) },
];

function ActionCard({ action, cachedAt, locked, onClick, index }) {
    const Icon = action.icon;
    return (
        <button
            onClick={onClick}
            className="group relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-md p-3.5 text-left hover:bg-white/60 hover:-translate-y-0.5 transition-all duration-300 animate-fade-up flex flex-col gap-2"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />

            <div className="relative z-10 flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shadow-inner">
                    <Icon size={14} className="text-navy-900" />
                </div>
                {locked ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[7px] font-bold uppercase tracking-widest text-navy-900/40">
                        <Lock size={7} strokeWidth={3} /> Enterprise
                    </span>
                ) : cachedAt ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[7px] font-bold uppercase tracking-widest text-emerald-700/80">
                        {timeAgo(cachedAt)}
                    </span>
                ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[7px] font-bold uppercase tracking-widest text-navy-900/30">
                        {action.mode}
                    </span>
                )}
            </div>
            <div className="relative z-10">
                <p className="text-[12px] font-semibold text-navy-900 tracking-tight leading-none">{action.title}</p>
                <p className="text-[10px] font-semibold text-navy-700/55 leading-snug mt-1.5 line-clamp-2">{action.desc}</p>
            </div>
        </button>
    );
}

function timeShort(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Barra de consumo IA (chat + generación de reportes) — reemplaza al botón
// "Limpiar", siempre visible (sin esconderla detrás de un clic). Degradado
// azul→morado tomado directo de los glows del sistema (rgba(64,98,200) /
// rgba(120,110,230)), a opacidad plena para que se note bien.
// Solo UI por ahora: el % es de muestra hasta que exista un límite real de
// tokens configurado para planes Pro/Enterprise.
function UsageBar({ percent = 0 }) {
    const pct = Math.min(100, Math.max(0, percent));
    return (
        <div className="flex items-center gap-2" title={`${pct}% del consumo IA de este mes (chat y reportes)`}>
            <div className="w-20 h-2 rounded-full bg-navy-900/10 overflow-hidden shrink-0">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgba(64,98,200,1), rgba(120,110,230,1))' }}
                />
            </div>
            <span className="text-[9px] font-bold text-navy-900/50 tabular-nums">{pct}%</span>
        </div>
    );
}

// Panel 3 (30%) — Chat de negocio, tarjeta independiente. Burbujas con el
// mismo estilo que Conversaciones (cristal bg-white/50, esquina recortada del
// lado de quien habla).
function ChatPanel({ mock, question, setQuestion, messages, asking, onRemove, onSubmit }) {
    const { className: auroraClass, pulse: pulseAurora } = useAuroraPulse();
    useEffect(() => { if (!mock) pulseAurora(4200); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // scrollIntoView arrastra CUALQUIER ancestro con scroll (bug ya visto en
    // Conversaciones) — se hace scroll manual del contenedor de mensajes.
    const scrollRef = useRef(null);
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, asking]);

    return (
        <div className={`ai-aurora rounded-[24px] flex-[3] min-w-0 flex min-h-0 ${auroraClass}`}>
            <div className="relative flex-1 min-w-0 flex flex-col min-h-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden">
                <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

                <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-navy-900 tracking-tight">
                        <AIStar size={12} /> Chat de negocio
                    </span>
                    {!mock && <UsageBar percent={42} />}
                </div>

                <div ref={scrollRef} className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 space-y-3">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-2">
                            <div className="w-10 h-10 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mb-2.5">
                                <AIStar size={16} className="text-navy-700/50" />
                            </div>
                            <p className="text-[11px] font-semibold text-navy-700/50 max-w-[180px]">
                                Pregúntame sobre tu negocio y te respondo con tus datos reales.
                            </p>
                        </div>
                    ) : (
                        messages.map((m, i) => {
                            const isOut = m.role === 'user';
                            return (
                                <div key={m.id ?? i} className={`group/msg flex w-full items-start gap-1.5 ${isOut ? 'justify-end' : 'justify-start'}`}>
                                    {isOut && m.id != null && (
                                        <button
                                            onClick={() => onRemove(m.id)}
                                            title="Borrar mensaje"
                                            className="mt-1.5 opacity-0 group-hover/msg:opacity-100 transition-opacity w-5 h-5 rounded-full bg-white/60 border border-white/70 flex items-center justify-center text-navy-700/50 hover:text-rose-600 hover:border-rose-200 shrink-0"
                                        >
                                            <X size={10} />
                                        </button>
                                    )}
                                    <div className={`max-w-[88%] relative overflow-hidden px-4 py-2.5 text-[12px] leading-relaxed font-medium shadow-sm rounded-[20px] ${isOut ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'} ${m.error
                                        ? 'bg-amber-50 border border-amber-100 text-amber-700'
                                        : 'bg-white/50 border border-white/60 text-navy-900'
                                        }`}>
                                        <p className="whitespace-pre-wrap">{m.text}</p>
                                        <div className={`text-[8px] uppercase font-bold tracking-widest mt-1.5 flex items-center gap-1 text-navy-900/40 ${isOut ? 'justify-end' : ''}`}>
                                            {isOut && <span>Tú</span>}
                                            {!isOut && !m.error && <span>IA</span>}
                                            <span>{timeShort(m.created_at)}</span>
                                        </div>
                                    </div>
                                    {!isOut && m.id != null && (
                                        <button
                                            onClick={() => onRemove(m.id)}
                                            title="Borrar mensaje"
                                            className="mt-1.5 opacity-0 group-hover/msg:opacity-100 transition-opacity w-5 h-5 rounded-full bg-white/60 border border-white/70 flex items-center justify-center text-navy-700/50 hover:text-rose-600 hover:border-rose-200 shrink-0"
                                        >
                                            <X size={10} />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                    {asking && (
                        <div className="flex justify-start">
                            <div className="bg-white/50 border border-white/60 rounded-[20px] rounded-bl-[4px] px-4 py-2.5 shadow-sm flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={onSubmit} className="relative z-10 shrink-0 px-5 pt-3 pb-5">
                    <div className="relative flex items-center gap-2 bg-white/50 border border-white/60 rounded-full pl-4 pr-1.5 py-1.5 shadow-md focus-within:bg-white/70 focus-within:ring-1 focus-within:ring-white transition-all">
                        <AIStar size={14} className="text-navy-900/50 shrink-0" />
                        <input
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            disabled={mock || asking}
                            placeholder="Pregúntale a tu negocio..."
                            className="flex-1 min-w-0 bg-transparent text-[12px] font-semibold text-navy-900 outline-none placeholder-navy-700/40 disabled:cursor-not-allowed"
                        />
                        <button
                            type="submit"
                            disabled={mock || asking || !question.trim()}
                            title="Enviar pregunta"
                            className="w-8 h-8 rounded-full bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card hover:bg-navy-800 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                            <Send size={13} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Panel 2 (50%) — Orbe + bienvenida + tarjetas de acción IA, tarjeta independiente.
// Todo el contenido (orbe + fichas) centrado horizontal Y verticalmente.
function InsightsPanel({ mock, feed, hasFeature, onOpenAction, firstName }) {
    const { className: auroraClass, pulse: pulseAurora } = useAuroraPulse();
    useEffect(() => { if (!mock) pulseAurora(4200); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className={`ai-aurora rounded-[24px] flex-[5] min-w-0 flex min-h-0 ${auroraClass}`}>
            <div className="relative flex-1 min-w-0 flex flex-col min-h-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden">
                <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

                <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 flex flex-col items-center justify-center gap-4">
                    <div className="shrink-0 flex flex-col items-center text-center">
                        <div className="relative w-[440px] max-w-full h-[300px] -mb-2">
                            {mock ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-20 h-20 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center">
                                        <AIStar size={30} className="text-navy-900/50" />
                                    </div>
                                </div>
                            ) : (
                                <AIOrb className="absolute inset-0 w-full h-full pointer-events-none [mask-image:radial-gradient(ellipse_at_center,#000_55%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,#000_55%,transparent_100%)]" />
                            )}
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-navy-900 tracking-tight leading-none">
                            {firstName ? `Hola, ${firstName}` : 'Hola'}
                        </h2>
                        <p className="text-[9.5px] font-semibold text-navy-700/55 mt-1 max-w-md leading-none whitespace-nowrap">
                            Análisis y estrategias de tu negocio, verlos después no gasta IA
                        </p>
                    </div>

                    <div className="shrink-0 w-full max-w-[720px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {AI_ACTIONS.map((action, i) => (
                            <ActionCard
                                key={action.scope}
                                action={action}
                                index={i}
                                locked={!mock && action.feature && !hasFeature(action.feature)}
                                cachedAt={feed.find(x => x.scope === action.scope)?.generated_at || null}
                                onClick={() => onOpenAction(action)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AIHub() {
    const { hasFeature, plan } = usePlanLimits();
    const { profile } = useAuth();
    const openPlans = useAppStore(s => s.openPlans);
    const unlocked = hasFeature('stats_intelligence');
    const mock = !unlocked;

    const { insights, loading, generate, reload } = useAIInsights(unlocked);
    const feed = unlocked ? insights : MOCK_INSIGHTS;

    const [question, setQuestion] = useState('');
    const { messages, sending: asking, send, remove } = useAIChat(unlocked);

    const firstName = profile?.full_name?.trim().split(/\s+/)[0] || '';

    // Drawer de detalle: { action, refId } o null
    const [drawer, setDrawer] = useState(null);
    function openDrawer(action, refId) { setDrawer({ action, refId }); }
    function openFromActivity(item) {
        const meta = SCOPE_META[item.scope];
        if (!meta) return;
        setDrawer({ action: meta, refId: item.ref_id || null });
    }

    function openAction(action) {
        if (mock) return;
        if (action.feature && !hasFeature(action.feature)) { openPlans(); return; }
        openDrawer(action, null);
    }

    async function handleAsk(e) {
        e.preventDefault();
        const q = question.trim();
        if (!q || asking || mock) return;
        setQuestion('');
        await send(q);
    }

    const panels = (
        <div className="flex flex-col lg:flex-row gap-4 lg:h-full items-stretch w-full">
            <div className="flex-[2] min-w-0 min-h-[320px] lg:min-h-0">
                <RecentInsights
                    insights={feed}
                    loading={mock ? false : loading}
                    onSelect={mock ? () => { } : openFromActivity}
                    onReload={mock ? () => { } : reload}
                />
            </div>
            <InsightsPanel mock={mock} feed={feed} hasFeature={hasFeature} onOpenAction={openAction} firstName={firstName} />
            <ChatPanel
                mock={mock}
                question={question}
                setQuestion={setQuestion}
                messages={messages}
                asking={asking}
                onRemove={remove}
                onSubmit={handleAsk}
            />
        </div>
    );

    return (
        <div className="h-full flex flex-col w-full px-2">
            <div className="flex items-end justify-between gap-3 mb-4 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Centro IA</h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Análisis, estrategias y chat sobre tu negocio</p>
                </div>
                {unlocked && plan === 'enterprise' && (
                    <span className="text-[10px] font-bold px-3 py-1.5 rounded-full border shrink-0 bg-violet-50 text-violet-700 border-violet-200">
                        Plan Enterprise
                    </span>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar pb-4">
                <div className="flex flex-col h-full items-stretch px-1 py-1">
                    {unlocked ? panels : (
                        <div className="flex-1 min-w-0 flex min-h-[600px]">
                            <FeatureLock
                                feature="stats_intelligence"
                                variant="blurred"
                                title="Centro IA"
                                description="Resúmenes, estrategias y análisis inteligentes de tu negocio, disponibles en plan Enterprise."
                                requiredPlan="Enterprise"
                            >
                                {panels}
                            </FeatureLock>
                        </div>
                    )}

                    {drawer && (
                        <InsightDrawer
                            action={drawer.action}
                            initialRefId={drawer.refId}
                            onGenerate={generate}
                            onClose={() => setDrawer(null)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
