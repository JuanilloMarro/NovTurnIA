import { useState, useEffect, useCallback } from 'react';
import {
    getPatientLTV,
    getRetentionRate,
    getServiceAnalytics,
    getAppointmentPrediction,
    getServices,
} from '../services/supabaseService';

function makeSection() {
    return { data: null, loading: true, error: null };
}

export function useStatsIntelligence(enabled = true, startDate, endDate) {
    const [ltv, setLtv]               = useState(makeSection);
    const [retention, setRetention]   = useState(makeSection);
    const [services, setServices]     = useState(makeSection);
    const [prediction, setPrediction] = useState(makeSection);
    const [ownServices, setOwnServices] = useState([]);

    const loadSection = useCallback(async (fetcher, setter) => {
        setter(s => ({ ...s, loading: true, error: null }));
        try {
            const data = await fetcher();
            setter({ data, loading: false, error: null });
        } catch (err) {
            setter({ data: null, loading: false, error: err.message || 'Error al cargar' });
        }
    }, []);

    const load = useCallback(() => {
        if (!enabled || !startDate || !endDate) return;
        // Carga servicios propios del negocio para padding y validación
        getServices().then(s => setOwnServices(s || [])).catch(() => {});
        loadSection(() => getPatientLTV(startDate, endDate),            setLtv);
        loadSection(() => getRetentionRate(startDate, endDate),         setRetention);
        loadSection(() => getServiceAnalytics(startDate, endDate),      setServices);
        loadSection(() => getAppointmentPrediction(startDate, endDate), setPrediction);
    }, [enabled, startDate, endDate, loadSection]);

    useEffect(() => { load(); }, [load]);

    return { ltv, retention, services, prediction, ownServices, reload: load };
}
