import { useState, useEffect } from 'react';
import { getAuditLog, getStaffUsers } from '../services/supabaseService';
import { Search, Database, ArrowRight, Filter } from 'lucide-react';

// ── Módulos ──
const MODULES = {
    'appointments': 'Turnos',
    'patients': 'Pacientes',
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
    'created_by': 'Desde', 'content': 'Contenido', 'plan': 'Plan',
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
        const on = Object.entries(val).filter(([,v]) => v).map(([k]) => FIELDS[k] || k);
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

function parseData(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj)
        .filter(([k]) => FIELDS[k])
        .map(([k, v]) => ({ label: FIELDS[k], value: fmtVal(k, v) }))
        .filter(e => e.value !== null);
    return entries.length > 0 ? entries : null;
}

export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [staffMap, setStaffMap] = useState({});
    const [filterAction, setFilterAction] = useState('');
    const [filterUser, setFilterUser] = useState('');

    useEffect(() => {
        async function fetchData() {
            try {
                const [logData, staffData] = await Promise.all([getAuditLog(200), getStaffUsers()]);
                const map = {};
                (staffData || []).forEach(u => { map[u.id] = u.full_name || u.email || 'Staff'; });
                setLogs(logData || []);
                setStaffMap(map);
            } catch (err) {
                console.error('Error fetching audit log:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    function userName(uuid) {
        if (!uuid) return 'Sistema';
        return staffMap[uuid] || uuid.slice(0, 8) + '…';
    }

    // Unique users for filter dropdown
    const uniqueUsers = [...new Set(logs.map(l => l.changed_by))].map(uuid => ({
        uuid, name: userName(uuid)
    }));

    const filtered = logs.filter(log => {
        if (filterAction && log.action !== filterAction) return false;
        if (filterUser && log.changed_by !== filterUser) return false;
        if (search) {
            const t = `${MODULES[log.table_name] || log.table_name} ${ACTIONS[log.action] || log.action} ${userName(log.changed_by)}`.toLowerCase();
            if (!t.includes(search.toLowerCase())) return false;
        }
        return true;
    });

    const selectClass = "appearance-none bg-white/60 backdrop-blur-card border border-white/90 rounded-full px-3 py-2 text-[11px] font-bold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all shadow-sm cursor-pointer";

    return (
        <div className="h-full flex flex-col max-w-5xl mx-auto w-full pt-2 px-0">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Registro de Actividad</h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Historial de cambios en el sistema</p>
                </div>
                <div className="flex items-center gap-2 h-10 flex-wrap">
                    {/* Filtro Acción */}
                    <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className={selectClass}>
                        <option value="">Todas las acciones</option>
                        <option value="INSERT">Creado</option>
                        <option value="UPDATE">Actualizado</option>
                        <option value="DELETE">Eliminado</option>
                    </select>

                    {/* Filtro Usuario */}
                    <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={selectClass}>
                        <option value="">Todos los usuarios</option>
                        {uniqueUsers.map(u => (
                            <option key={u.uuid} value={u.uuid}>{u.name}</option>
                        ))}
                    </select>

                    {/* Búsqueda */}
                    <div className="relative w-48 h-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-navy-900">
                            <Search size={13} strokeWidth={2.5} />
                        </div>
                        <input
                            className="w-full h-full bg-white/60 backdrop-blur-card border border-white/90 rounded-full pl-9 pr-3 text-[11px] font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/50 shadow-sm"
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="px-2.5 py-2 bg-white/50 border border-white/70 rounded-full text-[10px] font-bold text-navy-700 shadow-sm">
                        {filtered.length}
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex flex-col overflow-hidden animate-fade-up mb-4 lg:mb-6">
                <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
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
                        <div className="space-y-2 pt-3">
                            {filtered.map(log => {
                                const mod = MODULES[log.table_name] || log.table_name || '—';
                                const act = ACTIONS[log.action] || log.action || '—';
                                const actStyle = ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-600 border-gray-200';
                                const who = userName(log.changed_by);
                                const d = log.created_at ? new Date(log.created_at) : null;

                                const oldP = parseData(log.old_data);
                                const newP = parseData(log.new_data);
                                const isUpdate = log.action === 'UPDATE';
                                const isDelete = log.action === 'DELETE';

                                return (
                                    <div key={log.id} className="bg-white/50 hover:bg-white/70 border border-white/60 rounded-2xl px-5 py-4 transition-colors">
                                        {/* Header: Acción → Módulo → Usuario → Hora */}
                                        <div className="flex items-center gap-2.5 flex-wrap mb-3">
                                            {/* Acción */}
                                            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-widest ${actStyle}`}>
                                                {act}
                                            </span>

                                            {/* Módulo */}
                                            <span className="text-[9px] font-bold text-navy-700 bg-navy-900/5 px-2.5 py-1 rounded-lg border border-navy-900/10 uppercase tracking-widest">
                                                {mod}
                                            </span>

                                            <div className="w-px h-4 bg-navy-900/10" />

                                            {/* Usuario */}
                                            <span className="text-[11px] font-bold text-navy-900">
                                                {who}
                                            </span>

                                            {/* Hora (derecha) */}
                                            {d && (
                                                <div className="ml-auto flex items-center gap-1.5 text-[10px] text-navy-900/45 font-semibold shrink-0">
                                                    <span>{d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}</span>
                                                    <span className="text-navy-900/20">•</span>
                                                    <span>{d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Data */}
                                        {(oldP || newP) && (() => {
                                            // Colores: DELETE = rojo "Datos", INSERT = verde "Datos", UPDATE = amber antes + verde después
                                            const oldStyle = isDelete
                                                ? 'bg-rose-50/40 border-rose-200/30'
                                                : 'bg-amber-50/40 border-amber-200/30';
                                            const oldLabel = isDelete
                                                ? 'text-rose-500/80'
                                                : 'text-amber-600/80';
                                            const newStyle = 'bg-emerald-50/40 border-emerald-200/30';
                                            const newLabel = 'text-emerald-600/80';

                                            return (
                                                <div className={`grid gap-3 ${oldP && newP ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-1'}`}>
                                                    {oldP && (
                                                        <div className={`border rounded-xl px-3 py-2.5 ${oldStyle}`}>
                                                            <div className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${oldLabel}`}>
                                                                {isDelete ? 'Datos' : 'Antes'}
                                                            </div>
                                                            <div className="space-y-1">
                                                                {oldP.map((e, i) => (
                                                                    <div key={i} className="flex gap-2 text-[11px]">
                                                                        <span className="text-navy-700/50 font-semibold min-w-[70px] shrink-0">{e.label}</span>
                                                                        <span className="text-navy-800/70 break-all">{e.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {oldP && newP && (
                                                        <div className="flex items-center justify-center">
                                                            <ArrowRight size={14} className="text-navy-900/20" />
                                                        </div>
                                                    )}

                                                    {newP && (
                                                        <div className={`border rounded-xl px-3 py-2.5 ${isUpdate ? newStyle : (log.action === 'INSERT' ? 'bg-emerald-50/40 border-emerald-200/30' : oldStyle)}`}>
                                                            <div className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${isUpdate ? newLabel : (log.action === 'INSERT' ? 'text-emerald-600/80' : oldLabel)}`}>
                                                                {oldP ? 'Después' : 'Datos'}
                                                            </div>
                                                            <div className="space-y-1">
                                                                {newP.map((e, i) => (
                                                                    <div key={i} className="flex gap-2 text-[11px]">
                                                                        <span className="text-navy-700/50 font-semibold min-w-[70px] shrink-0">{e.label}</span>
                                                                        <span className="text-navy-900 font-semibold break-all">{e.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
