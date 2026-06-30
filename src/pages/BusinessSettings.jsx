import { useState, useEffect, useRef } from 'react';
import WheelColumn from '../components/ui/WheelColumn';
import {
    getBusinessInfo,
    updateBusinessInfo,
    parseCustomPrompt,
    buildCustomPrompt,
    getPausedPatients,
    reactivateBot,
} from '../services/supabaseService';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useAppStore } from '../store/useAppStore';
import FeatureLock from '../components/FeatureLock';
import AIOrb from '../components/ui/AIOrb';
import { formatPhone } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import { Save, Building2, Clock, Lock, Bot, BotOff, Check, Power, Search, Pencil, MessageCircle, User } from 'lucide-react';
import { showSettingsSavedToast, showValidationToast, showErrorToast, showBotReactivateToast } from '../store/useToastStore';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, '0')}:00`,
}));

const DAYS = [
    { key: 'Lun', label: 'Lunes' },
    { key: 'Mar', label: 'Martes' },
    { key: 'Mié', label: 'Miércoles' },
    { key: 'Jue', label: 'Jueves' },
    { key: 'Vie', label: 'Viernes' },
    { key: 'Sáb', label: 'Sábado' },
    { key: 'Dom', label: 'Domingo' },
];

const PLAN_LABELS = {
    basic: { label: 'Básico', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    pro: { label: 'Pro', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    enterprise: { label: 'Enterprise', color: 'bg-violet-50 text-violet-700 border-violet-200' },
};

function parseDays(str) {
    if (!str) return new Set(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']);
    if (str.includes(',')) return new Set(str.split(',').map(s => s.trim()).filter(Boolean));
    if (str.includes('-')) {
        const [from, to] = str.split('-').map(s => s.trim());
        const fromIdx = DAYS.findIndex(d => d.key === from);
        const toIdx = DAYS.findIndex(d => d.key === to);
        if (fromIdx !== -1 && toIdx !== -1 && toIdx >= fromIdx)
            return new Set(DAYS.slice(fromIdx, toIdx + 1).map(d => d.key));
    }
    return new Set([str.trim()]);
}

function serializeDays(set) {
    return DAYS.filter(d => set.has(d.key)).map(d => d.key).join(',');
}

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function Section({ icon: Icon, title, children }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-navy-900/5 flex items-center justify-center text-navy-700">
                    <Icon size={14} />
                </div>
                <h3 className="text-[12px] font-bold text-navy-800 tracking-wide">{title}</h3>
                <div className="flex-1 h-px bg-navy-900/8" />
            </div>
            <div className="space-y-5">{children}</div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none mb-2.5">
                {label}
            </label>
            {children}
        </div>
    );
}

function HourSelect({ value, onChange, options }) {
    const items = options.map(o => o.label);
    const selected = HOUR_OPTIONS.find(o => o.value === value)?.label || '00:00';
    return (
        <div className="bg-white/30 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
            <WheelColumn
                items={items}
                selected={selected}
                onSelect={label => onChange(parseInt(label.split(':')[0]))}
            />
        </div>
    );
}

export default function BusinessSettings() {
    const { canManageRoles } = usePermissions();
    const { hasFeature } = usePlanLimits();
    const navigate = useNavigate();

    // Redirige conservando el ?bid= actual (multi-tenancy en la URL).
    function goWithBid(path) {
        const bid = new URLSearchParams(window.location.search).get('bid');
        navigate(bid ? `${path}${path.includes('?') ? '&' : '?'}bid=${bid}` : path);
    }

    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [form, setForm] = useState(null);
    const [selectedDays, setSelectedDays] = useState(new Set());
    const [agentName, setAgentName] = useState('');
    const [instructions, setInstructions] = useState('');

    // Clientes con la IA pausada (handoff humano)
    const [pausedClients, setPausedClients] = useState([]);
    const [loadingPaused, setLoadingPaused] = useState(true);
    const [resumingId, setResumingId] = useState(null);
    const [pausedSearch, setPausedSearch] = useState('');

    // Efecto "serpiente" del borde de la IA: finito, se dispara al entrar al
    // módulo o al reactivar una IA, luego se apaga.
    const [aiEffect, setAiEffect] = useState(false);
    const aiEffectTimer = useRef(null);
    function triggerAiEffect(duration = 3200) {
        setAiEffect(true);
        clearTimeout(aiEffectTimer.current);
        aiEffectTimer.current = setTimeout(() => setAiEffect(false), duration);
    }
    useEffect(() => () => clearTimeout(aiEffectTimer.current), []);
    // Al entrar al módulo (cuando termina de cargar), recorre el borde una vez.
    useEffect(() => { if (!loading) triggerAiEffect(); }, [loading]);

    function loadPaused() {
        setLoadingPaused(true);
        getPausedPatients()
            .then(setPausedClients)
            .catch(() => { /* silencioso: no bloquea la configuración */ })
            .finally(() => setLoadingPaused(false));
    }

    useEffect(() => { loadPaused(); }, []);

    async function handleResume(patientId) {
        setResumingId(patientId);
        const target = pausedClients.find(p => p.id === patientId);
        try {
            await reactivateBot(patientId);
            setPausedClients(prev => prev.filter(p => p.id !== patientId));
            // Sincroniza el estado global para que Turnos/Clientes/Conversaciones
            // reflejen de inmediato que la IA volvió a estar activa (el mapa del
            // store sobrescribe el human_takeover cacheado en cada módulo).
            useAppStore.getState().setPatientTakeover(patientId, false);
            useAppStore.getState().invalidateConversationsCache();
            useAppStore.getState().invalidatePatientsCache();
            triggerAiEffect();
            showBotReactivateToast(`La IA volvió a atender a ${target?.display_name || 'el cliente'}.`);
        } catch (err) {
            showErrorToast('Error', err.message || 'No se pudo reactivar la IA.');
        } finally {
            setResumingId(null);
        }
    }

    useEffect(() => {
        getBusinessInfo()
            .then(data => {
                setInfo(data);
                const parsed = parseCustomPrompt(data.custom_prompt);
                setAgentName(parsed.agentName);
                setInstructions(parsed.instructions);
                setForm({
                    name: data.name || '',
                    schedule_start: data.schedule_start ?? 9,
                    schedule_end: data.schedule_end ?? 18,
                    notification_email: data.notification_email || '',
                });
                setSelectedDays(parseDays(data.schedule_days));
            })
            .catch(() => showErrorToast('Error', 'No se pudo cargar la configuración'))
            .finally(() => setLoading(false));
    }, []);

    function setField(key, val) {
        setForm(f => ({ ...f, [key]: val }));
        setDirty(true);
    }

    function handleAgentNameChange(val) {
        setAgentName(val);
        setDirty(true);
    }

    function handleInstructionsChange(val) {
        setInstructions(val);
        setDirty(true);
    }

    function toggleDay(key) {
        setSelectedDays(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
        setDirty(true);
    }

    async function handleSave() {
        const nameInput = form.name.trim();
        if (!nameInput) {
            showValidationToast('Atención', 'El nombre del negocio no puede estar vacío.');
            return;
        }
        if (nameInput.length > 100) {
            showValidationToast('Nombre muy largo', 'El nombre no debe exceder los 100 caracteres.');
            return;
        }
        if (agentName.trim().length > 25) {
            showValidationToast('Nombre de asistente largo', 'El nombre del asistente no debe exceder los 25 caracteres.');
            return;
        }
        if (instructions.trim().length > 250) {
            showValidationToast('Instrucciones muy largas', 'Las instrucciones no deben exceder los 250 caracteres.');
            return;
        }
        if (selectedDays.size === 0) {
            showValidationToast('Días inválidos', 'Debes seleccionar al menos un día de atención.');
            return;
        }
        if (Number(form.schedule_end) <= Number(form.schedule_start)) {
            showValidationToast('Horario inválido', 'La hora de cierre debe ser posterior a la de apertura.');
            return;
        }
        // Correo opcional: cada cambio es independiente. Solo se valida el formato
        // cuando hay un correo escrito; estar vacío no bloquea guardar (p. ej. horarios).
        const emailInput = form.notification_email.trim();
        if (emailInput && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(emailInput)) {
            showValidationToast('Email inválido', 'Revisa el formato del correo de notificaciones.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: nameInput,
                schedule_start: Number(form.schedule_start),
                schedule_end: Number(form.schedule_end),
                schedule_days: serializeDays(selectedDays),
                notification_email: emailInput || '',
            };

            if (hasFeature('custom_prompt')) {
                const finalAgentName = hasFeature('ai_agent_name') ? agentName.trim() : '';
                payload.custom_prompt = buildCustomPrompt(finalAgentName, instructions.trim()) || null;
            }

            await updateBusinessInfo(payload);
            // Refresca el store para que el calendario (Turnos) y los modales de turno
            // re-generen tamaño y slots al instante con el nuevo horario, sin esperar a
            // un nuevo inicio de sesión. El calendario lee schedule_start/end como "HH:MM".
            const toHHMM = (h) => `${String(Number(h)).padStart(2, '0')}:00`;
            useAppStore.getState().setBusinessHours({
                schedule_start: toHHMM(form.schedule_start),
                schedule_end:   toHHMM(form.schedule_end),
                schedule_days:  useAppStore.getState().businessHours?.schedule_days ?? [1, 2, 3, 4, 5],
            });
            showSettingsSavedToast(nameInput);
            setDirty(false);
        } catch (err) {
            console.error('SERVER ERROR:', err);
            showErrorToast('Error de Base de Datos', err.message || 'No se pudo guardar la configuración.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
        </div>
    );

    const planMeta = PLAN_LABELS[info?.plan] ?? { label: info?.plan ?? '—', color: 'bg-gray-100 text-gray-500 border-gray-200' };

    const filteredPaused = pausedSearch.trim()
        ? pausedClients.filter(c =>
            (c.display_name || '').toLowerCase().includes(pausedSearch.toLowerCase()) ||
            (c.phone || '').includes(pausedSearch.trim()))
        : pausedClients;

    return (
        <div className="h-full flex flex-col mx-auto w-full max-w-[1080px] pt-2 px-2">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Configuración IA</h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Personalidad, horario y preferencias del asistente</p>
                </div>
                {info && (
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full border shrink-0 ${planMeta.color}`}>
                        Plan {planMeta.label}
                    </span>
                )}
            </div>

            <div className="flex-1 flex flex-col min-h-0 mb-4 lg:mb-6">
                <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar p-4 animate-fade-up">
                    <div className="flex flex-col lg:flex-row gap-5 items-stretch lg:h-full">

                        {/* ── Columna Izquierda: Asistente IA + Guardar ── */}
                        <div className="w-full lg:w-[44%] shrink-0 flex flex-col gap-4">
                            <div className={`ai-rainbow rounded-[24px] w-full flex flex-1 min-h-0 ${aiEffect ? 'is-active' : ''}`}>
                                <div className="relative flex-1 rounded-[24px] overflow-hidden border border-white/60 bg-white/40 backdrop-blur-2xl shadow-md p-6 flex flex-col justify-between gap-6 min-h-[380px]">
                                    {/* glows ambiente — patrón de Ofertas (4 esquinas, 0.05) */}
                                    <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                                    <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                                    <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                                    <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

                                    {/* Malla + bola de partículas — centrada entre el label y el nombre.
                                        Se difumina con una máscara (no con una banda de color) para que el
                                        fondo del panel sea un degradado continuo, sin cortes. */}
                                    <AIOrb className="absolute inset-x-0 top-[8%] w-full h-[58%] z-0 pointer-events-none [mask-image:linear-gradient(to_bottom,transparent_0%,#000_18%,#000_60%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_18%,#000_60%,transparent_100%)]" />

                                    {/* etiqueta */}
                                    <div className="relative z-10 flex items-center gap-2 text-navy-700/80">
                                        <div className="w-6 h-6 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center">
                                            <Bot size={13} className="text-navy-700/80" />
                                        </div>
                                        <span className="text-[11px] font-bold tracking-wide">Asistente IA · Personalidad</span>
                                    </div>

                                    {/* espaciador central — deja respirar la malla detrás */}
                                    <div className="relative z-10 flex-1 min-h-[150px]" />

                                    {/* nombre: label estático "Tu nombre es" + nombre dinámico editable, en una sola línea */}
                                    <div className="relative z-10 flex flex-col items-center mb-1">
                                        {/* Una sola frase continua: "Tu nombre es" es fijo (label) y solo el
                                            nombre es editable; misma tipografía y sin separación para que se
                                            lea como un único texto. El input se autoajusta exactamente al
                                            ancho del texto (sizer oculto en grid) para que la frase quede
                                            siempre centrada en el panel. */}
                                        <div className="flex items-baseline justify-center max-w-full">
                                            <span className="text-lg font-bold text-navy-900 select-none whitespace-nowrap">Tu nombre es&nbsp;</span>
                                            <span className="inline-grid">
                                                <span aria-hidden className="invisible col-start-1 row-start-1 text-lg font-bold whitespace-pre">{agentName || 'tu asistente'}</span>
                                                <input
                                                    type="text"
                                                    size={1}
                                                    maxLength={25}
                                                    value={agentName}
                                                    onChange={e => handleAgentNameChange(e.target.value)}
                                                    disabled={!hasFeature('ai_agent_name')}
                                                    placeholder="tu asistente"
                                                    className="col-start-1 row-start-1 w-full min-w-0 text-left bg-transparent text-lg font-bold text-navy-900 outline-none placeholder-navy-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                                />
                                            </span>
                                        </div>
                                        <p className="flex items-center justify-center gap-1 mt-1.5 text-[9px] font-bold tracking-wider text-navy-900/40">
                                            {hasFeature('ai_agent_name')
                                                ? <><Pencil size={9} /> Toca para renombrar</>
                                                : <><Lock size={9} /> Enterprise</>}
                                        </p>
                                    </div>

                                    {/* contexto / descripción */}
                                    <div className="relative z-10 rounded-2xl bg-white/30 border border-white/60 p-3 shadow-sm">
                                        <textarea
                                            maxLength={250}
                                            value={instructions}
                                            onChange={e => handleInstructionsChange(e.target.value)}
                                            disabled={!hasFeature('custom_prompt')}
                                            placeholder="Describe la personalidad y el contexto de tu IA..."
                                            className="w-full h-20 bg-transparent text-[11px] font-medium leading-relaxed text-navy-900 outline-none placeholder-navy-700/40 resize-none custom-scrollbar disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                        <div className="flex items-center justify-between pt-1 border-t border-navy-900/5">
                                            <span className="flex items-center gap-1 text-[9px] font-bold tracking-wider text-navy-900/40">
                                                {hasFeature('custom_prompt') ? 'Contexto' : <><Lock size={9} /> Pro</>}
                                            </span>
                                            <span className="text-[9px] font-bold text-navy-900/30">{instructions.length}/250</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Guardar — debajo del panel de IA */}
                            {canManageRoles && (
                                <div className="flex justify-end shrink-0">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !form.name.trim() || !dirty}
                                        className="relative overflow-hidden group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md hover:bg-white/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                        <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                        <Save size={14} className="shrink-0 relative z-10" />
                                        <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap relative z-10">
                                            {saving ? 'Guardando...' : 'Guardar cambios'}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Columna Derecha: 3 paneles ── */}
                        <div className="flex-1 min-w-0 flex flex-col gap-5 min-h-0">

                            {/* Identidad */}
                            <div className="relative shrink-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md p-6 overflow-hidden">
                                <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                                <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                                <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                                <div className="relative flex flex-col md:flex-row gap-6 items-center">
                                    {/* Lado izquierdo: Icono grande y Título */}
                                    <div className="flex flex-col items-center justify-center bg-navy-900/5 rounded-2xl border border-navy-900/10 w-20 h-20 shrink-0 shadow-inner">
                                        <Building2 size={28} className="text-navy-800" />
                                        <h3 className="text-[9px] font-bold text-navy-800 tracking-wider text-center leading-none mt-1.5">Identidad</h3>
                                    </div>

                                    {/* Lado derecho: Parámetros */}
                                    <div className="flex-1 w-full">
                                        <Field label="Nombre del negocio">
                                            <input
                                                type="text"
                                                maxLength={100}
                                                value={form.name}
                                                onChange={e => setField('name', e.target.value)}
                                                placeholder="Ej: Clínica San Rafael"
                                                className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                                            />
                                        </Field>
                                    </div>
                                </div>
                            </div>

                            {/* Horario de atención */}
                            <div className="relative shrink-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md p-6 overflow-hidden">
                                <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                                <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                                <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
                                    {/* Lado izquierdo: Icono grande y Título */}
                                    <div className="flex flex-col items-center justify-center bg-navy-900/5 rounded-2xl border border-navy-900/10 w-20 h-20 shrink-0 shadow-inner">
                                        <Clock size={28} className="text-navy-800" />
                                        <h3 className="text-[9px] font-bold text-navy-800 tracking-wider text-center leading-none mt-1.5">Horario</h3>
                                    </div>

                                    {/* Lado derecho: Parámetros */}
                                    <div className="flex-1 w-full space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Hora de apertura">
                                                <HourSelect
                                                    value={form.schedule_start}
                                                    onChange={val => setField('schedule_start', val)}
                                                    options={HOUR_OPTIONS}
                                                />
                                            </Field>
                                            <Field label="Hora de cierre">
                                                <HourSelect
                                                    value={form.schedule_end}
                                                    onChange={val => setField('schedule_end', val)}
                                                    options={HOUR_OPTIONS.filter(o => o.value > form.schedule_start)}
                                                />
                                            </Field>
                                        </div>

                                        <Field label="Días de atención">
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {DAYS.map(day => {
                                                    const active = selectedDays.has(day.key);
                                                    return (
                                                        <button
                                                            key={day.key}
                                                            type="button"
                                                            onClick={() => toggleDay(day.key)}
                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all duration-300 select-none border ${active
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-[0_2px_8px_rgba(59,130,246,0.18)]'
                                                                : 'bg-white/50 text-navy-700/60 border-white/60 hover:bg-white/70 hover:text-navy-800'
                                                                }`}
                                                        >
                                                            {day.key}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </Field>
                                    </div>
                                </div>
                            </div>

                            {/* IA pausada — clientes en atención humana (handoff) */}
                            <div className="relative flex-1 min-h-[200px] bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md p-6 overflow-hidden flex flex-col">
                                <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                                <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                                <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                                <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

                                {/* header */}
                                <div className="relative flex items-center gap-3 mb-4">
                                    <div className="w-11 h-11 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0 shadow-inner">
                                        <BotOff size={20} className="text-navy-800" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-[12px] font-bold text-navy-800 tracking-wide leading-none">IA pausada</h3>
                                        <p className="text-[10px] font-semibold text-navy-700/50 mt-1 leading-none">
                                            {pausedClients.length === 0
                                                ? 'Ningún cliente con la IA pausada'
                                                : `${pausedClients.length} ${pausedClients.length === 1 ? 'cliente' : 'clientes'} en atención humana`}
                                        </p>
                                    </div>
                                    {pausedClients.length > 6 && (
                                        <div className="relative w-32 sm:w-40 shrink-0">
                                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700/40 pointer-events-none" />
                                            <input
                                                value={pausedSearch}
                                                onChange={e => setPausedSearch(e.target.value)}
                                                placeholder="Buscar..."
                                                className="w-full bg-white/50 border border-white/60 rounded-full pl-8 pr-3 py-1.5 text-[11px] font-semibold text-navy-900 outline-none focus:bg-white/70 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* lista scrollable (soporta 100+ clientes) — con padding para que el
                                    sombreado de las fichas no se corte en los lados, arriba ni abajo */}
                                <div className="relative flex-1 min-h-0 overflow-y-auto custom-scrollbar -mx-2 px-2 py-2">
                                    {loadingPaused ? (
                                        <div className="flex items-center justify-center py-10">
                                            <div className="w-6 h-6 border-[3px] border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                                        </div>
                                    ) : filteredPaused.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-center">
                                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
                                                <Bot size={20} className="text-emerald-600" />
                                            </div>
                                            <p className="text-[11px] font-semibold text-navy-700/50 max-w-[220px]">
                                                {pausedClients.length === 0
                                                    ? 'La IA está atendiendo a todos los clientes automáticamente.'
                                                    : 'Sin coincidencias para tu búsqueda.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredPaused.map((c, i) => (
                                                <div
                                                    key={c.id}
                                                    className="group relative overflow-hidden backdrop-blur-2xl rounded-2xl p-3 transition-all duration-300 animate-fade-up flex items-center justify-between gap-3 border shadow-md bg-white/40 border-white/60 hover:bg-white/60"
                                                    style={{ animationDelay: `${i * 0.04}s` }}
                                                >
                                                    <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                    <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />

                                                    <div className="flex items-center gap-3 relative z-10 min-w-0">
                                                        <div className="w-9 h-9 flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all duration-300 border rounded-full leading-none bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900 group-hover:to-gray-200 group-hover:border-gray-200">
                                                            <span className="block">{initials(c.display_name)}</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-navy-900 text-[12px] truncate leading-tight">{c.display_name || 'Cliente'}</div>
                                                            <div className="text-[11px] font-semibold text-navy-700/60 tracking-wide leading-tight mt-0.5 truncate">
                                                                {c.phone ? formatPhone(c.phone) : '—'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 relative z-10 shrink-0">
                                                        {/* Abrir chat del cliente (directo a su conversación) */}
                                                        <button
                                                            onClick={() => goWithBid(`/conversations?patient=${c.id}`)}
                                                            title="Abrir chat del cliente"
                                                            className="relative overflow-hidden group/chat h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-3 rounded-full border border-white/60 bg-white/40 backdrop-blur-2xl text-navy-700 text-[10px] font-bold shadow-md hover:bg-white transition-all duration-300 shrink-0"
                                                        >
                                                            <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                            <div className="absolute -bottom-3 -left-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                                            <MessageCircle size={14} className="shrink-0 relative z-10" />
                                                            <span className="max-w-0 overflow-hidden group-hover/chat:max-w-[60px] transition-all duration-300 whitespace-nowrap relative z-10">Chat</span>
                                                        </button>
                                                        {/* Ver perfil del cliente (directo a su ficha) */}
                                                        <button
                                                            onClick={() => goWithBid(`/patients?id=${c.id}`)}
                                                            title="Ver perfil del cliente"
                                                            className="relative overflow-hidden group/perfil h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-3 rounded-full border border-white/60 bg-white/40 backdrop-blur-2xl text-navy-700 text-[10px] font-bold shadow-md hover:bg-white transition-all duration-300 shrink-0"
                                                        >
                                                            <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                                                            <div className="absolute -bottom-3 -left-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                                                            <User size={14} className="shrink-0 relative z-10" />
                                                            <span className="max-w-0 overflow-hidden group-hover/perfil:max-w-[60px] transition-all duration-300 whitespace-nowrap relative z-10">Perfil</span>
                                                        </button>
                                                        {/* Reanudar IA */}
                                                        <button
                                                            onClick={() => handleResume(c.id)}
                                                            disabled={resumingId === c.id}
                                                            className="relative overflow-hidden group/btn h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-3 bg-white/40 backdrop-blur-2xl border border-white/60 text-emerald-600 text-[10px] font-bold rounded-full shadow-md hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all duration-300 disabled:opacity-50 shrink-0"
                                                            title="Reanudar IA para este cliente"
                                                        >
                                                            <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(16,185,129,0.08)' }} />
                                                            <div className="absolute -bottom-3 -left-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(52,211,153,0.08)' }} />
                                                            <Power size={13} className="shrink-0 relative z-10" />
                                                            <span className="max-w-0 overflow-hidden group-hover/btn:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">
                                                                {resumingId === c.id ? '...' : 'Reanudar'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
