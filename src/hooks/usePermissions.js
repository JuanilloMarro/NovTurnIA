import { useAuth } from './useAuth';

export function usePermissions() {
    const { profile } = useAuth();

    // El profile ahora contiene staff_roles
    const roleName = profile?.staff_roles?.name || 'Invitado';
    const perms = profile?.staff_roles?.permissions || {};

    return {
        role: roleName,
        canViewStats: perms.view_stats || false,
        canManageRoles: perms.manage_staff || false,
        canViewCalendar: true, // Acceso base para staff activo
        canViewPatients: perms.view_patients || true,
        canViewHistory: true,
        canCreateAppointment: perms.edit_appointments || true,
        canCancelAppointment: perms.edit_appointments || true,
    };
}
