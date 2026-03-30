import { useAuth } from './useAuth';

// Roles principales que tienen todos los permisos por defecto
const MAIN_ROLES = ['dentist', 'barber', 'veterinarian', 'doctor', 'admin'];

export function usePermissions() {
    const { profile } = useAuth();

    // El profile ahora contiene staff_roles
    const roleName = profile?.staff_roles?.name || 'Invitado';
    const perms = profile?.staff_roles?.permissions || {};
    const isMain = MAIN_ROLES.includes(roleName.toLowerCase());

    return {
        role: roleName,
        isMainRole: isMain,

        canViewStats: isMain || perms.view_stats || false,
        canManageRoles: isMain || perms.manage_roles || false,
        
        canViewCalendar: true, // Acceso base para staff activo
        canViewHistory: true,
        
        // Turnos
        canCreateAppointments: isMain || perms.create_appointments || false,
        canEditAppointments: isMain || perms.edit_appointments || false,
        canConfirmAppointments: isMain || perms.confirm_appointments || false,
        canDeleteAppointments: isMain || perms.delete_appointments || false,
        
        // Pacientes
        canViewPatients: isMain || perms.view_patients || false,
        canCreatePatients: isMain || perms.create_patients || false,
        canEditPatients: isMain || perms.edit_patients || false,
        canDeletePatients: isMain || perms.delete_patients || false,
        
        // IA y Conversaciones
        canViewConversations: isMain || perms.view_conversations || false,
        canToggleAi: isMain || perms.toggle_ai || false,
        canDeleteUsers: isMain || perms.delete_users || false,
    };
}
