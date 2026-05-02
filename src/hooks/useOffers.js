import { useState, useCallback, useEffect } from 'react';
import {
    getOffers,
    createOffer as createOfferAPI,
    updateOffer as updateOfferAPI,
    toggleOfferActive,
    deleteOffer as deleteOfferAPI,
} from '../services/supabaseService';

// Estado derivado de starts_at/ends_at + active.
// El backend tiene exclusion constraint: dos ofertas activas del mismo
// servicio no pueden solapar. Acá sólo computamos labels para la UI.
export function getOfferStatus(offer, now = new Date()) {
    if (!offer.active) return 'inactive';
    const start = new Date(offer.starts_at);
    const end   = new Date(offer.ends_at);
    if (now < start) return 'scheduled';
    if (now >= end)  return 'expired';
    return 'active';
}

export function useOffers() {
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setOffers(await getOffers());
        } catch (err) {
            if (err.code !== 'PGRST116' && err.code !== '42P01') {
                console.error('[useOffers]', err.message);
            }
            setOffers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function create(fields) {
        const created = await createOfferAPI(fields);
        setOffers(prev => [created, ...prev]);
        return created;
    }

    async function update(id, fields) {
        const updated = await updateOfferAPI(id, fields);
        setOffers(prev => prev.map(o => o.id === id ? updated : o));
        return updated;
    }

    async function toggle(id, active) {
        await toggleOfferActive(id, active);
        setOffers(prev => prev.map(o => o.id === id ? { ...o, active } : o));
    }

    async function remove(id) {
        await deleteOfferAPI(id);
        setOffers(prev => prev.filter(o => o.id !== id));
    }

    return { offers, loading, reload: load, create, update, toggle, remove };
}
