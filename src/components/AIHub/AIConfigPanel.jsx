import { useState, useEffect } from 'react';
import { Save, Building2, Clock, Bot, Lock, Mail, Pencil } from 'lucide-react';
import WheelColumn from '../ui/WheelColumn';
import AIOrb from '../ui/AIOrb';
import PausedAIPanel from './PausedAIPanel';
import { useAuroraPulse } from '../../hooks/useAuroraPulse';
import { usePlanLimits } from '../../hooks/usePlanLimits';
import { useAppStore } from '../../store/useAppStore';
import {
    getBusinessInfo,
    updateBusinessInfo,
    parseCustomPrompt,
    buildCustomPrompt,
} from '../../services/supabaseService';
import { showSettingsSavedToast, showValidationToast, showErrorToast } from '../../store/useToastStore';

// Configuración del asistente IA + identidad y horario del negocio. Disponible
// en todos los planes (no es una feature Enterprise). Vive en su propia página
// (/business, "Configuración"), separada de Centro IA (análisis + chat).

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

const EMAIL_RE = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;

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

function CornerGlows() {
    return (
        <>
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
        </>
    );
}

function Section({ icon: Icon, title, children }) {
    return (
        <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                    <Icon size={18} />
                </div>
                <h3 className="text-[12.5px] font-bold text-navy-800 tracking-wide">{title}</h3>
                <div className="flex-1 h-px bg-navy-900/8" />
            </div>
            {children && <div className="space-y-5">{children}</div>}
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

function HourSelect({ value, onChange, options, disabled }) {
    const items = options.map(o => o.label);
    const selected = HOUR_OPTIONS.find(o => o.value === value)?.label || '00:00';
    return (
        <div className={`bg-white/30 border border-white/60 rounded-xl overflow-hidden shadow-sm transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <WheelColumn
                items={items}
                selected={selected}
                onSelect={label => onChange(parseInt(label.split(':')[0]))}
                itemHeight={21}
                selectedFontSize={12.5}
                unselectedFontSize={11}
            />
        </div>
    );
}

export default function AIConfigPanel({ canEdit = true }) {
    const { hasFeature } = usePlanLimits();
    const { className: auroraClass, pulse: pulseAurora } = useAuroraPulse();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [form, setForm] = useState(null);
    const [selectedDays, setSelectedDays] = useState(new Set());
    const [agentName, setAgentName] = useState('');
    const [instructions, setInstructions] = useState('');

    const readOnly = !canEdit;

    useEffect(() => {
        getBusinessInfo()
            .then(data => {
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

    // Saluda con el borde aurora al entrar al módulo (una vez, cuando termina de cargar).
    useEffect(() => { if (!loading) pulseAurora(4200); }, [loading, pulseAurora]);

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
        if (readOnly) return;
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
        const emailInput = form.notification_email.trim();
        if (emailInput && !EMAIL_RE.test(emailInput)) {
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
            // Sincroniza el horario en el store para que Turnos y los modales
            // re-generen slots al instante (mismo comportamiento que antes).
            const toHHMM = (h) => `${String(Number(h)).padStart(2, '0')}:00`;
            useAppStore.getState().setBusinessHours({
                schedule_start: toHHMM(form.schedule_start),
                schedule_end: toHHMM(form.schedule_end),
                schedule_days: useAppStore.getState().businessHours?.schedule_days ?? [1, 2, 3, 4, 5],
            });
            showSettingsSavedToast(nameInput);
            pulseAurora();
            setDirty(false);
        } catch (err) {
            showErrorToast('Error de Base de Datos', err.message || 'No se pudo guardar la configuración.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="relative h-full min-h-[380px] flex items-center justify-center bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md overflow-hidden">
                <div className="w-8 h-8 border-4 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-5 items-stretch h-full min-h-0">

            {/* Columna izquierda: Asistente IA + Guardar */}
            <div className="w-full lg:w-[44%] shrink-0 flex flex-col gap-4 min-h-0">
                <div className={`ai-aurora rounded-[24px] w-full flex flex-1 min-h-0 ${auroraClass}`}>
                    <div className="relative flex-1 rounded-[24px] overflow-hidden border border-white/60 bg-white/40 backdrop-blur-2xl shadow-md p-6 flex flex-col justify-between gap-6 min-h-[380px]">
                        <CornerGlows />

                        <AIOrb className="absolute inset-x-0 top-[8%] w-full h-[58%] z-0 pointer-events-none [mask-image:linear-gradient(to_bottom,transparent_0%,#000_18%,#000_60%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_18%,#000_60%,transparent_100%)]" />

                        <div className="relative z-10 flex items-center gap-2.5 text-navy-700/80">
                            <div className="w-8 h-8 rounded-xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center shrink-0">
                                <Bot size={14} className="text-navy-700/80" />
                            </div>
                            <span className="text-[11px] font-bold tracking-wide">Asistente IA · Personalidad</span>
                        </div>

                        <div className="relative z-10 flex-1 min-h-[150px]" />

                        <div className="relative z-10 flex flex-col items-center mb-1">
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
                                        disabled={readOnly || !hasFeature('ai_agent_name')}
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

                        <div className="relative z-10 rounded-2xl bg-white/30 border border-white/60 p-3 shadow-sm">
                            <textarea
                                maxLength={250}
                                value={instructions}
                                onChange={e => handleInstructionsChange(e.target.value)}
                                disabled={readOnly || !hasFeature('custom_prompt')}
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

                {canEdit && (
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

            {/* Columna derecha: Identidad + Horario (lado a lado, angostos y altos) + IA pausada */}
            <div className="flex-1 min-w-0 flex flex-col gap-5 min-h-0">

                <div className="grid grid-cols-2 gap-5 shrink-0">

                    <div className={`ai-aurora rounded-[22px] ${auroraClass}`}>
                        <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[22px] shadow-md p-5 overflow-hidden">
                            <CornerGlows />
                            <Section icon={Building2} title="Identidad" />
                            <div className="relative z-10 space-y-4">
                                <Field label="Nombre del negocio">
                                    <input
                                        type="text"
                                        maxLength={100}
                                        value={form.name}
                                        onChange={e => setField('name', e.target.value)}
                                        disabled={readOnly}
                                        placeholder="Ej: Clínica San Rafael"
                                        className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-[13px] font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </Field>
                                <Field label="Correo de notificaciones">
                                    <div className="relative">
                                        <Mail size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-700/40 pointer-events-none" />
                                        <input
                                            type="email"
                                            value={form.notification_email}
                                            onChange={e => setField('notification_email', e.target.value)}
                                            disabled={readOnly}
                                            placeholder="opcional"
                                            className="w-full bg-white/40 border border-white/60 rounded-full pl-9 pr-4 py-2.5 text-[13px] font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </Field>
                            </div>
                        </div>
                    </div>

                    <div className={`ai-aurora rounded-[22px] ${auroraClass}`}>
                        <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[22px] shadow-md p-5 overflow-hidden">
                            <CornerGlows />
                            <Section icon={Clock} title="Horario" />
                            <div className="relative z-10 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Apertura">
                                        <HourSelect
                                            value={form.schedule_start}
                                            onChange={val => setField('schedule_start', val)}
                                            options={HOUR_OPTIONS}
                                            disabled={readOnly}
                                        />
                                    </Field>
                                    <Field label="Cierre">
                                        <HourSelect
                                            value={form.schedule_end}
                                            onChange={val => setField('schedule_end', val)}
                                            options={HOUR_OPTIONS.filter(o => o.value > form.schedule_start)}
                                            disabled={readOnly}
                                        />
                                    </Field>
                                </div>
                                <Field label="Días de atención">
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map(day => {
                                            const active = selectedDays.has(day.key);
                                            return (
                                                <button
                                                    key={day.key}
                                                    type="button"
                                                    onClick={() => toggleDay(day.key)}
                                                    disabled={readOnly}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all duration-300 select-none border disabled:cursor-not-allowed ${active
                                                        ? 'bg-navy-50 text-navy-700 border-navy-100 shadow-[0_2px_8px_rgba(15,32,68,0.18)]'
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
                </div>

                <div className="flex-1 min-h-[200px]">
                    <PausedAIPanel canEdit={canEdit} />
                </div>
            </div>
        </div>
    );
}
