import { useState, useEffect, useCallback } from 'react';
import { getAIInsights, generateAIInsight, getPatientsByIds } from '../services/supabaseService';
import { SCOPE_META } from '../components/AIHub/aiActions';

// Centro IA — cache-first: `insights` es el feed de resultados ya generados
// (leerlos no gasta tokens). `generate(scope, opts)` es la única acción que
// invoca la IA.
export function useAIInsights(enabled = true) {
    const [insights, setInsights] = useState([]);
    const [patientNames, setPatientNames] = useState({}); // { [ref_id]: display_name }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Scope en generación ("patient_summary", "weekly_digest", ...) o null.
    const [generating, setGenerating] = useState(null);

    const load = useCallback(async () => {
        if (!enabled) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const data = await getAIInsights({ limit: 30 });
            setInsights(data);
            // A qué cliente pertenece cada análisis por-cliente (Actividad
            // reciente no debe mostrar solo "Resumen de cliente" a secas).
            const ids = [...new Set(
                data.filter(i => SCOPE_META[i.scope]?.needsPatient && i.ref_id).map(i => i.ref_id)
            )];
            if (ids.length) {
                getPatientsByIds(ids)
                    .then(rows => setPatientNames(Object.fromEntries(rows.map(r => [r.id, r.display_name]))))
                    .catch(() => { /* nombres son un extra visual, no bloquean el feed */ });
            } else {
                setPatientNames({});
            }
        } catch (err) {
            setError(err.message || 'Error al cargar los análisis');
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => { load(); }, [load]);

    const generate = useCallback(async (scope, opts = {}) => {
        setGenerating(scope);
        try {
            const result = await generateAIInsight(scope, opts);
            await load(); // refresca el feed con el insight recién cacheado
            return result;
        } finally {
            setGenerating(null);
        }
    }, [load]);

    // Último insight cacheado de un scope (y opcionalmente de un ref concreto).
    const latestFor = useCallback((scope, refId = null) =>
        insights.find(i => i.scope === scope && (refId == null || i.ref_id === refId)) || null,
    [insights]);

    return { insights, patientNames, loading, error, generating, generate, latestFor, reload: load };
}
