import { useState, useEffect } from 'react';
import { getPlanLimits } from '../services/supabaseService';
import { useAppStore } from '../store/useAppStore';

// Evalúa el valor JSONB de un flag — admite booleanos y strings ("limited", "full").
function flagEnabled(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value !== '' && value !== 'false' && value !== 'limited';
    return true;
}

export function clearPlanLimitsCache() {
    useAppStore.getState().invalidatePlanLimitsCache();
}

const UNLIMITED = {
    isLoading: false,
    canAddPatient: true,
    canAddStaff: true,
    patientsLeft: null,
    staffLeft: null,
    plan: null,
    planStatus: 'active',
    features: {},
    hasFeature: () => true,
};

let _inflight = null;

export function usePlanLimits() {
    const cache = useAppStore(s => s._planLimitsCache);
    const setPlanLimitsCache = useAppStore(s => s.setPlanLimitsCache);
    const [isLoading, setIsLoading] = useState(!cache.data);

    useEffect(() => {
        if (cache.data) {
            setIsLoading(false);
            return;
        }

        if (!_inflight) {
            _inflight = getPlanLimits()
                .then(data => {
                    setPlanLimitsCache(data);
                    return data;
                })
                .catch(() => {
                    return null;
                })
                .finally(() => {
                    _inflight = null;
                    setIsLoading(false);
                });
        }
    }, [cache.data]);

    if (isLoading || !cache.data) return { ...UNLIMITED, isLoading: true };

    const limits = cache.data;
    const maxPatients = limits.max_patients ?? null;
    const maxStaff    = limits.max_staff    ?? null;
    const maxConversations = limits.max_conversations ?? null;
    const patientsUsed = limits.patients_used ?? 0;
    const staffUsed    = limits.staff_used    ?? 0;

    const features = limits.features || {};

    return {
        isLoading: false,
        canAddPatient: true, // Límites visuales ahora
        canAddStaff:   true,
        patientsLeft:  null,
        staffLeft:     null,
        patientsUsed,
        maxPatients,
        maxConversations,
        staffUsed,
        maxStaff,
        plan: limits.plan,
        planStatus: limits.plan_status ?? 'active',
        features,
        hasFeature: (name) => flagEnabled(features[name]),
    };
}
