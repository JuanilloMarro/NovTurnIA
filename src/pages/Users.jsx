import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { Shield, User, Check, Trash2, Key, Info, X, Mail, UserPlus, Save } from 'lucide-react';
import { showErrorToast, showSuccessToast } from '../store/useToastStore';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function NewUserModal({ isOpen, onClose, onAdd, roles }) {
    const [formData, setFormData] = useState({ email: '', password: '', full_name: '', role_id: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (roles?.length > 0 && !formData.role_id) {
            setFormData(prev => ({ ...prev, role_id: roles[0].id }));
        }
    }, [roles]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const emailRaw = formData.email.trim();
        if (!emailRaw) {
            setError('Por favor ingresa un email.');
            return;
        }

        // Si el usuario pone un texto simple, le agregamos el dominio default
        // Si ya puso un @, lo dejamos tal cual
        const fullEmail = emailRaw.includes('@') ? emailRaw : `${emailRaw}@novturnia.com`;

        setIsSubmitting(true);
        try {
            await onAdd({ ...formData, email: fullEmail });
            showSuccessToast(
                'Personal Agregado',
                `${formData.full_name} (${fullEmail})`,
                'staff'
            );
            setFormData({ email: '', password: '', full_name: '', role_id: roles[0]?.id || '' });
            onClose();
        } catch (err) {
            console.error('Create user error:', err);
            let msg = err.message || 'Error al conectar con el servidor.';
            
            // Traducción de error común de Supabase
            if (msg.includes('email rate limit exceeded')) {
                msg = 'Se ha superado el límite de intentos. Por favor, espera unos minutos antes de intentar de nuevo.';
            }
            
            setError(msg);
            showErrorToast('Error al Crear Usuario', msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-900/10 backdrop-blur-md">
            <div className="relative w-full max-w-md bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] overflow-hidden animate-fade-up flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <h2 className="text-lg font-bold text-navy-900 tracking-tight">Agregar Personal</h2>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                         <Info size={14} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="px-6 py-4 space-y-5">
                        {/* Nombre */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-widest leading-none mb-3">Nombre Completo</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-800/50">
                                    <User size={16} />
                                </div>
                                <input
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Ej: Dr. Alejandro Paz"
                                    className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 leading-none mb-3">Email de acceso</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-800/50">
                                    <Mail size={16} />
                                </div>
                                <input
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="dentista / secretaria"
                                    className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900"
                                />
                                {/* Eliminamos el dominio fijo para permitir emails reales o ficticios válidos */}
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 leading-none mb-3">Contraseña</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-800/50">
                                    <Key size={16} />
                                </div>
                                <input
                                    required
                                    type="text"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Contraseña segura"
                                    className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900"
                                />
                            </div>
                        </div>

                        {/* Rol */}
                        <div>
                            <label className="block text-[11px] font-bold text-navy-800 leading-none mb-3">Cargo / Rol</label>
                            <div className="relative">
                                <select
                                    required
                                    value={formData.role_id}
                                    onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                                    className="w-full bg-white/40 border border-white/60 rounded-full pl-4 pr-10 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm text-navy-900 appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>Seleccionar Rol...</option>
                                    {roles.map(r => {
                                        const translations = {
                                            'dentist': 'Dentista / admin',
                                            'secretary': 'Secretaria',
                                            'admin': 'Administrador',
                                            'staff': 'Personal'
                                        };
                                        const label = translations[(r.name || '').toLowerCase()] || r.name || 'Sin nombre';
                                        return (
                                            <option key={r.id} value={r.id}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
                                        );
                                    })}
                                </select>
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-navy-800/50">
                                    <Shield size={16} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 px-6 pb-6 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/40 border border-white/60 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm min-w-[100px]">
                            <X size={13} /> Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/40 border border-white/60 rounded-full text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/60 transition-all disabled:opacity-50 min-w-[100px]"
                        >
                            <Save size={13} />
                            {isSubmitting ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

export default function Users() {
    const { users, roles, loading, changeRole, addUser, removeUser, changeRolePermissions } = useUsers();
    const { user: currentUser } = useAuth();
    const { canDeleteUsers } = usePermissions();
    const [selectedUser, setSelectedUser] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // REMOVED AUTO FIX DENTIST PERMISSIONS to allow user testing
    // (Requested: enable testing varied role permissions)

    // Simulated per-role permissions for the UI demo as requested
    const PERMISSIONS = [
        { id: 'view_calendar', label: 'Ver Calendario', desc: 'Acceso a ver turnos' },
        { id: 'manage_appointments', label: 'Gestionar Turnos', desc: 'Crear, cancelar y editar citas' },
        { id: 'view_patients', label: 'Ver Pacientes', desc: 'Acceso al listado y perfiles' },
        { id: 'manage_patients', label: 'Gestionar Pacientes', desc: 'Crear y editar información médica' },
        { id: 'view_stats', label: 'Estadísticas', desc: 'Ver reportes y KPIs de la clínica' },
        { id: 'manage_roles', label: 'Administrar Staff', desc: 'Gestión de usuarios y permisos' },
    ];

    const getRoleBadge = (user) => {
        let roleName = user.staff_roles?.name || 'Personal';

        // Traducción manual de seguridad si el DB sigue en inglés
        const translations = {
            'dentist': 'Dentista / admin',
            'secretary': 'Secretaria',
            'admin': 'Administrador',
            'staff': 'Personal'
        };
        const key = roleName.toLowerCase();
        if (translations[key]) roleName = translations[key];

        const isDentist = user.staff_roles?.permissions?.view_stats;
        if (isDentist) return { label: roleName, classes: 'bg-navy-900 text-white shadow-navy-100' };
        return { label: roleName, classes: 'bg-white border border-gray-200 text-gray-600 shadow-sm' };
    };

    const handleDelete = async (user) => {
        if (!user || !user.id) return showErrorToast('Error', 'No se pudo identificar al usuario.');
        if (user.id === currentUser?.id) return showErrorToast('Acción denegada', 'No puedes eliminarte a ti mismo.');

        const ok = window.confirm(`¿Estás seguro de eliminar a ${user.full_name}? Esto revocará su acceso al sistema de forma permanente.`);
        if (!ok) return;

        try {
            await removeUser(user.id);
            showSuccessToast('Usuario Eliminado', `Se ha revocado el acceso de ${user.full_name}`, 'staff');
            setSelectedUser(null);
        } catch (err) {
            console.error('Catch error in handleDelete:', err);
            showErrorToast('Error al eliminar', err.message);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="h-full flex flex-col mx-auto w-full max-w-4xl pt-2 px-0">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Gestión de Usuarios</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Administra el personal y sus turnos</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 text-[11px] font-bold text-navy-900 shadow-sm h-10">
                        <button onClick={() => setIsModalOpen(true)} className="px-5 h-8 rounded-full bg-white border border-white/80 hover:bg-white/80 shadow-sm hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5 font-bold">
                            <span className="text-[14px]">+</span> Agregar Usuarios
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex overflow-hidden mb-4 lg:mb-6 animate-fade-up">
                {/* Left Side: User List Navigation */}
                <div className="w-[300px] xl:w-[320px] flex flex-col z-10">
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-navy-900 text-[13px] tracking-tight">Personal Activo</h3>
                            <span className="text-[10px] font-bold text-navy-900/40 tracking-tight">{users.length} miembros</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pt-0 space-y-1.5">
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
                <div className="flex-1 flex flex-col relative min-w-0">
                    {selectedUser ? (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* User Profile & Role Switcher + Title (STATIC HEADER) */}
                            <div className="p-8 pb-3 shrink-0 z-10 relative animate-fade-down">
                                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 xl:gap-0 mb-4">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-full bg-navy-900 flex items-center justify-center text-white text-lg font-bold shadow-md">
                                            {getInitials(selectedUser.full_name)}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-navy-900 tracking-tight">{selectedUser.full_name}</h2>
                                            <div className="flex items-center gap-2.5 mt-1.5">
                                                {selectedUser.email && (
                                                    <span className="text-navy-700 font-semibold text-[12px] tracking-wide">{selectedUser.email}</span>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                    <span className="text-[10px] font-bold text-navy-400 pt-[1px]">
                                                        {(() => {
                                                            const role = roles.find(r => r.id === selectedUser.role_id);
                                                            const translations = {
                                                                'dentist': 'Dentista / Admin',
                                                                'secretary': 'Secretaria',
                                                                'admin': 'Administrador',
                                                                'staff': 'Personal'
                                                            };
                                                            return translations[(role?.name || '').toLowerCase()] || role?.name || 'S/C';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col xl:items-end">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-[11px] font-bold text-navy-900/50 flex items-center gap-2">
                                                <Shield size={14} className="text-navy-900/20" />
                                                Panel de Accesos
                                            </h4>
                                        </div>
                                    </div>
                                </div>
                                
                            </div>


                            {/* Scrollable Permissions Checkboxes */}
                            <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar relative animate-fade-up">
                                <div className="space-y-10 pb-12 pt-2">
                                    {[
                                        {
                                            title: 'Roles en Turnos',
                                            perms: [
                                                { key: 'view_conversations', label: 'Ver conversación' },
                                                { key: 'toggle_ai', label: 'Pausar o reactivar IA' },
                                                { key: 'edit_appointments', label: 'Editar' },
                                                { key: 'confirm_appointments', label: 'Confirmar' },
                                                { key: 'delete_appointments', label: 'Eliminar' },
                                                { key: 'create_appointments', label: 'Crear turno' }
                                            ]
                                        },
                                        {
                                            title: 'Roles en Pacientes',
                                            perms: [
                                                { key: 'view_patients', label: 'Ver información' },
                                                { key: 'create_patients', label: 'Crear paciente' },
                                                { key: 'edit_patients', label: 'Editar paciente' },
                                                { key: 'delete_patients', label: 'Eliminar paciente' }
                                            ]
                                        },
                                        {
                                            title: 'Roles de Administración',
                                            perms: [
                                                { key: 'view_stats', label: 'Ver estadísticas' },
                                                { key: 'manage_roles', label: 'Administrar staff' },
                                                { key: 'delete_users', label: 'Eliminar personal' }
                                            ]
                                        }
                                    ].map(group => (
                                        <div key={group.title}>
                                            <h5 className="text-[12px] font-bold text-navy-700 tracking-wide mb-3 border-b border-navy-900/10 pb-1.5">{group.title}</h5>
                                            <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-4 pt-1">
                                                {group.perms.map(perm => {
                                                    const isChecked = selectedUser.staff_roles?.permissions?.[perm.key] || false;
                                                    
                                                    const togglePermission = () => {
                                                        const currentPerms = selectedUser.staff_roles?.permissions || {};
                                                        const newPerms = { ...currentPerms, [perm.key]: !isChecked };
                                                        
                                                        // Update local state ONLY
                                                        setSelectedUser({
                                                            ...selectedUser,
                                                            staff_roles: {
                                                                ...selectedUser.staff_roles,
                                                                permissions: newPerms
                                                            }
                                                        });
                                                    };

                                                    return (
                                                        <label key={perm.key} className="flex items-center gap-3.5 py-1 cursor-pointer select-none group w-fit">
                                                            <div className="relative shrink-0 flex items-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="peer sr-only" 
                                                                    checked={isChecked} 
                                                                    onChange={togglePermission} 
                                                                />
                                                                <div className={`w-[16px] h-[16px] rounded-[5px] border border-navy-900/30 bg-white/60 backdrop-blur-sm transition-all flex items-center justify-center peer-checked:bg-navy-900 peer-checked:border-navy-900 peer-checked:text-white group-hover:border-navy-900/50 shadow-sm`}>
                                                                    <Check size={12} strokeWidth={4} className={`transition-transform duration-200 ${isChecked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                                                                </div>
                                                            </div>
                                                            <div className="font-bold text-navy-900 text-[10.5px] tracking-tight leading-none pt-[1.5px]">
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
                            
                            {/* Footer de Acciones (Guardar y Eliminar) */}
                            <div className="mt-6 px-8 pb-10 flex items-center justify-end gap-3 z-20">
                                {/* 1. Guardar (Emerald) */}
                                <button
                                    onClick={async () => {
                                        if (!selectedUser) return;
                                        try {
                                            await changeRolePermissions(selectedUser.role_id, selectedUser.staff_roles?.permissions || {});
                                            showSuccessToast('Permisos Guardados', `Se han actualizado los permisos para el rol de ${selectedUser.full_name}`, 'staff');
                                        } catch (err) {
                                            showErrorToast('Error al Guardar', err.message);
                                        }
                                    }}
                                    className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-emerald-600 text-[11px] font-bold rounded-full shadow-card hover:bg-emerald-50 hover:border-emerald-100/50 transition-all duration-300 overflow-hidden"
                                >
                                    <Save size={14} className="shrink-0" />
                                    <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap">Guardar cambios</span>
                                </button>

                                {/* 2. Eliminar (Rose) */}
                                {canDeleteUsers && (
                                    <button
                                        onClick={() => handleDelete(selectedUser)}
                                        disabled={selectedUser.id === currentUser?.id}
                                        className={`group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white border border-white/80 text-rose-600 text-[11px] font-bold rounded-full shadow-card hover:bg-rose-50 transition-all duration-300 overflow-hidden ${selectedUser.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        title={selectedUser.id === currentUser?.id ? 'No puedes eliminarte a ti mismo' : 'Eliminar personal'}
                                    >
                                        <Trash2 size={14} className="shrink-0" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[70px] transition-all duration-300 whitespace-nowrap">Eliminar</span>
                                    </button>
                                )}
                            </div>
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

            <NewUserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={addUser}
                roles={roles}
            />
        </div>
    );
}
