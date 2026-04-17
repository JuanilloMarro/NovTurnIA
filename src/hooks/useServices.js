import { useState, useCallback, useEffect } from 'react';
import {
    getServices,
    createService as createServiceAPI,
    updateService as updateServiceAPI,
    toggleServiceActive,
    deleteService as deleteServiceAPI,
} from '../services/supabaseService';

export function useServices() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getServices();
            setServices(data);
        } catch (err) {
            // Graceful: tabla puede no existir aún en algunos entornos
            if (err.code !== 'PGRST116' && err.code !== '42P01') {
                console.error('[useServices]', err.message);
            }
            setServices([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function create(fields) {
        const created = await createServiceAPI(fields);
        setServices(prev =>
            [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'es'))
        );
        return created;
    }

    async function update(id, fields) {
        const updated = await updateServiceAPI(id, fields);
        setServices(prev => prev.map(s => s.id === id ? updated : s));
        return updated;
    }

    async function toggle(id, active) {
        await toggleServiceActive(id, active);
        setServices(prev => prev.map(s => s.id === id ? { ...s, active } : s));
    }

    async function remove(id) {
        await deleteServiceAPI(id);
        setServices(prev => prev.filter(s => s.id !== id));
    }

    return { services, loading, reload: load, create, update, toggle, remove };
}
