import { create } from 'zustand';

// T-38: Genera slots de HH:MM desde startTime hasta endTime (inclusive) en pasos de `stepMin`.
// Ejemplo: generateTimeSlots('08:00', '17:00', 30) → ['08:00','08:30',...,'17:00']
export function generateTimeSlots(startTime = '09:00', endTime = '18:00', stepMin = 30) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
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
    isSidebarOpen: true,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    // Multi-tenant: business ID derivado del perfil del usuario autenticado.
    // T-20: movido de 'export let BUSINESS_ID' en config/supabase.js al store
    // para tener una fuente de verdad trazable y evitar condiciones de carrera.
    businessId: 0,
    setBusinessId: (id) => set({ businessId: id }),

    // T-38: Horario del negocio leído de DB al login — evita hardcodear 09:00-18:00.
    // schedule_start / schedule_end vienen de businesses.schedule_start / schedule_end (TIME).
    // schedule_days: array de días habilitados (0=Dom … 6=Sáb), para deshabilitar picker.
    businessHours: {
        schedule_start: '09:00',
        schedule_end:   '18:00',
        schedule_days:  [1, 2, 3, 4, 5], // Lun–Vie por defecto
    },
    setBusinessHours: ({ schedule_start, schedule_end, schedule_days }) =>
        set({ businessHours: { schedule_start, schedule_end, schedule_days } }),

    // Theme
    theme: localStorage.getItem('theme') || 'system',
    setTheme: (theme) => {
        localStorage.setItem('theme', theme);
        set({ theme });
    },

    // Auth
    user: null,
    profile: null,
    loading: true,
    businessStatus: 'active', // 'active' | 'suspended' | 'cancelled'
    setAuth: (user, profile) => set({ user, profile, loading: false }),
    setLoading: (loading) => set({ loading }),
    setBusinessStatus: (status) => set({ businessStatus: status }),
    clearAuth: () => set({
        user: null, profile: null, loading: false, businessStatus: 'active',
        businessHours: { schedule_start: '09:00', schedule_end: '18:00', schedule_days: [1,2,3,4,5] },
    }),

    // Cache de pacientes (1 minuto)
    _patientsCache: { data: [], fetchedAt: 0 },
    setPatientsCache: (data) => set({ _patientsCache: { data, fetchedAt: Date.now() } }),
    invalidatePatientsCache: () => set({ _patientsCache: { data: [], fetchedAt: 0 } }),

    // Cache de estadísticas (5 minutos)
    // Stats hace 7 queries a tablas pesadas — sin cache, cada visita a /stats
    // dispara todas las queries desde cero. Con 5 min de stale, las visitas frecuentes
    // son instantáneas y la data sigue siendo fresca para propósitos de dashboard.
    _statsCache: { data: null, fetchedAt: 0 },
    setStatsCache: (data) => set({ _statsCache: { data, fetchedAt: Date.now() } }),
    invalidateStatsCache: () => set({ _statsCache: { data: null, fetchedAt: 0 } }),
}));
