import { useState, useCallback, useEffect } from 'react';
import {
    getFinanceCategories,
    createFinanceCategory as createFinanceCategoryAPI,
    updateFinanceCategory as updateFinanceCategoryAPI,
    toggleFinanceCategoryActive,
    deleteFinanceCategory as deleteFinanceCategoryAPI,
} from '../services/supabaseService';

export function useFinanceCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getFinanceCategories();
            setCategories(data);
        } catch (err) {
            // Graceful: tabla puede no existir aún en algunos entornos
            if (err.code !== 'PGRST116' && err.code !== '42P01') {
                console.error('[useFinanceCategories]', err.message);
            }
            setCategories([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function create(fields) {
        const created = await createFinanceCategoryAPI(fields);
        setCategories(prev =>
            [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'es'))
        );
        return created;
    }

    async function update(id, fields) {
        const updated = await updateFinanceCategoryAPI(id, fields);
        setCategories(prev => prev.map(c => c.id === id ? updated : c));
        return updated;
    }

    async function toggle(id, active) {
        await toggleFinanceCategoryActive(id, active);
        setCategories(prev => prev.map(c => c.id === id ? { ...c, active } : c));
    }

    async function remove(id) {
        await deleteFinanceCategoryAPI(id);
        setCategories(prev => prev.filter(c => c.id !== id));
    }

    return { categories, loading, reload: load, create, update, toggle, remove };
}
