import { useAppStore } from '../store/useAppStore';
import { supabase } from '../config/supabase';
import { loginStaff } from '../services/supabaseService';

export function useAuth() {
    const { user, profile, loading, setAuth, setLoading, clearAuth } = useAppStore();

    async function login(email, password) {
        setLoading(true);
        try {
            const data = await loginStaff(email, password);
            // 'user' en nuestro store ahora es el staff_user
            setAuth(data, data);
            localStorage.setItem('staff_session', JSON.stringify({ email, password }));
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    }

    async function logout() {
        localStorage.removeItem('staff_session');
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
    const session = localStorage.getItem('staff_session');

    if (session) {
        try {
            const { email, password } = JSON.parse(session);
            const data = await loginStaff(email, password);
            setAuth(data, data);
        } catch (err) {
            console.error('Session expired or invalid:', err.message);
            localStorage.removeItem('staff_session');
            clearAuth();
        } finally {
            setLoading(false);
        }
    } else {
        setLoading(false);
    }
}
