import { useState, useRef, useEffect } from 'react';
import { CreditCard, Star, Bot, Check, X, Users, BarChart2, ShieldCheck, Zap, Calendar, MessageCircle, Settings, List, Layers, ChevronDown, Building2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import AIStar from './Icons/AIStar';
import { getBusinessInfo } from '../services/supabaseService';

export default function PlansModal({ isOpen, onClose }) {
    const detailsRef = useRef(null);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'

    useEffect(() => {
        if (isOpen) {
            getBusinessInfo().then(info => {
                setCurrentPlan(info?.plan || 'basic');
            }).catch(() => {
                setCurrentPlan('basic');
            });
        }
    }, [isOpen]);

    // Early return DESPUÉS de los hooks — Rules of Hooks: conteo estable
    // entre renders independientemente de isOpen.
    if (!isOpen) return null;

    const scrollToDetails = () => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const plans = [
        {
            id: 'basic',
            title: 'Básico',
            monthlyPrice: 499,
            perfectFor: 'Para emprendedores que buscan automatizar su agenda básica.',
            icon: <Check size={18} />,
            features: ['IA de razonamiento Estándar', 'Turnos con IA Ilimitados', 'Dashboard: Limitado', '1 Usuario', 'Integración de Modulos a la Medida']
        },
        {
            id: 'pro',
            title: 'Pro',
            monthlyPrice: 999,
            perfectFor: 'Para negocios en crecimiento que necesitan control total.',
            icon: <Star size={18} />,
            active: true,
            features: ['IA de razonamiento Avanzada', 'IA con memoria contextual', 'Dashboard: Completo', 'Hasta 5 Usuarios', 'Kanban de estados de turnos', 'Integración de Modulos a la Medida']
        },
        {
            id: 'enterprise',
            title: 'Enterprise',
            monthlyPrice: 1999,
            perfectFor: 'Para empresas grandes que escalan su comunicación con IA.',
            icon: <ShieldCheck size={18} />,
            features: ['IA de razonamiento Premium', 'Confirmaciones automáticas', 'Generación de Contenido', 'Usuarios Ilimitados', 'Kanban de estados de turnos', 'Integración de Modulos a la Medida']
        }
    ];

    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[40px] shadow-[0_20px_50px_rgba(26,58,107,0.15)] w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fade-up flex flex-col">
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
                        <h3 className="text-2xl font-black text-navy-900 tracking-tight mb-2 text-center max-w-xl">
                            Precios increíbles, diseñados para escalar.
                        </h3>
                        <p className="text-navy-700/60 font-bold text-[13px] text-center max-w-2xl leading-relaxed">
                            Implementa Inteligencia Artificial en atención a tu cliente, gestiona y maneja tu negocio en una sola plataforma premium.
                        </p>

                        {/* Billing Toggle - Compacto */}
                        <div className="mt-6 flex items-center gap-1 bg-navy-900/5 p-1 rounded-2xl border border-navy-900/10">
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`px-6 py-2 rounded-xl text-[11px] font-black transition-all duration-300 ${billingCycle === 'monthly'
                                    ? 'bg-navy-900 text-white shadow-lg'
                                    : 'text-navy-900/40 hover:text-navy-900'
                                    }`}
                            >
                                Mensual
                            </button>
                            <button
                                onClick={() => setBillingCycle('annual')}
                                className={`px-6 py-2 rounded-xl text-[11px] font-black transition-all duration-300 flex items-center gap-2 ${billingCycle === 'annual'
                                    ? 'bg-navy-900 text-white shadow-lg'
                                    : 'text-navy-900/40 hover:text-navy-900'
                                    }`}
                            >
                                Anual
                                <span className="bg-emerald-500 text-[9px] text-white px-2 py-0.5 rounded-full animate-pulse">
                                    -16% OFF
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full pb-4">
                        {plans.map((plan, i) => {
                            const price = billingCycle === 'monthly'
                                ? plan.monthlyPrice
                                : Math.round((plan.monthlyPrice * 10) / 12);

                            return (
                                <div key={i} className="p-6 rounded-[32px] border border-navy-900 bg-navy-900 text-white shadow-2xl transition-all duration-500 flex flex-col hover:scale-[1.02] relative overflow-hidden group/card">
                                    {/* Decoración sutil de fondo */}
                                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/5 rounded-full blur-2xl transition-all duration-500 group-hover/card:bg-white/10" />

                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <div className="p-2.5 rounded-xl bg-white/10 flex items-center justify-center">
                                            {plan.icon}
                                        </div>
                                        {plan.active && (
                                            <span className="bg-white/10 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
                                                Recomendado
                                            </span>
                                        )}
                                    </div>

                                    <div className="min-h-[140px] flex flex-col">
                                        <h4 className="font-bold text-lg mb-1 relative z-10">{plan.title}</h4>
                                        <div className="flex flex-col mb-4 relative z-10">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-black text-white leading-none">Q {price.toLocaleString()}</span>
                                                <span className="text-[10px] opacity-60 font-bold uppercase tracking-tight">/mes</span>
                                            </div>
                                            {billingCycle === 'annual' && (
                                                <span className="text-[9px] font-bold text-emerald-400 mt-1">
                                                    Q {(plan.monthlyPrice * 10).toLocaleString()} al año
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[11px] font-bold text-white/50 mb-4 italic leading-relaxed flex-1">
                                            {plan.perfectFor}
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t border-white/10 relative z-10 flex-1 flex flex-col">
                                        {i > 0 ? (
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-4">
                                                Todo lo de {plans[i - 1].title} más:
                                            </p>
                                        ) : (
                                            <p className="text-[9px] font-black uppercase tracking-widest text-transparent mb-4 select-none">
                                                -
                                            </p>
                                        )}
                                        <ul className="space-y-3 mb-6 flex-1">
                                            {plan.features.map((feat, j) => (
                                                <li key={j} className="flex items-center gap-2.5 text-[11px] font-bold text-white/90">
                                                    <Check size={12} className="text-white/60 shrink-0" strokeWidth={3} />
                                                    {feat}
                                                </li>
                                            ))}
                                        </ul>

                                        <button
                                            disabled={currentPlan === plan.id}
                                            className={`w-full mt-auto py-3 font-black text-[10px] rounded-2xl transition-all uppercase tracking-widest relative z-10 backdrop-blur-sm shadow-xl ${currentPlan === plan.id
                                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 cursor-default flex items-center justify-center gap-2'
                                                : 'bg-white/10 border border-white/20 text-white/90 hover:bg-white hover:text-navy-900 active:scale-95'
                                                }`}
                                        >
                                            {currentPlan === plan.id ? (
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

                    <div className="flex justify-center mt-0 mb-8">
                        <button
                            onClick={scrollToDetails}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-navy-900/30 hover:text-navy-900 hover:translate-y-1 transition-all duration-300 group"
                        >
                            <span>Ver comparativa detallada</span>
                            <ChevronDown size={14} className="transition-transform" />
                        </button>
                    </div>

                    {/* Secciones por Módulo */}
                    <div ref={detailsRef} className="w-full mt-12 space-y-16 pb-12">

                        {/* 1. Módulo de Turnos */}
                        <ModuleSection
                            title="Turnos"
                            subtitle="Gestión de agenda y IA"
                            icon={<Calendar size={20} />}
                            rows={[
                                { name: 'Visualización de Agenda', basic: true, pro: true, enterprise: true },
                                { name: 'Creación Manual de Turnos', basic: true, pro: true, enterprise: true },
                                { name: 'Recordatorios Automáticos', basic: false, pro: true, enterprise: true },
                                { name: 'Seguimiento de Cancelaciones / No Presentes', basic: false, pro: true, enterprise: true },
                                { name: 'Kanban de estados de turnos', basic: false, pro: true, enterprise: true },
                                { name: 'Agente IA (Agendamiento)', basic: 'Ilimitado', pro: 'Ilimitado', enterprise: 'Ilimitado' },
                            ]}
                        />

                        {/* 2. Módulo de Clientes */}
                        <ModuleSection
                            title="Clientes"
                            subtitle="Base de datos y perfiles"
                            icon={<Users size={20} />}
                            delay="50ms"
                            rows={[
                                { name: 'Creación Manual de un Cliente', basic: true, pro: true, enterprise: true },
                                { name: 'Historial de Turnos', basic: true, pro: true, enterprise: true },
                                { name: 'Toma de Control Humano', basic: true, pro: true, enterprise: true },
                                { name: 'Observaciones / Notas', basic: false, pro: true, enterprise: true },
                                { name: 'Exportación de Información', basic: false, pro: false, enterprise: true },
                                { name: 'Límite de Visualización de Clientes', basic: 'Últimos 10', pro: 'Últimos 100', enterprise: 'Ilimitado' },
                            ]}
                        />

                        {/* 3. Módulo de Conversaciones */}
                        <ModuleSection
                            title="Conversaciones"
                            subtitle="IA y Mensajería"
                            icon={<MessageCircle size={20} />}
                            delay="100ms"
                            rows={[
                                { name: 'Bandeja Unificada', basic: true, pro: true, enterprise: true },
                                { name: 'Manejo de Emergencias', basic: true, pro: true, enterprise: true },
                                { name: 'Auto-Respuestas Inteligentes', basic: true, pro: true, enterprise: true },
                                { name: 'IA con Contexto Completo', basic: false, pro: true, enterprise: true },
                                { name: 'Confirmación Automática por WhatsApp', basic: false, pro: false, enterprise: true },
                                { name: 'Límite de Visualización de Chats', basic: 'Últimos 10', pro: 'Últimos 100', enterprise: 'Ilimitado' },
                            ]}
                        />

                        {/* 4. Módulo de Estadísticas */}
                        <ModuleSection
                            title="Estadísticas"
                            subtitle="Reportes y métricas"
                            icon={<BarChart2 size={20} />}
                            delay="150ms"
                            rows={[
                                { name: 'Dashboard de Métricas (Turnos y Clientes)', basic: false, pro: true, enterprise: true },
                                { name: 'Métricas de Mensajes (IA)', basic: false, pro: true, enterprise: true },
                                { name: 'Tasa de Confirmación y Cancelaciones', basic: false, pro: true, enterprise: true },
                                { name: 'Histórico Comparativo Mensual', basic: false, pro: true, enterprise: true },
                                { name: 'Exportación de Reportes', basic: false, pro: false, enterprise: true },
                            ]}
                        />

                        {/* 5. Módulo de Servicios */}
                        <ModuleSection
                            title="Servicios"
                            subtitle="Catálogo y Configuración"
                            icon={<Layers size={20} />}
                            delay="200ms"
                            rows={[
                                { name: 'Gestión de Servicios Ilimitados', basic: true, pro: true, enterprise: true },
                                { name: 'Activar / Desactivar Servicios', basic: true, pro: true, enterprise: true },
                                { name: 'Precios y Duraciones Variables', basic: true, pro: true, enterprise: true },
                                { name: 'Descripción Detallada (Contexto para IA)', basic: false, pro: true, enterprise: true },
                                { name: 'Precios Dinámicos / Ofertas', basic: false, pro: false, enterprise: true },
                            ]}
                        />

                        {/* 6. Módulo de Actividad */}
                        <ModuleSection
                            title="Actividad"
                            subtitle="Registro de Auditoría"
                            icon={<List size={20} />}
                            delay="250ms"
                            rows={[
                                { name: 'Registro de actividad General', basic: false, pro: true, enterprise: true },
                                { name: 'Historial de cambios en clientes', basic: false, pro: true, enterprise: true },
                                { name: 'Historial de cambios en turnos', basic: false, pro: true, enterprise: true },
                                { name: 'Auditoría de acciones de staff', basic: false, pro: true, enterprise: true },
                                { name: 'Exportación Excel', basic: false, pro: false, enterprise: true },
                            ]}
                        />

                        {/* 7. Módulo de Usuarios */}
                        <ModuleSection
                            title="Usuarios"
                            subtitle="Control de Acceso"
                            icon={<ShieldCheck size={20} />}
                            delay="300ms"
                            rows={[
                                { name: 'Gestión de Personal', basic: true, pro: true, enterprise: true },
                                { name: 'Roles y Permisos Personalizados', basic: false, pro: true, enterprise: true },
                                { name: 'Límite de Usuarios', basic: '1', pro: 'Hasta 5', enterprise: 'Ilimitados' },
                            ]}
                        />

                        {/* 8. Módulo de Configuración */}
                        <ModuleSection
                            title="Configuración"
                            subtitle="Personalización del negocio"
                            icon={<Settings size={20} />}
                            delay="350ms"
                            rows={[
                                { name: 'Perfil de Negocio Completo', basic: true, pro: true, enterprise: true },
                                { name: 'Horarios de Atención Generales', basic: true, pro: true, enterprise: true },
                                { name: 'Personalización de IA (Contexto)', basic: false, pro: true, enterprise: true },
                                { name: 'Integración con Gmail', basic: false, pro: false, enterprise: true },
                            ]}
                        />

                        {/* 9. Módulo de Sucursales */}
                        <ModuleSection
                            title={
                                <div className="flex items-center gap-2">
                                    Sucursales
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest text-amber-600">
                                        <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                        Próximamente
                                    </span>
                                </div>
                            }
                            subtitle="Gestión Multi-Sede"
                            icon={<Building2 size={20} />}
                            delay="400ms"
                            rows={[
                                { name: 'Gestión de Sucursal Principal', basic: true, pro: true, enterprise: true },
                                { name: 'Configuración de Horarios por Sede', basic: true, pro: true, enterprise: true },
                                { name: 'Múltiples Sucursales', basic: false, pro: false, enterprise: true },
                                { name: 'Panel de Control Multi-Sede', basic: false, pro: false, enterprise: true },
                            ]}
                        />

                        {/* 10. Módulo de Soporte */}
                        <ModuleSection
                            title={
                                <div className="flex items-center gap-2">
                                    Soporte
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest text-amber-600">
                                        <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                        Próximamente
                                    </span>
                                </div>
                            }
                            subtitle="Atención y Garantía"
                            icon={<ShieldCheck size={20} />}
                            delay="450ms"
                            rows={[
                                { name: 'Soporte vía Ticket', basic: true, pro: true, enterprise: true },
                                { name: 'Soporte vía WhatsApp', basic: false, pro: true, enterprise: true },
                                { name: 'Tiempo de Respuesta Garantizado', basic: '48h', pro: '24h', enterprise: '4h' },
                            ]}
                        />

                        {/* Pie de Tabla */}
                        <div className="flex flex-col items-center justify-center pt-8 border-t border-navy-900/5">
                            <Zap size={24} className="text-navy-900/20 mb-4" />
                            <p className="text-[12px] font-bold text-navy-900/40 text-center max-w-lg leading-relaxed">
                                ¿Necesitas algo a medida? Integración de Modulos a la Medida disponible para soluciones NovTurnIA.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

function ModuleSection({ title, subtitle, icon, rows, delay = '0ms' }) {
    return (
        <div className="animate-fade-up" style={{ animationDelay: delay }}>
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                    {icon}
                </div>
                <div>
                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">{title}</h4>
                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">{subtitle}</p>
                </div>
            </div>

            <div className="bg-white/40 border border-white/80 rounded-[32px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="border-b border-navy-900/5">
                                <th className="p-6 text-[11px] font-black text-navy-900/40 uppercase tracking-widest">Característica</th>
                                <th className="p-6 text-[11px] font-black text-navy-900 uppercase tracking-widest text-center">Básico</th>
                                <th className="p-6 text-[11px] font-black text-navy-900 uppercase tracking-widest text-center">Pro</th>
                                <th className="p-6 text-[11px] font-black text-navy-900 uppercase tracking-widest text-center">Enterprise</th>
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
