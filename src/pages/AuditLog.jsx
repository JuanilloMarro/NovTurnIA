import { useState, useEffect } from 'react';
import { getAuditLog, getStaffUsers, getPatientsForAuditLog } from '../services/supabaseService';
import { Search, Database, SlidersHorizontal, Plus, Edit2, Trash2, X, Download, RefreshCw } from 'lucide-react';
import { formatPhone } from '../utils/format';
import { downloadCSV } from '../utils/export';
import { withTimeout } from '../utils/withTimeout';

// ── Módulos ──
const MODULES = {
    'appointments': 'Turnos',
    'patients': 'Clientes',
    'patient_phones': 'Teléfonos',
    'staff_users': 'Personal',
    'staff_roles': 'Roles',
    'services': 'Servicios',
    'businesses': 'Negocio',
    'notifications': 'Notificaciones',
    'history': 'Conversaciones',
};

// ── Acciones ──
const ACTIONS = { 'INSERT': 'Creado', 'UPDATE': 'Actualizado', 'DELETE': 'Eliminado' };
const ACTION_STYLES = {
    'INSERT': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    'UPDATE': 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    'DELETE': 'bg-rose-500/10 text-rose-700 border-rose-500/20',
};

// ── Campos whitelist ──
const FIELDS = {
    'display_name': 'Nombre', 'full_name': 'Nombre completo', 'email': 'Correo',
    'phone': 'Teléfono', 'status': 'Estado', 'confirmed': 'Confirmado',
    'notes': 'Notas', 'active': 'Activo', 'permissions': 'Permisos',
    'name': 'Nombre', 'description': 'Descripción', 'duration_minutes': 'Duración',
    'content': 'Contenido', 'plan': 'Plan',
    'title': 'Título', 'type': 'Tipo', 'read': 'Leído',
};

const STATUS_MAP = { 'scheduled': 'Pendiente', 'confirmed': 'Confirmado', 'cancelled': 'Cancelado' };
const MODE_MAP = { 'auto': 'Automático', 'eval': 'Evaluación', 'human': 'Manual' };

function fmtVal(key, val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (key === 'status' && STATUS_MAP[val]) return STATUS_MAP[val];
    if (key === 'mode' && MODE_MAP[val]) return MODE_MAP[val];
    if (key === 'created_by') {
        if (val === 'bot' || val === 'ai_agent') return 'Inteligencia Artificial';
        if (val === 'dashboard' || val === 'system') return 'Sistema';
        return val;
    }
    if (key === 'permissions' && typeof val === 'object') {
        const on = Object.entries(val).filter(([, v]) => v).map(([k]) => FIELDS[k] || k);
        return on.length > 0 ? on.join(', ') : 'Ninguno';
    }
    if (typeof val === 'object') return null;
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
        try {
            const d = new Date(val);
            return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
        } catch { /* fallback */ }
    }
    if (key === 'duration_minutes') return `${val} min`;
    return String(val);
}

function parseData(obj, table, pMap) {
    if (!obj || typeof obj !== 'object') return null;
    let entries = Object.entries(obj)
        .filter(([k]) => FIELDS[k])
        .map(([k, v]) => ({ label: FIELDS[k], value: fmtVal(k, v) }))
        .filter(e => e.value !== null);

    // Context enrichment: Inject patient name or phone number
    if (table === 'appointments' && obj.patient_id && pMap?.[obj.patient_id]) {
        entries.unshift({ label: 'Cliente', value: pMap[obj.patient_id].name || 'Sin nombre' });
    }
    if (table === 'patients' && obj.id && pMap?.[obj.id]?.phone) {
        entries.push({ label: 'Teléfono', value: formatPhone(pMap[obj.id].phone) });
    }
    if (table === 'patient_phones' && obj.user_id && pMap?.[obj.user_id]) {
        entries.unshift({ label: 'Cliente', value: pMap[obj.user_id].name || 'Sin nombre' });
    }

    // Deduplicate entries by label
    const uniqueEntries = [];
    const seen = new Set();
    for (const e of entries) {
        if (!seen.has(e.label)) {
            seen.add(e.label);
            uniqueEntries.push(e);
        }
    }

    return uniqueEntries.length > 0 ? uniqueEntries : null;
}

function getLogSummary(log, oldP, newP, ctxPaciente) {
    try {
        const isUpdate = log.action === 'UPDATE';
        const isDelete = log.action === 'DELETE';
        const isInsert = log.action === 'INSERT';

        if (log.table_name === 'appointments') {
            const pName = ctxPaciente || 'un cliente';
            if (isInsert) return `creó un nuevo turno para ${pName}`;
            if (isDelete) return `eliminó el turno de ${pName}`;
            if (isUpdate) {
                const oldStatus = (oldP || []).find(e => e?.label === 'Estado')?.value;
                const newStatus = (newP || []).find(e => e?.label === 'Estado')?.value;
                if (oldStatus !== newStatus) {
                    if (newStatus === 'Cancelado') return `canceló el turno de ${pName}`;
                    if (newStatus === 'Confirmado') return `confirmó el turno de ${pName}`;
                    if (newStatus === 'Pendiente') return `marcó como pendiente el turno de ${pName}`;
                }

                const changedFields = (newP || []).filter(e => {
                    const oldVal = (oldP || []).find(o => o?.label === e?.label)?.value;
                    return oldVal !== e?.value;
                }).map(e => e?.label).filter(Boolean).join(', ');

                return `actualizó el turno de ${pName}${changedFields ? ` (${String(changedFields).toLowerCase()})` : ''}`;
            }
        }

        if (log.table_name === 'patients') {
            const pName = ctxPaciente || (newP || []).find(e => e?.label === 'Nombre' || e?.label === 'Nombre completo')?.value || 'un cliente';

            if (isInsert) return `registró a ${pName} como nuevo cliente`;
            if (isDelete) return `eliminó el registro de ${pName}`;
            if (isUpdate) {
                // Verificar si fue un Soft Delete
                if (!log.old_data?.deleted_at && log.new_data?.deleted_at) {
                    return `eliminó el registro del cliente ${pName}`;
                }
                // Verificar si fue una restauración (opcional)
                if (log.old_data?.deleted_at && !log.new_data?.deleted_at) {
                    return `restauró el registro del cliente ${pName}`;
                }

                const changedFields = (newP || []).filter(e => {
                    const oldVal = (oldP || []).find(o => o?.label === e?.label)?.value;
                    return oldVal !== e?.value;
                }).map(e => e?.label).filter(Boolean).join(', ');
                return `actualizó información de ${pName}${changedFields ? ` (${String(changedFields).toLowerCase()})` : ''}`;
            }
        }

        const actMap = { 'INSERT': 'creó un registro en', 'UPDATE': 'actualizó un registro en', 'DELETE': 'eliminó un registro en' };
        const moduleName = MODULES[log.table_name] || log.table_name || 'Módulo';
        return `${actMap[log.action] || log.action || 'Modificó'} ${moduleName}`;
    } catch (err) {
        return `Registró una actividad en ${MODULES[log.table_name] || log.table_name || 'el sistema'}`;
    }
}

export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [auditPage, setAuditPage] = useState(0);
    const [auditHasMore, setAuditHasMore] = useState(false);
    const [search, setSearch] = useState('');
    const [staffMap, setStaffMap] = useState({});
    const [patientMap, setPatientMap] = useState({});
    const [filterAction, setFilterAction] = useState('');
    const [filterUser, setFilterUser] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [exporting, setExporting] = useState(false);

    // T-35: deduplicación O(n) con Set — reemplaza el reduce con find() que era O(n²).
    // El trigger handle_audit_log ya previene nuevos duplicados en DB (ver migración T-35).
    // Este filtro es solo una salvaguarda para datos históricos.
    function deduplicateLogs(raw) {
        const seen = new Set();
        return raw.filter(l => {
            if (l.table_name === 'patient_phones') return false;
            // Bucket de 5 segundos: floor(ms / 5000) agrupa eventos dentro de la misma ventana
            const bucket = Math.floor(new Date(l.created_at).getTime() / 5000);
            const key = `${l.table_name}:${l.action}:${l.record_id}:${bucket}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async function fetchData() {
        setLoading(true);
        try {
            const [{ data: logData, hasMore: more }, staffData, patientsData] = await withTimeout(
                Promise.all([
                    getAuditLog({ page: 0 }),
                    getStaffUsers(),
                    getPatientsForAuditLog()
                ]),
                15_000,
                'auditLogFetchData'
            );

            const sMap = {};
            (staffData || []).forEach(u => { sMap[u.id] = u.full_name || u.email || 'Staff'; });

            const pMap = {};
            (patientsData || []).forEach(p => {
                pMap[p.id] = {
                    name: p.display_name,
                    phone: p.patient_phones?.find(ph => ph.is_primary)?.phone || p.patient_phones?.[0]?.phone
                };
            });

            setLogs(deduplicateLogs(logData || []));
            setAuditHasMore(more);
            setAuditPage(0);
            setStaffMap(sMap);
            setPatientMap(pMap);
        } catch (err) {
            console.error('Error fetching audit log:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchData(); }, []);

    function handleExport() {
        setExporting(true);
        try {
            const rows = filtered.map(log => ({
                fecha: log.created_at ? new Date(log.created_at).toLocaleString('es-GT') : '',
                usuario: userName(log.changed_by),
                modulo: MODULES[log.table_name] || log.table_name || '',
                accion: ACTIONS[log.action] || log.action || '',
            }));
            const date = new Date().toISOString().split('T')[0];
            downloadCSV(rows, `actividad_${date}.csv`);
        } finally {
            setExporting(false);
        }
    }

    async function loadMoreLogs() {
        if (!auditHasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const nextPage = auditPage + 1;
            const { data, hasMore: more } = await getAuditLog({ page: nextPage });
            setLogs(prev => deduplicateLogs([...prev, ...(data || [])]));
            setAuditHasMore(more);
            setAuditPage(nextPage);
        } catch (err) {
            console.error('Error loading more audit log:', err);
        } finally {
            setLoadingMore(false);
        }
    }

    function userName(uuid) {
        if (!uuid) return 'Sistema';
        return staffMap[uuid] || uuid.slice(0, 8) + '…';
    }

    // Unique users for filter dropdown — usa '__sistema__' como sentinel para changed_by null
    const SISTEMA_KEY = '__sistema__';
    const uniqueUsers = [...new Set(logs.map(l => l.changed_by ?? SISTEMA_KEY))].map(id => ({
        uuid: id,
        name: id === SISTEMA_KEY ? 'Sistema' : (staffMap[id] || id.slice(0, 8) + '…'),
    }));

    const hasActiveFilters = filterAction || filterUser;

    const filtered = logs.filter(log => {
        // Evaluar la acción efectiva (Visual) para el filtro
        const isSoftDelete = log.action === 'UPDATE' && !log.old_data?.deleted_at && log.new_data?.deleted_at;
        const isCancellation = log.action === 'UPDATE' && log.table_name === 'appointments' && log.new_data?.status === 'cancelled' && log.old_data?.status !== 'cancelled';
        const effectiveAction = (log.action === 'DELETE' || isSoftDelete || isCancellation) ? 'DELETE' : log.action;

        if (filterAction && effectiveAction !== filterAction) return false;
        if (filterUser) {
            const logUser = log.changed_by ?? SISTEMA_KEY;
            if (logUser !== filterUser) return false;
        }
        if (search) {
            const t = `${MODULES[log.table_name] || log.table_name} ${ACTIONS[effectiveAction] || effectiveAction} ${userName(log.changed_by)}`.toLowerCase();
            if (!t.includes(search.toLowerCase())) return false;
        }
        return true;
    });

    return (
        <div className="h-full flex flex-col max-w-[1080px] mx-auto w-full pt-2 px-0">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Registro de Actividad</h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">{filtered.length} registros</p>
                </div>
                <div className="flex items-center gap-2 md:h-10 flex-wrap w-full lg:w-auto">
                    {/* Search bar */}
                    <div className="relative w-full sm:w-64 h-10">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-900">
                            <Search size={14} strokeWidth={2.5} />
                        </div>
                        <input
                            className="w-full h-full bg-white/60 backdrop-blur-card border border-white/90 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-sm"
                            placeholder="Buscar por acción o usuario..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Refresh */}
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-10 shadow-sm">
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 active:scale-95 transition-all duration-300 overflow-hidden disabled:opacity-40"
                        >
                            <RefreshCw size={14} className={`shrink-0 ${loading ? 'animate-spin' : ''}`} />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">Actualizar</span>
                        </button>
                    </div>

                    {/* Export CSV */}
                    <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-10 shadow-sm">
                        <button
                            onClick={handleExport}
                            disabled={exporting || filtered.length === 0}
                            className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden disabled:opacity-50"
                        >
                            <Download size={14} className="shrink-0" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-300 whitespace-nowrap">Exportar</span>
                        </button>
                    </div>

                    {/* Filter funnel button */}
                    <div className="relative">
                        <div className="flex items-center bg-white/60 backdrop-blur-card border border-white/90 rounded-full p-1 h-10 shadow-sm">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="group h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-4 rounded-full bg-white border border-white/80 text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/80 transition-all duration-300 overflow-hidden outline-none"
                            >
                                <SlidersHorizontal size={14} className="shrink-0" />
                                <span className="max-w-0 overflow-hidden group-hover:max-w-[50px] transition-all duration-300 whitespace-nowrap">Filtros</span>
                            </button>
                        </div>

                        {/* Filter dropdown */}
                        {showFilters && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-3xl shadow-[0_8px_32px_rgba(26,58,107,0.16),0_2px_8px_rgba(0,0,0,0.06)] z-50 p-2 animate-fade-up">
                                {hasActiveFilters && (
                                    <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-gray-100">
                                        <span className="text-[10px] font-bold text-navy-700/50 tracking-wide">Filtros</span>
                                        <button onClick={() => { setFilterAction(''); setFilterUser(''); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-600">Limpiar</button>
                                    </div>
                                )}
                                <p className="px-2 pt-2 pb-1 text-[10px] font-bold text-navy-700/40 tracking-wide">Acción</p>
                                {[{ value: '', label: 'Todas' }, { value: 'INSERT', label: 'Creado' }, { value: 'UPDATE', label: 'Actualizado' }, { value: 'DELETE', label: 'Eliminado' }].map(opt => (
                                    <div
                                        key={opt.value}
                                        onClick={() => setFilterAction(opt.value)}
                                        className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${filterAction === opt.value ? 'bg-white border-white shadow-[0_4px_14px_rgba(0,0,0,0.09)] text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-gray-50'}`}
                                    >
                                        {opt.label}
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 mt-1 pt-1">
                                    <p className="px-2 pt-1 pb-1 text-[10px] font-bold text-navy-700/40 tracking-wide">Usuario</p>
                                    {[{ uuid: '', name: 'Todos' }, ...uniqueUsers].map(u => (
                                        <div
                                            key={u.uuid}
                                            onClick={() => setFilterUser(u.uuid)}
                                            className={`px-3 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${filterUser === u.uuid ? 'bg-white border-white shadow-[0_4px_14px_rgba(0,0,0,0.09)] text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-gray-50'}`}
                                        >
                                            {u.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 lg:mb-6 pr-3">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center">
                        <Database size={32} className="mx-auto mb-3 text-navy-900/20" />
                        <p className="text-sm font-semibold text-navy-700/60">Sin registros de auditoría.</p>
                    </div>
                ) : (
                    <div className="space-y-2 pt-1 pb-4">
                        {filtered.map(log => {
                            const modRaw = MODULES[log.table_name] || log.table_name || '—';
                            const mod = modRaw.charAt(0).toUpperCase() + modRaw.slice(1).toLowerCase();
                            const act = ACTIONS[log.action] || log.action || '—';

                            // Title Case User
                            const whoRaw = userName(log.changed_by);
                            const who = whoRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

                            const d = log.created_at ? new Date(log.created_at) : null;

                            const isInsert = log.action === 'INSERT';

                            // Detect Soft Deletes or Cancellations
                            const isSoftDelete = log.action === 'UPDATE' && !log.old_data?.deleted_at && log.new_data?.deleted_at;
                            const isCancellation = log.action === 'UPDATE' && log.table_name === 'appointments' && log.new_data?.status === 'cancelled' && log.old_data?.status !== 'cancelled';

                            const isEffectivelyDelete = log.action === 'DELETE' || isSoftDelete || isCancellation;

                            const oldPRaw = parseData(log.old_data, log.table_name, patientMap);
                            const newPRaw = parseData(log.new_data, log.table_name, patientMap);

                            // Extract context tags
                            const ctxPaciente = (newPRaw || oldPRaw)?.find(e => e.label === 'Cliente')?.value;
                            const ctxTelefono = (newPRaw || oldPRaw)?.find(e => e.label === 'Teléfono')?.value;

                            // Filter out context tags for the delta view
                            const oldP = oldPRaw?.filter(e => e.label !== 'Cliente' && e.label !== 'Teléfono');
                            const newP = newPRaw?.filter(e => e.label !== 'Cliente' && e.label !== 'Teléfono');

                            const summary = getLogSummary(log, oldP, newP, ctxPaciente);
                            const actStyle = ACTION_STYLES[isEffectivelyDelete ? 'DELETE' : log.action] || 'bg-gray-100 text-gray-600 border-gray-200';

                            return (
                                <div key={log.id} className="group bg-white/40 backdrop-blur-sm border border-white/60 rounded-2xl px-5 py-4 hover:bg-white/60 transition-all duration-300 shadow-sm">
                                    <div className="flex items-center gap-3.5">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${actStyle}`}>
                                            {isInsert ? <Plus size={16} strokeWidth={2.5} /> : isEffectivelyDelete ? <Trash2 size={16} strokeWidth={2.5} /> : <Edit2 size={16} strokeWidth={2.5} />}
                                        </div>

                                        <div className="flex-1">
                                            <p className="text-[13px] font-semibold text-navy-900 leading-snug">
                                                <span className="font-bold text-navy-900/60 text-[10px] tracking-wider block mb-0.5">{who}</span>
                                                {String(summary || '').charAt(0).toUpperCase() + String(summary || '').slice(1)}.
                                            </p>
                                            {d && (
                                                <div className="flex items-center mt-1.5 flex-wrap text-[10px] font-bold text-navy-900/40 tracking-wider">
                                                    <span>{mod}</span>
                                                    <span className="mx-1.5 opacity-60">•</span>
                                                    <span>{d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}</span>
                                                    <span className="mx-1.5 opacity-60">•</span>
                                                    <span>{d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {auditHasMore && (
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={loadMoreLogs}
                                    disabled={loadingMore}
                                    className="px-6 py-2 bg-white/50 border border-white/70 rounded-full text-xs font-bold text-navy-800 hover:bg-white/70 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {loadingMore ? 'Cargando...' : 'Cargar más'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
