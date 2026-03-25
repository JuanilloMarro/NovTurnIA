import { useState, useEffect } from 'react';
import { getAuditLog } from '../services/supabaseService';
import { List, Search, Clock, User as UserIcon } from 'lucide-react';

export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        async function fetchLogs() {
            try {
                const data = await getAuditLog(200);
                setLogs(data);
            } catch (err) {
                console.error('Error fetching audit log:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const text = `${log.action_type} ${log.description} ${log.patients?.display_name || ''}`.toLowerCase();
        return text.includes(search.toLowerCase());
    });

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto w-full pt-2 px-0 shadow-none">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">
                        Audit log
                    </h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">
                        Registro de auditoría del sistema
                    </p>
                </div>

                <div className="flex items-center gap-3 h-10">
                    <div className="relative w-72 h-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-900">
                            <Search size={14} strokeWidth={2.5} />
                        </div>
                        <input
                            className="w-full h-full bg-white/60 backdrop-blur-card border border-white/90 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-sm"
                            placeholder="Buscar en el registro..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex flex-col overflow-hidden animate-fade-up px-2 pb-2 mb-4 lg:mb-6">
                {/* Table Header */}
                <div className="grid grid-cols-[160px_1fr_180px_140px] px-6 py-4 border-b border-white/40 bg-white/20 backdrop-blur-md sticky top-0 z-10 mx-2 mt-2 rounded-t-2xl">
                    <div className="text-[10px] font-bold text-navy-800 uppercase tracking-widest px-2">Fecha y Hora</div>
                    <div className="text-[10px] font-bold text-navy-800 uppercase tracking-widest px-2">Acción / Descripción</div>
                    <div className="text-[10px] font-bold text-navy-800 uppercase tracking-widest px-2">Paciente (Si aplica)</div>
                    <div className="text-[10px] font-bold text-navy-800 uppercase tracking-widest px-2 text-right">Usuario (Id)</div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-sm font-semibold text-navy-700/60">No se encontraron registros de auditoría.</p>
                        </div>
                    ) : (
                        <div className="space-y-[2px]">
                            {filteredLogs.map(log => {
                                const isSystem = !log.created_by || log.created_by.includes('system') || log.created_by === 'ai_agent';
                                
                                // Beautiful specific color per action type
                                const actionColors = {
                                    'CREATE': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                    'UPDATE': 'bg-blue-50 text-blue-700 border-blue-200',
                                    'DELETE': 'bg-rose-50 text-rose-700 border-rose-200',
                                    'MESSAGE_IN': 'bg-purple-50 text-purple-700 border-purple-200',
                                    'MESSAGE_OUT': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
                                };
                                const badgeClass = actionColors[log.action_type] || 'bg-gray-100 text-gray-700 border-gray-200';

                                return (
                                    <div key={log.id} className="grid grid-cols-[160px_1fr_180px_140px] px-4 py-3 bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-white/50 rounded-xl items-center transition-colors group">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-navy-900 border-r border-navy-900/5 pr-3">
                                            <Clock size={12} className="text-navy-900/40" />
                                            {new Date(log.created_at).toLocaleString('es-GT', { 
                                                day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'
                                            })}
                                        </div>
                                        
                                        <div className="px-4 border-r border-navy-900/5 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${badgeClass}`}>
                                                    {log.action_type}
                                                </span>
                                            </div>
                                            <div className="text-xs text-navy-700 truncate font-medium">
                                                {log.description}
                                            </div>
                                        </div>

                                        <div className="px-4 border-r border-navy-900/5 text-xs font-bold text-navy-900 truncate">
                                            {log.patients?.display_name || '-'}
                                        </div>

                                        <div className="px-3 pl-4 flex items-center justify-end gap-2 text-right">
                                            <div className="truncate text-xs font-bold text-navy-900 shadow-sm px-2.5 py-1 rounded border border-white/80 bg-white">
                                                {isSystem ? 'Sistema / IA' : log.created_by.slice(0, 8) + '...'}
                                            </div>
                                        </div>
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
