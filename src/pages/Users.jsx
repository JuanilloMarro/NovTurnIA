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
            <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-navy-900">Agregar Personal</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Nombre Completo</label>
                        <input
                            required
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder="Ej: Dr. Alejandro Paz"
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-navy-500 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Email de Acceso</label>
                        <div className="relative">
                            <input
                                required
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="ejemplo@novturnia.com"
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-navy-500 transition-all font-medium pr-[110px]"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-navy-500 bg-navy-50 px-2 py-1 rounded-lg pointer-events-none">
                                @novturnia.com
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Contraseña</label>
                        <input
                            required
                            type="text"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Contraseña para el usuario"
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-navy-500 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Cargo / Rol</label>
                        <select
                            required
                            value={formData.role_id}
                            onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-navy-500 transition-all cursor-pointer"
                        >
                            <option value="" disabled>Seleccionar Rol...</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name || 'Sin nombre'}</option>
                            ))}
                        </select>
                        {roles.length === 0 && <p className="text-[10px] text-red-500 mt-1">⚠️ No se encontraron roles para esta clínica.</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full !mt-6 bg-navy-900 text-white font-bold py-4 rounded-[20px] shadow-btn hover:shadow-btn-hover hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Guardando...' : 'Crear Usuario'}
                    </button>
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
            'dentist': 'Dentista / Admin',
            'secretary': 'Secretaria',
            'admin': 'Administrador'
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
        <div className="max-w-7xl mx-auto h-full flex flex-col pt-2 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-sm text-gray-500 mt-1">Administra el personal y sus niveles de acceso</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-navy-900 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-btn hover:shadow-btn-hover transition-all flex items-center gap-2"
                    >
                        <UserPlus size={16} /> Agregar Personal
                    </button>
                </div>
            </div>

            <div className="flex gap-8 h-[calc(100vh-210px)]">
                {/* Left Panel: User List */}
                <div className="w-[420px] bg-white border border-gray-100 rounded-[32px] shadow-sm flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-navy-900">Personal Activo</h3>
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{users.length} miembros</span>
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
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left group ${isSelected ? 'bg-navy-50/80 border border-navy-100' : 'hover:bg-gray-50 border border-transparent'}`}
                                >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm transition-all duration-300 ${isSelected ? 'bg-navy-900' : 'bg-gray-300 group-hover:bg-navy-900'}`}>
                                        {getInitials(u.full_name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-navy-900 text-[15px]">{u.full_name}</span>
                                            {isMe && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badge.classes}`}>
                                                {badge.label}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Permissions & Settings */}
                <div className="flex-1 bg-white/70 backdrop-blur-xl border border-white/90 rounded-[32px] shadow-sm flex flex-col overflow-hidden relative overflow-y-auto custom-scrollbar">
                    {selectedUser ? (
                        <div className="p-10 animate-fade-up">
                            {/* User Profile Info */}
                            <div className="flex items-start justify-between mb-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-[24px] bg-navy-900 flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4 border-white transition-all duration-300">
                                        {getInitials(selectedUser.full_name)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-navy-900 tracking-tight">{selectedUser.full_name}</h2>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-gray-500 font-medium text-sm">{selectedUser.email}</span>
                                            <div className="w-1 h-1 rounded-full bg-gray-300" />
                                            <span className="text-emerald-500 font-bold text-xs uppercase tracking-widest">Activo</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDelete(selectedUser)}
                                        className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"
                                        title="Eliminar Acceso"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Role Switcher */}
                            <div className="mb-10">
                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Key size={14} className="text-navy-500" /> Nivel de Cargo
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
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
                                            className={`p-5 rounded-2xl border transition-all text-left relative ${selectedUser.role_id === r.id
                                                ? 'bg-navy-50 border-navy-200 ring-2 ring-navy-700/5 shadow-sm'
                                                : 'bg-white border-gray-100 hover:border-gray-300'}`}
                                        >
                                            <div className="font-bold text-navy-900 capitalize text-[15px]">{r.name}</div>
                                            {selectedUser.role_id === r.id && (
                                                <div className="absolute top-4 right-4 text-navy-700 bg-white rounded-full p-1 shadow-sm">
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Permissions Visualization */}
                            <div>
                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Shield size={14} className="text-navy-500" /> Permisos del Rol
                                </h4>
                                <div className="bg-gray-50/50 border border-gray-100 rounded-3xl p-6 grid grid-cols-2 gap-4">
                                    {Object.entries(selectedUser.staff_roles?.permissions || {}).map(([key, value]) => (
                                        <div
                                            key={key}
                                            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${value ? 'bg-white border-white shadow-[0_4px_12px_rgba(0,0,0,0.02)]' : 'opacity-60 grayscale'}`}
                                        >
                                            <div className={`mt-1 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${value ? 'bg-navy-900 border-navy-900 text-white' : 'bg-white border-gray-200'}`}>
                                                {value && <Check size={12} strokeWidth={4} />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-navy-900 text-[14px] capitalize">{key.replace('_', ' ')}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10 text-center">
                            <div className="w-20 h-20 rounded-full bg-white border border-gray-100 flex items-center justify-center mb-6 shadow-sm">
                                <Shield size={32} className="text-gray-200" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold text-navy-900 tracking-tight">Centro de Control Staff</h3>
                            <p className="max-w-[280px] text-[15px] font-medium text-gray-400 mt-2">
                                Selecciona un miembro del personal para ver su perfil y ajustar sus privilegios de acceso al sistema.
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
