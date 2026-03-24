import { useState, useEffect } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { Shield, User, Check, Trash2, Key, Info, X, Mail, UserPlus } from 'lucide-react';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function NewUserModal({ isOpen, onClose, onAdd, roles }) {
    const [formData, setFormData] = useState({ email: '', password: '', full_name: '', role_id: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (roles?.length > 0 && !formData.role_id) {
            setFormData(prev => ({ ...prev, role_id: roles[0].id }));
        }
    }, [roles]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación de dominio obligatorio
        if (!formData.email.endsWith('@novturnia.com')) {
            alert('El correo debe terminar obligatoriamente en @novturnia.com');
            return;
        }

        setIsSubmitting(true);
        try {
            await onAdd(formData);
            setFormData({ email: '', password: '', full_name: '', role_id: roles[0]?.id || '' });
            onClose();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/20 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-card overflow-hidden animate-scale-in flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 p-4 bg-white/20 border-b border-white/40 backdrop-blur-md">
                    <h3 className="flex-1 font-bold text-navy-900 tracking-tight text-sm text-center">Agregar Personal</h3>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 overflow-y-auto custom-scrollbar space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-navy-800 uppercase tracking-widest pl-1">Nombre Completo</label>
                        <input
                            required
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder="Ej: Dr. Alejandro Paz"
                            className="w-full bg-white/40 backdrop-blur-card border border-white/60 rounded-full px-4 py-2 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all shadow-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-navy-800 uppercase tracking-widest pl-1">Email de Acceso</label>
                        <div className="relative">
                            <input
                                required
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="ejemplo@novturnia.com"
                                className="w-full bg-white/40 backdrop-blur-card border border-white/60 rounded-full pl-4 pr-28 py-2 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all shadow-sm"
                            />
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-navy-900 bg-white/60 border border-white/80 px-2 py-1 rounded-full shadow-sm pointer-events-none">
                                @novturnia.com
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-navy-800 uppercase tracking-widest pl-1">Contraseña</label>
                        <input
                            required
                            type="text"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Contraseña para el usuario"
                            className="w-full bg-white/40 backdrop-blur-card border border-white/60 rounded-full px-4 py-2 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all shadow-sm"
                        />
                    </div>

                    <div className="space-y-1 pb-2">
                        <label className="text-[10px] font-bold text-navy-800 uppercase tracking-widest pl-1">Cargo / Rol</label>
                        <select
                            required
                            value={formData.role_id}
                            onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                            className="w-full bg-white/40 backdrop-blur-card border border-white/60 rounded-full px-4 py-2 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Seleccionar Rol...</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name || 'Sin nombre'}</option>
                            ))}
                        </select>
                        {roles.length === 0 && <p className="text-[10px] text-red-500 mt-1 font-bold">⚠️ No se encontraron roles.</p>}
                    </div>

                    <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/40 mt-auto">
                        <button type="button" onClick={onClose}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-white/80 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/80 transition-colors shadow-sm min-w-[110px]">
                            <X size={13} /> Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-white/80 rounded-full text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all disabled:opacity-50 min-w-[130px]"
                        >
                            {isSubmitting ? (
                                'Guardando...'
                            ) : (
                                <>
                                    <UserPlus size={13} /> Crear Usuario
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Users() {
    const { users, roles, loading, changeRole, addUser, removeUser } = useUsers();
    const { user: currentUser } = useAuth();
    const [selectedUser, setSelectedUser] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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
        console.log('handleDelete called for user:', user);
        console.log('removeUser function:', removeUser);

        if (!user || !user.id) return alert('No se pudo identificar al usuario.');
        if (user.id === currentUser?.id) return alert('No puedes eliminarte a ti mismo.');

        const ok = window.confirm(`¿Estás seguro de eliminar a ${user.full_name}? Esto revocará su acceso al sistema.`);
        console.log('Confirm returned:', ok);
        if (!ok) return;

        try {
            console.log('Calling removeUser in hook...');
            await removeUser(user.id);
            console.log('removeUser done.');
            setSelectedUser(null);
        } catch (err) {
            console.error('Catch error in handleDelete:', err);
            alert('Error al eliminar: ' + err.message);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto w-full pt-2">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Gestión de Usuarios</h1>
                        <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Administra el personal y sus turnos</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 shadow-sm text-xs font-bold text-navy-900">
                        <button onClick={() => setIsModalOpen(true)} className="px-4 py-1.5 rounded-full bg-white shadow-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-1">
                            <span>+</span> Agregar Personal
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 lg:gap-6 flex-1 min-h-0 mb-4 lg:mb-6">
                {/* Left Panel: User List */}
                <div className="w-[320px] bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-card flex flex-col overflow-hidden animate-fade-up">
                    <div className="p-4 border-b border-white/40 bg-white/20 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-navy-900 text-sm">Personal Activo</h3>
                            <span className="text-[10px] font-bold text-navy-900 tracking-tight">{users.length} miembros</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {users.map(u => {
                            const isSelected = selectedUser?.id === u.id;
                            const badge = getRoleBadge(u);
                            const isMe = currentUser?.id === u.id;
                            return (
                                <button
                                    key={u.id}
                                    onClick={() => setSelectedUser(u)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left group border ${isSelected ? 'bg-white/60 border-white/80 shadow-sm' : 'hover:bg-white/40 border-transparent'}`}
                                >
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 border ${isSelected ? 'bg-navy-900 border-navy-900 text-white shadow-md' : 'bg-white border-white/60 text-navy-900 group-hover:bg-navy-900 group-hover:text-white group-hover:border-navy-900 shadow-sm'}`}>
                                        {getInitials(u.full_name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold text-sm truncate ${isSelected ? 'text-navy-900' : 'text-navy-900/80'}`}>{u.full_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="text-[9px] font-bold text-navy-700 tracking-tight truncate capitalize">{badge.label}</div>
                                            {isMe && <span className="text-[9px] bg-navy-900/10 text-navy-900 px-1.5 py-0.5 rounded-full font-bold ml-auto shrink-0">Tú</span>}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Permissions & Settings */}
                <div className="flex-1 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-card flex flex-col overflow-hidden relative overflow-y-auto custom-scrollbar">
                    {selectedUser ? (
                        <div className="p-6 animate-fade-up">
                            {/* User Profile Info */}
                            <div className="flex items-center justify-between mb-6 bg-white/40 p-4 rounded-2xl border border-white/60 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-navy-900 flex items-center justify-center text-white text-xl font-bold shadow-md border border-white/20">
                                        {getInitials(selectedUser.full_name)}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-navy-900 tracking-tight">{selectedUser.full_name}</h2>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-navy-700 font-semibold text-xs tracking-wide">{selectedUser.email}</span>
                                            <div className="w-1 h-1 rounded-full bg-navy-900/20" />
                                            <span className="text-[10px] text-navy-900 bg-white/60 px-2 py-0.5 rounded-full font-bold tracking-tight shadow-sm">Activo</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDelete(selectedUser)}
                                        className="p-2.5 bg-white/60 text-red-600 rounded-full border border-white/80 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors shadow-sm"
                                        title="Eliminar Acceso"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Role Switcher */}
                            <div className="mb-6">
                                <h4 className="text-[10px] font-bold text-navy-800 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                    <Key size={14} /> Nivel de Cargo
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {roles.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={async () => {
                                                if (selectedUser.role_id === r.id) return;
                                                if (!confirm(`¿Cambiar el cargo de ${selectedUser.full_name} a ${r.name}?`)) return;
                                                try {
                                                    await changeRole(selectedUser.id, r.id);
                                                    setSelectedUser({ ...selectedUser, role_id: r.id, staff_roles: r });
                                                } catch (err) {
                                                    alert('Error al cambiar rol: ' + err.message);
                                                }
                                            }}
                                            className={`p-3 rounded-2xl border transition-all text-left relative flex items-center ${selectedUser.role_id === r.id
                                                ? 'bg-navy-900 border-navy-800 text-white shadow-md'
                                                : 'bg-white/50 backdrop-blur-md border border-white/80 text-navy-900 hover:bg-white/80 shadow-sm'}`}
                                        >
                                            <div className="font-bold text-xs tracking-wide">
                                                {(() => {
                                                    const translations = {
                                                        'dentist': 'Dentista / admin',
                                                        'secretary': 'Secretaria',
                                                        'admin': 'Administrador',
                                                        'staff': 'Personal'
                                                    };
                                                    return translations[r.name.toLowerCase()] || r.name;
                                                })()}
                                            </div>
                                            {selectedUser.role_id === r.id && (
                                                <div className="ml-auto text-white bg-white/20 rounded-full p-1 shadow-sm border border-white/30">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Permissions Visualization */}
                            <div>
                                <h4 className="text-[10px] font-bold text-navy-800 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                    <Shield size={14} /> Permisos del Rol
                                </h4>
                                <div className="bg-white/30 backdrop-blur-md border border-white/60 shadow-sm rounded-2xl p-4 grid grid-cols-2 gap-3">
                                    {Object.entries(selectedUser.staff_roles?.permissions || {}).map(([key, value]) => (
                                        <div
                                            key={key}
                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${value ? 'bg-white/60 border-white/80 shadow-[0_2px_8px_rgba(26,58,107,0.05)]' : 'bg-white/30 border-white/40 opacity-70 grayscale'}`}
                                        >
                                            <div className={`shrink-0 w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${value ? 'bg-navy-900 border-navy-900 text-white shadow-sm' : 'bg-white/50 border-white text-transparent'}`}>
                                                {value && <Check size={10} strokeWidth={4} />}
                                            </div>
                                            <div className="font-bold text-navy-900 text-[11px] leading-none pt-0.5">
                                                {(() => {
                                                    const labels = {
                                                        view_calendar: 'Ver calendario',
                                                        manage_appointments: 'Gestionar turnos',
                                                        edit_appointments: 'Editar turnos',
                                                        view_patients: 'Ver pacientes',
                                                        manage_patients: 'Gestionar pacientes',
                                                        view_stats: 'Ver estadísticas',
                                                        manage_roles: 'Administrar staff',
                                                        manage_staff: 'Gestionar personal',
                                                        manage_users: 'Gestionar usuarios',
                                                        view_conversations: 'Ver conversaciones',
                                                        manage_conversations: 'Gestionar conversaciones'
                                                    };
                                                    return labels[key] || key.replace(/_/g, ' ');
                                                })()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
