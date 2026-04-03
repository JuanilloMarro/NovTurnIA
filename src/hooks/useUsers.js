import { useState, useEffect } from 'react';
import {
    getStaffUsers,
    createStaffUser,
    deleteStaffUser,
    getStaffRoles,
    updateStaffUserRole,
    updateRolePermissions
} from '../services/supabaseService';

export function useUsers() {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [u, r] = await Promise.all([getStaffUsers(), getStaffRoles()]);
            setUsers(u || []);
            setRoles(r || []);
        } catch (err) {
            console.error('Error loading users/roles:', err.message);
        } finally {
            setLoading(false);
        }
    }

    async function addUser(userData) {
        const newUser = await createStaffUser(userData);
        setUsers(prev => [...prev, newUser]);
        return newUser;
    }

    async function removeUser(id) {
        try {
            await deleteStaffUser(id);
            setUsers(prev => prev.filter(u => u.id !== id));
        } catch (err) {
            console.error('Error in useUsers.removeUser hook:', err);
            throw err;
        }
    }

    async function changeRole(userId, roleId) {
        await updateStaffUserRole(userId, roleId);
        await loadData();
    }

    async function changeRolePermissions(roleId, permissions) {
        await updateRolePermissions(roleId, permissions);
        await loadData();
    }

    return { users, roles, loading, addUser, removeUser, changeRole, changeRolePermissions, refresh: loadData };
}
