import { useAppStore } from '../store/useAppStore';
import { supabase, setBusinessId } from '../config/supabase';

export function useAuth() {
    const { user, profile, loading, setAuth, setLoading, clearAuth } = useAppStore();

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

            setAuth(staffProfile, staffProfile);
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
    }

    return {
        user,
        profile,
        loading,
        login,
        logout
    };
}

export async function initializeAuth(setAuth, setLoading, clearAuth) {
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
                // Auto-detect: establecer el business_id desde el perfil
                setBusinessId(staffProfile.business_id);
                setAuth(staffProfile, staffProfile);
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
             // Si hay sesión y aún no tenemos el perfil o algo falló, volvemos a checkear
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
