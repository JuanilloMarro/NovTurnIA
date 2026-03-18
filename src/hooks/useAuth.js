import { useAppStore } from '../store/useAppStore';
import { supabase, setAuthToken, clearAuthToken, getAuthToken } from '../config/supabase';
import { loginStaff } from '../services/supabaseService';

export function useAuth() {
    const { user, profile, loading, setAuth, setLoading, clearAuth } = useAppStore();

    async function login(email, password) {
        setLoading(true);
        try {
            const { user: staffUser, token } = await loginStaff(email, password);

            // Store JWT token (NOT plaintext credentials)
            setAuthToken(token);
            await supabase.auth.setSession({ access_token: token, refresh_token: token }); 

            // 'user' en nuestro store ahora es el staff_user
            setAuth(staffUser, staffUser);
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    }

    async function logout() {
        clearAuthToken();
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
    const token = getAuthToken();

    if (token) {
        // Sync session even on load
        await supabase.auth.setSession({ access_token: token, refresh_token: token });
        
        try {
            // Decode the JWT payload to restore the session
            // (No need to re-login with plaintext credentials)
            const payloadB64 = token.split('.')[1];
            const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(padded));

            // Check if token is expired
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                console.log('Session token expired, clearing auth.');
                clearAuthToken();
                clearAuth();
                setLoading(false);
                return;
            }

            // Reconstruct the staff user from token payload
            const staffUser = {
                id: payload.staff_id,
                business_id: payload.business_id,
                email: payload.email,
                full_name: payload.full_name || payload.display_name || payload.name,
                display_name: payload.full_name || payload.display_name || payload.name,
                role_id: payload.role_id,
                staff_roles: {
                    name: payload.role_name,
                    permissions: payload.permissions || {},
                },
            };

            setAuth(staffUser, staffUser);
        } catch (err) {
            console.error('Invalid session token:', err.message);
            clearAuthToken();
            clearAuth();
        } finally {
            setLoading(false);
        }
    } else {
        setLoading(false);
    }
}
