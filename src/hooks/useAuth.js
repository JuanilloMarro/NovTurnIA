import { useAppStore } from '../store/useAppStore';
import { supabase, setBusinessId } from '../config/supabase';
import * as Sentry from '@sentry/react';

async function fetchBusinessStatus(businessId) {
    const { data } = await supabase
        .from('businesses')
        .select('plan_status')
        .eq('id', businessId)
        .single();
    return data?.plan_status || 'active';
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
            const planStatus = await fetchBusinessStatus(staffProfile.business_id);
            setBusinessStatus(planStatus);
            setAuth(staffProfile, staffProfile);
            Sentry.setUser({ id: staffProfile.id, business_id: staffProfile.business_id });
        } catch (err) {
            throw err;
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
                const planStatus = await fetchBusinessStatus(staffProfile.business_id);
                setBusinessId(staffProfile.business_id);
                setBusinessStatus(planStatus);
                setAuth(staffProfile, staffProfile);
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
                        const planStatus = await fetchBusinessStatus(profile.business_id);
                        setBusinessId(profile.business_id);
                        setBusinessStatus(planStatus);
                        setAuth(profile, profile);
                    }
                } catch (e) {
                    console.error('Error fetching on auth change', e);
                }
            }
        }
    });

    return subscription;
}
