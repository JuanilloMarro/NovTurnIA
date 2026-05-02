import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, Users, BarChart2, MessageCircle, Bot, ShieldCheck, Settings, List, Layers, CreditCard, Lock } from 'lucide-react';
import AIStar from './Icons/AIStar';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../store/useAppStore';
import { getBusinessInfo } from '../services/supabaseService';

export default function Sidebar({ onOpenPlans }) {
    const { canViewStats, canManageRoles, canManageServices, canViewPatients, canViewConversations } = usePermissions();
    const { hasFeature } = usePlanLimits();
    const statsUnlocked = hasFeature('dashboard');
    const auditUnlocked = hasFeature('audit_log');
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

    const activeClass = 'flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/50 backdrop-blur-md shadow-sm text-navy-900 font-bold text-[13px] tracking-wide transition-all';
    const normalClass = 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-navy-900/40 hover:bg-white/30 hover:text-navy-900 text-[13px] font-bold transition-all duration-300';

    return (
        <>
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-navy-900/20 backdrop-blur-sm z-[19] cursor-pointer"
                    onClick={toggleSidebar}
                />
            )}

            <aside className={`absolute left-0 top-0 bottom-0 w-[240px] p-6 flex flex-col z-20 bg-transparent transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
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
                    <NavLink to="/" end onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                        <Calendar size={16} /> Turnos
                    </NavLink>

                    {canViewPatients && (
                        <NavLink to="/patients" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                            <Users size={16} /> Clientes
                        </NavLink>
                    )}

                    {canViewConversations && (
                        <NavLink to="/conversations" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                            <MessageCircle size={16} /> Conversaciones
                        </NavLink>
                    )}

                    {canViewStats && (
                        <NavLink to="/stats" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                            <BarChart2 size={16} />
                            <span className="flex-1">Estadísticas</span>
                            {!statsUnlocked && <Lock size={11} className="text-navy-900" />}
                        </NavLink>
                    )}

                    {(canManageServices || canManageRoles) && (
                        <NavLink to="/settings" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                            <Layers size={16} /> Servicios
                        </NavLink>
                    )}

                    {canManageRoles && (
                        <>
                            <NavLink to="/audit-log" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                                <List size={16} />
                                <span className="flex-1">Actividad</span>
                                {!auditUnlocked && <Lock size={11} className="text-navy-900" />}
                            </NavLink>

                            <NavLink to="/users" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                                <ShieldCheck size={16} /> Usuarios
                            </NavLink>

                            <NavLink to="/business" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                                <Settings size={16} /> Configuración
                            </NavLink>
                        </>
                    )}

                    <button
                        onClick={() => { onOpenPlans(); closeMobile(); }}
                        className={normalClass}
                    >
                        <CreditCard size={16} /> Planes
                    </button>
                </nav>

                <div className="mt-auto pt-6 px-5 border-t border-white/20">
                    <div className="font-bold text-navy-900/60 truncate tracking-tight text-[12px]">{businessName || 'Cargando...'}</div>
                </div>
            </aside>
        </>
    );
}
