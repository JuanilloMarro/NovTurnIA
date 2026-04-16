import { useState, useEffect } from 'react';
import { getPlanLimits } from '../services/supabaseService';

// T-01: Hook que expone los límites del plan activo del negocio.
// Mientras la migración de planes no esté ejecutada (RPC no existe), trata todo como ilimitado.
// Uso:
//   const { canAddPatient, canAddStaff, patientsLeft, staffLeft } = usePlanLimits();

const UNLIMITED = {
    isLoading: false,
    canAddPatient: true,
    canAddStaff: true,
    patientsLeft: null,   // null = sin límite conocido
    staffLeft: null,
    plan: null,
    planStatus: 'active',
};

export function usePlanLimits() {
    const [limits, setLimits] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getPlanLimits()
            .then(setLimits)
            .catch(() => setLimits(null))
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) return { ...UNLIMITED, isLoading: true };

    // RPC no existe o plan no configurado → ilimitado
    if (!limits) return UNLIMITED;

    const maxPatients = limits.max_patients ?? null;
    const maxStaff    = limits.max_staff    ?? null;
    const patientsUsed = limits.patients_used ?? 0;
    const staffUsed    = limits.staff_used    ?? 0;

    return {
        isLoading: false,
        canAddPatient: maxPatients === null || patientsUsed < maxPatients,
        canAddStaff:   maxStaff    === null || staffUsed    < maxStaff,
        patientsLeft:  maxPatients === null ? null : Math.max(0, maxPatients - patientsUsed),
        staffLeft:     maxStaff    === null ? null : Math.max(0, maxStaff    - staffUsed),
        patientsUsed,
        maxPatients,
        staffUsed,
        maxStaff,
        plan: limits.plan,
        planStatus: limits.plan_status ?? 'active',
    };
}
