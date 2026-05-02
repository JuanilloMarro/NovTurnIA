import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { supabase } from '../config/supabase';
import { getBusinessStatus, getBusinessSchedule, resetServiceCaches } from '../services/supabaseService';
import { clearPlanLimitsCache } from './usePlanLimits';
import * as Sentry from '@sentry/react';

const setBusinessId   = (id)   => useAppStore.getState().setBusinessId(id);
const setBusinessName = (name) => useAppStore.getState().setBusinessName(name);

function toHHMM(val, fallback) {
    if (val === null || val === undefined || val === '') return fallback;
    const num = Number(val);
    if (!isNaN(num) && String(val).trim().match(/^\d+$/)) {
        const totalMin = num < 24 ? num * 60 : num;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const match = String(val).match(/(\d{1,2}):(\d{2})/);
    if (!match) return fallback;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

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

            setBusinessId(staffProfile.business_id);
            const [planStatus, schedule] = await Promise.all([
                getBusinessStatus(staffProfile.business_id),
                getBusinessSchedule(staffProfile.business_id),
            ]);
            setBusinessStatus(planStatus);
            applyBusinessHours(schedule);
            if (schedule?.name) setBusinessName(schedule.name);
            useAppStore.getState().setFeatureFlags(schedule?.feature_flags ?? {});
            setAuth(data.user, staffProfile);
            Sentry.setUser({ id: staffProfile.id, business_id: staffProfile.business_id });
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    }

    async function logout() {
        useToastStore.getState().resetForNewSession();
        resetServiceCaches();
        clearPlanLimitsCache();
        await supabase.auth.signOut();
        setBusinessId('');
        clearAuth();
        Sentry.setUser(null);
    }

    return { user, profile, loading, login, logout };
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
                if (schedule?.name) setBusinessName(schedule.name);
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

    // Escuchar cambios de sesion. Guard: evitar re-fetch inutil en cada
    // TOKEN_REFRESHED (cada hora) cuando el perfil ya esta en el store.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (event === 'SIGNED_OUT') {
            useToastStore.getState().resetForNewSession();
            resetServiceCaches();
        clearPlanLimitsCache();
            setBusinessId('');
            clearAuth();
            return;
        }

        if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED') return;
        if (!currentSession?.user) return;

        const currentProfile = useAppStore.getState().profile;
        if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')
            && currentProfile?.id === currentSession.user.id) {
            return;
        }

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
                if (schedule?.name) setBusinessName(schedule.name);
                setAuth(currentSession.user, profile);
            }
        } catch (e) {
            console.error('Error fetching on auth change', e);
        }
    });

    return subscription;
}
