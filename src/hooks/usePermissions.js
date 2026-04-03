import { useAuth } from './useAuth';

// IMPORTANTE: Los permisos se derivan ÚNICAMENTE del campo `permissions` en la DB (staff_roles).
// No existe ningún rol "especial" hardcodeado en el frontend.
// Razón: hardcodear roles en el cliente permite que cualquier staff con nombre de rol "doctor"
// obtenga todos los permisos sin importar lo que diga la DB, y hace que el RBAC sea imposible
// de auditar o modificar sin un deploy de frontend.
// Si un rol necesita todos los permisos, éstos deben estar seteados en su columna `permissions`.

export function usePermissions() {
    const { profile } = useAuth();

    const roleName = profile?.staff_roles?.name || 'Invitado';
    const perms = profile?.staff_roles?.permissions || {};

    return {
        role: roleName,

        canViewStats: !!perms.view_stats,
        canManageRoles: !!perms.manage_roles,

        canViewCalendar: true, // Acceso base para cualquier staff activo autenticado
        canViewHistory: true,

        // Turnos
        canCreateAppointments: !!perms.create_appointments,
        canEditAppointments: !!perms.edit_appointments,
        canConfirmAppointments: !!perms.confirm_appointments,
        canDeleteAppointments: !!perms.delete_appointments,

        // Pacientes
        canViewPatients: !!perms.view_patients,
        canCreatePatients: !!perms.create_patients,
        canEditPatients: !!perms.edit_patients,
        canDeletePatients: !!perms.delete_patients,

        // IA y Conversaciones
        canViewConversations: !!perms.view_conversations,
        canToggleAi: !!perms.toggle_ai,
        canDeleteUsers: !!perms.delete_users,
    };
}
