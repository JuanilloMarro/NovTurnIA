import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, Users, BarChart2, MessageCircle, Bot, ShieldCheck, Settings, List, Layers, CreditCard, Lock, Tag, History, Wallet } from 'lucide-react';
import AIStar from './Icons/AIStar';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../store/useAppStore';
import { getBusinessInfo } from '../services/supabaseService';

// Glows en esquina — mismo patrón que los botones del listado de Ofertas, pero
// escalados al ancho del item (pill ancho y bajo) para que el difuminado se
// aprecie igual que en los botones/paneles del sistema.
function NavGlow() {
    return (
        <>
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
        </>
    );
}

// Item de navegación con el estilo de los botones de Ofertas:
// pill glass (bg-white/40 + blur + border-white/60 + shadow-md) y glows al estar activo.
function NavItem({ to, end, icon: Icon, label, locked, iconSize = 16, labelClass = '', onClick }) {
    const base = 'relative overflow-hidden flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-300';
    return (
        <NavLink
            to={to}
            end={end}
            onClick={onClick}
            className={({ isActive }) =>
                isActive
                    ? `${base} bg-white/40 backdrop-blur-2xl border border-white/60 shadow-md text-navy-700`
                    : `${base} border border-transparent text-navy-700/40 hover:bg-white/30 hover:text-navy-700`
            }
        >
            {({ isActive }) => (
                <>
                    {isActive && <NavGlow />}
                    <Icon size={iconSize} className="shrink-0 relative z-10" />
                    <span className={`flex-1 relative z-10 whitespace-nowrap ${labelClass}`}>{label}</span>
                    {locked && <Lock size={11} className="shrink-0 relative z-10" />}
                </>
            )}
        </NavLink>
    );
}

export default function Sidebar({ onOpenPlans }) {
    const { canViewStats, canManageRoles, canManageServices, canViewPatients, canViewConversations, canViewFollowUp, canViewFinance } = usePermissions();
    const { hasFeature } = usePlanLimits();
    const statsUnlocked = hasFeature('dashboard');
    const auditUnlocked = hasFeature('audit_log');
    const offersUnlocked = hasFeature('dynamic_pricing');
    const followUpUnlocked = hasFeature('followup');
    const financeUnlocked = hasFeature('finance');
    const { profile } = useAuth();
    const { isSidebarOpen, toggleSidebar } = useAppStore();
    const [businessName, setBusinessName] = useState('');

    const businessId = profile?.business_id || '';

    useEffect(() => {
        if (businessId) {
            getBusinessInfo()
                .then(info => setBusinessName(info?.name || 'Negocio'))
                .catch(() => setBusinessName('Negocio'));
        }
    }, [businessId]);

    const closeMobile = () => {
        if (window.innerWidth < 768) toggleSidebar();
    };

    // Estilo del botón "Planes" (no es ruta, nunca está activo) — variante inactiva del item.
    const normalClass = 'relative overflow-hidden flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-300 border border-transparent text-navy-700/40 hover:bg-white/30 hover:text-navy-700';

    return (
        <>
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-navy-900/20 backdrop-blur-sm z-[19] cursor-pointer"
                    onClick={toggleSidebar}
                />
            )}

            <aside className={`absolute left-0 top-0 bottom-0 w-[272px] p-6 flex flex-col z-20 bg-transparent transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer transition-transform hover:scale-[1.02] group/logo">
                    <div className="w-9 h-9 rounded-[10px] bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card transition-all duration-500 group-hover/logo:-translate-y-1">
                        <div className="relative">
                            <Bot size={18} strokeWidth={2.5} className="transition-transform duration-500 group-hover/logo:rotate-12" />
                            <AIStar
                                size={8}
                                className="absolute -top-1 -left-1 text-white transition-all duration-500 group-hover/logo:scale-125"
                                strokeWidth={2.5}
                            />
                        </div>
                    </div>
                    <span className="font-bold text-navy-900 tracking-tight text-lg">NovTurnIA</span>
                </div>

                <nav className="flex-1 flex flex-col gap-1.5 mt-2">
                    <NavItem to="/" end icon={Calendar} label="Turnos" onClick={closeMobile} />

                    {canViewFollowUp && (
                        <NavItem to="/followup" icon={History} label="Seguimiento" locked={!followUpUnlocked} onClick={closeMobile} />
                    )}

                    {canViewPatients && (
                        <NavItem to="/patients" icon={Users} label="Clientes" onClick={closeMobile} />
                    )}

                    {canViewConversations && (
                        <NavItem to="/conversations" icon={MessageCircle} label="Conversaciones" onClick={closeMobile} />
                    )}

                    {canViewStats && (
                        <NavItem to="/stats" icon={BarChart2} label="Estadísticas" locked={!statsUnlocked} onClick={closeMobile} />
                    )}

                    {(canManageServices || canManageRoles) && (
                        <NavItem to="/settings" icon={Layers} label="Servicios" onClick={closeMobile} />
                    )}

                    {canManageServices && (
                        <NavItem to="/offers" icon={Tag} label="Ofertas" locked={!offersUnlocked} onClick={closeMobile} />
                    )}

                    {canViewFinance && (
                        <NavItem to="/finance" icon={Wallet} label="Finanzas" locked={!financeUnlocked} onClick={closeMobile} />
                    )}

                    {canManageRoles && (
                        <>
                            <NavItem to="/audit-log" icon={List} label="Actividad" locked={!auditUnlocked} onClick={closeMobile} />
                            <NavItem to="/users" icon={ShieldCheck} label="Usuarios" onClick={closeMobile} />
                            <NavItem to="/business" icon={Bot} iconSize={18} label="Inteligencia Artificial" onClick={closeMobile} />
                        </>
                    )}

                    <button
                        onClick={() => { onOpenPlans(); closeMobile(); }}
                        className={normalClass}
                    >
                        <CreditCard size={16} className="shrink-0 relative z-10" /> <span className="relative z-10">Planes</span>
                    </button>
                </nav>

                <div className="mt-auto pt-6 px-5 border-t border-white/20">
                    <div className="font-bold text-navy-900/60 truncate tracking-tight text-[12px]">{businessName || 'Cargando...'}</div>
                </div>
            </aside>
        </>
    );
}
