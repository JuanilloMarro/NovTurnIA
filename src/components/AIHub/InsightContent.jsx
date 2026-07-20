import { useState } from 'react';
import { Copy, Check, MessageCircle, TrendingUp, AlertTriangle, PartyPopper, Target, Sparkles, Clock } from 'lucide-react';

// Renderiza el `content` jsonb de ai_insights con el schema exacto de cada
// scope (doc "Automatización Agente IA" · Parte B §B.2 — responseSchema de
// Gemini, no texto libre). Cualquier forma que no calce con lo esperado del
// scope cae a un volcado clave→valor legible, para no perder información
// mientras el backend real todavía no existe.

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={() => {
                navigator.clipboard?.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                }).catch(() => {});
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/50 border border-white/60 text-[9px] font-bold text-navy-700 hover:bg-white/80 transition-all duration-300 shadow-sm shrink-0"
        >
            {copied ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
            {copied ? 'Copiado' : 'Copiar'}
        </button>
    );
}

function Label({ children }) {
    return <p className="text-[9px] font-bold text-navy-900/40 tracking-widest mb-1.5">{children}</p>;
}

function Body({ children }) {
    return <p className="text-[12px] font-semibold text-navy-900/80 leading-relaxed whitespace-pre-line">{children}</p>;
}

function WhatsappDraft({ text }) {
    if (!text) return null;
    return (
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2">
                <p className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700/70 tracking-widest">
                    <MessageCircle size={11} /> Borrador de WhatsApp
                </p>
                <CopyButton text={text} />
            </div>
            <p className="text-[11.5px] font-semibold text-navy-900/80 leading-relaxed whitespace-pre-line">{text}</p>
            <p className="text-[9px] font-bold text-navy-900/30 mt-2">No se envía solo: tú decides si usarlo.</p>
        </div>
    );
}

// ── 1) patient_summary: { resumen, estado, siguiente_accion } ──────────────
const ESTADO_META = {
    activo:     { label: 'Activo',       cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' },
    en_riesgo:  { label: 'En riesgo',    cls: 'bg-amber-500/10 border-amber-500/20 text-amber-700' },
    inactivo:   { label: 'Inactivo',     cls: 'bg-navy-900/5 border-navy-900/10 text-navy-900/50' },
    nuevo:      { label: 'Nuevo',        cls: 'bg-blue-500/10 border-blue-500/20 text-blue-700' },
};

function PatientSummary({ content }) {
    const { resumen, estado, siguiente_accion } = content;
    const meta = ESTADO_META[estado];
    return (
        <div className="space-y-4">
            {meta && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[9px] font-bold tracking-widest ${meta.cls}`}>
                    {meta.label}
                </span>
            )}
            {resumen && <Body>{resumen}</Body>}
            {siguiente_accion && (
                <div className="bg-navy-900/3 border border-navy-900/5 rounded-2xl px-3.5 py-3">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold text-navy-900/40 tracking-widest mb-1.5">
                        <Target size={11} /> Siguiente acción
                    </p>
                    <p className="text-[11.5px] font-bold text-navy-900 leading-relaxed">{siguiente_accion}</p>
                </div>
            )}
        </div>
    );
}

// ── 2) patient_strategy: { accion, razon, borrador_whatsapp } ──────────────
function PatientStrategy({ content }) {
    const { accion, razon, borrador_whatsapp } = content;
    return (
        <div className="space-y-4">
            {accion && <h4 className="text-[14px] font-bold text-navy-900 tracking-tight leading-snug">{accion}</h4>}
            {razon && <Body>{razon}</Body>}
            <WhatsappDraft text={borrador_whatsapp} />
        </div>
    );
}

// ── 3) retention: { tasa_retencion, prioridades:[{nombre,razon,sugerencia}], insight_general } ──
function Retention({ content }) {
    const { tasa_retencion, prioridades, insight_general } = content;
    return (
        <div className="space-y-4">
            {typeof tasa_retencion === 'number' && (
                <div className="flex items-center gap-3 bg-navy-900/3 border border-navy-900/5 rounded-2xl px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-white/60 border border-white/70 flex items-center justify-center shrink-0 shadow-sm">
                        <TrendingUp size={16} className="text-navy-900" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-navy-900/40 tracking-widest leading-none">Tasa de retención</p>
                        <p className="text-[18px] font-bold text-navy-900 tracking-tight leading-none mt-1">{tasa_retencion}%</p>
                    </div>
                </div>
            )}

            {Array.isArray(prioridades) && prioridades.length > 0 && (
                <div>
                    <Label>A quién contactar primero</Label>
                    <ul className="space-y-2">
                        {prioridades.map((p, i) => (
                            <li key={i} className="bg-navy-900/3 border border-navy-900/5 rounded-2xl px-3.5 py-2.5">
                                <div className="flex items-start gap-2.5">
                                    <span className="w-4 h-4 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-[8px] font-bold text-navy-800 shrink-0 mt-0.5">{i + 1}</span>
                                    <div className="min-w-0">
                                        <p className="text-[11.5px] font-bold text-navy-900 leading-relaxed">{p.nombre}</p>
                                        {p.razon && <p className="text-[10.5px] font-semibold text-navy-700/60 leading-relaxed mt-0.5">{p.razon}</p>}
                                        {p.sugerencia && (
                                            <p className="text-[10.5px] font-semibold text-emerald-700/80 leading-relaxed mt-1 flex items-start gap-1">
                                                <Sparkles size={10} className="shrink-0 mt-0.5" /> {p.sugerencia}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {insight_general && <Body>{insight_general}</Body>}
        </div>
    );
}

// ── 4) kpi_narrative: { titular, analisis, recomendaciones:[string] } ──────
function KpiNarrative({ content }) {
    const { titular, analisis, recomendaciones } = content;
    return (
        <div className="space-y-4">
            {titular && <h4 className="text-[14px] font-bold text-navy-900 tracking-tight leading-snug">{titular}</h4>}
            {analisis && <Body>{analisis}</Body>}
            {Array.isArray(recomendaciones) && recomendaciones.length > 0 && (
                <div>
                    <Label>Recomendaciones</Label>
                    <ul className="space-y-2">
                        {recomendaciones.map((r, i) => (
                            <li key={i} className="flex items-start gap-2.5 bg-navy-900/3 border border-navy-900/5 rounded-2xl px-3.5 py-2.5">
                                <span className="w-4 h-4 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-[8px] font-bold text-navy-800 shrink-0 mt-0.5">{i + 1}</span>
                                <p className="text-[11.5px] font-bold text-navy-900 leading-relaxed">{r}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ── 5) weekly_digest: { semana, resumen, wins:[], alertas:[], foco_siguiente_semana } ──
function BadgeList({ items, icon: Icon, cls }) {
    return (
        <ul className="space-y-1.5">
            {items.map((item, i) => (
                <li key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 border text-[11px] font-semibold leading-relaxed ${cls}`}>
                    <Icon size={12} className="shrink-0 mt-0.5" /> {item}
                </li>
            ))}
        </ul>
    );
}

function WeeklyDigest({ content }) {
    const { semana, resumen, wins, alertas, foco_siguiente_semana } = content;
    return (
        <div className="space-y-4">
            {semana && (
                <span className="inline-block px-2.5 py-1 rounded-full bg-navy-900/5 border border-navy-900/10 text-[9px] font-bold tracking-widest text-navy-900/40">
                    {semana}
                </span>
            )}
            {resumen && <Body>{resumen}</Body>}
            {Array.isArray(wins) && wins.length > 0 && (
                <div>
                    <Label>Lo que salió bien</Label>
                    <BadgeList items={wins} icon={PartyPopper} cls="bg-emerald-500/5 border-emerald-500/15 text-emerald-800" />
                </div>
            )}
            {Array.isArray(alertas) && alertas.length > 0 && (
                <div>
                    <Label>Para prestar atención</Label>
                    <BadgeList items={alertas} icon={AlertTriangle} cls="bg-amber-500/5 border-amber-500/15 text-amber-800" />
                </div>
            )}
            {foco_siguiente_semana && (
                <div className="bg-navy-900/3 border border-navy-900/5 rounded-2xl px-3.5 py-3">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold text-navy-900/40 tracking-widest mb-1.5">
                        <Target size={11} /> Foco de la próxima semana
                    </p>
                    <p className="text-[11.5px] font-bold text-navy-900 leading-relaxed">{foco_siguiente_semana}</p>
                </div>
            )}
        </div>
    );
}

// ── 6) content_offer: { promos:[{servicio, descuento_sugerido, dias, copy}] } ──
function ContentOffer({ content }) {
    const { promos } = content;
    if (!Array.isArray(promos) || promos.length === 0) return null;
    return (
        <div className="space-y-3">
            {promos.map((p, i) => (
                <div key={i} className="bg-navy-900/3 border border-navy-900/5 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-[11.5px] font-bold text-navy-900">{p.servicio}</p>
                        <div className="flex items-center gap-1.5">
                            {p.descuento_sugerido && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-700">
                                    {p.descuento_sugerido}
                                </span>
                            )}
                            {p.dias && (
                                <span className="px-2 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/10 text-[9px] font-bold text-navy-900/55 tracking-wider">
                                    {p.dias}
                                </span>
                            )}
                        </div>
                    </div>
                    {p.copy && (
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[10.5px] font-semibold text-navy-700/70 leading-relaxed whitespace-pre-line">{p.copy}</p>
                            <CopyButton text={p.copy} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ── Fallback genérico: forma desconocida o backend aún de prueba ───────────
function GenericFallback({ content }) {
    if (typeof content === 'string') return <Body>{content}</Body>;

    const title = content.title;
    const body = content.summary ?? content.text ?? content.body ?? content.narrative ?? null;
    const bullets = content.bullets ?? content.recommendations ?? content.actions ?? null;
    const draft = content.draft ?? content.whatsapp_draft ?? null;
    const hasKnown = title || body || (Array.isArray(bullets) && bullets.length) || draft;

    if (!hasKnown) {
        return (
            <div className="space-y-2">
                {Object.entries(content).map(([k, v]) => (
                    <div key={k} className="bg-navy-900/3 border border-navy-900/5 rounded-2xl px-3.5 py-2.5">
                        <Label>{k.replace(/_/g, ' ')}</Label>
                        <p className="text-[11.5px] font-semibold text-navy-900/80 leading-relaxed whitespace-pre-line">
                            {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                        </p>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {title && <h4 className="text-[14px] font-bold text-navy-900 tracking-tight leading-snug">{title}</h4>}
            {body && <Body>{body}</Body>}
            {Array.isArray(bullets) && bullets.length > 0 && (
                <div>
                    <Label>Recomendaciones</Label>
                    <ul className="space-y-2">
                        {bullets.map((item, i) => {
                            const label = typeof item === 'string' ? item : (item.label || item.title || '');
                            return (
                                <li key={i} className="flex items-start gap-2.5 bg-navy-900/3 border border-navy-900/5 rounded-2xl px-3.5 py-2.5">
                                    <span className="w-4 h-4 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-[8px] font-bold text-navy-800 shrink-0 mt-0.5">{i + 1}</span>
                                    <p className="text-[11.5px] font-bold text-navy-900 leading-relaxed">{label}</p>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            <WhatsappDraft text={draft} />
        </div>
    );
}

// ── 7) finance_narrative: { titular, salud, analisis, recomendaciones } ─────
const SALUD_META = {
    buena:    { label: 'Salud buena',        cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' },
    atencion: { label: 'Requiere atención',  cls: 'bg-amber-500/10 border-amber-500/20 text-amber-700' },
    critica:  { label: 'Situación crítica',  cls: 'bg-rose-500/10 border-rose-500/20 text-rose-600' },
};

function FinanceNarrative({ content }) {
    const { titular, salud, analisis, recomendaciones } = content;
    const meta = SALUD_META[salud];
    return (
        <div className="space-y-4">
            {meta && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[9px] font-bold tracking-widest ${meta.cls}`}>
                    {meta.label}
                </span>
            )}
            {titular && <h4 className="text-[14px] font-bold text-navy-900 tracking-tight leading-snug">{titular}</h4>}
            {analisis && <Body>{analisis}</Body>}
            {Array.isArray(recomendaciones) && recomendaciones.length > 0 && (
                <div>
                    <Label>Recomendaciones</Label>
                    <ul className="space-y-2">
                        {recomendaciones.map((r, i) => (
                            <li key={i} className="flex items-start gap-2.5 bg-navy-900/3 border border-navy-900/5 rounded-2xl px-3.5 py-2.5">
                                <span className="w-4 h-4 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-[8px] font-bold text-navy-800 shrink-0 mt-0.5">{i + 1}</span>
                                <p className="text-[11.5px] font-bold text-navy-900 leading-relaxed">{r}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ── 8) agenda_narrative: { titular, analisis, huecos:[], recomendaciones:[] } ──
function AgendaNarrative({ content }) {
    const { titular, analisis, huecos, recomendaciones } = content;
    return (
        <div className="space-y-4">
            {titular && <h4 className="text-[14px] font-bold text-navy-900 tracking-tight leading-snug">{titular}</h4>}
            {analisis && <Body>{analisis}</Body>}
            {Array.isArray(huecos) && huecos.length > 0 && (
                <div>
                    <Label>Huecos en la agenda</Label>
                    <BadgeList items={huecos} icon={Clock} cls="bg-blue-500/5 border-blue-500/15 text-blue-800" />
                </div>
            )}
            {Array.isArray(recomendaciones) && recomendaciones.length > 0 && (
                <div>
                    <Label>Recomendaciones</Label>
                    <ul className="space-y-2">
                        {recomendaciones.map((r, i) => (
                            <li key={i} className="flex items-start gap-2.5 bg-navy-900/3 border border-navy-900/5 rounded-2xl px-3.5 py-2.5">
                                <span className="w-4 h-4 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-[8px] font-bold text-navy-800 shrink-0 mt-0.5">{i + 1}</span>
                                <p className="text-[11.5px] font-bold text-navy-900 leading-relaxed">{r}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ── Insight incompleto: la generación vieja guardó { raw: "<texto cortado>" } ──
// (bug del 2026-07-14: el thinking de Gemini se comía el maxOutputTokens y la
// Edge Function cacheaba la salida truncada). El backend ya no guarda estas
// filas; esto cubre las históricas que sigan en cache.
function IncompleteInsight() {
    return (
        <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-2xl px-3.5 py-3">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
                <p className="text-[11.5px] font-bold text-amber-800 leading-relaxed">Este análisis quedó incompleto</p>
                <p className="text-[10.5px] font-semibold text-navy-700/60 leading-relaxed mt-0.5">
                    Vuelve a generarlo para obtener el resultado completo.
                </p>
            </div>
        </div>
    );
}

// Intenta rescatar el JSON de un `raw` guardado: parse directo → bloque
// ```json``` → substring del primer { al último }. null si nada parsea.
function salvageRaw(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const text = raw.trim();
    const candidates = [text];
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) candidates.push(fenced[1].trim());
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
    for (const c of candidates) {
        try {
            const parsed = JSON.parse(c);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch { /* siguiente candidato */ }
    }
    return null;
}

const SCOPE_RENDERERS = {
    patient_summary: PatientSummary,
    patient_strategy: PatientStrategy,
    retention: Retention,
    kpi_narrative: KpiNarrative,
    weekly_digest: WeeklyDigest,
    content_offer: ContentOffer,
    finance_narrative: FinanceNarrative,
    agenda_narrative: AgendaNarrative,
};

// Claves que identifican cada schema — si el content no trae ninguna de las
// suyas (backend de prueba, datos viejos), cae al fallback genérico en vez
// de renderizar un componente vacío.
const SCOPE_KEYS = {
    patient_summary: ['resumen', 'estado', 'siguiente_accion'],
    patient_strategy: ['accion', 'razon', 'borrador_whatsapp'],
    retention: ['tasa_retencion', 'prioridades', 'insight_general'],
    kpi_narrative: ['titular', 'analisis', 'recomendaciones'],
    weekly_digest: ['semana', 'resumen', 'wins', 'alertas', 'foco_siguiente_semana'],
    content_offer: ['promos'],
    finance_narrative: ['titular', 'salud', 'analisis', 'recomendaciones'],
    agenda_narrative: ['titular', 'analisis', 'huecos', 'recomendaciones'],
};

export default function InsightContent({ scope, content }) {
    if (content == null) return null;
    if (typeof content === 'string') return <Body>{content}</Body>;

    // Fila { raw } de una generación fallida: rescatar el JSON si se puede,
    // si no, estado claro de "incompleto" — nunca volcar el texto crudo.
    if (typeof content.raw === 'string' && Object.keys(content).length === 1) {
        const salvaged = salvageRaw(content.raw);
        if (!salvaged) return <IncompleteInsight />;
        content = salvaged;
    }

    const Renderer = SCOPE_RENDERERS[scope];
    const keys = SCOPE_KEYS[scope];
    const matchesSchema = Renderer && keys?.some(k => content[k] !== undefined);

    if (matchesSchema) return <Renderer content={content} />;
    return <GenericFallback content={content} />;
}
