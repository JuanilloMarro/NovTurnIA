import { useAuth } from './useAuth';

export function usePermissions() {
    const { profile } = useAuth();

    // El profile ahora contiene staff_roles
    const roleName = profile?.staff_roles?.name || 'Invitado';
    const perms = profile?.staff_roles?.permissions || {};

    return {
        role: roleName,
        canViewStats: perms.view_stats || false,
        canManageRoles: perms.manage_roles || false,
        
        canViewCalendar: true, // Acceso base para staff activo
        canViewHistory: true,
        
        // Turnos
        canCreateAppointments: perms.create_appointments || false,
        canEditAppointments: perms.edit_appointments || false,
        canConfirmAppointments: perms.confirm_appointments || false,
        canDeleteAppointments: perms.delete_appointments || false,
        
        // Pacientes
        canViewPatients: perms.view_patients || false,
        canCreatePatients: perms.create_patients || false,
        canEditPatients: perms.edit_patients || false,
        canDeletePatients: perms.delete_patients || false,
        
        // IA y Conversaciones
        canViewConversations: perms.view_conversations || false,
        canToggleAi: perms.toggle_ai || false,
        canDeleteUsers: perms.delete_users || false,
    };
}
