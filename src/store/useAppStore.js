import { create } from 'zustand';

function normalizeTime(val, fallback) {
    if (val === null || val === undefined || val === '') return fallback;
    const num = Number(val);
    if (!isNaN(num) && String(val).match(/^\d+$/)) {
        const totalMin = num < 24 ? num * 60 : num;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const s = String(val);
    const match = s.match(/(\d{1,2}):(\d{2})/);
    if (!match) return fallback;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function generateTimeSlots(startTime = '09:00', endTime = '18:00', stepMin = 30) {
    const start = normalizeTime(startTime, '09:00');
    const end   = normalizeTime(endTime,   '18:00');
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes   = eh * 60 + em;
    const slots = [];
    for (let m = startMinutes; m <= endMinutes; m += stepMin) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
    }
    return slots;
}

export const useAppStore = create((set) => ({
    isSidebarOpen: false,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    businessId: '',
    setBusinessId: (id) => set({ businessId: id }),

    businessName: '',
    setBusinessName: (name) => set({ businessName: name }),

    businessHours: {
        schedule_start: '09:00',
        schedule_end:   '18:00',
        schedule_days:  [1, 2, 3, 4, 5],
    },
    setBusinessHours: ({ schedule_start, schedule_end, schedule_days }) =>
        set({ businessHours: { schedule_start, schedule_end, schedule_days } }),

    // Feature flags por negocio — leídos de businesses.feature_flags (JSONB).
    // Permiten activar/desactivar módulos por cliente sin redeploy.
    // Ejemplo: { billing: true, inventory: false, marketing_ai: true }
    featureFlags: {},
    setFeatureFlags: (flags) => set({ featureFlags: flags || {} }),

    // Theme — wrap localStorage para no romper en Safari Privado / iframes con storage off.
    theme: (() => { try { return localStorage.getItem('theme') || 'system'; } catch { return 'system'; } })(),
    setTheme: (theme) => {
        try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
        set({ theme });
    },

    user: null,
    profile: null,
    loading: true,
    businessStatus: 'active',
    setAuth: (user, profile) => set({ user, profile, loading: false }),
    setLoading: (loading) => set({ loading }),
    setBusinessStatus: (status) => set({ businessStatus: status }),
    clearAuth: () => set({
        user: null, profile: null, loading: false, businessStatus: 'active',
        businessName: '',
        businessHours: { schedule_start: '09:00', schedule_end: '18:00', schedule_days: [1,2,3,4,5] },
        featureFlags: {},
    }),

    realtimeStatus: 'connected',
    setRealtimeStatus: (realtimeStatus) => set({ realtimeStatus }),

    _patientsCache: { data: [], fetchedAt: 0 },
    setPatientsCache: (data) => set({ _patientsCache: { data, fetchedAt: Date.now() } }),
    invalidatePatientsCache: () => set({ _patientsCache: { data: [], fetchedAt: 0 } }),

    _conversationsCache: { data: [], fetchedAt: 0 },
    setConversationsCache: (data) => set({ _conversationsCache: { data, fetchedAt: Date.now() } }),
    invalidateConversationsCache: () => set({ _conversationsCache: { data: [], fetchedAt: 0 } }),

    _statsCache: { data: null, fetchedAt: 0 },
    setStatsCache: (data) => set({ _statsCache: { data, fetchedAt: Date.now() } }),
    invalidateStatsCache: () => set({ _statsCache: { data: null, fetchedAt: 0 } }),

    humanTakeoverMap: {},
    setPatientTakeover: (patientId, value) => set(state => ({
        humanTakeoverMap: { ...state.humanTakeoverMap, [patientId]: value },
    })),
}));
