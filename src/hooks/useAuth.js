import { useAppStore } from '../store/useAppStore';
import { supabase } from '../config/supabase';
import { getBusinessStatus, getBusinessSchedule } from '../services/supabaseService';
import * as Sentry from '@sentry/react';

// T-20: setBusinessId leído del store en lugar de config/supabase.js
const setBusinessId = (id) => useAppStore.getState().setBusinessId(id);

// T-38: normaliza un valor de tiempo al formato 'HH:MM'.
// Soporta: integer < 24 (horas: 8 → '08:00'),
//          integer >= 24 (minutos: 480 → '08:00'),
//          string '08:00', '08:00:00', timestamp ISO.
function toHHMM(val, fallback) {
    if (val === null || val === undefined || val === '') return fallback;
    // Entero puro: hora (< 24) o minutos (>= 24)
    const num = Number(val);
    if (!isNaN(num) && String(val).trim().match(/^\d+$/)) {
        const totalMin = num < 24 ? num * 60 : num;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    // String con formato HH:MM (o HH:MM:SS, o timestamp ISO)
    const match = String(val).match(/(\d{1,2}):(\d{2})/);
    if (!match) return fallback;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

// Poblar businessHours desde la info del negocio — siempre guarda strings HH:MM limpios
function applyBusinessHours(info) {
    if (!info) return;
    useAppStore.getState().setBusinessHours({
        schedule_start: toHHMM(info.schedule_start, '09:00'),
        schedule_end:   toHHMM(info.schedule_end,   '18:00'),
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
            // T-38: getBusinessSchedule nunca lanza — devuelve null si la columna no existe
            const [planStatus, schedule] = await Promise.all([
                getBusinessStatus(staffProfile.business_id),
                getBusinessSchedule(staffProfile.business_id),
            ]);
            setBusinessStatus(planStatus);
            applyBusinessHours(schedule); // no-op si es null
            setAuth(data.user, staffProfile);
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
                setBusinessId(staffProfile.business_id);
                const [planStatus, schedule] = await Promise.all([
                    getBusinessStatus(staffProfile.business_id),
                    getBusinessSchedule(staffProfile.business_id),
                ]);
                setBusinessStatus(planStatus);
                applyBusinessHours(schedule);
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
                        const [planStatus, schedule] = await Promise.all([
                            getBusinessStatus(profile.business_id),
                            getBusinessSchedule(profile.business_id),
                        ]);
                        setBusinessStatus(planStatus);
                        applyBusinessHours(schedule);
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
