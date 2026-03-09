import { useState, useEffect } from 'react';
import {
    getStaffUsers,
    createStaffUser,
    deleteStaffUser,
    getStaffRoles,
    updateStaffUserRole
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
        console.log('useUsers.removeUser called for id:', id);
        try {
            await deleteStaffUser(id);
            console.log('deleteStaffUser successful in DB');
            setUsers(prev => prev.filter(u => u.id !== id));
            console.log('users state updated in hook');
        } catch (err) {
            console.error('Error in useUsers.removeUser hook:', err);
            throw err;
        }
    }

    async function changeRole(userId, roleId) {
        await updateStaffUserRole(userId, roleId);
        await loadData();
    }

    return { users, roles, loading, addUser, removeUser, changeRole, refresh: loadData };
}
