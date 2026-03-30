import { Bell, Moon, Sun, Monitor, Check, LogOut, Calendar, UserPlus, Trash2, Bot } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { useAuth } from '../hooks/useAuth';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Topbar() {
    const { profile, logout } = useAuth();
    const { activityLog, unreadCount, markAllRead } = useNotifications();
    const clearActivityLog = useToastStore(s => s.clearActivityLog);
    const { theme, setTheme } = useAppStore();
    const [showNotif, setShowNotif] = useState(false);
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const notifRef = useRef(null);
    const profileRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotif(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowThemeMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const themeOptions = [
        { id: 'light', label: 'Modo Claro', icon: <Sun size={14} /> },
        { id: 'dark', label: 'Modo Oscuro', icon: <Moon size={14} /> },
        { id: 'system', label: 'Predeterminado', icon: <Monitor size={14} /> },
    ];

    const handleBellClick = () => {
        const willOpen = !showNotif;
        setShowNotif(willOpen);
        setShowThemeMenu(false);
        if (willOpen) markAllRead();
    };

    return (
        <header className="h-[72px] px-6 flex items-center justify-end z-[100] transition-all sticky top-0 bg-transparent">
            <div className="flex items-center gap-6 mt-2">
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={handleBellClick}
                        className="relative flex items-center justify-center w-11 h-11 rounded-full border border-white/80 bg-white/40 backdrop-blur-md text-navy-700 shadow-card hover:bg-white/60 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotif && (
                        <div className="absolute top-14 right-0 w-[400px] sm:w-[440px] bg-white/30 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_rgba(26,58,107,0.15)] border border-white/60 p-3 animate-fade-up z-[110] overflow-hidden">
                            <div className="flex justify-between items-center mb-3 px-3 pt-1">
                                <h3 className="font-bold text-navy-900 text-base">Actividad</h3>
                                {activityLog.length > 0 && (
                                    <button 
                                        onClick={() => clearActivityLog()}
                                        className="text-[10px] text-red-600/70 hover:text-red-600 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                                    >
                                        <Trash2 size={10} />
                                        Limpiar
                                    </button>
                                )}
                            </div>
                            <div className="max-h-[320px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                {activityLog.length === 0 ? (
                                    <div className="text-center text-navy-800/60 py-8 text-xs font-bold">Sin actividad reciente</div>
                                ) : (
                                    activityLog.map(entry => {
                                        const isApt = entry.type === 'appointment';
                                        const isPatient = entry.type === 'patient';
                                        const isBot = entry.type.startsWith('bot');

                                        return (
                                            <div key={entry.id} className={`flex items-center gap-3 p-3 bg-white/40 hover:bg-white/60 border border-white/50 rounded-2xl transition-all cursor-pointer shadow-sm group ${
                                                !entry.read ? 'ring-1 ring-navy-400/20' : ''
                                            }`}>
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm border border-white/30 text-sm bg-navy-900/90`}>
                                                    {isBot ? <Bot size={15} className="text-white" /> : isApt ? <Calendar size={15} className="text-white" /> : isPatient ? <UserPlus size={15} className="text-white" /> : (entry.title?.[0] || '?')}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-1">
                                                    <div className="font-bold text-navy-900 text-sm truncate leading-tight flex items-center gap-1.5">
                                                        {entry.title}
                                                        {isPatient && <span className="bg-navy-100 text-navy-800 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Nuevo</span>}
                                                    </div>
                                                    <div className="text-navy-800/70 text-[11px] truncate mt-0.5 font-medium">
                                                        {entry.message}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-[10px] font-bold bg-white/30 border-white/40 text-navy-700">
                                                    <span>{getTimeAgo(entry.created_at || entry.timestamp)}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={profileRef}>
                    <div
                        onClick={() => {
                            setShowThemeMenu(!showThemeMenu);
                            setShowNotif(false);
                        }}
                        className="w-11 h-11 rounded-full bg-navy-900 border border-white/20 flex items-center justify-center text-white font-bold shadow-card shadow-navy-900/20 text-[15px] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                    >
                        {getInitials(profile?.full_name || profile?.display_name)}
                    </div>

                    {showThemeMenu && (
                        <div className="absolute top-12 right-0 w-44 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-white/90 p-2 animate-fade-up z-[110]">
                            <button
                                onClick={() => logout()}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-bold text-red-600 hover:bg-red-50 transition-all duration-200"
                            >
                                <LogOut size={16} />
                                Cerrar Sesión
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
}
