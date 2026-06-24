import { useState, useCallback, useEffect } from 'react';
import {
    getSupplies,
    createSupply as createSupplyAPI,
    updateSupply as updateSupplyAPI,
    toggleSupplyActive,
    deleteSupply as deleteSupplyAPI,
    getServiceCosts,
} from '../services/supabaseService';

// Catálogo de insumos + costo teórico por servicio (vista v_service_cost).
export function useSupplies() {
    const [supplies, setSupplies] = useState([]);
    const [costs, setCosts] = useState([]); // [{ service_id, total_cost }]
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [s, c] = await Promise.all([getSupplies(), getServiceCosts()]);
            setSupplies(s);
            setCosts(c);
        } catch (err) {
            if (err.code !== '42P01' && err.code !== 'PGRST116') console.error('[useSupplies]', err.message);
            setSupplies([]);
            setCosts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function create(fields) {
        const c = await createSupplyAPI(fields);
        setSupplies(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name, 'es')));
        return c;
    }
    async function update(id, fields) {
        const u = await updateSupplyAPI(id, fields);
        setSupplies(prev => prev.map(s => s.id === id ? u : s));
        return u;
    }
    async function toggle(id, active) {
        await toggleSupplyActive(id, active);
        setSupplies(prev => prev.map(s => s.id === id ? { ...s, active } : s));
    }
    async function remove(id) {
        await deleteSupplyAPI(id);
        setSupplies(prev => prev.filter(s => s.id !== id));
    }

    // costo total del servicio según su receta (0 si no tiene receta)
    const costForService = (serviceId) =>
        Number(costs.find(c => String(c.service_id) === String(serviceId))?.total_cost || 0);

    return { supplies, costs, loading, reload: load, create, update, toggle, remove, costForService };
}
