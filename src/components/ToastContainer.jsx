import { useToastStore } from '../store/useToastStore';
import { Calendar, UserPlus, CheckCircle2, AlertCircle, Info, X, Bot } from 'lucide-react';
import { useState, useEffect } from 'react';

const TOAST_ICONS = {
    appointment: <Calendar size={18} />,
    patient: <UserPlus size={18} />,
    success: <CheckCircle2 size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
    staff: <UserPlus size={18} />,
    bot_pause: <Bot size={18} />,
    bot_reactivate: <Bot size={18} />,
};

// Map status/type to colors
const TOAST_STYLES = {
    // Creations (Green)
    success: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: 'text-emerald-600 bg-emerald-100',
        title: 'text-emerald-900',
        message: 'text-emerald-700',
        bar: 'bg-emerald-500',
    },
    // Edits (Yellow)
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-600 bg-amber-100',
        title: 'text-amber-900',
        message: 'text-amber-700',
        bar: 'bg-amber-500',
    },
    // Deletions (Red)
    error: {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        icon: 'text-rose-600 bg-rose-100',
        title: 'text-rose-900',
        message: 'text-rose-700',
        bar: 'bg-rose-500',
    },
    staff: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: 'text-emerald-600 bg-emerald-100',
        title: 'text-emerald-900',
        message: 'text-emerald-700',
        bar: 'bg-emerald-500',
    },
    // Special Info/Patient default
    patient: {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        icon: 'text-indigo-600 bg-indigo-100',
        title: 'text-indigo-900',
        message: 'text-indigo-700',
        bar: 'bg-indigo-500',
    },
    appointment: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-600 bg-amber-100',
        title: 'text-amber-900',
        message: 'text-amber-700',
        bar: 'bg-amber-500',
    }
};

function SingleToast({ toast, onRemove }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    
    // Choose style based on status FIRST, then type, then info
    const styles = TOAST_STYLES[toast.status] || TOAST_STYLES[toast.type] || TOAST_STYLES.success;
    
    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));
        
        // Start exit animation before auto-removal
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
                w-[380px] rounded-2xl border shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden
                transition-all duration-300 ease-out
                ${styles.bg} ${styles.border}
                ${isVisible && !isLeaving 
                    ? 'translate-x-0 opacity-100' 
                    : 'translate-x-[120%] opacity-0'}
            `}
        >
            <div className="flex items-start gap-3 p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                    {TOAST_ICONS[toast.type] || TOAST_ICONS.success}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <div className={`font-bold text-[13px] leading-tight ${styles.title}`}>
                        {toast.title}
                    </div>
                    {toast.message && (
                        <div className={`text-[12px] font-medium mt-1 truncate ${styles.message}`}>
                            {toast.message}
                        </div>
                    )}
                </div>
                <button 
                    onClick={handleClose}
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors mt-0.5"
                >
                    <X size={12} className="text-gray-400" />
                </button>
            </div>
            {/* Progress bar */}
            <div className="h-[3px] w-full bg-black/5">
                <div 
                    className={`h-full ${styles.bar} rounded-full`}
                    style={{ 
                        animation: `toast-progress ${toast.duration || 4000}ms linear forwards`,
                    }}
                />
            </div>
        </div>
    );
}

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-auto">
            {toasts.map(toast => (
                <SingleToast 
                    key={toast.id} 
                    toast={toast} 
                    onRemove={removeToast} 
                />
            ))}
        </div>
    );
}
