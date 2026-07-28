// OutboundUsage.jsx — Consumo de mensajes SALIENTES del mes (F2 + F3)
// ═══════════════════════════════════════════════════════════════════════════
// Bolsa MENSUAL de mensajes salientes (bot de WhatsApp + respuestas del staff
// desde Conversaciones). Es una bolsa SEPARADA de los tokens semanales del
// Centro IA — no reutiliza ni se acopla al UsageBar de tokens de IA (AIHub).
//
// Fuente de verdad: get_plan_limits → usePlanLimits:
//   messagesOut            consumido este mes (solo salientes; B1)
//   maxMessagesOut         cupo del plan + paquetes extra
//   messagesOutEffective   greatest(cupo − consumido, 0)
//   messagesOutPct         % consumido
//   messagesResetsAt       1º del mes siguiente (reinicio del período mensual)
//
// El corte real (F1) vive en el composer de Conversaciones; acá solo se muestra.
// ═══════════════════════════════════════════════════════════════════════════
import { Send, AlertTriangle, Package } from 'lucide-react';

// Semáforo del consumo — mismo lenguaje visual que el resto del sistema, con el
// umbral alineado al aviso del 80% (F3): verde → ámbar → rosa.
function barColor(pct) {
    if (pct >= 80) return '#f43f5e'; // rose-500 — cupo casi/ya agotado
    if (pct >= 50) return '#f59e0b'; // amber-500
    return '#10b981';                // emerald-500
}

function fmt(n) {
    return Number(n || 0).toLocaleString('es-GT');
}

function resetLabel(resetsAt) {
    if (!resetsAt) return '';
    return new Date(resetsAt).toLocaleDateString('es-GT', { day: 'numeric', month: 'long' });
}

// ── F2 · Barra compacta de consumo (siempre visible en el header) ────────────
export function OutboundUsageBar({ usage }) {
    const { maxMessagesOut, messagesOut, messagesOutPct, messagesResetsAt } = usage || {};
    if (maxMessagesOut == null) return null; // plan sin tope → no aplica

    const pct = messagesOutPct ?? 0;
    const title = `${fmt(messagesOut)} de ${fmt(maxMessagesOut)} mensajes salientes este mes · se reinicia el ${resetLabel(messagesResetsAt)}`;

    return (
        <div
            className="flex items-center gap-2 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full pl-3 pr-3.5 py-1.5 shadow-md"
            title={title}
            aria-label={title}
        >
            <Send size={13} strokeWidth={2.5} className="text-navy-700/70 shrink-0" />
            <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1.5 leading-none">
                    <span className="text-[11px] font-bold text-navy-900 tabular-nums">{fmt(messagesOut)}</span>
                    <span className="text-[10px] font-semibold text-navy-700/50 tabular-nums">/ {fmt(maxMessagesOut)}</span>
                    <span className="text-[9px] font-bold text-navy-900/45 tabular-nums">· {pct}%</span>
                </div>
                <div className="w-28 h-1.5 rounded-full bg-navy-900/10 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: barColor(pct) }}
                    />
                </div>
            </div>
        </div>
    );
}

// ── F3 · Aviso al ≥80% con CTA de comprar paquete ────────────────────────────
// El CTA queda DESHABILITADO: los paquetes (businesses.extra_messages) todavía
// no existen — dependen de B4. Cuando B4 aterrice, este botón abre el flujo de
// compra; hoy solo comunica que la opción viene en camino.
export function OutboundQuotaNotice({ usage }) {
    const { maxMessagesOut, messagesOutPct, messagesOutBlocked, messagesResetsAt } = usage || {};
    if (maxMessagesOut == null) return null;

    const pct = messagesOutPct ?? 0;
    if (pct < 80) return null; // solo a partir del 80%

    const reset = resetLabel(messagesResetsAt);
    const headline = messagesOutBlocked
        ? 'Se agotó el cupo de mensajes salientes de este mes.'
        : `Vas por el ${pct}% del cupo de mensajes salientes de este mes.`;
    const sub = messagesOutBlocked
        ? `No se podrán enviar más mensajes hasta el ${reset}. Compra un paquete para seguir respondiendo.`
        : `Se reinicia el ${reset}. Compra un paquete para no quedarte sin cupo.`;

    return (
        <div
            className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 shadow-sm mb-3 animate-fade-up ${messagesOutBlocked
                ? 'bg-rose-50/80 border-rose-200/70'
                : 'bg-amber-50/80 border-amber-200/70'}`}
            role="status"
        >
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${messagesOutBlocked ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                <AlertTriangle size={15} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-bold leading-snug ${messagesOutBlocked ? 'text-rose-700' : 'text-amber-800'}`}>
                    {headline}
                </p>
                <p className={`text-[11px] font-semibold leading-snug mt-0.5 ${messagesOutBlocked ? 'text-rose-600/80' : 'text-amber-700/80'}`}>
                    {sub}
                </p>
            </div>
            {/* CTA deshabilitado — depende de B4 (paquetes de mensajes adicionales) */}
            <button
                type="button"
                disabled
                title="Los paquetes de mensajes estarán disponibles pronto"
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold bg-white/60 border border-white/70 text-navy-900/50 shadow-sm cursor-not-allowed opacity-70"
            >
                <Package size={13} strokeWidth={2.5} />
                Comprar paquete
                <span className="text-[8px] font-bold uppercase tracking-wider text-navy-700/40">Pronto</span>
            </button>
        </div>
    );
}
