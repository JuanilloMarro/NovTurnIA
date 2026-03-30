import { useState, useCallback, useEffect, useMemo } from 'react';
import { getPatients } from '../services/supabaseService';
import { useRealtimePatients } from './useRealtime';
import { useAppStore } from '../store/useAppStore';

export function usePatients() {
    const [rawPatients, setRawPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortOrder, setSortOrder] = useState('recent');

    const load = useCallback(async (q = search, forceRefresh = false) => {
        const cache = useAppStore.getState()._patientsCache;
        const STALE_MS = 60_000; // 1 minuto

        // Usar caché solo si no hay búsqueda, no se fuerza el refresco, y la caché está fresca
        if (!q && !forceRefresh && cache.data.length > 0 && Date.now() - cache.fetchedAt < STALE_MS) {
            setRawPatients(cache.data);
            setLoading(false);
            return;
        }

        // Solo mostrar loading si es la carga inicial o si no hay datos en caché válidos
        if (rawPatients.length === 0) setLoading(true);
        try {
            const data = await getPatients(q);
            setRawPatients(data);
            
            // Guardar en caché solo la lista completa (sin búsqueda)
            if (!q) {
                useAppStore.getState().setPatientsCache(data);
            }
        } finally {
            setLoading(false);
        }
    }, [search, rawPatients.length]);

    useEffect(() => {
        load('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Búsqueda con debounce
    function handleSearch(q) {
        setSearch(q);
        clearTimeout(window._patientSearchTimeout);
        window._patientSearchTimeout = setTimeout(() => load(q), 300);
    }

    // Realtime Sync (Optimized: only re-fetch on Insert/Delete, Update locally)
    useRealtimePatients((payload) => {
        if (payload.eventType === 'UPDATE') {
            setRawPatients(current => {
                const newData = current.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p);
                // Si la caché tiene datos, actualizarla también
                const cache = useAppStore.getState()._patientsCache;
                if (cache.data.length > 0) useAppStore.getState().setPatientsCache(newData);
                return newData;
            });
        } else {
            // Re-fetch everything for Insert/Delete to keep consistency
            useAppStore.getState().invalidatePatientsCache();
            load('', true); // Force refresh
        }
    });

    // Apply Sorting
    const patients = useMemo(() => {
        return [...rawPatients].sort((a, b) => {
            if (sortOrder === 'recent') return new Date(b.created_at) - new Date(a.created_at);
            if (sortOrder === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
            if (sortOrder === 'a-z') return (a.display_name || '').localeCompare(b.display_name || '');
            if (sortOrder === 'z-a') return (b.display_name || '').localeCompare(a.display_name || '');
            return 0;
        });
    }, [rawPatients, sortOrder]);

    return { patients, loading, search, handleSearch, sortOrder, setSortOrder, reload: load };
}
