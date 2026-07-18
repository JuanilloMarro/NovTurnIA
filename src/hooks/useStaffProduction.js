import { useState, useCallback, useEffect } from 'react';
import { getStaffProduction, setStaffCommission } from '../services/supabaseService';

// Producción por profesional en un rango: servicios cobrados, ingresos
// generados y comisión (con % congelado por entrada). También es el roster de
// staff para atribuir cobros (la RPC devuelve a todo el equipo del negocio).
export function useStaffProduction(range, enabled = true) {
    const start = range?.start;
    const end = range?.end;
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!enabled || !start || !end) { setLoading(false); return; }
        setLoading(true);
        try {
            setRows(await getStaffProduction(start, end));
        } catch (err) {
            console.error('[useStaffProduction]', err.message);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, start, end]);

    useEffect(() => { load(); }, [load]);

    async function saveCommission(staffId, pct) {
        await setStaffCommission(staffId, pct);
        await load();
    }

    const activeStaff = rows.filter(r => r.active);
    const totalCommission = rows.reduce((s, r) => s + Number(r.commission_total || 0), 0);
    const assignedRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);

    return { rows, activeStaff, totalCommission, assignedRevenue, loading, reload: load, saveCommission };
}
