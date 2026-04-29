import { Bell, Moon, Sun, Monitor, LogOut, Calendar, UserPlus, Trash2, Bot, Menu, Clock, Siren, Home, MessageSquareWarning, PhoneCall, Check, Building2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { usePendingReminder } from '../hooks/usePendingReminder';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { useAuth } from '../hooks/useAuth';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const ROLE_LABELS = {
    owner:     { label: 'Propietario', color: 'bg-navy-900 text-white' },
    secretary: { label: 'Secretaria',  color: 'bg-sky-100 text-sky-800' },
    admin:     { label: 'Admin',        color: 'bg-violet-100 text-violet-800' },
    doctor:    { label: 'Doctor',       color: 'bg-emerald-100 text-emerald-800' },
};

function RoleBadge({ roleName }) {
    const key = roleName?.toLowerCase() || '';
    const match = ROLE_LABELS[key];
    const label = match?.label || roleName || 'Staff';
    const color = match?.color || 'bg-gray-100 text-gray-700';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black capitalize tracking-wide ${color}`}>
            {label}
        </span>
    );
}

export default function Topbar() {
    const { profile, logout } = useAuth();
    const { activityLog, unreadCount, markAllRead } = useNotifications();
    usePendingReminder();
    const clearActivityLog  = useToastStore(s => s.clearActivityLog);
    const markOneRead       = useToastStore(s => s.markOneRead);
    const deleteOne         = useToastStore(s => s.deleteOne);
    const { theme, setTheme, toggleSidebar, businessName } = useAppStore();
    const [showNotif,    setShowNotif]    = useState(false);
    const [showProfile,  setShowProfile]  = useState(false);
    const notifRef   = useRef(null);
    const profileRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (notifRef.current   && !notifRef.current.contains(event.target))   setShowNotif(false);
            if (profileRef.current && !profileRef.current.contains(event.target)) setShowProfile(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const themeOptions = [
        { id: 'light',  label: 'Modo Claro',       icon: <Sun size={14} /> },
        { id: 'dark',   label: 'Modo Oscuro',       icon: <Moon size={14} /> },
        { id: 'system', label: 'Predeterminado',    icon: <Monitor size={14} /> },
    ];

    const handleBellClick = () => {
        const willOpen = !showNotif;
        setShowNotif(willOpen);
        setShowProfile(false);
        if (willOpen) markAllRead();
    };

    return (
        <header className="h-[72px] px-6 flex items-center justify-between md:justify-end z-[100] transition-all sticky top-0 bg-transparent">
            {/* Hamburger — solo mobile */}
            <button
                onClick={toggleSidebar}
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-900 shadow-sm hover:bg-white/80 transition-all"
                aria-label="Abrir menú"
            >
                <Menu size={18} />
            </button>

            <div className="flex items-center gap-2 mt-2">

                {/* ── Notificaciones ─────────────────────────────────── */}
                <div className="relative" ref={notifRef}>
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-sm h-11">
                        <button
                            onClick={handleBellClick}
                            className="relative w-9 h-9 rounded-full bg-white border border-white/80 hover:bg-white/80 shadow-sm hover:scale-[1.02] transition-all flex items-center justify-center text-navy-900 font-bold"
                        >
                            <Bell size={16} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-[16px] min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {showNotif && (
                        <div className="fixed sm:absolute top-[64px] sm:top-14 left-2 right-2 sm:left-auto sm:right-0 sm:w-[400px] md:w-[440px] bg-white/30 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_rgba(26,58,107,0.15)] border border-white/60 p-3 animate-fade-up z-[110] overflow-hidden">
                            <div className="flex justify-between items-center mb-3 px-3 pt-1">
                                <h3 className="font-bold text-navy-900 text-base">Actividad</h3>
                                {activityLog.length > 0 && (
                                    <button
                                        onClick={() => clearActivityLog()}
                                        className="text-[10px] text-red-600/70 hover:text-red-600 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                                    >
                                        <Trash2 size={10} />
                                        Borrar todo
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[480px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                {activityLog.length === 0 ? (
                                    <div className="text-center text-navy-800/60 py-8 text-xs font-bold">Sin actividad reciente</div>
                                ) : (
                                    activityLog.map(entry => (
                                        <NotifCard
                                            key={entry.id}
                                            entry={entry}
                                            onMarkRead={() => markOneRead(entry.id)}
                                            onDelete={() => deleteOne(entry.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Perfil de usuario ──────────────────────────────── */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
                        className="w-11 h-11 rounded-full bg-navy-900 border border-white/20 flex items-center justify-center text-white font-bold shadow-card shadow-navy-900/20 text-[15px] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                        aria-label="Menú de usuario"
                    >
                        {getInitials(profile?.full_name || profile?.display_name)}
                    </button>

                    {showProfile && (
                        <div className="absolute top-14 right-0 w-64 bg-white/30 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_rgba(26,58,107,0.15)] border border-white/60 overflow-hidden animate-fade-up z-[110]">

                            {/* Info del usuario */}
                            <div className="px-4 pt-4 pb-3 flex flex-col items-center text-center gap-1.5">
                                <div className="w-14 h-14 rounded-full bg-navy-900 flex items-center justify-center text-white font-black text-xl shadow-md mb-0.5">
                                    {getInitials(profile?.full_name || profile?.display_name)}
                                </div>
                                <p className="font-black text-navy-900 text-sm leading-tight truncate max-w-full">
                                    {profile?.full_name || 'Usuario'}
                                </p>
                                {profile?.email && (
                                    <p className="text-[11px] text-navy-800/60 font-medium truncate max-w-full">
                                        {profile.email}
                                    </p>
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap justify-center mt-0.5">
                                    {businessName && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-navy-700/70 bg-navy-50 px-2 py-0.5 rounded-full border border-navy-100">
                                            <Building2 size={9} />
                                            {businessName}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="h-px bg-navy-100/60 mx-3" />

                            {/* Tema */}
                            <div className="px-2 py-2">
                                <p className="text-[9px] font-black text-navy-800/40 capitalize tracking-widest px-2 mb-1">Apariencia</p>
                                <div className="flex gap-1">
                                    {themeOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setTheme(opt.id)}
                                            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[10px] font-bold transition-all ${
                                                theme === opt.id
                                                    ? 'bg-navy-900 text-white shadow-sm'
                                                    : 'text-navy-700 hover:bg-navy-50'
                                            }`}
                                        >
                                            {opt.icon}
                                            <span className="leading-none">{opt.id === 'light' ? 'Claro' : opt.id === 'dark' ? 'Oscuro' : 'Auto'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-px bg-navy-100/60 mx-3" />

                            {/* Logout */}
                            <div className="p-2">
                                <button
                                    onClick={() => logout()}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-bold text-red-600 hover:bg-red-50 transition-all duration-200"
                                >
                                    <LogOut size={15} />
                                    Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

/* ── Tarjeta de notificación con acciones ─────────────────────────── */
function NotifCard({ entry, onMarkRead, onDelete }) {
    const isBotError   = entry.type === 'error_ia' || entry.type === 'bot_error';
    const isBotWarning = entry.type === 'bot_reactivate' || entry.type === 'bot_pause';
    const isBot        = !isBotError && !isBotWarning && entry.type?.startsWith('bot');
    const isAptNew     = entry.type === 'apt_new' || entry.type === 'appointment';
    const isPatientNew = entry.type === 'patient_new' || entry.type === 'patient';
    const isReminder   = entry.type === 'pending_reminder';
    const isUrgencia   = entry.type === 'urgencia';
    const isQueja      = entry.type === 'queja';
    const isDomicilio  = entry.type === 'domicilio';
    const isPideHumano = entry.type === 'pide_humano';

    const dotColor = isBotError   ? 'bg-red-500/90'
                   : isUrgencia   ? 'bg-red-600/90'
                   : isQueja      ? 'bg-orange-500/90'
                   : isBotWarning ? 'bg-amber-400/90'
                   : isReminder   ? 'bg-amber-500/90'
                   : isDomicilio  ? 'bg-violet-500/90'
                   : isPideHumano ? 'bg-sky-500/90'
                   : isAptNew     ? 'bg-emerald-500/90'
                   : isPatientNew ? 'bg-emerald-500/90'
                   : 'bg-navy-900/90';

    const dotIcon = isBotError   ? <Siren size={15} className="text-white" />
                  : isUrgencia   ? <Siren size={15} className="text-white" />
                  : isQueja      ? <MessageSquareWarning size={15} className="text-white" />
                  : isBotWarning ? <Bot size={15} className="text-white" />
                  : isReminder   ? <Clock size={15} className="text-white" />
                  : isDomicilio  ? <Home size={15} className="text-white" />
                  : isPideHumano ? <PhoneCall size={15} className="text-white" />
                  : isAptNew     ? <Calendar size={15} className="text-white" />
                  : isPatientNew ? <UserPlus size={15} className="text-white" />
                  : isBot        ? <Bot size={15} className="text-white" />
                  : (entry.title?.[0] || '?');

    return (
        <div className={`group relative flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-default shadow-sm ${
            entry.read
                ? 'bg-white/30 border-white/40 hover:bg-white/50'
                : 'bg-white/50 border-navy-200/40 ring-1 ring-navy-400/15 hover:bg-white/65'
        }`}>
            {/* Dot de color + icono */}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm border border-white/30 text-sm leading-none ${dotColor} ${!entry.read ? 'shadow-md' : ''}`}>
                {dotIcon}
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    {!entry.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-navy-500 shrink-0" />
                    )}
                    <span className="font-bold text-navy-900 text-sm leading-tight truncate">
                        {entry.title}
                    </span>
                    {isPatientNew && (
                        <span className="bg-navy-100 text-navy-800 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter shrink-0">Nuevo</span>
                    )}
                </div>
                {entry.message && (
                    isReminder ? (
                        <div className="flex flex-col gap-0.5 mt-0.5">
                            {entry.message.split(' · ').map((line, i) => (
                                <p key={i} className="text-navy-800/65 text-[11px] font-medium leading-snug">{line}</p>
                            ))}
                        </div>
                    ) : (
                        <p className="text-navy-800/65 text-[11px] truncate mt-0.5 font-medium">
                            {entry.message}
                        </p>
                    )
                )}
                <p className="text-navy-800/40 text-[10px] font-bold mt-0.5">
                    {getTimeAgo(entry.created_at || entry.timestamp)}
                </p>
            </div>

            {/* Acciones — visibles en hover */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {!entry.read && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
                        title="Marcar como leído"
                        className="w-7 h-7 flex items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200/60 transition-colors"
                    >
                        <Check size={13} strokeWidth={2.5} />
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    title="Eliminar notificación"
                    className="w-7 h-7 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-200/60 transition-colors"
                >
                    <Trash2 size={13} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now  = new Date();
    const date = new Date(dateStr);
    const diffMs   = now - date;
    const diffMin  = Math.floor(diffMs / 60000);
    const diffHrs  = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin  < 1)  return 'Ahora';
    if (diffMin  < 60) return `${diffMin}m`;
    if (diffHrs  < 24) return `${diffHrs}h`;
    if (diffDays < 7)  return `${diffDays}d`;
    return date.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
}
