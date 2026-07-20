import { useState, useEffect, useCallback } from 'react';
import {
    getPatientLTV,
    getRetentionRate,
    getAppointmentPrediction,
} from '../services/supabaseService';

// Nota: el análisis de servicios se movió a Finanzas → Resumen (servicios más
// rentables con costo real), por eso este hook ya no consulta getServiceAnalytics.

function makeSection() {
    return { data: null, loading: true, error: null };
}

export function useStatsIntelligence(enabled = true, startDate, endDate) {
    const [ltv, setLtv]               = useState(makeSection);
    const [retention, setRetention]   = useState(makeSection);
    const [prediction, setPrediction] = useState(makeSection);

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
        loadSection(() => getPatientLTV(startDate, endDate),            setLtv);
        loadSection(() => getRetentionRate(startDate, endDate),         setRetention);
        loadSection(() => getAppointmentPrediction(startDate, endDate), setPrediction);
    }, [enabled, startDate, endDate, loadSection]);

    useEffect(() => { load(); }, [load]);

    return { ltv, retention, prediction, reload: load };
}
