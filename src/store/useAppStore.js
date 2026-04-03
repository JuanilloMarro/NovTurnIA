import { create } from 'zustand';

export const useAppStore = create((set) => ({
    isSidebarOpen: true,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

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
    setAuth: (user, profile) => set({ user, profile, loading: false }),
    setLoading: (loading) => set({ loading }),
    clearAuth: () => set({ user: null, profile: null, loading: false }),

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
