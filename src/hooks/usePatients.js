import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { getPatients } from '../services/supabaseService';
import { useRealtimePatients } from './useRealtime';
import { useAppStore } from '../store/useAppStore';

export function usePatients() {
    const [rawPatients, setRawPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortOrder, setSortOrder] = useState('recent');

    // useRef en lugar de rawPatients.length como dependencia:
    // Tener rawPatients.length en el array de deps de useCallback recrea la función cada vez
    // que la lista cambia de tamaño. Esto causaba que el callback de realtime llamara load(),
    // que actualizaba rawPatients, que recreaba load(), creando un ciclo potencial.
    // Con un ref, la función es estable y solo se recrea si cambia `search`.
    const hasDataRef = useRef(false);

    // useRef para el debounce del buscador en lugar de window._patientSearchTimeout:
    // Usar window contamina el namespace global y no se limpia al desmontar el componente.
    // Si hay múltiples instancias montadas a la vez, comparten el mismo timeout.
    // Un ref es privado a la instancia del hook y se limpia correctamente.
    const searchTimeoutRef = useRef(null);

    const load = useCallback(async (q = search, forceRefresh = false) => {
        const cache = useAppStore.getState()._patientsCache;
        const STALE_MS = 60_000; // 1 minuto

        if (!q && !forceRefresh && cache.data.length > 0 && Date.now() - cache.fetchedAt < STALE_MS) {
            setRawPatients(cache.data);
            setLoading(false);
            return;
        }

        if (!hasDataRef.current) setLoading(true);
        try {
            const data = await getPatients(q);
            setRawPatients(data);
            hasDataRef.current = true;

            if (!q) {
                useAppStore.getState().setPatientsCache(data);
            }
            return data;
        } finally {
            setLoading(false);
        }
    }, [search]); // rawPatients.length removido de las dependencias

    useEffect(() => {
        load('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Limpieza del debounce al desmontar — evita que el timeout dispare después del unmount
    useEffect(() => {
        return () => clearTimeout(searchTimeoutRef.current);
    }, []);

    function handleSearch(q) {
        setSearch(q);
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => load(q), 300);
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
