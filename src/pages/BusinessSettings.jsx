import { useState, useEffect } from 'react';
import WheelColumn from '../components/ui/WheelColumn';
import {
    getBusinessInfo,
    updateBusinessInfo,
    parseCustomPrompt,
    buildCustomPrompt,
} from '../services/supabaseService';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import FeatureLock from '../components/FeatureLock';
import { Save, Building2, Clock, Mail, Lock, Bot, Check, Sparkles, Globe } from 'lucide-react';
import { showSettingsSavedToast, showValidationToast, showErrorToast } from '../store/useToastStore';

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

const SECTIONS = [
    { key: 'identity', label: 'Identidad', icon: Building2 },
    { key: 'schedule', label: 'Horario de atención', icon: Clock },
    { key: 'ai', label: 'Inteligencia Artificial', icon: Bot },
    { key: 'notifications', label: 'Notificaciones', icon: Mail },
    { key: 'localization', label: 'Localización', icon: Globe },
];

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

function ReadOnlyField({ label, value }) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[11px] font-bold text-navy-800/50 tracking-wide leading-none">{label}</span>
                <Lock size={9} className="text-navy-800/30" />
            </div>
            <div className="w-full bg-white/20 border border-white/30 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900/40 shadow-sm select-none">
                {value}
            </div>
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

    const [activeSection, setActiveSection] = useState('identity');
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [form, setForm] = useState(null);
    const [selectedDays, setSelectedDays] = useState(new Set());
    const [agentName, setAgentName] = useState('');
    const [instructions, setInstructions] = useState('');

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
        if (agentName.trim().length > 30) {
            showValidationToast('Nombre de asistente largo', 'El nombre del asistente no debe exceder los 30 caracteres.');
            return;
        }
        if (instructions.trim().length > 270) {
            showValidationToast('Instrucciones muy largas', 'Las instrucciones no deben exceder los 270 caracteres.');
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
        if (!emailInput) {
            showValidationToast('Email requerido', 'El correo es indispensable para el manejo de notificaciones y emergencias.');
            return;
        }
        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(emailInput)) {
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

    return (
        <div className="h-full flex flex-col mx-auto w-full max-w-[1080px] pt-2 px-0">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Configuración del negocio</h1>
                    <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Ajustes generales, horario y preferencias</p>
                </div>
                {info && (
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full border shrink-0 ${planMeta.color}`}>
                        Plan {planMeta.label}
                    </span>
                )}
            </div>

            <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex flex-col overflow-hidden mb-4 lg:mb-6 animate-fade-up">

                {/* Two-panel layout */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left nav panel */}
                    <div className="w-64 shrink-0 border-r border-white/50 flex flex-col gap-1 py-5 px-3 bg-white/20">
                        {SECTIONS.map(({ key, label, icon: Icon }) => {
                            const isActive = activeSection === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setActiveSection(key)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 group w-full text-left
                                        ${isActive
                                            ? 'bg-white/70 shadow-sm border border-white/80'
                                            : 'hover:bg-white/40 border border-transparent'}`}
                                >
                                    <div className={`w-8 h-8 flex items-center justify-center shrink-0 transition-all duration-300 border rounded-full
                                        ${isActive
                                            ? 'bg-gradient-to-b from-white to-gray-200 border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900'
                                            : 'bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900 group-hover:to-gray-200 group-hover:border-gray-200'}`}>
                                        <Icon size={15} strokeWidth={2} />
                                    </div>
                                    <span className={`text-[11px] font-bold tracking-wide leading-tight whitespace-nowrap transition-colors duration-200
                                        ${isActive ? 'text-navy-900' : 'text-navy-800/50 group-hover:text-navy-900'}`}>
                                        {label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right content panel */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="px-8 py-8">

                            {activeSection === 'identity' && (
                                <Section icon={Building2} title="Identidad">
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
                                    <ReadOnlyField label="Tipo de negocio" value={info?.business_type || '—'} />
                                </Section>
                            )}

                            {activeSection === 'schedule' && (
                                <Section icon={Clock} title="Horario de atención">
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
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-y-4 gap-x-2 pt-1">
                                            {DAYS.map(day => {
                                                const active = selectedDays.has(day.key);
                                                return (
                                                    <label key={day.key} className="flex items-center gap-3.5 cursor-pointer group select-none">
                                                        <div className="relative flex items-center justify-center shrink-0">
                                                            <input type="checkbox" checked={active} onChange={() => toggleDay(day.key)} className="sr-only" />
                                                            <div className={`w-[16px] h-[16px] rounded-[5px] border transition-all duration-300 flex items-center justify-center shadow-sm ${active ? 'bg-navy-900 border-navy-900' : 'border-navy-900/30 bg-white/60 group-hover:border-navy-900/50'}`}>
                                                                <Check size={12} strokeWidth={4} className={`text-white transition-all duration-200 ${active ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-[10.5px] tracking-tight leading-none pt-[1.5px] text-navy-900">
                                                            {day.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </Field>
                                </Section>
                            )}

                            {activeSection === 'ai' && (
                                <Section icon={Bot} title="Inteligencia Artificial del Asistente">
                                    <Field label="Nombre del asistente IA">
                                        <p className="text-[10px] text-navy-700/60 font-semibold mb-2 leading-tight">
                                            Dale un nombre personalizado a tu asistente. Aparecerá en sus respuestas como contexto para la IA.
                                        </p>
                                        <FeatureLock feature="ai_agent_name" requiredPlan="Enterprise">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    maxLength={30}
                                                    value={agentName}
                                                    onChange={e => handleAgentNameChange(e.target.value)}
                                                    disabled={!hasFeature('ai_agent_name')}
                                                    placeholder="Ej: Sofía, Valentina, Asistente..."
                                                    className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 pr-16 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    <Sparkles size={12} className="text-violet-400" />
                                                    <span className="text-[10px] font-bold text-navy-900/30">
                                                        {agentName.length}/30
                                                    </span>
                                                </div>
                                            </div>
                                        </FeatureLock>
                                    </Field>

                                    <Field label="Contexto e instrucciones base">
                                        <p className="text-[10px] text-navy-700/60 font-semibold mb-2 leading-tight">
                                            Instrucciones adicionales para el asistente: ubicación, estilo de comunicación, información del negocio, entre otros.
                                        </p>
                                        <FeatureLock feature="custom_prompt" requiredPlan="Pro">
                                            <div className="relative">
                                                <textarea
                                                    maxLength={270}
                                                    value={instructions}
                                                    onChange={e => handleInstructionsChange(e.target.value)}
                                                    disabled={!hasFeature('custom_prompt')}
                                                    placeholder="Ej: Somos una clínica dental en Xela. Tratamos con amabilidad y profesionalismo. Manejamos urgencias dentales."
                                                    className="w-full h-24 bg-white/40 border border-white/60 rounded-2xl px-4 py-3 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 resize-none custom-scrollbar disabled:cursor-not-allowed"
                                                />
                                                <span className="absolute bottom-3 right-4 text-[10px] font-bold text-navy-900/20">
                                                    {instructions.length}/270
                                                </span>
                                            </div>
                                        </FeatureLock>
                                    </Field>
                                </Section>
                            )}

                            {activeSection === 'notifications' && (
                                <Section icon={Mail} title="Notificaciones">
                                    <Field label="Email de notificaciones">
                                        <FeatureLock feature="notification_email" requiredPlan="Enterprise">
                                            <input
                                                type="email"
                                                maxLength={255}
                                                value={form.notification_email}
                                                onChange={e => setField('notification_email', e.target.value)}
                                                placeholder="doctor@clinica.com"
                                                disabled={!hasFeature('notification_email')}
                                                className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                        </FeatureLock>
                                    </Field>
                                </Section>
                            )}

                            {activeSection === 'localization' && (
                                <Section icon={Globe} title="Localización">
                                    <ReadOnlyField label="Zona horaria" value="América/Guatemala (GMT-6)" />
                                </Section>
                            )}

                        </div>
                    </div>
                </div>

                {canManageRoles && (
                    <div className="px-6 py-4 bg-white/40 border-t border-white/60 backdrop-blur-md flex items-center justify-end gap-3 z-20 shrink-0">
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.name.trim() || !dirty}
                            className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2 bg-white border border-white/80 text-navy-900 text-[11px] font-bold rounded-full shadow-sm hover:bg-navy-50 hover:border-navy-100/50 transition-all duration-300 overflow-hidden disabled:opacity-50"
                        >
                            <Save size={14} className="shrink-0" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">
                                {saving ? 'Guardando...' : 'Guardar cambios'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
