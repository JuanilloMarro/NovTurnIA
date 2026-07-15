import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, BotOff, Power, Search, MessageCircle, User } from 'lucide-react';
import { getPausedPatients, reactivateBot } from '../../services/supabaseService';
import { useAppStore } from '../../store/useAppStore';
import { useAuroraPulse } from '../../hooks/useAuroraPulse';
import { showBotReactivateToast, showErrorToast } from '../../store/useToastStore';
import { formatPhone } from '../../utils/format';

// Listado "IA pausada" (clientes en atención humana). Disponible en todos los
// planes — vive en la página "Configuración" (/business), junto a AIConfigPanel.

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PausedAIPanel({ canEdit = true }) {
    const [paused, setPaused] = useState([]);
    const [loading, setLoading] = useState(true);
    const [resumingId, setResumingId] = useState(null);
    const [search, setSearch] = useState('');
    const { className: auroraClass, pulse: pulseAurora } = useAuroraPulse();
    const navigate = useNavigate();

    // Redirige conservando el ?bid= actual (multi-tenancy en la URL).
    function goWithBid(path) {
        const bid = new URLSearchParams(window.location.search).get('bid');
        navigate(bid ? `${path}${path.includes('?') ? '&' : '?'}bid=${bid}` : path);
    }

    useEffect(() => {
        getPausedPatients()
            .then(setPaused)
            .catch(() => { /* silencioso: no bloquea el Centro IA */ })
            .finally(() => setLoading(false));
    }, []);

    // Saluda con el borde aurora al entrar al módulo (una vez, cuando termina de cargar).
    useEffect(() => { if (!loading) pulseAurora(4200); }, [loading, pulseAurora]);

    async function handleResume(patientId) {
        setResumingId(patientId);
        const target = paused.find(p => p.id === patientId);
        try {
            await reactivateBot(patientId);
            setPaused(prev => prev.filter(p => p.id !== patientId));
            // Sincroniza el estado global para que Turnos/Clientes/Conversaciones
            // reflejen de inmediato que la IA volvió a estar activa.
            useAppStore.getState().setPatientTakeover(patientId, false);
            useAppStore.getState().invalidateConversationsCache();
            useAppStore.getState().invalidatePatientsCache();
            pulseAurora();
            showBotReactivateToast(`La IA volvió a atender a ${target?.display_name || 'el cliente'}.`);
        } catch (err) {
            showErrorToast('Error', err.message || 'No se pudo reactivar la IA.');
        } finally {
            setResumingId(null);
        }
    }

    const filtered = search.trim()
        ? paused.filter(c =>
            (c.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.phone || '').includes(search.trim()))
        : paused;

    return (
        <div className={`ai-aurora rounded-[24px] h-full flex min-h-0 ${auroraClass}`}>
        <div className="relative flex-1 min-w-0 flex flex-col min-h-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

            {/* Header */}
            <div className="relative z-10 flex items-center gap-3 px-6 pt-6 pb-4 shrink-0">
                <div className="w-9 h-9 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                    <BotOff size={15} className="text-navy-900" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-[12.5px] font-bold text-navy-900 tracking-tight leading-none">IA pausada</h3>
                    <p className="text-[9.5px] font-bold text-navy-900/40 mt-1.5 leading-none">
                        {paused.length === 0
                            ? 'Sin clientes en atención humana'
                            : `${paused.length} ${paused.length === 1 ? 'cliente' : 'clientes'} en atención humana`}
                    </p>
                </div>
                {paused.length > 4 && (
                    <div className="relative w-24 shrink-0">
                        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-700/40 pointer-events-none" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar"
                            className="w-full bg-white/50 border border-white/60 rounded-full pl-7 pr-2 py-1 text-[10px] font-semibold text-navy-900 outline-none focus:bg-white/70 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                        />
                    </div>
                )}
            </div>

            {/* Lista */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-navy-900/20 border-t-navy-900/60 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
                            <Bot size={16} className="text-emerald-600" />
                        </div>
                        <p className="text-[10.5px] font-semibold text-navy-700/50 max-w-[200px]">
                            {paused.length === 0
                                ? 'La IA está atendiendo a todos los clientes automáticamente.'
                                : 'Sin coincidencias para tu búsqueda.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2 py-1">
                        {filtered.map((c, i) => (
                            <div
                                key={c.id}
                                className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border border-white/60 bg-white/40 hover:bg-white/60 shadow-sm transition-all duration-300 animate-fade-up"
                                style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 flex items-center justify-center text-[9.5px] font-bold shrink-0 border rounded-full leading-none bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900">
                                        {initials(c.display_name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11.5px] font-bold text-navy-900 truncate leading-tight">{c.display_name || 'Cliente'}</p>
                                        <p className="text-[9.5px] font-semibold text-navy-700/50 truncate leading-tight mt-0.5">
                                            {c.phone ? formatPhone(c.phone) : '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => goWithBid(`/conversations?patient=${c.id}`)}
                                        title="Abrir chat del cliente"
                                        className="w-8 h-8 flex items-center justify-center bg-white/40 border border-white/60 text-navy-900 rounded-full shadow-sm hover:bg-white transition-all duration-300 shrink-0"
                                    >
                                        <MessageCircle size={13} />
                                    </button>
                                    <button
                                        onClick={() => goWithBid(`/patients?id=${c.id}`)}
                                        title="Ver perfil del cliente"
                                        className="w-8 h-8 flex items-center justify-center bg-white/40 border border-white/60 text-navy-900 rounded-full shadow-sm hover:bg-white transition-all duration-300 shrink-0"
                                    >
                                        <User size={13} />
                                    </button>
                                    {canEdit && (
                                        <button
                                            onClick={() => handleResume(c.id)}
                                            disabled={resumingId === c.id}
                                            title="Reanudar IA para este cliente"
                                            className="w-8 h-8 flex items-center justify-center bg-white/40 border border-white/60 text-emerald-600 rounded-full shadow-sm hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all duration-300 disabled:opacity-50 shrink-0"
                                        >
                                            {resumingId === c.id
                                                ? <div className="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                                                : <Power size={13} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </div>
    );
}
