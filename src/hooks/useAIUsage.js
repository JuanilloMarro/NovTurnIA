import { useState, useCallback, useEffect } from 'react';
import { getAIUsage } from '../services/supabaseService';

// Consumo semanal REAL de tokens IA (Centro IA · RPC get_ai_usage). Alimenta
// la UsageBar y el estado bloqueado de la UI; el tope de verdad vive en el
// backend (check_ai_budget → 429 ai_limit_reached), así que si esto falla la
// barra queda en 0 pero el límite igual se aplica.
export function useAIUsage(enabled = true) {
    const [usage, setUsage] = useState(null);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        try {
            const data = await getAIUsage();
            if (data) setUsage(data);
        } catch { /* sin datos: no bloquea el módulo */ }
    }, [enabled]);

    useEffect(() => { refresh(); }, [refresh]);

    const usedTokens = usage?.used_tokens ?? 0;
    const limitTokens = usage?.limit_tokens ?? 0;
    const pct = limitTokens > 0 ? Math.min(100, Math.round((usedTokens / limitTokens) * 100)) : 0;
    const blocked = limitTokens > 0 && usedTokens >= limitTokens;

    return { usedTokens, limitTokens, pct, blocked, resetsAt: usage?.resets_at ?? null, refresh };
}
