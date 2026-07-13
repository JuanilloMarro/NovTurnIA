import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, User, Calendar as CalendarIcon, Tag, CornerDownLeft } from 'lucide-react';
import { searchGlobal } from '../services/supabaseService';
import { usePermissions } from '../hooks/usePermissions';

// Búsqueda global (Ctrl+K / Cmd+K) — command palette glass sobre search_global:
// pacientes (→ historial), turnos próximos (→ calendario) y servicios (→ ajustes).
const KIND_META = {
    patient:     { icon: User,         label: 'Clientes' },
    appointment: { icon: CalendarIcon, label: 'Turnos próximos' },
    service:     { icon: Tag,          label: 'Servicios' },
};
const KIND_ORDER = ['patient', 'appointment', 'service'];

export default function CommandPalette() {
    const navigate = useNavigate();
    const { canViewPatients } = usePermissions();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hi, setHi] = useState(0);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    // Atajo global Ctrl+K / Cmd+K
    useEffect(() => {
        function onKey(e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            }
            if (e.key === 'Escape') setOpen(false);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (open) {
            setQuery(''); setResults([]); setHi(0);
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open]);

    // Búsqueda con debounce (250ms)
    useEffect(() => {
        if (!open) return;
        clearTimeout(debounceRef.current);
        if (query.trim().length < 2) { setResults([]); setLoading(false); return; }
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const rows = await searchGlobal(query, 6);
                // Sin permiso de clientes no se muestran pacientes (el RPC ya scopea por negocio)
                setResults(canViewPatients ? rows : rows.filter(r => r.kind !== 'patient'));
                setHi(0);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 250);
        return () => clearTimeout(debounceRef.current);
    }, [query, open, canViewPatients]);

    const flat = KIND_ORDER.flatMap(k => results.filter(r => r.kind === k));

    const go = useCallback((item) => {
        if (!item) return;
        setOpen(false);
        navigate(item.route);
    }, [navigate]);

    function onInputKey(e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, flat.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); go(flat[hi]); }
    }

    if (!open) return null;

    let idx = -1; // índice corrido para el resaltado entre grupos
    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[300] flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)}>
            <div onClick={e => e.stopPropagation()}
                className="w-full max-w-lg bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[28px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] overflow-hidden animate-fade-up">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/50">
                    <Search size={16} className="text-navy-700/50 shrink-0" />
                    <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onInputKey}
                        placeholder="Buscar clientes, turnos o servicios..."
                        className="flex-1 bg-transparent outline-none text-sm font-semibold text-navy-900 placeholder-navy-700/40" />
                    <kbd className="text-[9px] font-bold text-navy-700/40 bg-white/50 border border-white/60 rounded-md px-1.5 py-0.5 shrink-0">ESC</kbd>
                </div>

                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2">
                    {loading && <p className="text-[11px] font-semibold text-navy-700/40 text-center py-4">Buscando…</p>}
                    {!loading && query.trim().length >= 2 && flat.length === 0 && (
                        <p className="text-[11px] font-semibold text-navy-700/40 text-center py-4">Sin resultados para "{query}"</p>
                    )}
                    {!loading && query.trim().length < 2 && (
                        <p className="text-[11px] font-semibold text-navy-700/40 text-center py-4">Escribe al menos 2 letras…</p>
                    )}
                    {!loading && KIND_ORDER.map(kind => {
                        const group = results.filter(r => r.kind === kind);
                        if (!group.length) return null;
                        const Meta = KIND_META[kind];
                        return (
                            <div key={kind} className="px-2 pb-1">
                                <p className="text-[9px] font-bold text-navy-700/40 uppercase tracking-widest px-3 pt-2 pb-1">{Meta.label}</p>
                                {group.map(item => {
                                    idx += 1;
                                    const active = idx === hi;
                                    const myIdx = idx;
                                    return (
                                        <button key={`${item.kind}-${item.id}`} onClick={() => go(item)} onMouseEnter={() => setHi(myIdx)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${active ? 'bg-white/60 shadow-sm' : 'hover:bg-white/40'}`}>
                                            <span className="w-7 h-7 rounded-full bg-white/50 border border-white/60 flex items-center justify-center shrink-0">
                                                <Meta.icon size={13} className="text-navy-700/60" />
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-[13px] font-bold text-navy-900 truncate">{item.title}</span>
                                                {item.subtitle && <span className="block text-[10px] font-semibold text-navy-700/50 truncate">{item.subtitle}</span>}
                                            </span>
                                            {active && <CornerDownLeft size={12} className="text-navy-700/40 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body
    );
}
