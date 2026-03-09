import { Bell, Moon, Sun, Monitor, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAppStore } from '../store/useAppStore';

export default function Topbar() {
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
                        <div className="absolute top-12 right-0 w-[380px] bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-100 p-4 animate-fade-up z-50">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <h3 className="font-bold text-navy-900 text-lg">Notificaciones</h3>
                                <span className="text-sm text-gray-500 font-medium">{unreadCount} pendiente{unreadCount !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                {notifications.length === 0 ? (
                                    <div className="text-center text-gray-400 py-6 text-[13px] font-medium">No hay notificaciones nuevas</div>
                                ) : (
                                    notifications.map(n => {
                                        const name = n.users?.display_name || n.user_id || '?';
                                        return (
                                            <div key={n.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
                                                <div className="w-10 h-10 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold shrink-0 shadow-sm border border-white/20">
                                                    {name[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-navy-900 text-[15px] truncate">{name}</div>
                                                    <div className="text-gray-500 text-[13px] truncate">
                                                        {new Date(n.date_start).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }).replace(/\./g, '')} · {new Date(n.date_start).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100/50 text-amber-700 text-[11px] font-bold tracking-wide">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pendiente
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
                        CN
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
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
