import { useState, useEffect } from 'react';
import { getBusinessInfo, updateBusinessInfo } from '../services/supabaseService';
import { usePermissions } from '../hooks/usePermissions';
import { Save, Building2, Clock, Mail, Zap, Lock, Bot } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../store/useToastStore';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, '0')}:00`,
}));

// Canonical day order and display labels
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

// Parse stored schedule_days string → Set of day keys
// Accepts legacy ranges like 'Lun-Vie' or new comma-separated 'Lun,Mié,Vie'
function parseDays(str) {
    if (!str) return new Set(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']);

    // Comma-separated (new format)
    if (str.includes(',')) {
        return new Set(str.split(',').map(s => s.trim()).filter(Boolean));
    }

    // Legacy range 'Lun-Vie' → expand
    if (str.includes('-')) {
        const [from, to] = str.split('-').map(s => s.trim());
        const fromIdx = DAYS.findIndex(d => d.key === from);
        const toIdx = DAYS.findIndex(d => d.key === to);
        if (fromIdx !== -1 && toIdx !== -1 && toIdx >= fromIdx) {
            return new Set(DAYS.slice(fromIdx, toIdx + 1).map(d => d.key));
        }
    }

    // Single day
    return new Set([str.trim()]);
}

// Serialize Set → comma-separated string in canonical order
function serializeDays(set) {
    return DAYS.filter(d => set.has(d.key)).map(d => d.key).join(',');
}

function Section({ icon: Icon, title, children }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-navy-900/5 flex items-center justify-center text-navy-700">
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
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full bg-white/40 border border-white/60 rounded-full px-4 pr-10 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all appearance-none shadow-sm"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-navy-800">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
        </div>
    );
}

export default function BusinessSettings() {
    const { canManageRoles } = usePermissions();

    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [form, setForm] = useState(null);
    const [selectedDays, setSelectedDays] = useState(new Set());

    useEffect(() => {
        getBusinessInfo()
            .then(data => {
                setInfo(data);
                setForm({
                    name: data.name || '',
                    schedule_start: data.schedule_start ?? 9,
                    schedule_end: data.schedule_end ?? 18,
                    notification_email: data.notification_email || '',
                    has_emergencias: data.has_emergencias ?? false,
                    custom_prompt: data.custom_prompt || '',
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
            showErrorToast('Atención', 'El nombre del negocio no puede estar vacío.');
            return;
        }
        if (nameInput.length > 100) {
            showErrorToast('Nombre muy largo', 'El nombre no debe exceder los 100 caracteres.');
            return;
        }

        if (selectedDays.size === 0) {
            showErrorToast('Días inválidos', 'Debes seleccionar al menos un día de atención.');
            return;
        }

        if (Number(form.schedule_end) <= Number(form.schedule_start)) {
            showErrorToast('Horario inválido', 'La hora de cierre debe ser posterior a la de apertura.');
            return;
        }

        const emailInput = form.notification_email.trim();
        if (emailInput && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(emailInput)) {
            showErrorToast('Email inválido', 'Revisa el formato del correo de notificaciones.');
            return;
        }
        if (emailInput.length > 255) {
            showErrorToast('Email muy largo', 'El correo no debe exceder los 255 caracteres.');
            return;
        }

        setSaving(true);
        try {
            await updateBusinessInfo({
                name: nameInput,
                schedule_start: Number(form.schedule_start),
                schedule_end: Number(form.schedule_end),
                schedule_days: serializeDays(selectedDays),
                notification_email: emailInput || null,
                has_emergencias: form.has_emergencias,
                custom_prompt: form.custom_prompt.trim() || null,
            });
            showSuccessToast('Configuración guardada', nameInput);
            setDirty(false);
        } catch (err) {
            console.error('SERVER ERROR:', err);
            // Replace masked error with raw message so user can see it exactly
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
        <div className="h-full flex flex-col mx-auto w-full max-w-4xl pt-2 px-0">
            {/* Header */}
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

            {/* Main card */}
            <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-md flex flex-col overflow-hidden mb-4 lg:mb-6 animate-fade-up">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="px-8 py-8 space-y-10">

                        {/* Identidad */}
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

                        {/* Horario */}
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
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {DAYS.map(day => {
                                        const active = selectedDays.has(day.key);
                                        return (
                                            <button
                                                key={day.key}
                                                type="button"
                                                onClick={() => toggleDay(day.key)}
                                                className={`px-4 py-2 rounded-full text-[12px] font-bold border transition-all duration-200 ${active
                                                    ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                                                    : 'bg-white/40 text-navy-900/40 border-white/60 hover:bg-white/60 hover:text-navy-900'
                                                    }`}
                                            >
                                                {day.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Field>
                            <ReadOnlyField label="Zona horaria" value="América/Guatemala" />
                        </Section>

                        {/* Notificaciones */}
                        <Section icon={Mail} title="Notificaciones">
                            <Field label="Email de notificaciones">
                                <input
                                    type="email"
                                    maxLength={255}
                                    value={form.notification_email}
                                    onChange={e => setField('notification_email', e.target.value)}
                                    placeholder="doctor@clinica.com"
                                    className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40"
                                />
                            </Field>
                        </Section>

                        {/* Inteligencia Artificial */}
                        <Section icon={Bot} title="Inteligencia Artificial del Asistente">
                            <Field label="Contexto e ideas base">
                                <p className="text-[10px] text-navy-700/60 font-semibold mb-2 leading-tight">
                                    Aquí puedes proporcionar instrucciones o contexto adicional para el asistente (ubicación, estilo de habla, entre otros). La IA usará esto como sugerencia inicial.
                                </p>
                                <textarea
                                    maxLength={1500}
                                    value={form.custom_prompt}
                                    onChange={e => setField('custom_prompt', e.target.value)}
                                    placeholder="Ej: Somos una clínica dental en Xela. Tratamos con amabilidad y profesionalismo. Manejamos urgencias dentales."
                                    className="w-full h-24 bg-white/40 border border-white/60 rounded-2xl px-4 py-3 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm placeholder-navy-700/40 resize-none custom-scrollbar"
                                />
                            </Field>
                        </Section>

                        {/* Funciones */}
                        <Section icon={Zap} title="Funciones">
                            <div className="flex items-center justify-between bg-white/40 border border-white/60 rounded-2xl px-5 py-4 shadow-sm">
                                <div>
                                    <p className="text-sm font-bold text-navy-900 leading-none mb-1">Atención de emergencias</p>
                                    <p className="text-[11px] text-navy-700/50 font-semibold">
                                        Permite que la IA gestione consultas fuera del horario habitual
                                    </p>
                                </div>
                                <button
                                    onClick={() => setField('has_emergencias', !form.has_emergencias)}
                                    className={`relative w-11 h-6 rounded-full border transition-all duration-300 shrink-0 ${form.has_emergencias
                                        ? 'bg-navy-900 border-navy-900'
                                        : 'bg-white/60 border-white/80'
                                        }`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${form.has_emergencias ? 'translate-x-5' : 'translate-x-0'
                                        }`} />
                                </button>
                            </div>
                        </Section>

                    </div>
                </div>

                {/* Footer actions sticky but slim */}
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
