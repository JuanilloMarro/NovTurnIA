import { useState, useEffect } from 'react';
import { getPlanLimits } from '../services/supabaseService';
import { useAppStore } from '../store/useAppStore';

// Evalúa el valor JSONB de un flag — admite booleanos y strings ("limited", "full").
// Exportado: PlansModal la reutiliza para derivar la comparativa de planes
// directo de plans.features (misma regla de interpretación en toda la app).
export function flagEnabled(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value !== '' && value !== 'false' && value !== 'limited';
    return true;
}

let _inflight = null;

export function clearPlanLimitsCache() {
    // Anular el inflight y la cache: evita que una promesa en vuelo de la
    // sesión anterior resuelva y sobrescriba la cache de la nueva sesión.
    _inflight = null;
    useAppStore.getState().invalidatePlanLimitsCache();
}

// SAFE_DEFAULTS — devuelto durante isLoading. Bloquea por defecto
// (hasFeature=false) en lugar de unlock por defecto, así NUNCA hay un flash
// de contenido desbloqueado mientras se resuelve el RPC. Las páginas que
// quieren un loading-state explícito siguen leyendo `isLoading`.
const SAFE_DEFAULTS = {
    isLoading: true,
    canAddPatient: true,
    canAddStaff: true,
    canAddAppointment: true,
    patientsLeft: null,
    staffLeft: null,
    appointmentsUsed: 0,
    maxAppointments: null,
    conversationsUsed: 0,
    maxConversations: null,
    // Cupo de mensajes SALIENTES (bolsa mensual del bot + dashboard — separada
    // de la bolsa de tokens semanales del Centro IA). Durante la carga NO se
    // bloquea el composer: el backend es la fuente de verdad del corte, y un
    // fallo transitorio del RPC no debe dejar sin responder a un cliente que paga.
    messagesOut: 0,
    maxMessagesOut: null,
    messagesOutEffective: null,
    extraMessages: 0,
    messagesOutBlocked: false,
    messagesOutPct: 0,
    messagesResetsAt: null,
    aiPaused: false,
    plan: null,
    planStatus: 'active',
    features: {},
    hasFeature: () => false,
};

// Primer día del mes siguiente en hora local — el período de usage_counters es
// mensual (date_trunc('month')), así que el cupo de salientes se reinicia el 1º
// del mes que viene. No depende del RPC; es puro calendario.
function firstOfNextMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export function usePlanLimits() {
    const cache = useAppStore(s => s._planLimitsCache);
    const setPlanLimitsCache = useAppStore(s => s.setPlanLimitsCache);
    const [isLoading, setIsLoading] = useState(!cache.data);

    useEffect(() => {
        let mounted = true;
        if (cache.data) {
            setIsLoading(false);
            return;
        }

        if (!_inflight) {
            _inflight = getPlanLimits()
                .then(data => {
                    setPlanLimitsCache(data);
                    return data;
                })
                .catch(() => null)
                .finally(() => {
                    _inflight = null;
                    if (mounted) setIsLoading(false);
                });
        }
        return () => { mounted = false; };
    }, [cache.data]);

    if (isLoading || !cache.data) return SAFE_DEFAULTS;

    const limits = cache.data;
    const maxPatients = limits.max_patients ?? null;
    const maxStaff    = limits.max_staff    ?? null;
    const maxAppointments  = limits.max_appointments  ?? null;
    const maxConversations = limits.max_conversations ?? null;
    const patientsUsed = limits.patients_used ?? 0;
    const staffUsed    = limits.staff_used    ?? 0;
    const appointmentsUsed  = limits.appointments_used  ?? 0;
    const conversationsUsed = limits.conversations_used ?? 0;
    const aiPaused = limits.ai_paused ?? false;

    // ── Cupo de mensajes SALIENTES (B7 · fuente: get_plan_limits) ──────────────
    // messages_out           → consumido este mes (solo salientes; B1 ya separa
    //                          entrantes de salientes en usage_counters)
    // max_messages_out       → cupo del plan + paquetes extra (plan + extra_messages)
    // messages_out_effective → greatest(cupo − consumido, 0), piso 0
    const messagesOut = limits.messages_out ?? 0;
    const maxMessagesOut = limits.max_messages_out ?? null;
    const messagesOutEffective = limits.messages_out_effective ?? null;
    const extraMessages = limits.extra_messages ?? 0;
    // Bloquea SOLO cuando el plan realmente tiene tope y el efectivo llegó a 0.
    // Sin tope (null) nunca bloquea. El corte real vive en el backend/n8n; esto
    // es la capa UX que deshabilita el composer antes de intentar el envío.
    const messagesOutBlocked = maxMessagesOut != null
        && messagesOutEffective != null
        && messagesOutEffective <= 0;
    const messagesOutPct = maxMessagesOut > 0
        ? Math.min(100, Math.round((messagesOut / maxMessagesOut) * 100))
        : (messagesOutBlocked ? 100 : 0);

    const features = limits.features || {};

    // Límites REALES (2026-07-05): null = ilimitado. La fuente de verdad son
    // los triggers de la DB (enforce_*_limit); estos booleanos son la capa UX
    // que deshabilita botones ANTES de que el server rechace el INSERT.
    return {
        isLoading: false,
        canAddPatient:     maxPatients      == null || patientsUsed     < maxPatients,
        canAddStaff:       maxStaff         == null || staffUsed        < maxStaff,
        canAddAppointment: maxAppointments  == null || appointmentsUsed < maxAppointments,
        patientsLeft: maxPatients == null ? null : Math.max(maxPatients - patientsUsed, 0),
        staffLeft:    maxStaff    == null ? null : Math.max(maxStaff    - staffUsed,    0),
        patientsUsed,
        maxPatients,
        appointmentsUsed,
        maxAppointments,
        maxConversations,
        conversationsUsed,
        // Cupo de mensajes salientes (F1/F2/F3)
        messagesOut,
        maxMessagesOut,
        messagesOutEffective,
        extraMessages,
        messagesOutBlocked,
        messagesOutPct,
        messagesResetsAt: maxMessagesOut == null ? null : firstOfNextMonth(),
        aiPaused,
        staffUsed,
        maxStaff,
        plan: limits.plan,
        planStatus: limits.plan_status ?? 'active',
        features,
        hasFeature: (name) => flagEnabled(features[name]),
    };
}
