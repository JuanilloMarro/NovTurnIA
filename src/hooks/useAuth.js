import { useAppStore } from '../store/useAppStore';
import { supabase } from '../config/supabase';

export function useAuth() {
    const { user, profile, loading, setAuth, setLoading, clearAuth } = useAppStore();

    async function login(email, password) {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // Obtener perfil del staff desde staff_users
            const { data: staffProfile, error: profileError } = await supabase
                .from('staff_users')
                .select('*, staff_roles(*)')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw new Error('Usuario no tiene perfil de staff asignado.');

            setAuth(staffProfile, staffProfile);
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    }

    async function logout() {
        await supabase.auth.signOut();
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
                .single();

            if (staffProfile) {
                setAuth(staffProfile, staffProfile);
            } else {
                // Usuario autenticado pero sin perfil de staff
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
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            clearAuth();
        }
    });
}
