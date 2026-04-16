import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, Users, BarChart2, MessageCircle, Bot, ShieldCheck, Settings, ChevronDown, List } from 'lucide-react';
import AIStar from './Icons/AIStar';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../store/useAppStore';
import { getBusinessInfo } from '../services/supabaseService';

export default function Sidebar() {
    const { role, canViewStats, canManageRoles, canViewPatients, canViewConversations } = usePermissions();
    const { profile } = useAuth();
    const { isSidebarOpen, toggleSidebar } = useAppStore();
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [businessName, setBusinessName] = useState('');
    const location = useLocation();

    const businessId = profile?.business_id || 0;

    // Auto-open config if we're on a config page
    useEffect(() => {
        if (location.pathname.startsWith('/users') || location.pathname.startsWith('/audit-log')) {
            setIsConfigOpen(true);
        }
    }, [location.pathname]);

    // Fetch business name when profile loads
    useEffect(() => {
        if (businessId) {
            getBusinessInfo()
                .then(info => setBusinessName(info?.name || 'Negocio'))
                .catch(() => setBusinessName('Negocio'));
        }
    }, [businessId]);

    // Cierra sidebar en mobile al navegar
    const closeMobile = () => {
        if (window.innerWidth < 768) toggleSidebar();
    };

    const activeClass    = 'flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/50 backdrop-blur-md shadow-sm text-navy-900 font-bold text-[13px] tracking-wide transition-all';
    const normalClass    = 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-navy-900/40 hover:bg-white/30 hover:text-navy-900 text-[13px] font-bold transition-all duration-300';
    const subActiveClass = 'flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/50 shadow-sm text-navy-900 font-bold text-[13px] tracking-wide transition-all ml-2 mt-0.5';
    const subNormalClass = 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-navy-900/40 hover:bg-white/30 hover:text-navy-900 text-[13px] font-bold transition-all duration-300 ml-2 mt-0.5';

    return (
        <>
            {/* Mobile backdrop — visible solo cuando sidebar está abierto en mobile */}
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-navy-900/20 backdrop-blur-sm z-[19] cursor-pointer"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar — en desktop siempre visible (md:translate-x-0 tiene prioridad);
                          en mobile se desliza fuera (-translate-x-full) y entra con toggle */}
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
                    <NavLink to="/" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                        <Calendar size={16} /> Turnos
                    </NavLink>
                    {canViewPatients && (
                        <NavLink to="/patients" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                            <Users size={16} /> Pacientes
                        </NavLink>
                    )}
                    {canViewConversations && (
                        <NavLink to="/conversations" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                            <MessageCircle size={16} /> Conversaciones
                        </NavLink>
                    )}
                    {canViewStats && (
                        <NavLink to="/stats" onClick={closeMobile} className={({ isActive }) => isActive ? activeClass : normalClass}>
                            <BarChart2 size={16} /> Estadísticas
                        </NavLink>
                    )}

                    {canManageRoles && (
                        <button
                            onClick={() => setIsConfigOpen(!isConfigOpen)}
                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-300 ${isConfigOpen ? 'bg-white/30 text-navy-900' : 'text-navy-900/40 hover:bg-white/20 hover:text-navy-900'} text-[13px] font-bold`}
                        >
                            <div className="flex items-center gap-3">
                                <Settings size={16} className={isConfigOpen ? 'text-navy-900' : ''} />
                                <span className={isConfigOpen ? 'text-navy-900' : ''}>Configuración</span>
                            </div>
                            <ChevronDown size={14} strokeWidth={3} className={`transition-transform duration-300 ${isConfigOpen ? 'rotate-180 text-navy-900' : ''}`} />
                        </button>
                    )}

                    {canManageRoles && (
                        <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ${isConfigOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <NavLink to="/users" onClick={closeMobile} className={({ isActive }) => isActive ? subActiveClass : subNormalClass}>
                                <ShieldCheck size={16} /> Usuarios
                            </NavLink>
                            <NavLink to="/audit-log" onClick={closeMobile} className={({ isActive }) => isActive ? subActiveClass : subNormalClass}>
                                <List size={16} /> Actividad
                            </NavLink>
                        </div>
                    )}
                </nav>

                <div className="mt-auto pt-6 px-5 border-t border-white/20">
                    <div className="font-bold text-navy-900/60 truncate tracking-tight text-[12px]">{businessName || 'Cargando...'}</div>
                </div>
            </aside>
        </>
    );
}
