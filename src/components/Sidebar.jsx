import { NavLink } from 'react-router-dom';
import { Calendar, Users, BarChart2, MessageCircle, Bot, ShieldCheck } from 'lucide-react';
import AIStar from './Icons/AIStar';
import { usePermissions } from '../hooks/usePermissions';
import { BUSINESS_ID } from '../config/supabase';

export default function Sidebar() {
    const { role, canViewStats, canManageRoles } = usePermissions();

    const activeClass = 'flex items-center gap-3 px-4 py-3 xl:px-5 xl:py-3.5 rounded-2xl bg-white/70 backdrop-blur-md shadow-card border border-white/80 text-navy-700 font-bold text-[14.5px] tracking-wide transition-all';
    const normalClass = 'flex items-center gap-3 px-4 py-3 xl:px-5 xl:py-3.5 rounded-2xl text-gray-500 hover:bg-white/40 hover:backdrop-blur-sm hover:shadow-sm hover:border hover:border-white/50 hover:text-navy-700 text-[14.5px] font-medium transition-all duration-200 border border-transparent';

    return (
        <aside className="absolute left-0 top-0 bottom-0 w-[240px] p-6 flex flex-col z-20 bg-transparent">
            <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer transition-transform hover:scale-[1.02] group/logo">
                <div className="w-9 h-9 rounded-[10px] bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card transition-all duration-500 group-hover/logo:-translate-y-1">
                    <div className="relative">
                        <Bot size={18} strokeWidth={2.5} className="transition-transform duration-500 group-hover/logo:rotate-12" />
                        <AIStar 
                            size={10} 
                            className="absolute -top-1.5 -left-1.5 text-white animate-pulse transition-all duration-500 group-hover/logo:scale-125" 
                            strokeWidth={2.5}
                        />
                    </div>
                </div>
                <span className="font-bold text-navy-900 tracking-tight text-lg">NovTurnIA</span>
            </div>

            <nav className="flex-1 flex flex-col gap-1.5 mt-2">
                <NavLink to="/" className={({ isActive }) => isActive ? activeClass : normalClass}>
                    <Calendar size={18} /> Turnos
                </NavLink>
                <NavLink to="/patients" className={({ isActive }) => isActive ? activeClass : normalClass}>
                    <Users size={18} /> Pacientes
                </NavLink>
                <NavLink to="/conversations" className={({ isActive }) => isActive ? activeClass : normalClass}>
                    <MessageCircle size={18} /> Conversaciones
                </NavLink>
                {canViewStats && (
                    <NavLink to="/stats" className={({ isActive }) => isActive ? activeClass : normalClass}>
                        <BarChart2 size={18} /> Estadísticas
                    </NavLink>
                )}
                {canManageRoles && (
                    <NavLink to="/users" className={({ isActive }) => isActive ? activeClass : normalClass}>
                        <ShieldCheck size={18} /> Usuarios
                    </NavLink>
                )}
            </nav>

            <div className="mt-auto pt-6 px-5 border-t border-white/20">
                <div className="font-bold text-navy-900/60 truncate tracking-tight text-[12px]">Clínica Novium Test</div>
                <div className="mt-0.5 text-[9px] font-bold text-navy-900/30 uppercase tracking-widest">
                    ID: {BUSINESS_ID}
                </div>
            </div>
        </aside>
    );
}
