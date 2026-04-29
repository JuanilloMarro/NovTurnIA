import { useState, useRef, useEffect } from 'react';
import { CreditCard, Star, Bot, Check, X, Users, BarChart2, ShieldCheck, Zap, Calendar, MessageCircle, Settings, List, Layers, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import AIStar from './Icons/AIStar';
import { getBusinessInfo } from '../services/supabaseService';

export default function PlansModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const detailsRef = useRef(null);
    const [currentPlan, setCurrentPlan] = useState(null);

    useEffect(() => {
        if (isOpen) {
            getBusinessInfo().then(info => {
                setCurrentPlan(info?.plan || 'basic');
            }).catch(() => {
                setCurrentPlan('basic');
            });
        }
    }, [isOpen]);

    const scrollToDetails = () => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const plans = [
        {
            id: 'basic',
            title: 'Básico',
            price: 'Q 499',
            perfectFor: 'Para emprendedores que buscan automatizar su agenda básica.',
            icon: <Check size={18} />,
            features: ['Turnos con IA ilimitados', 'IA: Gemini 2.5 Flash', 'Sincronización con Calendarios', 'Dashboard: Limitado', '1 Usuario', 'Integración de Modulos a la Medida']
        },
        {
            id: 'pro',
            title: 'Pro',
            price: 'Q 999',
            perfectFor: 'Para negocios en crecimiento que necesitan control total.',
            icon: <Star size={18} />,
            active: true,
            features: ['IA: Gemini 2.5 Pro', 'IA con memoria contextual', 'Analítica Avanzada de Clientes', 'Dashboard: Completo', 'Hasta 5 Usuarios', 'Integración de Modulos a la Medida']
        },
        {
            id: 'enterprise',
            title: 'Enterprise',
            price: 'Q 1,999',
            perfectFor: 'Para empresas grandes que escalan su comunicación con IA.',
            icon: <ShieldCheck size={18} />,
            features: ['IA: Gemini 3.1 Pro', 'Confirmaciones automáticas', 'Pagina Web', 'Generación de Contenido', 'Usuarios ilimitados', 'Integración de Modulos a la Medida']
        }
    ];

    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[40px] shadow-[0_20px_50px_rgba(26,58,107,0.15)] w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fade-up flex flex-col">
                {/* Header */}
                <div className="p-8 pb-4 flex items-center justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/50 border border-white/80 text-navy-900/40 hover:text-navy-900 hover:bg-white transition-all duration-300"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-0">
                    <div className="flex flex-col items-center justify-center mb-4">
                        <div className="w-16 h-16 rounded-[18px] bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card mb-5 transition-transform hover:scale-110 duration-500 group">
                            <div className="relative">
                                <Bot size={28} strokeWidth={2.5} className="transition-transform duration-500 group-hover:rotate-12" />
                                <AIStar
                                    size={12}
                                    className="absolute -top-1 -left-1 text-white transition-all duration-500 group-hover:scale-125"
                                    strokeWidth={2.5}
                                />
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-navy-900 tracking-tight mb-2 text-center max-w-xl">
                            Precios increíbles, diseñados para escalar.
                        </h3>
                        <p className="text-navy-700/60 font-bold text-[13px] text-center max-w-2xl leading-relaxed">
                            Implementa Inteligencia Artificial en atención a tu cliente, gestiona y maneja tu negocio en una sola plataforma premium.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full pb-4">
                        {plans.map((plan, i) => (
                            <div key={i} className="p-6 rounded-[32px] border border-navy-900 bg-navy-900 text-white shadow-xl transition-all duration-500 flex flex-col hover:scale-[1.02] relative overflow-hidden group/card">
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
                                    <div className="flex items-baseline gap-1 mb-4 relative z-10">
                                        <span className="text-2xl font-black text-white leading-none">{plan.price}</span>
                                        <span className="text-[10px] opacity-60 font-bold uppercase tracking-tight">/mes</span>
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
                        ))}
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
                        <div className="animate-fade-up">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">Turnos</h4>
                                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">Gestión de agenda y IA</p>
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
                                            {[
                                                { name: 'Visualización de Agenda', basic: true, pro: true, enterprise: true },
                                                { name: 'Creación Manual de Turnos', basic: true, pro: true, enterprise: true },
                                                { name: 'Recordatorios Automáticos', basic: false, pro: true, enterprise: true },
                                                { name: 'Seguimiento de Cancelaciones / No Presentes', basic: false, pro: true, enterprise: true },
                                                { name: 'Agente IA (Agendamiento)', basic: 'Ilimitado', pro: 'Ilimitado', enterprise: 'Ilimitado' },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-white/40 transition-colors">
                                                    <td className="p-6 text-[12px] font-bold text-navy-900">{row.name}</td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.basic === 'boolean'
                                                            ? (row.basic ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.basic}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.pro === 'boolean'
                                                            ? (row.pro ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.pro}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.enterprise === 'boolean'
                                                            ? (row.enterprise ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.enterprise}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 2. Módulo de Clientes */}
                        <div className="animate-fade-up">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">Clientes</h4>
                                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">Base de datos y perfiles</p>
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
                                            {[
                                                { name: 'Base de Datos Centralizada', basic: true, pro: true, enterprise: true },
                                                { name: 'Historial de Turnos', basic: true, pro: true, enterprise: true },
                                                { name: 'Etiquetas y Notas', basic: false, pro: true, enterprise: true },
                                                { name: 'Campos Personalizados', basic: false, pro: true, enterprise: true },
                                                { name: 'Límite de Clientes Visibles', basic: '100', pro: '500', enterprise: 'Ilimitados' },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-white/40 transition-colors">
                                                    <td className="p-6 text-[12px] font-bold text-navy-900">{row.name}</td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.basic === 'boolean'
                                                            ? (row.basic ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.basic}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.pro === 'boolean'
                                                            ? (row.pro ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.pro}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.enterprise === 'boolean'
                                                            ? (row.enterprise ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.enterprise}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 3. Módulo de Conversaciones */}
                        <div className="animate-fade-up">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                                    <MessageCircle size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">Conversaciones</h4>
                                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">IA y Mensajería</p>
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
                                            {[
                                                { name: 'Bandeja Unificada', basic: true, pro: true, enterprise: true },
                                                { name: 'Manejo de Emergencias', basic: true, pro: true, enterprise: true },
                                                { name: 'Auto-Respuestas Inteligentes', basic: true, pro: true, enterprise: true },
                                                { name: 'IA con Contexto Completo', basic: false, pro: true, enterprise: true },
                                                { name: 'Confirmación Automática por WhatsApp', basic: false, pro: false, enterprise: true },
                                                { name: 'Límite de Mensajes', basic: '500 / mes', pro: '2,500 / mes', enterprise: 'Ilimitados' },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-white/40 transition-colors">
                                                    <td className="p-6 text-[12px] font-bold text-navy-900">{row.name}</td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.basic === 'boolean'
                                                            ? (row.basic ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.basic}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.pro === 'boolean'
                                                            ? (row.pro ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.pro}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.enterprise === 'boolean'
                                                            ? (row.enterprise ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.enterprise}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 4. Módulo de Estadísticas */}
                        <div className="animate-fade-up">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                                    <BarChart2 size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">Estadísticas</h4>
                                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">Reportes y métricas</p>
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
                                            {[
                                                { name: 'Dashboard de Métricas (Turnos y Clientes)', basic: false, pro: true, enterprise: true },
                                                { name: 'Métricas de Mensajes (IA)', basic: false, pro: true, enterprise: true },
                                                { name: 'Tasa de Confirmación y Cancelaciones', basic: false, pro: true, enterprise: true },
                                                { name: 'Histórico Comparativo Mensual', basic: false, pro: true, enterprise: true },
                                                { name: 'Exportación de Reportes PDF/Excel', basic: false, pro: false, enterprise: true },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-white/40 transition-colors">
                                                    <td className="p-6 text-[12px] font-bold text-navy-900">{row.name}</td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.basic === 'boolean'
                                                            ? (row.basic ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.basic}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.pro === 'boolean'
                                                            ? (row.pro ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.pro}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.enterprise === 'boolean'
                                                            ? (row.enterprise ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.enterprise}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 5. Módulo de Servicios */}
                        <div className="animate-fade-up">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">Servicios</h4>
                                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">Catálogo y precios</p>
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
                                            {[
                                                { name: 'Gestión de Servicios Ilimitados', basic: true, pro: true, enterprise: true },
                                                { name: 'Activar / Desactivar Servicios', basic: true, pro: true, enterprise: true },
                                                { name: 'Descripción Detallada (Contexto para IA)', basic: false, pro: true, enterprise: true },
                                                { name: 'Precios Dinámicos / Ofertas', basic: false, pro: true, enterprise: true },
                                                { name: 'Servicios VIP / Privados', basic: false, pro: false, enterprise: true },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-white/40 transition-colors">
                                                    <td className="p-6 text-[12px] font-bold text-navy-900">{row.name}</td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.basic === 'boolean'
                                                            ? (row.basic ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.basic}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.pro === 'boolean'
                                                            ? (row.pro ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.pro}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.enterprise === 'boolean'
                                                            ? (row.enterprise ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.enterprise}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 6. Módulo de Actividad */}
                        <div className="animate-fade-up">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                                    <List size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">Actividad</h4>
                                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">Auditoría y control</p>
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
                                            {[
                                                { name: 'Registro de Actividad General', basic: false, pro: true, enterprise: true },
                                                { name: 'Historial de Cambios en Clientes', basic: false, pro: true, enterprise: true },
                                                { name: 'Historial de Cambios en Turnos', basic: false, pro: true, enterprise: true },
                                                { name: 'Auditoría de Acciones de Staff', basic: false, pro: true, enterprise: true },
                                                { name: 'Exportación de Logs (CSV/Excel)', basic: false, pro: false, enterprise: true },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-white/40 transition-colors">
                                                    <td className="p-6 text-[12px] font-bold text-navy-900">{row.name}</td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.basic === 'boolean'
                                                            ? (row.basic ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.basic}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.pro === 'boolean'
                                                            ? (row.pro ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.pro}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.enterprise === 'boolean'
                                                            ? (row.enterprise ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.enterprise}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 7. Módulo de Usuarios */}
                        <div className="animate-fade-up">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                                    <ShieldCheck size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">Usuarios</h4>
                                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">Roles y acceso</p>
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
                                            {[
                                                { name: 'Gestión de Personal', basic: true, pro: true, enterprise: true },
                                                { name: 'Roles (Admin, Editor, Viewer)', basic: 'Admin únicamente', pro: 'Roles Personalizables', enterprise: 'Roles Personalizables' },
                                                { name: 'Límite de Usuarios', basic: '1', pro: 'Hasta 5', enterprise: 'Ilimitados' },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-white/40 transition-colors">
                                                    <td className="p-6 text-[12px] font-bold text-navy-900">{row.name}</td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.basic === 'boolean'
                                                            ? (row.basic ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.basic}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.pro === 'boolean'
                                                            ? (row.pro ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.pro}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.enterprise === 'boolean'
                                                            ? (row.enterprise ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.enterprise}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 8. Módulo de Configuración */}
                        <div className="animate-fade-up">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900">
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-navy-900 tracking-tight leading-none mb-1">Configuración</h4>
                                    <p className="text-[11px] text-navy-700/50 font-bold uppercase tracking-wider">Personalización del negocio</p>
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
                                            {[
                                                { name: 'Perfil de Negocio Completo', basic: true, pro: true, enterprise: true },
                                                { name: 'Horarios de Atención', basic: true, pro: true, enterprise: true },
                                                { name: 'Personalización de IA (Contexto)', basic: false, pro: true, enterprise: true },
                                                { name: 'Integración con Gmail', basic: false, pro: true, enterprise: true },
                                                { name: 'Multi-Sede (Sucursales)', basic: false, pro: false, enterprise: true },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-navy-900/5 last:border-0 hover:bg-white/40 transition-colors">
                                                    <td className="p-6 text-[12px] font-bold text-navy-900">{row.name}</td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.basic === 'boolean'
                                                            ? (row.basic ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.basic}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.pro === 'boolean'
                                                            ? (row.pro ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.pro}</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        {typeof row.enterprise === 'boolean'
                                                            ? (row.enterprise ? <Check size={16} className="mx-auto text-emerald-500" strokeWidth={3} /> : <X size={16} className="mx-auto text-navy-900/20" />)
                                                            : <span className="text-[12px] font-bold text-navy-900/60">{row.enterprise}</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
