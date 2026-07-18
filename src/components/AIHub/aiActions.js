import { FileText, Target, HeartPulse, TrendingUp, Newspaper, Megaphone, Landmark } from 'lucide-react';

// Catálogo de acciones del Centro IA (doc "Automatización Agente IA" · Parte
// B §B.2). Cada acción mapea a un scope de ai_insights (CHECK constraint de
// la tabla); la UI es cache-first y solo Generar/Regenerar gasta IA.
//  - needsPatient: requiere elegir un cliente (ref_id = patient_id)
//  - feature: flag de plan adicional al gate general (stats_intelligence)
//  - mode: cómo se refresca ("A pedido" o "Semanal" vía batch)
export const AI_ACTIONS = [
    {
        scope: 'patient_summary',
        title: 'Resumen de cliente',
        desc: 'Seguimiento e historial de un cliente, resumido en segundos.',
        icon: FileText,
        needsPatient: true,
        mode: 'A pedido',
    },
    {
        scope: 'patient_strategy',
        title: 'Estrategia por cliente',
        desc: 'Acción sugerida y borrador de WhatsApp listo para aprobar.',
        icon: Target,
        needsPatient: true,
        mode: 'A pedido',
    },
    {
        scope: 'retention',
        title: 'Retención y riesgo',
        desc: 'Clientes en riesgo de abandono y a quién contactar primero.',
        icon: HeartPulse,
        mode: 'Semanal',
    },
    {
        scope: 'kpi_narrative',
        title: 'KPIs explicados',
        desc: 'El porqué detrás de tus números, con recomendaciones.',
        icon: TrendingUp,
        mode: 'A pedido',
    },
    {
        scope: 'weekly_digest',
        title: 'Digest semanal',
        desc: 'Resumen ejecutivo: ingresos, turnos, ausencias y top servicios.',
        icon: Newspaper,
        mode: 'Semanal',
    },
    {
        // Scope de ai_insights = 'content_offer' (fuente de verdad: CHECK de la
        // tabla en el doc). El feature flag de plan es un identificador distinto
        // que coincide en texto con 'content_gen' — no confundir los dos.
        scope: 'content_offer',
        title: 'Contenido y ofertas',
        desc: 'Promos para días flojos con el texto listo para publicar.',
        icon: Megaphone,
        feature: 'content_gen',
        mode: 'A pedido',
    },
    {
        // Finanzas v2: salud financiera del mes con contexto completo
        // (mes vs anterior, por cobrar, meta, proyección — RPC get_finance_pack).
        scope: 'finance_narrative',
        title: 'Salud financiera',
        desc: 'Cómo van tus finanzas del mes y qué hacer al respecto.',
        icon: Landmark,
        mode: 'A pedido',
    },
];

export const SCOPE_META = Object.fromEntries(AI_ACTIONS.map(a => [a.scope, a]));

// "hace 5 min" / "hace 3 h" / "hace 2 días" / fecha corta
export function timeAgo(iso) {
    if (!iso) return '';
    const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return 'hace un momento';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return days === 1 ? 'hace 1 día' : `hace ${days} días`;
    return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
}
