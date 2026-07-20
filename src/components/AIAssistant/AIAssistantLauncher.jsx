import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Lock, ArrowRight } from 'lucide-react';
import AIStar from '../Icons/AIStar';
import { AI_ACTIONS, timeAgo, usageColor } from '../AIHub/aiActions';
import { useAIChat } from '../../hooks/useAIChat';
import { useAIUsage } from '../../hooks/useAIUsage';
import { useAIInsights } from '../../hooks/useAIInsights';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import { usePermissions } from '../../hooks/usePermissions';
import { useAppStore } from '../../store/useAppStore';
import { generateAIInsight } from '../../services/supabaseService';

// Lazy: el drawer ya es un chunk compartido con AIHub/PatientDrawer — cargarlo
// solo al abrir una acción evita meterlo en el bundle principal vía Topbar.
const InsightDrawer = lazy(() => import('../AIHub/InsightDrawer'));

// Asistente IA global — la IA "a la mano" en todo el sistema (pedido 2026-07-17):
// un botón en el Topbar (mismo lenguaje que la campana de notificaciones) que
// abre un panel con (1) las acciones del Centro IA relevantes al módulo activo,
// (2) el resto de análisis a un toque, y (3) el chat de negocio. Reusa TODO el
// stack del Centro IA (InsightDrawer, useAIChat, useAIUsage, cache-first) — no
// duplica lógica de generación. Se oculta dentro del Centro IA (/ai), que ya
// es la experiencia completa.

// Qué acciones proponer primero según el módulo activo. `match` se evalúa en
// orden; la primera que calce gana. Los scopes no listados quedan en la fila
// "Más análisis" para que la IA completa esté disponible desde cualquier lado.
const MODULE_CONTEXT = [
    { match: p => p.startsWith('/patients'), name: 'Clientes', scopes: ['patient_summary', 'patient_strategy'] },
    { match: p => p.startsWith('/followup'), name: 'Seguimiento', scopes: ['retention', 'patient_strategy'] },
    { match: p => p.startsWith('/conversations'), name: 'Conversaciones', scopes: ['patient_summary', 'patient_strategy'] },
    { match: p => p.startsWith('/stats'), name: 'Estadísticas', scopes: ['kpi_narrative', 'retention'] },
    { match: p => p.startsWith('/offers'), name: 'Ofertas', scopes: ['content_offer', 'kpi_narrative'] },
    { match: p => p.startsWith('/finance'), name: 'Finanzas', scopes: ['finance_narrative', 'kpi_narrative'] },
    { match: p => p === '/', name: 'Agenda', scopes: ['agenda_narrative', 'weekly_digest'] },
];
const DEFAULT_CONTEXT = { name: null, scopes: ['weekly_digest', 'kpi_narrative'] };

function contextFor(pathname) {
    return MODULE_CONTEXT.find(c => c.match(pathname)) ?? DEFAULT_CONTEXT;
}

function fmtTokens(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
}

function UsageBar({ usage }) {
    const { pct, usedTokens, limitTokens } = usage;
    const title = limitTokens > 0
        ? `${fmtTokens(usedTokens)} de ${fmtTokens(limitTokens)} tokens esta semana · se reinicia el lunes`
        : 'Consumo IA de la semana (chat y reportes)';
    return (
        <div className="flex items-center gap-1.5" title={title}>
            <div className="w-14 h-1.5 rounded-full bg-navy-900/10 overflow-hidden shrink-0">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: usageColor(pct) }}
                />
            </div>
            <span className="text-[8px] font-bold text-navy-900/50 tabular-nums">{pct}%</span>
        </div>
    );
}

// Tarjeta grande de acción contextual (las 1-2 sugeridas para el módulo activo).
// Incluye la descripción de la acción: sin ella el card queda con un hueco
// vacío entre el título y la etiqueta de estado (mode/cachedAt).
function ContextActionCard({ action, cachedAt, locked, onClick }) {
    const Icon = action.icon;
    return (
        <button
            onClick={onClick}
            className="group relative overflow-hidden flex items-start gap-2.5 bg-white/50 border border-white/60 rounded-2xl px-3 py-2.5 text-left shadow-sm hover:bg-white/70 hover:-translate-y-px transition-all duration-300"
        >
            <div className="w-8 h-8 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                <Icon size={14} className="text-navy-900" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-navy-900 leading-tight truncate">{action.title}</p>
                <p className="text-[9.5px] font-semibold text-navy-700/55 leading-snug mt-0.5 line-clamp-2">{action.desc}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                    {locked ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[7px] font-bold tracking-widest text-navy-900/40 shrink-0">
                            <Lock size={7} strokeWidth={3} /> Enterprise
                        </span>
                    ) : cachedAt ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[7px] font-bold tracking-widest text-emerald-700/80 shrink-0">
                            {timeAgo(cachedAt)}
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[7px] font-bold tracking-widest text-navy-900/30 shrink-0">
                            {action.mode}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

function timeShort(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Contenido del panel — se monta solo con el panel abierto, así los hooks de
// datos (chat, usage, cache de insights) no gastan queries en cada página.
function AssistantPanel({ moduleCtx, hasFeature, onLaunchAction, onOpenHub }) {
    const { messages, sending, send } = useAIChat(true);
    const usage = useAIUsage(true);
    const { insights } = useAIInsights(true);
    const openPlans = useAppStore(s => s.openPlans);
    const [question, setQuestion] = useState('');

    // Scroll manual del contenedor (scrollIntoView arrastra ancestros con
    // overflow — bug ya visto en Conversaciones).
    const scrollRef = useRef(null);
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, sending]);

    const contextActions = moduleCtx.scopes
        .map(s => AI_ACTIONS.find(a => a.scope === s))
        .filter(Boolean);

    function cachedAt(scope) {
        return insights.find(i => i.scope === scope)?.generated_at || null;
    }

    function handleAction(action) {
        if (action.feature && !hasFeature(action.feature)) { openPlans(); return; }
        onLaunchAction(action);
    }

    async function handleAsk(e) {
        e.preventDefault();
        const q = question.trim();
        if (!q || sending || usage.blocked) return;
        setQuestion('');
        await send(q);
        usage.refresh();
    }

    return (
        <div className="relative z-10 flex flex-col min-h-0 max-h-[min(620px,calc(100vh-120px))]">
            {/* Header — título, acceso a Centro IA en medio, consumo semanal */}
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-navy-900 tracking-tight shrink-0">
                    <AIStar size={13} /> Asistente IA
                </span>
                <button
                    onClick={onOpenHub}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold text-navy-900/45 hover:text-navy-900 hover:bg-white/50 transition-all duration-300 shrink-0"
                >
                    Centro IA <ArrowRight size={10} />
                </button>
                <UsageBar usage={usage} />
            </div>

            {/* Acciones contextuales del módulo activo — solo las de este
                módulo; para el resto del análisis está el Centro IA completo. */}
            <div className="shrink-0 px-4">
                <p className="text-[8.5px] font-bold text-navy-900/40 tracking-widest mb-1.5">
                    {moduleCtx.name ? `Para ${moduleCtx.name}` : 'Sugerido'}
                </p>
                <div className={`grid gap-2 ${contextActions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {contextActions.map(action => (
                        <ContextActionCard
                            key={action.scope}
                            action={action}
                            cachedAt={cachedAt(action.scope)}
                            locked={action.feature && !hasFeature(action.feature)}
                            onClick={() => handleAction(action)}
                        />
                    ))}
                </div>
            </div>

            {/* Chat de negocio — mismo tratamiento de "sección propia" que las
                acciones de arriba (título + separación), para que quede claro
                dónde termina lo contextual y empieza el chat libre. */}
            <div className="shrink-0 px-4 mt-2.5">
                <p className="text-[8.5px] font-bold text-navy-900/40 tracking-widest mb-1.5">Chat de negocio</p>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-[160px] overflow-y-auto custom-scrollbar px-4 space-y-2.5">
                {messages.length === 0 ? (
                    <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-center px-2">
                        <div className="w-9 h-9 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mb-2">
                            <AIStar size={14} className="text-navy-700/50" />
                        </div>
                        <p className="text-[10.5px] font-semibold text-navy-700/50 max-w-[200px]">
                            Pregúntame sobre tu negocio y te respondo con tus datos reales.
                        </p>
                    </div>
                ) : (
                    messages.map((m, i) => {
                        const isOut = m.role === 'user';
                        return (
                            <div key={m.id ?? `tmp-${i}`} className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[88%] relative overflow-hidden px-3.5 py-2 text-[11.5px] leading-relaxed font-medium shadow-sm rounded-[18px] ${isOut ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'} ${m.error
                                    ? 'bg-amber-50 border border-amber-100 text-amber-700'
                                    : 'bg-white/50 border border-white/60 text-navy-900'
                                    }`}>
                                    <p className="whitespace-pre-wrap">{m.text}</p>
                                    <div className={`text-[7.5px] font-bold tracking-widest mt-1 flex items-center gap-1 text-navy-900/40 ${isOut ? 'justify-end' : ''}`}>
                                        {isOut ? <span>Tú</span> : !m.error && <span>IA</span>}
                                        <span>{timeShort(m.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                {sending && (
                    <div className="flex justify-start">
                        <div className="bg-white/50 border border-white/60 rounded-[18px] rounded-bl-[4px] px-3.5 py-2 shadow-sm flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleAsk} className="shrink-0 px-4 pt-2.5 pb-3.5">
                <div className="relative flex items-center gap-2 bg-white/50 border border-white/60 rounded-full pl-3.5 pr-1 py-1 shadow-md focus-within:bg-white/70 focus-within:ring-1 focus-within:ring-white transition-all">
                    <AIStar size={12} className="text-navy-900/50 shrink-0" />
                    <input
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        disabled={sending || usage.blocked}
                        placeholder={usage.blocked ? 'Límite semanal de IA alcanzado · vuelve el lunes' : 'Pregúntale a tu negocio...'}
                        className="flex-1 min-w-0 bg-transparent text-[11.5px] font-semibold text-navy-900 outline-none placeholder-navy-700/40 disabled:cursor-not-allowed"
                    />
                    <button
                        type="submit"
                        disabled={sending || usage.blocked || !question.trim()}
                        title={usage.blocked ? 'Límite semanal de IA alcanzado' : 'Enviar pregunta'}
                        className="w-7 h-7 rounded-full bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card hover:bg-navy-800 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        <Send size={12} />
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function AIAssistantLauncher() {
    const location = useLocation();
    const navigate = useNavigate();
    const { hasFeature, isLoading } = usePlanLimits();
    const { canViewStats, canManageRoles } = usePermissions();
    const openPlans = useAppStore(s => s.openPlans);

    const [open, setOpen] = useState(false);
    // Acción lanzada al InsightDrawer — vive aquí (no en el panel) para que el
    // drawer sobreviva al cierre del panel.
    const [drawerAction, setDrawerAction] = useState(null);
    const panelRef = useRef(null);

    // Cerrar con click afuera / Escape / cambio de ruta.
    useEffect(() => {
        if (!open) return;
        function onClickOutside(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        }
        function onKey(e) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onClickOutside);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
    useEffect(() => { setOpen(false); }, [location.pathname]);

    // Dentro del Centro IA el asistente sobra (ahí está la experiencia completa).
    if (location.pathname === '/ai') return null;
    // Misma visibilidad que la ruta /ai; sin flash mientras carga el plan.
    if (isLoading || !(canViewStats || canManageRoles)) return null;

    const unlocked = hasFeature('stats_intelligence');
    const moduleCtx = contextFor(location.pathname);

    function handleButtonClick() {
        if (!unlocked) { openPlans(); return; }
        setOpen(o => !o);
    }

    return (
        <>
            <div className="relative" ref={panelRef}>
                <div className="relative flex items-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full shadow-md p-1 h-11">
                    <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl" style={{ background: 'rgba(64,98,200,0.08)' }} />
                        <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl" style={{ background: 'rgba(120,110,230,0.08)' }} />
                    </div>
                    <button
                        onClick={handleButtonClick}
                        title={unlocked ? 'Asistente IA' : 'Asistente IA · disponible desde el plan Pro'}
                        aria-label="Asistente IA"
                        className="relative z-10 w-9 h-9 rounded-full bg-white/60 backdrop-blur-sm border border-white/80 hover:bg-white/80 shadow-md hover:scale-[1.02] transition-all flex items-center justify-center text-navy-900"
                    >
                        <AIStar size={16} />
                        {unlocked ? (
                            <span
                                className="absolute -top-0.5 -right-0.5 z-20 w-2 h-2 rounded-full ring-2 ring-white"
                                style={{ background: 'linear-gradient(135deg, rgba(64,98,200,1), rgba(120,110,230,1))' }}
                            />
                        ) : (
                            <span className="absolute -top-1 -right-1 z-20 w-4 h-4 rounded-full bg-navy-900 ring-2 ring-white flex items-center justify-center">
                                <Lock size={8} strokeWidth={3} className="text-white" />
                            </span>
                        )}
                    </button>
                </div>

                {open && unlocked && (
                    <div className="fixed md:absolute top-[64px] md:top-14 left-2 right-2 md:left-auto md:right-0 md:w-[420px] bg-white/90 md:bg-white/40 backdrop-blur-2xl rounded-[24px] shadow-md border border-white/60 animate-fade-up z-[110] overflow-hidden">
                        <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                        <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                        <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                        <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                        <AssistantPanel
                            moduleCtx={moduleCtx}
                            hasFeature={hasFeature}
                            onLaunchAction={(action) => { setDrawerAction(action); setOpen(false); }}
                            onOpenHub={() => { setOpen(false); navigate('/ai'); }}
                        />
                    </div>
                )}
            </div>

            {/* El drawer vive en un portal a body (los ancestros del Topbar tienen
                overflow-hidden) y sobrevive al cierre del panel. */}
            {drawerAction && createPortal(
                <Suspense fallback={null}>
                    <InsightDrawer
                        action={drawerAction}
                        onGenerate={generateAIInsight}
                        onClose={() => setDrawerAction(null)}
                    />
                </Suspense>,
                document.body
            )}
        </>
    );
}
