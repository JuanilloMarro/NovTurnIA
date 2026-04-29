import { useToastStore } from '../store/useToastStore';
import {
    CalendarPlus, CalendarCheck, CalendarClock, CalendarX,
    UserPlus, UserCheck, UserX, ShieldOff, ShieldCheck, Shield,
    Layers, ToggleRight, ToggleLeft,
    Bot, Building2, AlertTriangle, AlertCircle, Trash2, CheckCircle2, X, Siren,
    Home, MessageSquareWarning, PhoneCall,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const TOAST_ICONS = {
    apt_new:            <CalendarPlus size={18} />,
    apt_confirm:        <CalendarCheck size={18} />,
    apt_edit:           <CalendarClock size={18} />,
    apt_cancel:         <CalendarX size={18} />,
    apt_noshow:         <UserX size={18} />,
    apt_pending:        <CalendarClock size={18} />,
    apt_delete:         <Trash2 size={18} />,
    patient_new:        <UserPlus size={18} />,
    patient_edit:       <UserCheck size={18} />,
    patient_delete:     <UserX size={18} />,
    patient_gdpr:       <ShieldOff size={18} />,
    service_new:        <Layers size={18} />,
    service_edit:       <Layers size={18} />,
    service_activate:   <ToggleRight size={18} />,
    service_deactivate: <ToggleLeft size={18} />,
    service_delete:     <Trash2 size={18} />,
    staff_perms:        <ShieldCheck size={18} />,
    staff_role:         <Shield size={18} />,
    bot_pause:          <Bot size={18} />,
    bot_reactivate:     <Bot size={18} />,
    bot_error:          <Siren size={18} />,
    error_ia:           <Siren size={18} />,
    urgencia:           <Siren size={18} />,
    queja:              <MessageSquareWarning size={18} />,
    domicilio:          <Home size={18} />,
    pide_humano:        <PhoneCall size={18} />,
    settings:           <Building2 size={18} />,
    tenant_new:         <Building2 size={18} />,
    validation:         <AlertTriangle size={18} />,
    error:              <AlertCircle size={18} />,
    success:            <CheckCircle2 size={18} />,
};

const TOAST_STYLES = {
    success: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: 'text-emerald-600 bg-emerald-100',
        title: 'text-emerald-900',
        message: 'text-emerald-700',
        bar: 'bg-emerald-500',
    },
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-600 bg-amber-100',
        title: 'text-amber-900',
        message: 'text-amber-700',
        bar: 'bg-amber-500',
    },
    error: {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        icon: 'text-rose-600 bg-rose-100',
        title: 'text-rose-900',
        message: 'text-rose-700',
        bar: 'bg-rose-500',
    },
};

function SingleToast({ toast, onRemove }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const styles = TOAST_STYLES[toast.status] || TOAST_STYLES.success;

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
        const exitTimer = setTimeout(() => {
            setIsLeaving(true);
        }, (toast.duration || 4000) - 400);
        return () => clearTimeout(exitTimer);
    }, [toast.duration]);

    const handleClose = () => {
        setIsLeaving(true);
        setTimeout(() => onRemove(toast.id), 300);
    };

    return (
        <div
            className={`
                w-full sm:w-[380px] rounded-xl sm:rounded-2xl border shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden
                transition-all duration-300 ease-out
                ${styles.bg} ${styles.border}
                ${isVisible && !isLeaving
                    ? 'translate-x-0 opacity-100'
                    : 'translate-x-[120%] opacity-0'}
            `}
        >
            <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-4">
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                    {TOAST_ICONS[toast.type] || TOAST_ICONS.success}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <div className={`font-bold text-[12px] sm:text-[13px] leading-tight ${styles.title}`}>
                        {toast.title}
                    </div>
                    {toast.message && (
                        <div className={`text-[11px] sm:text-[12px] font-medium mt-0.5 sm:mt-1 truncate ${styles.message}`}>
                            {toast.message}
                        </div>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors mt-0.5"
                >
                    <X size={12} className="text-gray-400" />
                </button>
            </div>
            <div className="h-[2px] sm:h-[3px] w-full bg-black/5">
                <div
                    className={`h-full ${styles.bar} rounded-full`}
                    style={{ animation: `toast-progress ${toast.duration || 4000}ms linear forwards` }}
                />
            </div>
        </div>
    );
}

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore();
    if (toasts.length === 0) return null;
    return (
        <div className="fixed top-2 right-2 left-2 sm:top-6 sm:right-6 sm:left-auto z-[500] flex flex-col gap-2 sm:gap-3 pointer-events-auto">
            {toasts.map(toast => (
                <SingleToast key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
        </div>
    );
}
