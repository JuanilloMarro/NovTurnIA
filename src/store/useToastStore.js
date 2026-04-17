import { create } from 'zustand';
import { getNotifications, markNotificationsRead, clearNotifications } from '../services/supabaseService';

let toastId = 0;

export const useToastStore = create((set, get) => ({
    toasts: [],
    activityLog: [],
    unreadCount: 0,
    _loaded: false, // prevents duplicate fetches
    
    addToast: (toast) => {
        const id = ++toastId;
        const newToast = { 
            id, 
            ...toast,
            duration: toast.duration || 4000 
        };
        
        set((state) => ({ 
            toasts: [...state.toasts, newToast] 
        }));
        
        // Auto-remove after duration
        setTimeout(() => {
            set((state) => ({ 
                toasts: state.toasts.filter(t => t.id !== id) 
            }));
        }, newToast.duration);
        
        return id;
    },
    
    removeToast: (id) => {
        set((state) => ({ 
            toasts: state.toasts.filter(t => t.id !== id) 
        }));
    },

    // ── Load notifications from Supabase (called once on mount) ──
    loadFromDB: async () => {
        if (get()._loaded) return;
        try {
            const data = await getNotifications();
            set({
                activityLog: data,
                unreadCount: data.filter(a => !a.read).length,
                _loaded: true,
            });
        } catch (err) {
            console.error('Failed to load notifications:', err.message);
        }
    },

    // ── Add a realtime notification to the local state ──
    addActivity: (activity) => {
        set((state) => {
            // Avoid duplicates (same id from DB)
            if (activity.id && state.activityLog.some(a => a.id === activity.id)) {
                return state;
            }
            let prevLog = state.activityLog;
            // Remover recordatorios anteriores no leídos para evitar duplicidad visual
            if (activity.type === 'pending_reminder') {
                prevLog = prevLog.filter(a => !(a.type === 'pending_reminder' && !a.read));
            }
            const newLog = [activity, ...prevLog].slice(0, 30);
            return { 
                activityLog: newLog,
                unreadCount: newLog.filter(a => !a.read).length,
            };
        });
    },

    markAllRead: async () => {
        // Optimistic update (instant UI response)
        set((state) => ({
            activityLog: state.activityLog.map(a => ({ ...a, read: true })),
            unreadCount: 0,
        }));
        // Persist to DB
        try {
            await markNotificationsRead();
        } catch (err) {
            console.error('Failed to mark notifications read:', err.message);
        }
    },

    clearActivityLog: async () => {
        // Optimistic update
        set({ activityLog: [], unreadCount: 0 });
        // Persist to DB
        try {
            await clearNotifications();
        } catch (err) {
            console.error('Failed to clear notifications:', err.message);
        }
    },
}));

// ── Toast-only helpers (immediate feedback, NO activity log) ──────────

export function showSuccessToast(title, message, iconType = 'success') {
    useToastStore.getState().addToast({ status: 'success', type: iconType, title, message });
}

export function showErrorToast(title, message, iconType = 'error') {
    useToastStore.getState().addToast({ status: 'error', type: iconType, title, message });
}

export function showInfoToast(title, message, iconType = 'info') {
    useToastStore.getState().addToast({ status: 'info', type: iconType, title, message });
}

export function showWarningToast(title, message, iconType = 'info') {
    useToastStore.getState().addToast({ status: 'warning', type: iconType, title, message });
}

// ── Toast + Activity log helpers (for Realtime events → campanita) ────

export function showAppointmentToast(patientName, time) {
    useToastStore.getState().addToast({ 
        status: 'success',
        type: 'appointment', 
        title: 'Nuevo Turno Agendado',
        message: `${patientName} : ${time}`,
        duration: 5000,
    });
}

export function showPatientToast(patientName) {
    useToastStore.getState().addToast({ 
        status: 'success',
        type: 'patient', 
        title: 'Nuevo Paciente Registrado',
        message: patientName,
        duration: 5000,
    });
}

export function showBotToast(isPaused, patientName) {
    const title = isPaused ? 'IA Pausada' : 'IA Reactivada';
    const type = isPaused ? 'bot_pause' : 'bot_reactivate';
    useToastStore.getState().addToast({ 
        type, 
        title, 
        message: (isPaused ? 'Pausada' : 'Reactivada') + ' para ' + patientName,
        duration: 5000,
    });
}
