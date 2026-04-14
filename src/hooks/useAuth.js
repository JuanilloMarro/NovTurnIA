import { useAppStore } from '../store/useAppStore';
import { supabase } from '../config/supabase';
import { getBusinessStatus, getBusinessInfo } from '../services/supabaseService';
import * as Sentry from '@sentry/react';

// T-20: setBusinessId leído del store en lugar de config/supabase.js
const setBusinessId    = (id) => useAppStore.getState().setBusinessId(id);
// T-38: helper para poblar businessHours desde la info del negocio
function applyBusinessHours(info) {
    if (!info) return;
    useAppStore.getState().setBusinessHours({
        schedule_start: info.schedule_start || '09:00',
        schedule_end:   info.schedule_end   || '18:00',
        schedule_days:  Array.isArray(info.schedule_days) ? info.schedule_days : [1,2,3,4,5],
    });
}

export function useAuth() {
    const { user, profile, loading, setAuth, setLoading, clearAuth, setBusinessStatus } = useAppStore();

    async function login(email, password) {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // Obtener perfil del staff — SIN filtro de business_id
            // porque aún no sabemos cuál es (se detecta del perfil)
            const { data: staffProfile, error: profileError } = await supabase
                .from('staff_users')
                .select('*, staff_roles(*)')
                .eq('id', data.user.id)
                .eq('active', true)
                .single();

            if (profileError || !staffProfile) {
                await supabase.auth.signOut();
                throw new Error('Usuario no tiene perfil de staff asignado o está desactivado.');
            }

            // Auto-detect: establecer el business_id desde el perfil
            setBusinessId(staffProfile.business_id);
            // T-38: leer horario del negocio de una sola query (getBusinessInfo ya trae schedule_*)
            const [planStatus, businessInfo] = await Promise.all([
                getBusinessStatus(staffProfile.business_id),
                getBusinessInfo(),
            ]);
            setBusinessStatus(planStatus);
            applyBusinessHours(businessInfo);
            setAuth(data.user, staffProfile);
            Sentry.setUser({ id: staffProfile.id, business_id: staffProfile.business_id });
        } finally {
            setLoading(false);
        }
    }

    async function logout() {
        await supabase.auth.signOut();
        setBusinessId(0);
        clearAuth();
        Sentry.setUser(null);
    }

    return {
        user,
        profile,
        loading,
        login,
        logout
    };
}

export async function initializeAuth(setAuth, setLoading, clearAuth, setBusinessStatus) {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            const { data: staffProfile } = await supabase
                .from('staff_users')
                .select('*, staff_roles(*)')
                .eq('id', session.user.id)
                .eq('active', true)
                .single();

            if (staffProfile) {
                setBusinessId(staffProfile.business_id);
                // T-38: leer horario del negocio (getBID ya está seteado arriba)
                const [planStatus, businessInfo] = await Promise.all([
                    getBusinessStatus(staffProfile.business_id),
                    getBusinessInfo(),
                ]);
                setBusinessStatus(planStatus);
                applyBusinessHours(businessInfo);
                setAuth(session.user, staffProfile);
                Sentry.setUser({ id: staffProfile.id, business_id: staffProfile.business_id });
            } else {
                await supabase.auth.signOut();
                clearAuth();
            }
        }
    } catch (err) {
        console.error('Auth init error:', err.message);
        clearAuth();
    } finally {
        setLoading(false);
    }

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (event === 'SIGNED_OUT') {
            setBusinessId(0);
            clearAuth();
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
            if (currentSession && currentSession.user) {
                try {
                    const { data: profile } = await supabase
                        .from('staff_users')
                        .select('*, staff_roles(*)')
                        .eq('id', currentSession.user.id)
                        .eq('active', true)
                        .single();

                    if (profile) {
                        setBusinessId(profile.business_id);
                        const [planStatus, businessInfo] = await Promise.all([
                            getBusinessStatus(profile.business_id),
                            getBusinessInfo(),
                        ]);
                        setBusinessStatus(planStatus);
                        applyBusinessHours(businessInfo);
                        setAuth(currentSession.user, profile);
                    }
                } catch (e) {
                    console.error('Error fetching on auth change', e);
                }
            }
        }
    });

    return subscription;
}
