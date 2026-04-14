import { create } from 'zustand';

export const useAppStore = create((set) => ({
    isSidebarOpen: true,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    // Multi-tenant: business ID derivado del perfil del usuario autenticado.
    // T-20: movido de 'export let BUSINESS_ID' en config/supabase.js al store
    // para tener una fuente de verdad trazable y evitar condiciones de carrera.
    businessId: 0,
    setBusinessId: (id) => set({ businessId: id }),

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
    clearAuth: () => set({ user: null, profile: null, loading: false, businessStatus: 'active' }),

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
