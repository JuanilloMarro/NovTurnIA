import { Bell, Moon, Sun, Monitor, Check, LogOut } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAppStore } from '../store/useAppStore';
import { useAuth } from '../hooks/useAuth';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Topbar() {
    const { profile, logout } = useAuth();
    const { notifications, unreadCount } = useNotifications();
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

    return (
        <header className="h-[72px] px-6 flex items-center justify-end z-40 transition-all sticky top-0 bg-transparent">
            <div className="flex items-center gap-6 mt-2">
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => {
                            setShowNotif(!showNotif);
                            setShowThemeMenu(false);
                        }}
                        className="relative flex items-center justify-center w-11 h-11 rounded-full border border-white/80 bg-white/40 backdrop-blur-md text-navy-700 shadow-card hover:bg-white/60 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotif && (
                        <div className="absolute top-14 right-0 w-[320px] sm:w-[360px] bg-white/30 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_rgba(26,58,107,0.15)] border border-white/60 p-3 animate-fade-up z-50 overflow-hidden">
                            <div className="flex justify-between items-center mb-3 px-3 pt-1">
                                <h3 className="font-bold text-navy-900 text-base">Notificaciones</h3>
                                <span className="text-xs text-navy-800 font-bold bg-white/40 px-2 py-0.5 rounded-full border border-white/50">{unreadCount} nuevas</span>
                            </div>
                            <div className="max-h-[320px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                {notifications.length === 0 ? (
                                    <div className="text-center text-navy-800/60 py-8 text-xs font-bold">Sin notificaciones nuevas</div>
                                ) : (
                                    notifications.map(n => {
                                        const name = n.users?.display_name || n.user_id || '?';
                                        return (
                                            <div key={n.id} className="flex items-center gap-3 p-3 bg-white/40 hover:bg-white/60 border border-white/50 rounded-2xl transition-all cursor-pointer shadow-sm">
                                                <div className="w-9 h-9 rounded-full bg-amber-600/90 flex items-center justify-center text-white font-bold shrink-0 shadow-sm border border-white/30 text-sm">
                                                    {name[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-1">
                                                    <div className="font-bold text-navy-900 text-sm truncate leading-tight">{name}</div>
                                                    <div className="text-navy-800/70 text-[11px] truncate mt-0.5 font-medium">
                                                        {new Date(n.date_start).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }).replace(/\./g, '')} · {new Date(n.date_start).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[10px] font-bold">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
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
                        {getInitials(profile?.full_name)}
                    </div>

                    {showThemeMenu && (
                        <div className="absolute top-12 right-0 w-48 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-white/90 p-2 animate-fade-up z-50">
                            <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1">Apariencia</div>
                            {themeOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        setTheme(opt.id);
                                        setShowThemeMenu(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${theme === opt.id
                                        ? 'bg-navy-50 text-navy-700 shadow-sm'
                                        : 'text-gray-600 hover:bg-white/60 hover:translate-x-1'}`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`${theme === opt.id ? 'text-navy-600' : 'text-gray-400'}`}>
                                            {opt.icon}
                                        </div>
                                        {opt.label}
                                    </div>
                                    {theme === opt.id && <Check size={14} className="text-navy-500" />}
                                </button>
                            ))}

                            <div className="h-px bg-gray-100/50 my-2 mx-2"></div>

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
