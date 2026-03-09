import { NavLink } from 'react-router-dom';
import { Calendar, Users, BarChart2, MessageCircle, Sparkles } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

export default function Sidebar() {
    const { canViewStats } = usePermissions();

    const activeClass = 'flex items-center gap-3 px-4 py-3 xl:px-5 xl:py-3.5 rounded-2xl bg-white/70 backdrop-blur-md shadow-card border border-white/80 text-navy-700 font-bold text-[14.5px] tracking-wide transition-all';
    const normalClass = 'flex items-center gap-3 px-4 py-3 xl:px-5 xl:py-3.5 rounded-2xl text-gray-500 hover:bg-white/40 hover:backdrop-blur-sm hover:shadow-sm hover:border hover:border-white/50 hover:text-navy-700 text-[14.5px] font-medium transition-all duration-200 border border-transparent';

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-[240px] p-6 flex flex-col z-20 bg-transparent">
            <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer transition-transform hover:scale-[1.02]">
                <div className="w-9 h-9 rounded-[10px] bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card">
                    <Sparkles size={18} strokeWidth={2.5} />
                </div>
                <span className="font-bold text-navy-900 tracking-tight text-lg">NovTurnAI</span>
            </div>

            <div className="mb-6 px-3 py-3 rounded-2xl bg-white/30 backdrop-blur-sm border border-white/40 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                <div className="font-bold text-navy-900 truncate tracking-tight text-[13px]">Clínica Novium Test</div>
                <div className="mt-0.5 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">ID: 1</div>
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
            </nav>

            <div className="mt-auto pt-6 px-2 text-[10px] text-gray-400">
                NovTurnAI · Powered with AI
            </div>
        </aside>
    );
}
