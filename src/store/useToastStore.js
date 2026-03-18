import { create } from 'zustand';

let toastId = 0;

// Load persisted activity log from localStorage
function loadActivityLog() {
    try {
        const stored = localStorage.getItem('turnia_activity_log');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveActivityLog(log) {
    try {
        localStorage.setItem('turnia_activity_log', JSON.stringify(log));
    } catch {}
}

export const useToastStore = create((set, get) => ({
    toasts: [],
    activityLog: loadActivityLog(),
    unreadCount: loadActivityLog().filter(a => !a.read).length,
    
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

    // Activity log for the bell icon
    addActivity: (activity) => {
        const entry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            read: false,
            ...activity,
        };
        set((state) => {
            const newLog = [entry, ...state.activityLog].slice(0, 20); // keep last 20
            saveActivityLog(newLog);
            return { 
                activityLog: newLog,
                unreadCount: newLog.filter(a => !a.read).length,
            };
        });
    },

    markAllRead: () => {
        set((state) => {
            const newLog = state.activityLog.map(a => ({ ...a, read: true }));
            saveActivityLog(newLog);
            return { activityLog: newLog, unreadCount: 0 };
        });
    },

    clearActivityLog: () => {
        saveActivityLog([]);
        set({ activityLog: [], unreadCount: 0 });
    },
}));

// ── Toast-only helpers (immediate feedback, NO activity log) ──────────

export function showSuccessToast(title, message) {
    useToastStore.getState().addToast({ type: 'success', title, message });
}

export function showErrorToast(title, message) {
    useToastStore.getState().addToast({ type: 'error', title, message });
}

export function showInfoToast(title, message) {
    useToastStore.getState().addToast({ type: 'info', title, message });
}

// ── Toast + Activity log helpers (for Realtime events → campanita) ────

export function showAppointmentToast(patientName, time) {
    useToastStore.getState().addToast({ 
        type: 'appointment', 
        title: 'Nuevo Turno Agendado',
        message: `${patientName} : ${time}`,
        duration: 5000,
    });
    useToastStore.getState().addActivity({ 
        type: 'appointment', 
        title: 'Nuevo Turno Agendado',
        message: `${patientName} : ${time}`,
    });
}

export function showPatientToast(patientName) {
    useToastStore.getState().addToast({ 
        type: 'patient', 
        title: 'Nuevo Paciente Registrado',
        message: patientName,
        duration: 5000,
    });
    useToastStore.getState().addActivity({ 
        type: 'patient', 
        title: 'Nuevo Paciente Registrado',
        message: patientName,
    });
}
