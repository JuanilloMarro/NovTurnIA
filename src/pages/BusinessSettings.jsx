import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { getBusinessInfo, updateBusinessInfo } from '../services/supabaseService';
import { usePermissions } from '../hooks/usePermissions';
import { Save, Building2, Clock, Mail, Zap, Lock, Bot, Check } from 'lucide-react';
import { showSettingsSavedToast, showValidationToast, showErrorToast } from '../store/useToastStore';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, '0')}:00`,
}));

// ── Wheel picker ──────────────────────────────────────────────────────────────
const WH = 26;

function WheelColumn({ items, selected, onSelect, displayFn, disabled = false }) {
    const containerRef = useRef(null);
    const trackRef     = useRef(null);
    const offsetRef    = useRef(0);
    const drag         = useRef({ active: false, startY: 0, startOffset: 0, lastY: 0, lastTime: 0, velocity: 0, raf: null });

    function applyTransform(offset) {
        if (trackRef.current) trackRef.current.style.transform = `translateY(${WH - offset}px)`;
    }

    useLayoutEffect(() => {
        if (drag.current.active) return;
        const idx = items.indexOf(selected);
        if (idx === -1) return;
        cancelAnimationFrame(drag.current.raf);
        const targetOffset = idx * WH;
        offsetRef.current = targetOffset;
        applyTransform(targetOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    function snapTo(fromOffset, velocity) {
        cancelAnimationFrame(drag.current.raf);
        const maxOffset = (items.length - 1) * WH;
        const projected = Math.max(0, Math.min(maxOffset, fromOffset + velocity * 100));
        const targetIdx = Math.round(projected / WH);
        const targetOffset = targetIdx * WH;
        const start = performance.now();
        const duration = 220;
        function step(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const cur = fromOffset + (targetOffset - fromOffset) * eased;
            offsetRef.current = cur;
            applyTransform(cur);
            if (t < 1) {
                drag.current.raf = requestAnimationFrame(step);
            } else {
                offsetRef.current = targetOffset;
                applyTransform(targetOffset);
                onSelect(items[targetIdx]);
            }
        }
        drag.current.raf = requestAnimationFrame(step);
    }

    function onPointerDown(e) {
        cancelAnimationFrame(drag.current.raf);
        Object.assign(drag.current, { active: true, startY: e.clientY, startOffset: offsetRef.current, lastY: e.clientY, lastTime: performance.now(), velocity: 0 });
        containerRef.current?.setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!drag.current.active) return;
        const dy = e.clientY - drag.current.startY;
        const maxOffset = (items.length - 1) * WH;
        const raw = drag.current.startOffset - dy;
        const clamped = raw < 0 ? raw * 0.3 : raw > maxOffset ? maxOffset + (raw - maxOffset) * 0.3 : raw;
        offsetRef.current = clamped;
        applyTransform(clamped);
        const now = performance.now();
        const dt = now - drag.current.lastTime;
        if (dt > 0) drag.current.velocity = -(e.clientY - drag.current.lastY) / dt;
        drag.current.lastY = e.clientY;
        drag.current.lastTime = now;
    }

    function onPointerUp() {
        if (!drag.current.active) return;
        drag.current.active = false;
        const maxOffset = (items.length - 1) * WH;
        snapTo(Math.max(0, Math.min(maxOffset, offsetRef.current)), drag.current.velocity);
    }

    return (
        <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden select-none touch-none"
            style={{ height: WH * 3, cursor: disabled ? 'default' : 'grab' }}
            onPointerDown={disabled ? undefined : onPointerDown}
            onPointerMove={disabled ? undefined : onPointerMove}
            onPointerUp={disabled ? undefined : onPointerUp}
            onPointerCancel={disabled ? undefined : onPointerUp}
        >
            <div className="absolute inset-x-1 pointer-events-none z-10 rounded-lg bg-white/60 border border-white/70 shadow-sm"
                style={{ top: WH, height: WH }} />
            <div className="absolute inset-0 pointer-events-none z-20"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.75) 0%, transparent 32%, transparent 68%, rgba(255,255,255,0.75) 100%)' }} />
            <div ref={trackRef} className="absolute inset-x-0 top-0 will-change-transform z-30">
                {items.map(item => {
                    const isSelected = item === selected;
                    return (
                        <div key={item} style={{ height: WH }}
                            className={`flex items-center justify-center transition-all duration-150 px-3 text-center leading-none ${isSelected ? 'text-navy-900 font-black text-[12px]' : 'text-navy-900/25 font-semibold text-[11px]'}`}>
                            <span className="truncate w-full text-center">{displayFn ? displayFn(item) : item}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

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
            showValidationToast('Atención', 'El nombre del negocio no puede estar vacío.');
            return;
        }
        if (nameInput.length > 100) {
            showValidationToast('Nombre muy largo', 'El nombre no debe exceder los 100 caracteres.');
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
        if (emailInput.length > 255) {
            showValidationToast('Email muy largo', 'El correo no debe exceder los 255 caracteres.');
            return;
        }

        setSaving(true);
        try {
            await updateBusinessInfo({
                name: nameInput,
                schedule_start: Number(form.schedule_start),
                schedule_end: Number(form.schedule_end),
                schedule_days: serializeDays(selectedDays),
                notification_email: emailInput || '',
                has_emergencias: form.has_emergencias,
                custom_prompt: form.custom_prompt.trim() || null,
            });
            showSettingsSavedToast(nameInput);
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
        <div className="h-full flex flex-col mx-auto w-full max-w-[1080px] pt-2 px-0">
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
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-y-4 gap-x-2 pt-1">
                                    {DAYS.map(day => {
                                        const active = selectedDays.has(day.key);
                                        return (
                                            <label key={day.key} className="flex items-center gap-3.5 cursor-pointer group select-none">
                                                <div className="relative flex items-center justify-center shrink-0">
                                                    <input type="checkbox" checked={active} onChange={() => toggleDay(day.key)} className="sr-only" />
                                                    <div className={`w-[16px] h-[16px] rounded-[5px] border transition-all duration-300 flex items-center justify-center shadow-sm ${active ? 'bg-navy-900 border-navy-900 shadow-sm' : 'border-navy-900/30 bg-white/60 backdrop-blur-sm group-hover:border-navy-900/50'}`}>
                                                        <Check size={12} strokeWidth={4} className={`text-white transition-all duration-200 ${active ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                                                    </div>
                                                </div>
                                                <span className="font-bold text-[10.5px] tracking-tight leading-none pt-[1.5px] text-navy-900 transition-colors duration-300">
                                                    {day.label}
                                                </span>
                                            </label>
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
                            <div className="bg-white/40 border border-white/60 rounded-2xl px-5 py-4 shadow-sm">
                                <p className="text-sm font-bold text-navy-900 leading-none mb-1">Atención de emergencias</p>
                                <p className="text-[11px] text-navy-700/50 font-semibold">
                                    Trabaja y gestiona emergencias fuera del horario habitual
                                </p>
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
