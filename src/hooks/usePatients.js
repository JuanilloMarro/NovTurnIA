import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { getPatients } from '../services/supabaseService';
import { useRealtimePatients } from './useRealtime';
import { useAppStore } from '../store/useAppStore';

export function usePatients() {
    const [rawPatients, setRawPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [sortOrder, setSortOrder] = useState('recent');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

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

    const load = useCallback(async (q = search, forceRefresh = false, pageNum = 0) => {
        const cache = useAppStore.getState()._patientsCache;
        const STALE_MS = 60_000; // 1 minuto

        if (!q && !forceRefresh && pageNum === 0 && cache.data.length > 0 && Date.now() - cache.fetchedAt < STALE_MS) {
            setRawPatients(cache.data);
            setLoading(false);
            return cache.data;
        }

        if (!hasDataRef.current || forceRefresh) setLoading(true);
        try {
            const { data, count, hasMore: more } = await getPatients(q, { page: pageNum });
            if (pageNum === 0) {
                setRawPatients(data);
            } else {
                setRawPatients(prev => [...prev, ...data]);
            }
            setHasMore(more);
            setTotalCount(count);
            setPage(pageNum);
            hasDataRef.current = true;

            if (!q && pageNum === 0) {
                useAppStore.getState().setPatientsCache(data);
            }
            return data;
        } finally {
            setLoading(false);
        }
    }, [search]); // rawPatients.length removido de las dependencias

    // T-59: unificado — delega en load() para no duplicar lógica de estado.
    // load(q, false, page+1) detecta pageNum>0 y hace append en lugar de replace.
    // setLoading no se activa porque hasDataRef.current=true y forceRefresh=false.
    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            await load(search, false, page + 1);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, page, search, load]);

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
        setPage(0);
        setHasMore(false);
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => load(q, false, 0), 300);
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
            useAppStore.getState().invalidateConversationsCache(); // Conversations ve los mismos pacientes
            setPage(0);
            load('', true, 0); // Force refresh from page 0
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

    return { patients, loading, loadingMore, hasMore, totalCount, search, handleSearch, sortOrder, setSortOrder, reload: load, loadMore };
}
