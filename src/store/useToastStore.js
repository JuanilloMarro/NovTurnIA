import { create } from 'zustand';
import { getNotifications, markNotificationsRead, clearNotifications, markOneNotificationRead, deleteOneNotification } from '../services/supabaseService';

let toastId = 0;

export const useToastStore = create((set, get) => ({
    toasts: [],
    activityLog: [],
    unreadCount: 0,
    _loaded: false,

    addToast: (toast) => {
        const id = ++toastId;
        const newToast = { id, ...toast, duration: toast.duration || 4000 };
        set((state) => ({ toasts: [...state.toasts, newToast] }));
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
        }, newToast.duration);
        return id;
    },

    removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    },

    loadFromDB: async () => {
        if (get()._loaded) return;
        try {
            const data = await getNotifications();
            set({ activityLog: data, unreadCount: data.filter(a => !a.read).length, _loaded: true });
        } catch (err) {
            console.error('Failed to load notifications:', err.message);
        }
    },

    addActivity: (activity) => {
        set((state) => {
            if (activity.id && state.activityLog.some(a => a.id === activity.id)) return state;
            let prevLog = state.activityLog;
            if (activity.type === 'pending_reminder') {
                prevLog = prevLog.filter(a => !(a.type === 'pending_reminder' && !a.read));
            }
            const newLog = [activity, ...prevLog].slice(0, 30);
            return { activityLog: newLog, unreadCount: newLog.filter(a => !a.read).length };
        });
    },

    markAllRead: async () => {
        set((state) => ({
            activityLog: state.activityLog.map(a => ({ ...a, read: true })),
            unreadCount: 0,
        }));
        try { await markNotificationsRead(); } catch (err) { console.error('Failed to mark notifications read:', err.message); }
    },

    clearActivityLog: async () => {
        set({ activityLog: [], unreadCount: 0 });
        try { await clearNotifications(); } catch (err) { console.error('Failed to clear notifications:', err.message); }
    },

    markOneRead: async (id) => {
        set((state) => {
            const updated = state.activityLog.map(a => a.id === id ? { ...a, read: true } : a);
            return { activityLog: updated, unreadCount: updated.filter(a => !a.read).length };
        });
        try { await markOneNotificationRead(id); } catch (err) { console.error('markOneRead failed:', err.message); }
    },

    deleteOne: async (id) => {
        set((state) => {
            const updated = state.activityLog.filter(a => a.id !== id);
            return { activityLog: updated, unreadCount: updated.filter(a => !a.read).length };
        });
        try { await deleteOneNotification(id); } catch (err) { console.error('deleteOne failed:', err.message); }
    },

    resetForNewSession: () => {
        set({ activityLog: [], unreadCount: 0, _loaded: false });
    },
}));

// ── Internal helper ───────────────────────────────────────────────────────────
function toast(status, type, title, message, duration) {
    useToastStore.getState().addToast({ status, type, title, message, ...(duration ? { duration } : {}) });
}

// ── Appointment ───────────────────────────────────────────────────────────────
export const showAptNewToast      = (message) => toast('success', 'apt_new',     'Turno Creado',       message);
export const showAptConfirmToast  = (message) => toast('success', 'apt_confirm', 'Turno Confirmado',   message);
export const showAptEditToast     = (message) => toast('warning', 'apt_edit',    'Turno Actualizado',  message);
export const showAptCancelToast   = (message) => toast('warning', 'apt_cancel',  'Turno Cancelado',    message);
export const showAptNoShowToast   = (message) => toast('warning', 'apt_noshow',  'Cliente Ausente',    message);
export const showAptPendingToast  = (message) => toast('warning', 'apt_pending', 'Turno en Pendiente', message);
export const showAptDeleteToast   = (message) => toast('error',   'apt_delete',  'Turno Eliminado',    message);

// ── Patient ───────────────────────────────────────────────────────────────────
export const showPatientNewToast    = (message) => toast('success', 'patient_new',    'Cliente Registrado',     message, 5000);
export const showPatientEditToast   = (message) => toast('warning', 'patient_edit',   'Cliente Actualizado',    message);
export const showPatientDeleteToast = (message) => toast('error',   'patient_delete', 'Cliente Eliminado',      message);
export const showPatientGdprToast   = (message) => toast('error',   'patient_gdpr',   'Datos Eliminados (GDPR)', message);

// ── Service ───────────────────────────────────────────────────────────────────
export const showServiceNewToast        = (message) => toast('success', 'service_new',        'Servicio Creado',      message);
export const showServiceEditToast       = (message) => toast('warning', 'service_edit',       'Servicio Actualizado', message);
export const showServiceActivateToast   = (message) => toast('success', 'service_activate',   'Servicio Activado',    message);
export const showServiceDeactivateToast = (message) => toast('warning', 'service_deactivate', 'Servicio Desactivado', message);
export const showServiceDeleteToast     = (message) => toast('error',   'service_delete',     'Servicio Eliminado',   message);

// ── Staff ─────────────────────────────────────────────────────────────────────
export const showStaffPermsToast = (message) => toast('success', 'staff_perms', 'Permisos Guardados', message);

// ── Bot / IA ──────────────────────────────────────────────────────────────────
export const showBotPauseToast      = (message) => toast('warning', 'bot_pause',      'IA Pausada',    message);
export const showBotReactivateToast = (message) => toast('success', 'bot_reactivate', 'IA Reactivada', message);

// ── Settings / Business ───────────────────────────────────────────────────────
export const showSettingsSavedToast = (message) => toast('success', 'settings',   'Configuración Guardada', message);
export const showTenantNewToast     = (message) => toast('success', 'tenant_new', 'Tenant Creado',          message);

// ── Generic ───────────────────────────────────────────────────────────────────
export const showValidationToast = (title, message) => toast('warning', 'validation', title, message);
export const showErrorToast      = (title, message) => toast('error',   'error',      title, message);
export const showSuccessToast    = (title, message) => toast('success', 'success',    title, message);
export const showWarningToast    = (title, message) => toast('warning', 'validation', title, message);

// ── Realtime events (toast + activity log) ────────────────────────────────────
export function showAppointmentToast(patientName, time) {
    useToastStore.getState().addToast({
        status: 'success', type: 'apt_new',
        title: 'Nuevo Turno Agendado',
        message: `${patientName} : ${time}`,
        duration: 5000,
    });
}

export function showPatientToast(patientName) {
    useToastStore.getState().addToast({
        status: 'success', type: 'patient_new',
        title: 'Nuevo Cliente Registrado',
        message: patientName,
        duration: 5000,
    });
}
