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

    // Cache
    _patientsCache: { data: [], fetchedAt: 0 },
    setPatientsCache: (data) => set({ _patientsCache: { data, fetchedAt: Date.now() } }),
    invalidatePatientsCache: () => set({ _patientsCache: { data: [], fetchedAt: 0 } }),
}));
