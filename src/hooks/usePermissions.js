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

        canViewCalendar: true,
        canViewHistory:  true,

        // ── Turnos ──────────────────────────────────────────
        canCreateAppointments:    !!perms.create_appointments,    // botón Agregar Turno
        canEditAppointments:      !!perms.edit_appointments,      // botón Editar en drawer
        canRescheduleAppointments:!!perms.reschedule_appointments,// botón Reagendar en drawer
        canConfirmAppointments:   !!perms.confirm_appointments,   // botón Confirmar en drawer
        canSetPending:            !!perms.set_pending_appointments,// botón Pendiente en drawer
        canMarkNoShow:            !!perms.mark_noshow_appointments,// botón No se presentó
        canDeleteAppointments:    !!perms.delete_appointments,    // botón Eliminar en drawer

        // ── Seguimiento ──────────────────────────────────────
        canViewFollowUp: !!perms.view_followup,                   // tab Seguimiento

        // ── Pacientes ────────────────────────────────────────
        canViewPatients:   !!perms.view_patients,                 // acceso al módulo
        canCreatePatients: !!perms.create_patients,               // botón Agregar Paciente
        canEditPatients:   !!perms.edit_patients,                 // botón Editar en drawer
        canDeletePatients: !!perms.delete_patients,               // botón Eliminar en drawer
        canExportPatients: !!perms.export_patients,               // botón Exportar CSV

        // ── Conversaciones e IA ──────────────────────────────
        canViewConversations: !!perms.view_conversations,         // módulo + botón Chat en drawer
        canToggleAi:          !!perms.toggle_ai,                  // botones Pausar / Reactivar IA

        // ── Estadísticas ─────────────────────────────────────
        canViewStats: !!perms.view_stats,                         // acceso al módulo

        // ── Servicios ────────────────────────────────────────
        canCreateServices: !!perms.create_services,               // botón Crear servicio
        canEditServices:   !!perms.edit_services,                 // botón Guardar cambios
        canToggleServices: !!perms.toggle_services,               // botones Activar / Desactivar
        // Acceso al módulo si tiene cualquier permiso de servicios
        canManageServices: !!(perms.create_services || perms.edit_services || perms.toggle_services),

        // ── Administración ───────────────────────────────────
        canManageRoles: !!perms.manage_roles,                     // módulo Usuarios, Actividad, Configuración
        canDeleteUsers: !!perms.delete_users,                     // botón Eliminar usuario
    };
}
