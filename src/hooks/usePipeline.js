import { useState, useEffect, useCallback, useMemo } from 'react';
import { ListChecks, Tag, Clock, CalendarCheck, Bell, CheckCircle2, PhoneCall, ClipboardList, Star, MessageSquareHeart } from 'lucide-react';
import { getPipelineBoard, getPipelineMetrics } from '../services/supabaseService';
import { useRealtimePipeline, useRealtimeAppointments } from './useRealtime';

export function relativeTime(iso) {
    if (!iso) return null;
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} d`;
}

// ── Columnas = FASE GENERAL; los pasos viven DENTRO de la ficha ──────────────
// Antes había 5 etapas planas (una columna por etapa). Concentrarlas en 4 fases
// y mover el detalle a pasos con su propio timestamp (respaldados en
// pipeline_deals.*_at, sellados por pipeline_touch) permite ver en el popover
// de hover EXACTAMENTE cuándo hizo cada cosa la IA, sin gastar una columna por
// paso. `stages` mapea a los valores que ya guarda la DB.
//
// Cada paso trae `source`:
//   'ai'    → lo hace el bot DENTRO de la conversación de WhatsApp ya viva hoy
//             (ofrecer servicios/promo, consultar horarios, leer la
//             confirmación o el puntaje que responde el cliente). Se sella
//             por `pipeline_touch` (service_role) — SIN checkbox, es lectura.
//   'human' → requiere que el STAFF salga a contactar por su cuenta (llamar,
//             escribir) y HOY no existe ningún motor automático en n8n para
//             eso (el propio Backlog Maestro tiene abierto el P0 "el motor de
//             recordatorios se vende pero no existe"). Lleva checkbox
//             circular, escrito por `set_pipeline_step` (authenticated, con
//             ownership-check). `stepId` es el nombre que espera ese RPC.
//   'auto'  → se deriva solo de datos reales (existe un turno o no) — ni la
//             IA ni el staff "marcan" esto, así que no lleva ni checkbox ni
//             atribución.
export const PIPELINE_COLUMNS = [
    {
        id: 'booking',
        title: 'Agendación',
        stages: ['discovery', 'negotiation'],
        steps: [
            { key: 'offered_services', label: 'Servicios ofrecidos', icon: ListChecks, atKey: 'offered_services_at', source: 'ai' },
            { key: 'offered_promo', label: 'Promoción ofrecida', icon: Tag, atKey: 'offered_promo_at', source: 'ai' },
            { key: 'queried_slots', label: 'Horarios consultados', icon: Clock, atKey: 'slot_offered_at', source: 'ai' },
            { key: '__scheduled', label: 'Turno agendado', icon: CalendarCheck, source: 'auto' },
        ],
    },
    {
        id: 'appointment',
        title: 'Cita programada',
        stages: ['scheduled'],
        steps: [
            { key: '__scheduled', label: 'Turno agendado', icon: CalendarCheck, source: 'auto' },
            { key: 'reminder_sent', label: 'Recordatorio enviado', icon: Bell, atKey: 'reminder_sent_at', source: 'human', stepId: 'reminder_sent' },
            { key: 'confirmed_by_user', label: 'Confirmado por el cliente', icon: CheckCircle2, atKey: 'confirmed_at', source: 'ai' },
        ],
    },
    {
        id: 'recovery',
        title: 'Recuperación',
        stages: ['recovery'],
        steps: [
            { key: '__recovery_1', label: 'Intento 1', icon: PhoneCall, minStep: 1, source: 'human', stepId: 'recovery_1' },
            { key: '__recovery_2', label: 'Intento 2', icon: PhoneCall, minStep: 2, source: 'human', stepId: 'recovery_2' },
            { key: '__recovery_3', label: 'Intento 3', icon: PhoneCall, minStep: 3, source: 'human', stepId: 'recovery_3' },
        ],
    },
    {
        id: 'loyalty',
        title: 'Fidelización',
        stages: ['loyalty'],
        steps: [
            { key: 'survey_sent', label: 'Encuesta enviada', icon: ClipboardList, atKey: 'survey_sent_at', source: 'human', stepId: 'survey_sent' },
            { key: 'nps_score', label: 'Encuesta respondida', icon: Star, atKey: 'nps_at', source: 'ai' },
            { key: 'review_requested', label: 'Reseña solicitada', icon: MessageSquareHeart, atKey: 'review_requested_at', source: 'human', stepId: 'review_requested' },
        ],
    },
];

// Salud del trato — es lo que pinta la barra de color de la ficha. Responde a
// "¿la IA va bien, se detuvo, se cayó, o lo logró?". Se deriva de datos que ya
// existen; no requiere columna nueva en la DB.
export const HEALTH = {
    won: { label: 'Logrado', dot: 'bg-emerald-500', glow: 'rgba(16,185,129,0.4)', bar: 'bg-emerald-500' },
    on_track: { label: 'En curso', dot: 'bg-navy-500', glow: 'rgba(29,95,173,0.4)', bar: 'bg-navy-500' },
    stalled: { label: 'Detenido', dot: 'bg-amber-500', glow: 'rgba(245,158,11,0.4)', bar: 'bg-amber-500' },
    dropped: { label: 'Se cayó', dot: 'bg-rose-500', glow: 'rgba(244,63,94,0.4)', bar: 'bg-rose-500' },
};

export function dealHealth(d) {
    if (d.human_takeover) return 'dropped';
    if (d.stage === 'recovery' && (d.recovery_step || 0) >= 3) return 'dropped';
    if (d.stage === 'loyalty' || (d.stage === 'scheduled' && d.confirmed_by_user)) return 'won';
    if (d.temperature === 'cold') return 'stalled';
    return 'on_track';
}

// Estado + timestamp de cada paso — lo que alimenta tanto el mini-resumen de
// la ficha como el popover de detalle.
export function dealSteps(deal, column) {
    if (!column) return [];
    return column.steps.map((s) => {
        if (s.key === '__scheduled') {
            return { ...s, done: !!deal.appointment_id, meta: deal.date_start ? new Date(deal.date_start).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', timeZone: 'America/Guatemala' }) : null };
        }
        if (s.minStep) {
            const done = (deal.recovery_step || 0) >= s.minStep;
            return { ...s, done, meta: done ? relativeTime(deal.recovery_last_at) : null };
        }
        const done = !!deal[s.key];
        return { ...s, done, meta: done ? relativeTime(deal[s.atKey]) : null };
    });
}

export const columnOfStage = (stage) =>
    PIPELINE_COLUMNS.find((c) => c.stages.includes(stage)) || null;

export function usePipeline({ days = 90 } = {}) {
    const [deals, setDeals] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [board, kpis] = await Promise.all([
                getPipelineBoard({ days }),
                getPipelineMetrics(),
            ]);
            setDeals(board);
            setMetrics(kpis);
            setError(null);
        } catch (err) {
            console.error('Error cargando el pipeline:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    // El RPC hace joins (paciente, teléfono, servicio, temperatura) que el
    // payload de realtime no trae, así que un UPDATE parchea solo los campos
    // planos del deal y deja el resto intacto. Alta/baja sí recarga.
    useRealtimePipeline((payload) => {
        if (payload.eventType === 'UPDATE' && payload.new?.id) {
            setDeals(current => current.map(d =>
                d.deal_id === payload.new.id
                    ? { ...d, ...payload.new, deal_id: d.deal_id }
                    : d
            ));
        } else {
            load(true);
        }
    });

    // Un cambio de turno mueve la etapa vía trigger en la DB; hay que releer
    // para traer el nuevo servicio/fecha del join.
    useRealtimeAppointments(() => load(true));

    const byColumn = useMemo(() => {
        const groups = Object.fromEntries(PIPELINE_COLUMNS.map(c => [c.id, []]));
        for (const d of deals) {
            const col = columnOfStage(d.stage);
            if (col) groups[col.id].push(d);
        }
        return groups;
    }, [deals]);

    return {
        deals, byColumn, metrics, loading, error,
        reload: () => load(true),
        setDeals,
    };
}
