import { useState, useCallback, useEffect, useMemo } from 'react';
import { getPatients } from '../services/supabaseService';
import { useRealtimePatients } from './useRealtime';

export function usePatients() {
    const [rawPatients, setRawPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortOrder, setSortOrder] = useState('recent');

    const load = useCallback(async (q = search) => {
        setLoading(true);
        try {
            const data = await getPatients(q);
            setRawPatients(data);
        } finally {
            setLoading(false);
        }
    }, [search]);

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

    // Realtime
    useRealtimePatients(load);

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
