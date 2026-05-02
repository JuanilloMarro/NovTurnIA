import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';

// M-010: hook que expone el Set de patient_ids visibles según el plan del negocio.
// Lo usan componentes que necesitan ocultar acciones (Perfil/Chat) para pacientes
// que quedaron fuera del top-N del plan basic/pro.
//
// - null = sin límite (enterprise) o RPC no disponible → todo se muestra.
// - Set vacío = aún cargando o sin pacientes.
//
// Cache module-level para no llamar la RPC desde cada AppointmentDrawer.

let _cache = { bid: null, ids: null, ts: 0 };
const TTL_MS = 30_000;
const subscribers = new Set();

function notify() {
    subscribers.forEach(fn => fn());
}

async function refresh(bid) {
    const { data, error } = await supabase.rpc('get_visible_patient_ids', { p_business_id: bid });
    if (error) {
        // RPC no desplegada o error → tratar como sin límite
        _cache = { bid, ids: null, ts: Date.now() };
    } else {
        _cache = { bid, ids: new Set(data || []), ts: Date.now() };
    }
    notify();
}

export function invalidateVisiblePatients() {
    _cache = { bid: null, ids: null, ts: 0 };
    notify();
}

export function useVisiblePatients() {
    const bid = useAppStore(s => s.businessId);
    const [, force] = useState(0);

    useEffect(() => {
        const cb = () => force(n => n + 1);
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }, []);

    useEffect(() => {
        if (!bid) return;
        const fresh = _cache.bid === bid && Date.now() - _cache.ts < TTL_MS;
        if (!fresh) refresh(bid);
    }, [bid]);

    const ids = _cache.bid === bid ? _cache.ids : null;
    return {
        // null = sin filtro → todo visible
        isPatientVisible: (patientId) => ids === null || ids.has(patientId),
        unlimited: ids === null,
    };
}
