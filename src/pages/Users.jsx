import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { Shield, Check, Save, Lock, ChevronLeft } from 'lucide-react';
import { showStaffPermsToast, showErrorToast } from '../store/useToastStore';
import { usePlanLimits } from '../hooks/usePlanLimits';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// isMainRole y MAIN_ROLES han sido eliminados de este archivo.
// Antes se usaban para determinar si los permisos de un usuario estaban bloqueados
// y si el usuario actual podía editar permisos. El problema:
//   1. Duplicaba la lógica hardcodeada que acabamos de eliminar de usePermissions.js
//   2. canEditPermissions usaba isCurrentUserMain (hardcodeado) en lugar de canManageRoles
//      (derivado de la DB), creando una inconsistencia: un usuario con manage_roles:true
//      cuyo rol se llame "supervisor" no podría editar permisos aunque la DB lo autorice.
//   3. Los checkboxes mostraban todos en true para "doctor" sin consultar la DB.
// Ahora: un usuario puede editar si canManageRoles (del hook, derivado de DB).
// Un rol tiene permisos "fijos" si la DB no permite edición (rol no-secretary).
// T-34: un rol es editable si tiene permisos JSONB en la DB,
// sin importar su nombre. Antes solo 'secretary' podía editarse.
function isEditableRole(role) {
    if (role?.permissions === null || role?.permissions === undefined) return false;
    // El rol con manage_roles:true es el rol máximo — sus permisos no se pueden editar
    // desde la UI para evitar un lockout accidental.
    if (role.permissions?.manage_roles === true) return false;
    return true;
}

// ── Traducciones de roles a español ──
const ROLE_TRANSLATIONS = {
    'dentist': 'Dentista',
    'barber': 'Barbero',
    'veterinarian': 'Veterinario',
    'doctor': 'Doctor',
    'secretary': 'Secretaria',
    'admin': 'Administrador',
    'staff': 'Personal'
};
function translateRole(name) {
    return ROLE_TRANSLATIONS[(name || '').toLowerCase()] || name || 'S/C';
}

export default function Users() {
    const { users, roles, loading, changeRole, changeRolePermissions } = useUsers();
    const { user: currentUser } = useAuth();
    const { canManageRoles } = usePermissions();
    const { staffUsed, maxStaff } = usePlanLimits();
    const [selectedUser, setSelectedUser] = useState(null);

    const getRoleBadge = (user) => {
        const roleName = user.staff_roles?.name || 'Personal';
        const label = translateRole(roleName);
        const isEditable = isEditableRole(user.staff_roles);
        if (!isEditable) return { label, classes: 'bg-navy-900 text-white shadow-navy-100' };
        return { label, classes: 'bg-white border border-gray-200 text-gray-600 shadow-sm' };
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
        </div>
    );

    // ── Determine permission editability for selected user ──
    // T-34: editabilidad basada en si el rol tiene permissions JSONB, no en el nombre del rol
    const canEditPermissions = canManageRoles && isEditableRole(selectedUser?.staff_roles);

    return (
        <div className="h-full flex flex-col mx-auto w-full max-w-[1080px] pt-2 px-0">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Gestión de Usuarios</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Administra el personal y sus permisos</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex overflow-hidden mb-4 lg:mb-6 animate-fade-up">
                {/* Left Side: User List Navigation */}
                <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} w-full md:w-[300px] xl:w-[320px] flex-col z-10 border-r border-white/40 md:border-r-0`}>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-navy-900 text-[13px] tracking-tight">Personal Activo</h3>
                            <span className="text-[10px] font-bold text-navy-900/40 tracking-tight">{users.length} miembros</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pr-3 pt-0 space-y-1.5">
                        {users.map(u => {
                            const isSelected = selectedUser?.id === u.id;
                            const badge = getRoleBadge(u);
                            const isMe = currentUser?.id === u.id;
                            return (
                                <button
                                    key={u.id}
                                    onClick={() => setSelectedUser(u)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left group border ${isSelected ? 'bg-white/60 border-white/80' : 'hover:bg-white/40 border-transparent hover:border-white/40'}`}
                                >
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border ${isSelected ? 'bg-navy-900 border-navy-900 text-white shadow-md shadow-navy-900/10' : 'bg-white/60 border-white/80 text-navy-900 group-hover:bg-navy-900 group-hover:text-white group-hover:border-navy-900'}`}>
                                        {getInitials(u.full_name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold text-sm truncate ${isSelected ? 'text-navy-900' : 'text-navy-900/80'}`}>{u.full_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className={`text-[9px] font-bold tracking-tight truncate capitalize ${isSelected ? 'text-navy-900/70' : 'text-navy-700/50'}`}>{badge.label}</div>
                                            {isMe && <span className="text-[9px] bg-navy-900/10 text-navy-900 px-1.5 py-0.5 rounded-full font-bold ml-auto shrink-0">Tú</span>}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Permissions & Settings */}
                <div className={`${selectedUser ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative min-w-0`}>
                    {selectedUser ? (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* User Profile Header */}
                            <div className="p-4 md:p-8 pb-3 shrink-0 z-10 relative animate-fade-down">
                                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 xl:gap-0 mb-4">
                                    <div className="flex items-center gap-3 md:gap-5">
                                        <button
                                            onClick={() => setSelectedUser(null)}
                                            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/60 border border-white/80 text-navy-700 hover:bg-white/80 shadow-sm shrink-0"
                                            aria-label="Volver al listado"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white text-base md:text-lg font-bold shadow-md bg-navy-900 shrink-0">
                                            {getInitials(selectedUser.full_name)}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-bold text-navy-900 tracking-tight">{selectedUser.full_name}</h2>
                                            <div className="flex items-center gap-2.5 mt-1.5">
                                                {selectedUser.email && (
                                                    <span className="text-navy-700 font-semibold text-[12px] tracking-wide">{selectedUser.email}</span>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full shadow-[0_0_8px] bg-navy-700 shadow-navy-700/50" />
                                                    <span className="text-[10px] font-bold text-navy-400 pt-[1px]">
                                                        {translateRole(selectedUser?.staff_roles?.name)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col xl:items-end gap-1.5">
                                        {!isEditableRole(selectedUser?.staff_roles) && (
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-navy-700 bg-navy-900/5 border border-navy-900/10 px-2.5 py-1 rounded-full">
                                                <Lock size={10} />
                                                {selectedUser?.staff_roles?.permissions?.manage_roles
                                                    ? 'Rol máximo acciones no editables'
                                                    : 'Permisos definidos en DB'}
                                            </div>
                                        )}
                                        {isEditableRole(selectedUser?.staff_roles) && canManageRoles && (
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-navy-700 bg-navy-900/5 border border-navy-900/10 px-2.5 py-1 rounded-full">
                                                <Shield size={10} />
                                                Permisos configurables
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Permissions Checkboxes */}
                            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 custom-scrollbar relative animate-fade-up">
                                <div className="space-y-10 pb-12 pt-2">
                                    {[
                                        {
                                            title: 'Turnos',
                                            perms: [
                                                { key: 'create_appointments', label: 'Agregar turno' },
                                                { key: 'edit_appointments', label: 'Editar turno' },
                                                { key: 'reschedule_appointments', label: 'Reagendar turno' },
                                                { key: 'confirm_appointments', label: 'Confirmar turno' },
                                                { key: 'set_pending_appointments', label: 'Marcar como pendiente' },
                                                { key: 'mark_noshow_appointments', label: 'No se presentó' },
                                                { key: 'delete_appointments', label: 'Eliminar turno' },
                                            ]
                                        },
                                        {
                                            title: 'Seguimiento',
                                            perms: [
                                                { key: 'view_followup', label: 'Ver seguimiento' },
                                            ]
                                        },
                                        {
                                            title: 'Clientes',
                                            perms: [
                                                { key: 'view_patients', label: 'Ver clientes' },
                                                { key: 'create_patients', label: 'Agregar cliente' },
                                                { key: 'edit_patients', label: 'Editar cliente' },
                                                { key: 'delete_patients', label: 'Eliminar cliente' },
                                                { key: 'export_patients', label: 'Exportar CSV' },
                                            ]
                                        },
                                        {
                                            title: 'Conversaciones e IA',
                                            perms: [
                                                { key: 'view_conversations', label: 'Ver conversaciones' },
                                                { key: 'toggle_ai', label: 'Pausar IA' },
                                            ]
                                        },
                                        {
                                            title: 'Estadísticas',
                                            perms: [
                                                { key: 'view_stats', label: 'Ver estadísticas' },
                                            ]
                                        },
                                        {
                                            title: 'Servicios',
                                            perms: [
                                                { key: 'create_services', label: 'Crear servicio' },
                                                { key: 'edit_services', label: 'Editar servicio' },
                                                { key: 'toggle_services', label: 'Activar / Desactivar servicio' },
                                            ]
                                        },
                                        {
                                            title: 'Administración',
                                            perms: [
                                                { key: 'manage_roles', label: 'Gestionar usuarios y roles' },
                                                { key: 'delete_users', label: 'Eliminar usuarios' },
                                            ]
                                        },
                                    ].map(group => (
                                        <div key={group.title}>
                                            <h5 className="text-[12px] font-bold text-navy-700 tracking-wide mb-3 border-b border-navy-900/10 pb-1.5">{group.title}</h5>
                                            <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-4 pt-1">
                                                {group.perms.map(perm => {
                                                    // El valor del checkbox viene siempre de la DB (permissions JSON).
                                                    // Antes: si el rol era "doctor", todos los checkboxes se forzaban a true
                                                    // sin importar lo que dijera la DB. Ahora la DB es la única fuente de verdad.
                                                    const isChecked = selectedUser.staff_roles?.permissions?.[perm.key] || false;
                                                    const isLocked = !canEditPermissions;

                                                    const togglePermission = () => {
                                                        if (isLocked) return;
                                                        const currentPerms = selectedUser.staff_roles?.permissions || {};
                                                        const newPerms = { ...currentPerms, [perm.key]: !isChecked };

                                                        setSelectedUser({
                                                            ...selectedUser,
                                                            staff_roles: {
                                                                ...selectedUser.staff_roles,
                                                                permissions: newPerms
                                                            }
                                                        });
                                                    };

                                                    return (
                                                        <label
                                                            key={perm.key}
                                                            className={`flex items-center gap-3.5 py-1 select-none group w-fit ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
                                                        >
                                                            <div className="relative shrink-0 flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="peer sr-only"
                                                                    checked={isChecked}
                                                                    onChange={togglePermission}
                                                                    disabled={isLocked}
                                                                />
                                                                <div className={`w-[16px] h-[16px] rounded-[5px] border transition-all flex items-center justify-center shadow-sm ${isChecked
                                                                    ? 'bg-navy-900 border-navy-900 text-white'
                                                                    : 'border-navy-900/30 bg-white/60 backdrop-blur-sm'
                                                                    } ${!isLocked ? 'group-hover:border-navy-900/50' : 'opacity-90'}`}>
                                                                    <Check size={12} strokeWidth={4} className={`transition-transform duration-200 ${isChecked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                                                                </div>
                                                            </div>
                                                            <div className={`font-bold text-[10.5px] tracking-tight leading-none pt-[1.5px] ${isLocked && isChecked ? 'text-navy-900/60' : 'text-navy-900'}`}>
                                                                {perm.label}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer: Guardar (solo si es editable) */}
                            {canEditPermissions && (
                                <div className="mt-6 px-4 md:px-8 pb-6 md:pb-10 flex items-center justify-end gap-3 z-20">
                                    <button
                                        onClick={async () => {
                                            if (!selectedUser) return;
                                            try {
                                                await changeRolePermissions(selectedUser.role_id, selectedUser.staff_roles?.permissions || {});
                                                showStaffPermsToast(`Permisos actualizados para ${translateRole(selectedUser?.staff_roles?.name)}`);
                                            } catch (err) {
                                                showErrorToast('Error al Guardar', err.message);
                                            }
                                        }}
                                        className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-card hover:bg-navy-50 hover:border-navy-100/50 transition-all duration-300 overflow-hidden"
                                    >
                                        <Save size={14} className="shrink-0" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap">Guardar cambios</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-navy-900/60 p-6 text-center animate-fade-in z-10">
                            <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center mb-4 shadow-sm">
                                <Shield size={28} strokeWidth={1.5} className="text-navy-900" />
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 tracking-tight">Centro de Control Staff</h3>
                            <p className="max-w-[280px] text-xs font-semibold mt-1">
                                Selecciona un miembro del personal para ver su perfil y ajustar accesos.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
