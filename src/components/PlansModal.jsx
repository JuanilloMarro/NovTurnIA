import { useState, useRef, useEffect } from 'react';
import { Star, Bot, Check, X, Users, BarChart2, ShieldCheck, Zap, Calendar, MessageCircle, List, Layers, ChevronDown, Building2, Wallet, History, Tag } from 'lucide-react';
import { createPortal } from 'react-dom';
import AIStar from './Icons/AIStar';
import { getBusinessInfo, getPlans } from '../services/supabaseService';
import { flagEnabled } from '../hooks/usePlanLimits';

// Precios, límites y la comparativa de features vienen TODOS de la tabla
// `plans` (getPlans(), pública/RLS `true` para SELECT) — nada hardcodeado.
// Antes este modal tenía un array de precios fijo en el front (ver doc
// "Modelo de Negocio.md" §8.3, hallazgo P2) que quedó desfasado de la v3 real
// en producción. Solo quedan como constantes locales el ícono, el tagline
// comercial y qué fila NO tiene respaldo en DB (features 100% parejas en
// todos los planes, o roadmap — "Próximamente").

// Metadata puramente decorativa por tier (no vive en la DB: ícono, copy de
// venta, cuál plan se marca "Recomendado").
const PLAN_META = {
    basic: { title: 'Básico', perfectFor: 'Para emprendedores que buscan automatizar su agenda básica.', icon: <Check size={15} /> },
    pro: { title: 'Pro', perfectFor: 'Para negocios en crecimiento que necesitan control total.', icon: <Star size={15} />, active: true },
    enterprise: { title: 'Enterprise', perfectFor: 'Para empresas grandes que escalan su comunicación con IA.', icon: <ShieldCheck size={15} /> },
};
const TIER_ORDER = ['basic', 'pro', 'enterprise'];

// Helpers para declarar filas de la comparativa sin repetir la lectura de
// plans.features — cada fila se evalúa contra el plan real de cada tier.
const flag = (key) => (p) => flagEnabled(p?.features?.[key]);
const limit = (key) => (p) => {
    const v = p?.[key];
    return v == null ? 'Ilimitado' : v.toLocaleString('es-GT');
};
const reasoning = (p) => {
    const v = p?.features?.ai_reasoning;
    if (v === 'premium') return 'Premium';
    if (v === 'advanced') return 'Avanzado';
    return 'Estándar';
};

// Resuelve basic/pro/enterprise de una fila: literal (true/false/string) o
// función(planRow) para lo que sí viene de plans.features / límites reales.
function resolveRow(row, plansByTier) {
    const resolve = (val, tier) => (typeof val === 'function' ? val(plansByTier[tier]) : val);
    return {
        name: row.name,
        basic: resolve(row.basic, 'basic'),
        pro: resolve(row.pro, 'pro'),
        enterprise: resolve(row.enterprise, 'enterprise'),
    };
}

// Especificación de la comparativa por módulo. Filas con flag()/limit()/
// reasoning() están respaldadas por columnas reales de `plans`; las demás
// son parejas en todos los tiers (core) o roadmap (Sucursales/Soporte) y no
// tienen una columna propia todavía.
const MODULE_SPECS = [
    {
        title: 'Turnos', subtitle: 'Gestión de agenda y IA', icon: <Calendar size={20} />,
        rows: [
            { name: 'Visualización de Agenda (Día / Semana / Mes)', basic: true, pro: true, enterprise: true },
            { name: 'Creación Manual de Turnos', basic: true, pro: true, enterprise: true },
            { name: 'Validación de Ingreso del Paciente', basic: true, pro: true, enterprise: true },
            { name: 'Toma de Control Humano (Pausa IA desde el Turno)', basic: true, pro: true, enterprise: true },
            { name: 'Cobro al Atender (Registro de Pago en el Turno)', basic: false, pro: true, enterprise: true },
            { name: 'Recordatorios Automáticos', basic: flag('reminders'), pro: flag('reminders'), enterprise: flag('reminders') },
            { name: 'Kanban de estados de turnos', basic: flag('kanban'), pro: flag('kanban'), enterprise: flag('kanban') },
            { name: 'Límite de Turnos al mes', basic: limit('max_appointments'), pro: limit('max_appointments'), enterprise: limit('max_appointments') },
        ],
    },
    {
        title: 'Seguimiento', subtitle: 'Recuperación de No-Shows y Cancelaciones', icon: <History size={20} />,
        rows: [
            { name: 'Listado de No-Shows y Cancelaciones', basic: flag('followup'), pro: flag('followup'), enterprise: flag('followup') },
            { name: 'Filtros por Tipo (No-Show / Cancelados)', basic: flag('followup'), pro: flag('followup'), enterprise: flag('followup') },
            { name: 'Filtros por Período (7 / 30 / 60 / 90 días)', basic: flag('followup'), pro: flag('followup'), enterprise: flag('followup') },
            { name: 'Reagendar directamente desde Seguimiento', basic: flag('followup'), pro: flag('followup'), enterprise: flag('followup') },
        ],
    },
    {
        title: 'Clientes', subtitle: 'Base de datos y perfiles', icon: <Users size={20} />,
        rows: [
            { name: 'Creación Manual de un Cliente', basic: true, pro: true, enterprise: true },
            { name: 'Historial Completo del Paciente', basic: true, pro: true, enterprise: true },
            { name: 'Toma de Control Humano (Pausa IA)', basic: true, pro: true, enterprise: true },
            { name: 'Observaciones / Notas', basic: flag('patient_notes'), pro: flag('patient_notes'), enterprise: flag('patient_notes') },
            { name: 'Exportación de Información (CSV)', basic: flag('export_patients'), pro: flag('export_patients'), enterprise: flag('export_patients') },
            { name: 'Límite de Visualización de Clientes', basic: limit('max_patients'), pro: limit('max_patients'), enterprise: limit('max_patients') },
        ],
    },
    {
        title: 'Conversaciones', subtitle: 'IA y Mensajería', icon: <MessageCircle size={20} />,
        rows: [
            { name: 'Bandeja Unificada', basic: true, pro: true, enterprise: true },
            { name: 'Ofrecimiento de Servicios Activos por IA', basic: flag('service_description'), pro: flag('service_description'), enterprise: flag('service_description') },
            { name: 'Ofrecimiento de Ofertas Activas por IA', basic: flag('dynamic_pricing'), pro: flag('dynamic_pricing'), enterprise: flag('dynamic_pricing') },
            { name: 'Límite de Mensajes al mes (usuario + IA)', basic: limit('max_conversations'), pro: limit('max_conversations'), enterprise: limit('max_conversations') },
        ],
    },
    {
        title: 'Estadísticas', subtitle: 'Reportes y métricas', icon: <BarChart2 size={20} />,
        rows: [
            { name: 'Total de Turnos (Completados, Cancelados, No-Shows)', basic: flag('dashboard'), pro: flag('dashboard'), enterprise: flag('dashboard') },
            { name: 'Total de Clientes Atendidos vs Nuevos', basic: flag('dashboard'), pro: flag('dashboard'), enterprise: flag('dashboard') },
            { name: 'Volumen de Mensajes (usuario + IA) del período', basic: flag('dashboard'), pro: flag('dashboard'), enterprise: flag('dashboard') },
            { name: 'Tasa de Confirmación y Cancelaciones', basic: flag('dashboard'), pro: flag('dashboard'), enterprise: flag('dashboard') },
            { name: 'Histórico Comparativo Mensual por Categoría', basic: flag('dashboard'), pro: flag('dashboard'), enterprise: flag('dashboard') },
            { name: 'LTV y Valor Promedio por Cliente', basic: flag('business_intelligence'), pro: flag('business_intelligence'), enterprise: flag('business_intelligence') },
            { name: 'Predicción de Demanda y Ocupación', basic: flag('business_intelligence'), pro: flag('business_intelligence'), enterprise: flag('business_intelligence') },
            { name: 'Tasa de Retención y Riesgo de Abandono (Churn)', basic: flag('business_intelligence'), pro: flag('business_intelligence'), enterprise: flag('business_intelligence') },
            { name: 'Rentabilidad Real por Servicio', basic: flag('business_intelligence'), pro: flag('business_intelligence'), enterprise: flag('business_intelligence') },
            { name: 'Exportación de Reportes Avanzados (CSV / PDF)', basic: flag('export_reports'), pro: flag('export_reports'), enterprise: flag('export_reports') },
        ],
    },
    {
        title: 'Servicios', subtitle: 'Catálogo y Configuración', icon: <Layers size={20} />,
        rows: [
            { name: 'Gestión de Servicios Ilimitados', basic: true, pro: true, enterprise: true },
            { name: 'Activar / Desactivar Servicios', basic: true, pro: true, enterprise: true },
            { name: 'Precios y Duraciones Variables', basic: true, pro: true, enterprise: true },
            { name: 'Descripción Detallada (Contexto para IA)', basic: flag('service_description'), pro: flag('service_description'), enterprise: flag('service_description') },
        ],
    },
    {
        title: 'Ofertas', subtitle: 'Promociones y Precios Dinámicos', icon: <Tag size={20} />,
        rows: [
            { name: 'Creación de Ofertas y Promociones', basic: flag('dynamic_pricing'), pro: flag('dynamic_pricing'), enterprise: flag('dynamic_pricing') },
            { name: 'Precio Promocional por Servicio', basic: flag('dynamic_pricing'), pro: flag('dynamic_pricing'), enterprise: flag('dynamic_pricing') },
            { name: 'Vigencia por Fechas (Tiempo Limitado)', basic: flag('dynamic_pricing'), pro: flag('dynamic_pricing'), enterprise: flag('dynamic_pricing') },
            { name: 'Activar / Desactivar Ofertas', basic: flag('dynamic_pricing'), pro: flag('dynamic_pricing'), enterprise: flag('dynamic_pricing') },
            { name: 'Ofertas Visibles al Agente IA en Conversaciones', basic: flag('dynamic_pricing'), pro: flag('dynamic_pricing'), enterprise: flag('dynamic_pricing') },
        ],
    },
    {
        title: 'Finanzas', subtitle: 'Ingresos, Costos y Rentabilidad', icon: <Wallet size={20} />,
        rows: [
            { name: 'Gráfica de Ingresos vs Egresos del Período', basic: flag('finance'), pro: flag('finance'), enterprise: flag('finance') },
            { name: 'Balance Neto y Utilidad del Mes', basic: flag('finance'), pro: flag('finance'), enterprise: flag('finance') },
            { name: 'Ranking de Servicios por Ingreso Generado', basic: flag('finance'), pro: flag('finance'), enterprise: flag('finance') },
            { name: 'Registro de Ingresos', basic: flag('finance'), pro: flag('finance'), enterprise: flag('finance') },
            { name: 'Registro de Egresos', basic: flag('finance'), pro: flag('finance'), enterprise: flag('finance') },
            { name: 'Validación de Ingresos Pendientes por Confirmar', basic: flag('finance'), pro: flag('finance'), enterprise: flag('finance') },
            { name: 'Catálogo de Insumos', basic: flag('supplies'), pro: flag('supplies'), enterprise: flag('supplies') },
            { name: 'Recetas y Costo Real por Servicio', basic: flag('supplies'), pro: flag('supplies'), enterprise: flag('supplies') },
        ],
    },
    {
        title: 'Actividad', subtitle: 'Registro de Auditoría', icon: <List size={20} />,
        rows: [
            { name: 'Registro de Actividad General', basic: flag('audit_log'), pro: flag('audit_log'), enterprise: flag('audit_log') },
            { name: 'Historial de cambios en Clientes', basic: flag('audit_log'), pro: flag('audit_log'), enterprise: flag('audit_log') },
            { name: 'Historial de cambios en Turnos', basic: flag('audit_log'), pro: flag('audit_log'), enterprise: flag('audit_log') },
            { name: 'Auditoría de acciones de Staff', basic: flag('audit_log'), pro: flag('audit_log'), enterprise: flag('audit_log') },
            { name: 'Exportación CSV', basic: flag('export_reports'), pro: flag('export_reports'), enterprise: flag('export_reports') },
        ],
    },
    {
        title: 'Usuarios', subtitle: 'Control de Acceso', icon: <ShieldCheck size={20} />,
        rows: [
            { name: 'Gestión de Personal', basic: true, pro: true, enterprise: true },
            { name: 'Roles y Permisos Personalizados', basic: flag('custom_roles'), pro: flag('custom_roles'), enterprise: flag('custom_roles') },
            { name: 'Límite de Usuarios', basic: limit('max_staff'), pro: limit('max_staff'), enterprise: limit('max_staff') },
        ],
    },
    {
        title: 'Inteligencia Artificial', subtitle: 'Capacidades y Personalización del Agente', icon: <Bot size={20} />,
        rows: [
            { name: 'Agente IA de Agendamiento (WhatsApp)', basic: 'Incluido', pro: 'Incluido', enterprise: 'Incluido' },
            { name: 'Tipo de Razonamiento IA', basic: reasoning, pro: reasoning, enterprise: reasoning },
            { name: 'Historial Visual de Clientes con IA Pausada', basic: true, pro: true, enterprise: true },
            { name: 'Datos Iniciales del Negocio para el Agente', basic: flag('custom_prompt'), pro: flag('custom_prompt'), enterprise: flag('custom_prompt') },
            { name: 'Memoria Contextual del Agente', basic: flag('ai_memory'), pro: flag('ai_memory'), enterprise: flag('ai_memory') },
            { name: 'Nombre Personalizado del Asistente', basic: flag('ai_agent_name'), pro: flag('ai_agent_name'), enterprise: flag('ai_agent_name') },
        ],
    },
    {
        title: (
            <div className="flex items-center gap-2">
                Sucursales
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-600">
                    <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                    Próximamente
                </span>
            </div>
        ),
        subtitle: 'Gestión Multi-Sede', icon: <Building2 size={20} />,
        rows: [
            { name: 'Gestión de Sucursal Principal', basic: true, pro: true, enterprise: true },
            { name: 'Configuración de Horarios por Sede', basic: true, pro: true, enterprise: true },
            { name: 'Múltiples Sucursales', basic: flag('multi_branch'), pro: flag('multi_branch'), enterprise: flag('multi_branch') },
            { name: 'Panel de Control Multi-Sede', basic: flag('multi_branch'), pro: flag('multi_branch'), enterprise: flag('multi_branch') },
        ],
    },
    {
        title: (
            <div className="flex items-center gap-2">
                Soporte
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold uppercase tracking-widest text-amber-600">
                    <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                    Próximamente
                </span>
            </div>
        ),
        subtitle: 'Atención y Garantía', icon: <ShieldCheck size={20} />,
        rows: [
            { name: 'Soporte vía Ticket', basic: true, pro: true, enterprise: true },
            { name: 'Soporte vía WhatsApp', basic: false, pro: true, enterprise: true },
            { name: 'Tiempo de Respuesta Garantizado', basic: '48h', pro: '24h', enterprise: '4h' },
        ],
    },
];

export default function PlansModal({ isOpen, onClose }) {
    const detailsRef = useRef(null);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
    const [plansByTier, setPlansByTier] = useState(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        getBusinessInfo().then(info => {
            setCurrentPlan(info?.plan || 'basic');
        }).catch(() => {
            setCurrentPlan('basic');
        });

        getPlans().then(rows => {
            const byTier = {};
            for (const row of rows) byTier[row.tier] = row;
            setPlansByTier(byTier);
            setLoadError(false);
        }).catch(() => setLoadError(true));
    }, [isOpen]);

    // Early return DESPUÉS de los hooks — Rules of Hooks: conteo estable
    // entre renders independientemente de isOpen.
    if (!isOpen) return null;

    const scrollToDetails = () => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const plans = plansByTier
        ? TIER_ORDER.map(tier => ({ tier, ...PLAN_META[tier], ...plansByTier[tier] }))
        : [];

    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[40px] shadow-[0_20px_50px_rgba(26,58,107,0.15)] w-full max-w-4xl max-h-[96vh] overflow-hidden animate-fade-up flex flex-col">
                {/* Sticky Header - Adjusted */}
                <div className="sticky top-0 z-50 px-10 pt-8 pb-4 flex items-center justify-center relative shrink-0 pointer-events-none">
                    {/* Centered Logo */}
                    <div className="w-16 h-16 rounded-[20px] bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card relative pointer-events-auto transition-transform hover:scale-105 duration-300 group">
                        <div className="relative">
                            <Bot size={28} strokeWidth={2.5} className="transition-transform duration-500 group-hover:rotate-12" />
                            <AIStar
                                size={14}
                                className="absolute -top-2 -left-2 text-white transition-all duration-500 group-hover:scale-125"
                                strokeWidth={2.5}
                            />
                        </div>
                    </div>

                    {/* Close Button - Right Aligned (Original Style) */}
                    <div className="absolute right-8 top-8 pointer-events-auto">
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-transparent border border-white/80 text-navy-900/40 hover:text-navy-900 hover:bg-white/30 transition-all duration-300"
                        >
                            <X size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pl-10 pr-8 pt-0 pb-8">
                    <div className="flex flex-col items-center justify-center mb-4">
                        <h3 className="text-2xl font-bold text-navy-900 tracking-tight mb-2 text-center max-w-xl">
                            Precios increíbles, diseñados para escalar.
                        </h3>
                        <p className="text-navy-700/60 font-bold text-[13px] text-center max-w-2xl leading-relaxed">
                            Implementa Inteligencia Artificial en atención a tu cliente, gestiona y maneja tu negocio en una sola plataforma premium.
                        </p>

                        {/* Billing Toggle - Compacto */}
                        <div className="mt-6 flex items-center gap-1 bg-navy-900/5 p-1 rounded-2xl border border-navy-900/10">
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`px-6 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${billingCycle === 'monthly'
                                    ? 'bg-navy-900 text-white shadow-lg'
                                    : 'text-navy-900/40 hover:text-navy-900'
                                    }`}
                            >
                                Mensual
                            </button>
                            <button
                                onClick={() => setBillingCycle('annual')}
                                className={`px-6 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 flex items-center gap-2 ${billingCycle === 'annual'
                                    ? 'bg-navy-900 text-white shadow-lg'
                                    : 'text-navy-900/40 hover:text-navy-900'
                                    }`}
                            >
                                Anual
                                <span className="bg-emerald-500 text-[9px] text-white px-2 py-0.5 rounded-full animate-pulse">
                                    -{plans[0]?.annual_discount ?? 16}% off
                                </span>
                            </button>
                        </div>
                    </div>

                    {loadError ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <p className="text-[12px] font-bold text-navy-900/40 max-w-sm">
                                No se pudieron cargar los planes. Intenta de nuevo en un momento.
                            </p>
                        </div>
                    ) : !plansByTier ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full pb-4">
                            {plans.map((plan, i) => {
                                const discount = plan.annual_discount ?? 16;
                                const price = billingCycle === 'monthly'
                                    ? plan.monthly_price
                                    : Math.round(plan.monthly_price * (1 - discount / 100));

                                return (
                                    <div key={plan.tier} className="p-6 rounded-[32px] border border-navy-900 bg-navy-900 text-white shadow-2xl transition-all duration-500 flex flex-col hover:scale-[1.02] relative overflow-hidden group/card">
                                        {/* Decoración sutil de fondo */}
                                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/5 rounded-full blur-2xl transition-all duration-500 group-hover/card:bg-white/10" />

                                        <div className="flex items-center justify-between mb-4 relative z-10">
                                            <div className="p-2 rounded-full bg-white/10 flex items-center justify-center">
                                                {plan.icon}
                                            </div>
                                            {plan.active && (
                                                <span className="bg-white/10 text-[8px] font-bold px-2 py-0.5 rounded-full border border-white/10">
                                                    Recomendado
                                                </span>
                                            )}
                                        </div>

                                        <div className="min-h-[180px] flex flex-col">
                                            <h4 className="font-bold text-2xl mb-1 relative z-10">{plan.title}</h4>
                                            <div className="flex flex-col mb-4 relative z-10">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl font-bold text-white leading-none">Q {price.toLocaleString('es-GT')}</span>
                                                    <span className="text-[11px] opacity-60 font-bold">/mes</span>
                                                </div>
                                                {billingCycle === 'annual' && (
                                                    <span className="text-[9px] font-bold text-emerald-400 mt-1">
                                                        Q {(price * 12).toLocaleString('es-GT')} al año
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-[9.5px] font-bold text-white/50 mb-4 italic leading-relaxed flex-1">
                                                {plan.perfectFor}
                                            </p>
                                        </div>

                                        <div className="pt-4 border-t border-white/10 relative z-10 flex-1 flex flex-col">
                                            {i > 0 ? (
                                                <p className="text-[9px] font-bold text-white/40 mb-5">
                                                    Todo lo de {plans[i - 1].title} más:
                                                </p>
                                            ) : (
                                                <p className="text-[9px] font-bold text-transparent mb-5 select-none">
                                                    -
                                                </p>
                                            )}
                                            <ul className="space-y-3 mb-6 flex-1">
                                                {(FEATURE_HIGHLIGHTS[plan.tier] || []).map((feat, j) => (
                                                    <li key={j} className="flex items-center gap-2.5 text-[9.5px] font-bold text-white/90">
                                                        <Check size={12} className="text-white/60 shrink-0" strokeWidth={3} />
                                                        {feat}
                                                    </li>
                                                ))}
                                            </ul>

                                            <button
                                                disabled={currentPlan === plan.tier}
                                                className={`w-full mt-auto py-3 font-bold text-[10px] rounded-2xl transition-all relative z-10 backdrop-blur-sm shadow-xl ${currentPlan === plan.tier
                                                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 cursor-default flex items-center justify-center gap-2'
                                                    : 'bg-white/10 border border-white/20 text-white/90 hover:bg-white hover:text-navy-900 active:scale-95'
                                                    }`}
                                            >
                                                {currentPlan === plan.tier ? (
                                                    <>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        Tu Plan Actual
                                                    </>
                                                ) : 'Seleccionar Plan'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex justify-center mt-2 mb-8">
                        <button
                            onClick={scrollToDetails}
                            className="flex items-center gap-2 text-[10px] font-bold text-navy-900/30 hover:text-navy-900 hover:translate-y-1 transition-all duration-300 group"
                        >
                            <span>Ver comparativa detallada</span>
                            <ChevronDown size={14} className="transition-transform" />
                        </button>
                    </div>

                    {/* Secciones por Módulo — cada fila se resuelve contra plans.features/límites reales */}
                    {plansByTier && (
                        <div ref={detailsRef} className="w-full mt-12 space-y-16 pb-12">
                            {MODULE_SPECS.map((mod, i) => (
                                <ModuleSection
                                    key={i}
                                    title={mod.title}
                                    subtitle={mod.subtitle}
                                    icon={mod.icon}
                                    rows={mod.rows.map(row => resolveRow(row, plansByTier))}
                                />
                            ))}

                            {/* Pie de Tabla */}
                            <div className="flex flex-col items-center justify-center pt-8 border-t border-navy-900/5">
                                <Zap size={24} className="text-navy-900/20 mb-4" />
                                <p className="text-[12px] font-bold text-navy-900/40 text-center max-w-lg leading-relaxed">
                                    ¿Necesitas algo a medida? Integración de Modulos a la Medida disponible para soluciones NovTurnIA.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// Bullets cortos de venta para las tarjetas de precio — copy de marketing,
// no 1:1 con plans.features (la comparativa detallada de abajo sí lo es).
const FEATURE_HIGHLIGHTS = {
    basic: ['IA de razonamiento Estándar', 'Turnos con IA Ilimitados', 'Agenda: Vista Día / Semana / Mes', 'Gestión de Clientes (últimos 10)', '1 Usuario', 'Integración de Módulos a la Medida'],
    pro: ['IA Avanzada + Memoria Contextual', 'Módulo de Finanzas (Ingresos, Egresos, Resumen)', 'Seguimiento de No-Shows y Cancelaciones', 'Kanban de estados de turnos', 'Roles y Permisos de Staff', 'Hasta 5 Usuarios'],
    enterprise: ['IA de razonamiento Premium', 'Insumos y Recetas (Costo por Servicio)', 'Ofertas y Precios Dinámicos', 'Exportación de Información y Reportes', 'Inteligencia de Negocio (LTV, retención, predicción)', 'Usuarios Ilimitados'],
};

function ModuleSection({ title, subtitle, icon, rows }) {
    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                    {icon}
                </div>
                <div>
                    <h4 className="text-lg font-bold text-navy-900 tracking-tight leading-none mb-1">{title}</h4>
                    <p className="text-[11px] text-navy-700/50 font-bold">{subtitle}</p>
                </div>
            </div>

            <div className="bg-white/40 border border-white/80 rounded-[32px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="border-b border-navy-900/5">
                                <th className="p-6 text-[11px] font-bold text-navy-900/40">Característica</th>
                                <th className="p-6 text-[11px] font-bold text-navy-900 text-center">Básico</th>
                                <th className="p-6 text-[11px] font-bold text-navy-900 text-center">Pro</th>
                                <th className="p-6 text-[11px] font-bold text-navy-900 text-center">Enterprise</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-navy-900/[0.02] transition-colors">
                                    <td className="p-6 text-[12px] font-bold text-navy-700">{row.name}</td>
                                    <td className="p-6 text-center">{renderValue(row.basic)}</td>
                                    <td className="p-6 text-center">{renderValue(row.pro)}</td>
                                    <td className="p-6 text-center">{renderValue(row.enterprise)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function renderValue(val) {
    if (typeof val === 'boolean') {
        return val ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />;
    }
    return <span className="text-[12px] font-bold text-navy-900/60">{val}</span>;
}
