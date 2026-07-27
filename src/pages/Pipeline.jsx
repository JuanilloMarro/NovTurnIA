import { useState, useMemo } from 'react';
import { RefreshCw, SlidersHorizontal, Search, Lock, Bot, Repeat, Hand, Timer } from 'lucide-react';
import { usePipeline, PIPELINE_COLUMNS, HEALTH, dealHealth, columnOfStage } from '../hooks/usePipeline';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { setPipelineStepDone } from '../services/supabaseService';
import { showErrorToast } from '../store/useToastStore';
import PipelineBoard from '../components/Pipeline/PipelineBoard';
import NewAppointmentModal from '../components/Calendar/NewAppointmentModal';
import FeatureLock from '../components/FeatureLock';

const DAYS_OPTIONS = [
    { id: 15, label: '15 días' },
    { id: 30, label: '30 días' },
    { id: 90, label: '90 días' },
];

const HEALTH_OPTIONS = [
    { id: 'all', label: 'Todos' },
    { id: 'on_track', label: 'En curso' },
    { id: 'stalled', label: 'Detenidos' },
    { id: 'dropped', label: 'Se cayeron' },
    { id: 'won', label: 'Logrados' },
];

// Muestras para el preview bloqueado. Alimentan el MISMO PipelineBoard que ve
// el usuario desbloqueado, para que el candado nunca se desincronice del módulo
// real (problema que sí tiene el mock de Seguimiento).
const MOCK_DEALS = [
    { deal_id: 'm1', display_name: 'Cristian Sigüenza', phone: '50240319928', stage: 'discovery', temperature: 'hot', offered_services: true, last_activity_at: new Date().toISOString() },
    { deal_id: 'm2', display_name: 'Ana Morales', phone: '50255512340', stage: 'negotiation', temperature: 'warm', offered_services: true, offered_promo: true, queried_slots: true, last_activity_at: new Date(Date.now() - 36e5).toISOString() },
    { deal_id: 'm6', display_name: 'Rosa Castillo', phone: '50244440011', stage: 'negotiation', temperature: 'cold', offered_services: true, queried_slots: true, last_activity_at: new Date(Date.now() - 5 * 864e5).toISOString() },
    { deal_id: 'm3', display_name: 'Luis Pérez', phone: '50247781122', stage: 'scheduled', temperature: 'hot', appointment_id: 'a1', reminder_sent: true, confirmed_by_user: true, service_name: 'Consulta General', date_start: new Date(Date.now() + 864e5).toISOString(), last_activity_at: new Date().toISOString() },
    { deal_id: 'm7', display_name: 'Marta Díaz', phone: '50266778899', stage: 'scheduled', temperature: 'warm', appointment_id: 'a2', service_name: 'Limpieza Dental', date_start: new Date(Date.now() + 2 * 864e5).toISOString(), last_activity_at: new Date(Date.now() - 72e5).toISOString() },
    { deal_id: 'm4', display_name: 'María Gómez', phone: '50233336709', stage: 'recovery', temperature: 'cold', human_takeover: true, recovery_step: 2, appointment_id: 'a3', last_activity_at: new Date(Date.now() - 3 * 864e5).toISOString() },
    { deal_id: 'm5', display_name: 'Jorge Ramírez', phone: '50241110022', stage: 'loyalty', temperature: 'warm', survey_sent: true, appointment_id: 'a4', service_name: 'Extracción', date_start: new Date(Date.now() - 5 * 864e5).toISOString(), last_activity_at: new Date(Date.now() - 2 * 864e5).toISOString() },
];

// Todas las tarjetas del mismo ancho (flex-1) entre sí, para que como grupo
// ocupen el espacio disponible EN MEDIO del título y el buscador — antes
// quedaban pegadas al título y desperdiciaban el ancho hacia la derecha.
// Altura h-10 para calzar en la misma línea que el resto del header.
function Kpi({ icon: Icon, label, value, suffix }) {
    return (
        <div className="flex-1 min-w-[120px] h-10 flex items-center gap-2 px-3 rounded-2xl bg-white/40 backdrop-blur-2xl border border-white/60 shadow-md">
            <div className="w-7 h-7 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                <Icon size={13} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 leading-none">
                <span className="text-[13px] font-bold text-navy-900 tabular-nums">{value ?? '—'}</span>
                <span className="text-[9px] font-bold text-navy-700/50">{suffix}</span>
                <p className="text-[8.5px] font-bold text-navy-700/50 truncate mt-0.5">{label}</p>
            </div>
        </div>
    );
}

export default function Pipeline() {
    const { canViewPipeline, canCreateAppointments, canViewConversations, canViewPatients } = usePermissions();
    const { hasFeature } = usePlanLimits();
    const unlocked = hasFeature('pipeline');

    const [days, setDays] = useState(90);
    const [search, setSearch] = useState('');
    const [health, setHealth] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [scheduleTarget, setScheduleTarget] = useState(null);

    const { byColumn, metrics, loading, reload, setDeals } = usePipeline({ days });

    // Pasos HUMANOS (llamada de recuperación, recordatorio, encuesta, reseña):
    // optimista con snapshot + revert en catch — mismo patrón que el
    // drag&drop de KanbanBoard.jsx. Los pasos de IA no pasan por aquí, los
    // escribe pipeline_touch desde n8n.
    const handleToggleStep = async (dealId, stepId, done) => {
        let prevSnapshot;
        setDeals(current => {
            prevSnapshot = current;
            return current.map(d => {
                if (d.deal_id !== dealId) return d;
                if (stepId.startsWith('recovery_')) {
                    const n = Number(stepId.slice(-1));
                    const nextStep = done ? Math.max(d.recovery_step || 0, n) : Math.min(d.recovery_step || 0, n - 1);
                    return { ...d, recovery_step: nextStep, recovery_last_at: done ? new Date().toISOString() : d.recovery_last_at };
                }
                return { ...d, [stepId]: done, [`${stepId}_at`]: done ? new Date().toISOString() : null };
            });
        });
        try {
            await setPipelineStepDone(dealId, stepId, done);
        } catch (err) {
            showErrorToast('No se pudo actualizar el paso', err.message);
            if (prevSnapshot) setDeals(prevSnapshot);
        }
    };

    // Filtros client-side sobre lo cargado — mismo patrón que Seguimiento/Ofertas.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const out = {};
        for (const col of PIPELINE_COLUMNS) {
            out[col.id] = (byColumn[col.id] || []).filter(d => {
                if (health !== 'all' && dealHealth(d) !== health) return false;
                if (!q) return true;
                return (d.display_name || '').toLowerCase().includes(q) || (d.phone || '').includes(q);
            });
        }
        return out;
    }, [byColumn, search, health]);

    const mockByColumn = useMemo(() => {
        const out = Object.fromEntries(PIPELINE_COLUMNS.map(c => [c.id, []]));
        for (const d of MOCK_DEALS) {
            const col = columnOfStage(d.stage);
            if (col) out[col.id].push(d);
        }
        return out;
    }, []);

    if (!canViewPipeline) {
        return (
            <div className="h-full flex items-center justify-center px-4">
                <div className="relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md p-8 max-w-sm text-center">
                    <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.06)' }} />
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-full bg-white/60 border border-white/70 flex items-center justify-center text-navy-700 mx-auto mb-4">
                            <Lock size={18} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-base font-bold text-navy-900 mb-1">Acceso restringido</h2>
                        <p className="text-xs text-navy-700/60 font-semibold">
                            No tienes permiso para ver el Pipeline. Pídele a un administrador que te habilite el módulo.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const activeFilters = health !== 'all' || days !== 90;

    // Fila de KPIs + buscador/filtros — vive DENTRO del candado cuando el plan
    // no incluye Pipeline (antes solo la tabla quedaba bloqueada y el resto del
    // módulo —KPIs reales, buscador, filtros— quedaba libre y funcional).
    const controlsRow = (
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 mb-3">
            <div className="flex items-stretch gap-2 flex-1 w-full lg:w-auto min-w-0 flex-wrap">
                <Kpi icon={Bot} label="Agendadas por IA" value={metrics.ai_booked} />
                <Kpi icon={Repeat} label="Recuperados" value={metrics.recovered} />
                <Kpi icon={Hand} label="Requieren humano" value={metrics.needs_human} />
                <Kpi icon={Timer} label="Respuesta prom." value={metrics.avg_response_seconds} suffix="s" />
            </div>

            <div className="flex items-center gap-2 sm:gap-3 h-10 flex-wrap shrink-0">
                <div className="relative w-full sm:w-56 h-10">
                    <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-700 z-10">
                        <Search size={14} strokeWidth={2.5} />
                    </div>
                    <input
                        className="relative w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-md"
                        placeholder="Buscar cliente…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <button
                    onClick={reload}
                    className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none"
                >
                    <RefreshCw size={14} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap">Actualizar</span>
                </button>

                <div className="relative">
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 backdrop-blur-2xl border text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none ${activeFilters ? 'bg-white/70 border-white' : 'bg-white/40 border-white/60'}`}
                    >
                        <SlidersHorizontal size={14} strokeWidth={2.5} />
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[70px] transition-all duration-300 whitespace-nowrap">Filtros</span>
                    </button>

                    {showFilters && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md z-50 p-2 animate-fade-up">
                            <p className="text-[10px] font-bold text-navy-700/50 px-3 pt-1 pb-1.5">Estado de la IA</p>
                            {HEALTH_OPTIONS.map(o => (
                                <button
                                    key={o.id}
                                    onClick={() => setHealth(o.id)}
                                    className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-2xl text-[11px] font-bold border transition-all ${health === o.id ? 'bg-white/60 backdrop-blur-sm border-white/80 shadow-md text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-white/20'}`}
                                >
                                    {o.id !== 'all' && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${HEALTH[o.id].dot}`} style={{ boxShadow: `0 0 6px ${HEALTH[o.id].glow}` }} />
                                    )}
                                    {o.label}
                                </button>
                            ))}
                            <p className="text-[10px] font-bold text-navy-700/50 px-3 pt-2 pb-1.5">Período</p>
                            {DAYS_OPTIONS.map(o => (
                                <button
                                    key={o.id}
                                    onClick={() => setDays(o.id)}
                                    className={`w-full text-left px-3 py-2 rounded-2xl text-[11px] font-bold border transition-all ${days === o.id ? 'bg-white/60 backdrop-blur-sm border-white/80 shadow-md text-navy-900' : 'border-transparent text-navy-700/60 hover:bg-white/20'}`}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col w-full pt-2 px-4 relative">
            <div className="shrink-0 mb-1">
                <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Pipeline</h1>
                <p className="text-xs text-navy-700/60 font-semibold tracking-wide whitespace-nowrap">
                    Cómo la IA mueve a tus clientes, en vivo
                </p>
            </div>

            {unlocked ? (
                <>
                    {controlsRow}
                    <PipelineBoard
                        byColumn={filtered}
                        loading={loading}
                        canMove={canCreateAppointments}
                        canEditSteps={canCreateAppointments}
                        onToggleStep={handleToggleStep}
                        canViewConversations={canViewConversations}
                        canViewPatients={canViewPatients}
                        onSchedule={canCreateAppointments ? (deal) => setScheduleTarget(deal) : undefined}
                    />
                </>
            ) : (
                <FeatureLock
                    feature="pipeline"
                    variant="blurred"
                    requiredPlan="Pro"
                    title="Pipeline de clientes"
                    description="Mira en tiempo real cómo el agente de IA mueve a cada cliente: qué le ofreció, en qué paso se quedó y quién necesita que intervengas."
                >
                    <div className="h-full flex flex-col mt-2">
                        {controlsRow}
                        <PipelineBoard byColumn={mockByColumn} loading={false} canMove={false} />
                    </div>
                </FeatureLock>
            )}

            {scheduleTarget && (
                <NewAppointmentModal
                    isOpen={true}
                    initialPatient={{
                        id: scheduleTarget.patient_id,
                        display_name: scheduleTarget.display_name,
                        patient_phones: scheduleTarget.phone ? [{ phone: scheduleTarget.phone, is_primary: true }] : [],
                    }}
                    onClose={() => setScheduleTarget(null)}
                    onCreated={() => { setScheduleTarget(null); reload(); }}
                />
            )}
        </div>
    );
}
