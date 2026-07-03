import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Search, Shield, LogOut, Users, Calendar,
    UserCheck, ChevronRight, Save, Mail, RefreshCw,
    SlidersHorizontal, Clock, Bot, Activity, Power, MessageSquare, Layers, Plus, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';
import { showSuccessToast, showErrorToast } from '../store/useToastStore';
import { adminListBusinesses, adminUpdateBusiness, adminResetPassword } from '../services/adminService';

const STATUS_META = {
    active:    { label: 'Activo',     cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
    trial:     { label: 'Trial',      cls: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
    suspended: { label: 'Suspendido', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
    cancelled: { label: 'Cancelado',  cls: 'bg-rose-500/10 text-rose-700 border-rose-500/20' },
};

const TIER_META = {
    basic:      { label: 'Basic',      cls: 'bg-navy-900/5 text-navy-900/50 border-navy-900/10' },
    pro:        { label: 'Pro',        cls: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
    enterprise: { label: 'Enterprise', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
};

const TIMEZONES = [
    'America/Guatemala', 'America/Mexico_City', 'America/Bogota',
    'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires',
    'America/Caracas', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
];

const STATUSES = ['active', 'trial', 'suspended', 'cancelled'];

// Módulos toggleables por cliente (sobre-escriben plan.features vía businesses.feature_flags)
const FEATURE_DEFS = [
    { key: 'dashboard',        label: 'Estadísticas' },
    { key: 'followup',         label: 'Seguimiento' },
    { key: 'kanban',           label: 'Tablero Kanban' },
    { key: 'audit_log',        label: 'Actividad' },
    { key: 'finance',          label: 'Finanzas' },
    { key: 'supplies',         label: 'Insumos (BOM)' },
    { key: 'dynamic_pricing',  label: 'Ofertas' },
    { key: 'custom_prompt',    label: 'Contexto IA / Prompt' },
];

const LIMIT_DEFS = [
    { key: 'max_patients',      label: 'Pacientes' },
    { key: 'max_staff',         label: 'Staff' },
    { key: 'max_appointments',  label: 'Turnos' },
    { key: 'max_conversations', label: 'Mensajes/mes' },
];

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TABS = [
    { id: 'datos',   label: 'Datos',            icon: Building2 },
    { id: 'modulos', label: 'Módulos + Límites', icon: SlidersHorizontal },
    { id: 'horario', label: 'Horario + IA',      icon: Clock },
    { id: 'uso',     label: 'Uso + acciones',    icon: Activity },
];

function Badge({ value, meta }) {
    const m = meta[value] ?? { label: value, cls: 'bg-navy-900/5 text-navy-900/50 border-navy-900/10' };
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${m.cls}`}>
            {m.label}
        </span>
    );
}

function MetricBar({ label, count, max, icon: Icon, warn }) {
    const pct = max ? Math.min((count / max) * 100, 100) : 0;
    const over = max && count >= max;
    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-navy-900/5 flex items-center justify-center flex-shrink-0">
                        <Icon size={13} className="text-navy-900/50" />
                    </div>
                    <span className="text-[11px] font-bold text-navy-700/60 uppercase tracking-wider">{label}</span>
                </div>
                <span className={`text-[13px] font-bold ${over && warn ? 'text-rose-600' : 'text-navy-900'}`}>
                    {count} <span className="text-navy-900/30 font-medium text-[11px]">/ {max ?? '∞'}</span>
                </span>
            </div>
            {!!max && (
                <div className="w-full h-1.5 bg-navy-900/5 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-navy-900/30'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
    );
}

function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-navy-900' : 'bg-navy-900/15'}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`} />
        </button>
    );
}

export default function AdminPanel() {
    const [businesses, setBusinesses] = useState([]);
    const [plans, setPlans] = useState([]);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [form, setForm] = useState(null);
    const [tab, setTab] = useState('datos');
    const profile = useAppStore(s => s.profile);
    const navigate = useNavigate();

    // % de mensajes del mes vs límite efectivo (para avisos de uso)
    const usagePct = (b) => {
        const mc = b?.limit_overrides?.max_conversations ?? b?.plans?.max_conversations;
        return mc ? (b.messages_used ?? 0) / mc : 0;
    };

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            const [bizData, plansRes] = await Promise.all([
                adminListBusinesses(),
                supabase.from('plans').select('id, tier, name, monthly_price').order('monthly_price'),
            ]);
            setBusinesses(bizData ?? []);
            setPlans(plansRes.data ?? []);
        } catch {
            showErrorToast('Error', 'No se pudieron cargar los negocios.');
        } finally {
            setLoading(false);
        }
    }

    function selectBusiness(biz) {
        setSelected(biz);
        setTab('datos');
        setForm({
            name: biz.name ?? '',
            business_type: biz.business_type ?? '',
            timezone: biz.timezone ?? 'America/Guatemala',
            plan_status: biz.plan_status ?? 'active',
            plan_id: biz.plans?.id ?? biz.plan_id ?? '',
            notification_email: biz.notification_email ?? '',
            schedule_start: biz.schedule_start ?? 9,
            schedule_end: biz.schedule_end ?? 18,
            schedule_days: biz.schedule_days ?? 'Lun,Mar,Mié,Jue,Vie',
            appointment_duration: biz.appointment_duration ?? 30,
            custom_prompt: biz.custom_prompt ?? '',
            phone_number_id: biz.phone_number_id ?? '',
            feature_flags: biz.feature_flags ?? {},
            limit_overrides: biz.limit_overrides ?? {},
            ai_paused: biz.ai_paused ?? false,
            ai_paused_reason: biz.ai_paused_reason ?? null,
        });
    }

    const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

    function toggleFeature(key) {
        setForm(f => {
            const planVal = !!selected?.plans?.features?.[key];
            const current = key in (f.feature_flags || {}) ? !!f.feature_flags[key] : planVal;
            return { ...f, feature_flags: { ...(f.feature_flags || {}), [key]: !current } };
        });
    }
    function featureValue(key) {
        if (!form) return false;
        if (key in (form.feature_flags || {})) return !!form.feature_flags[key];
        return !!selected?.plans?.features?.[key];
    }

    function setLimit(key, val) {
        setForm(f => {
            const next = { ...(f.limit_overrides || {}) };
            if (val === '' || val == null) delete next[key];
            else next[key] = Number(val);
            return { ...f, limit_overrides: next };
        });
    }

    function toggleDay(d) {
        setForm(f => {
            const set = new Set((f.schedule_days || '').split(',').map(s => s.trim()).filter(Boolean));
            set.has(d) ? set.delete(d) : set.add(d);
            return { ...f, schedule_days: DAYS.filter(x => set.has(x)).join(',') };
        });
    }

    async function handleSave() {
        if (!selected || !form) return;
        setSaving(true);
        try {
            const updates = {
                name: form.name,
                business_type: form.business_type,
                timezone: form.timezone,
                plan_status: form.plan_status,
                notification_email: form.notification_email,
                schedule_start: Number(form.schedule_start),
                schedule_end: Number(form.schedule_end),
                schedule_days: form.schedule_days,
                appointment_duration: Number(form.appointment_duration) || 30,
                custom_prompt: form.custom_prompt || null,
                phone_number_id: form.phone_number_id || null,
                feature_flags: form.feature_flags || {},
                limit_overrides: form.limit_overrides || {},
                ai_paused: !!form.ai_paused,
                ai_paused_reason: form.ai_paused ? (form.ai_paused_reason || 'manual') : null,
            };
            if (form.plan_id) updates.plan_id = form.plan_id;

            const updated = await adminUpdateBusiness(selected.id, updates);
            const merged = { ...selected, ...updated, plans: updated.plans };
            setBusinesses(prev => prev.map(b => b.id === selected.id ? merged : b));
            setSelected(merged);
            showSuccessToast('Guardado', 'Negocio actualizado correctamente.');
        } catch {
            showErrorToast('Error', 'No se pudo guardar el negocio.');
        } finally {
            setSaving(false);
        }
    }

    async function handleResetPassword() {
        const email = selected?.admin_email || selected?.notification_email;
        if (!email) return;
        setResetting(true);
        try {
            await adminResetPassword(selected.id, email);
            showSuccessToast('Email enviado', `Enlace de recuperación enviado a ${email}.`);
        } catch {
            showErrorToast('Error', 'No se pudo enviar el email de recuperación.');
        } finally {
            setResetting(false);
        }
    }

    const filtered = businesses.filter(b =>
        b.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.notification_email?.toLowerCase().includes(search.toLowerCase()) ||
        b.admin_email?.toLowerCase().includes(search.toLowerCase())
    );

    const labelCls = 'block text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-1.5';
    const maxConv = selected?.limit_overrides?.max_conversations ?? selected?.plans?.max_conversations ?? null;

    return (
        <div className="h-screen w-screen relative overflow-hidden bg-transparent p-2 sm:p-4 lg:p-6 flex items-center justify-center">
            <div className="w-full max-w-[1920px] h-full rounded-[24px] sm:rounded-[32px] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(26,58,107,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] overflow-hidden relative z-10 flex flex-col">

            {/* Topbar */}
            <div className="flex-shrink-0 px-5 py-3 border-b border-white/40 flex items-center justify-between bg-white/20">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-navy-900 flex items-center justify-center text-white flex-shrink-0">
                        <Shield size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-navy-900 leading-none">Panel de Administración</h1>
                        <p className="text-[11px] text-navy-700/50 font-medium mt-0.5">
                            NovTurnIA · {profile?.full_name ?? profile?.email ?? ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/admin/new-tenant')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-900 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-navy-800 transition-colors duration-200">
                        <Plus size={13} /> <span className="hidden sm:inline">Nuevo negocio</span>
                    </button>
                    <button onClick={load} disabled={loading}
                        className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/60 bg-white/30 hover:bg-white/60 text-navy-900/40 hover:text-navy-900 transition-all duration-200 disabled:opacity-40">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <span className="text-[11px] text-navy-700/40 font-medium hidden sm:block">{businesses.length} negocios</span>
                    <button onClick={() => supabase.auth.signOut()}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/60 bg-white/30 hover:bg-white/60 text-[11px] font-bold text-navy-900/50 hover:text-navy-900 transition-all duration-200 uppercase tracking-widest">
                        <LogOut size={12} /> Salir
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex gap-4 min-h-0 px-4 lg:px-6 py-4">
                {/* Left list */}
                <div className="w-72 xl:w-80 flex flex-col gap-2 min-h-0 flex-shrink-0">
                    <div className="relative flex-shrink-0">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-900/30 pointer-events-none" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar negocio o email..."
                            className="glass-input w-full pl-9 pr-3 py-2.5 text-[12px]" />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="w-6 h-6 border-2 border-navy-100 border-t-navy-700 rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <p className="text-center text-[12px] text-navy-700/40 font-medium py-10">Sin resultados</p>
                        ) : filtered.map(biz => {
                            const isActive = selected?.id === biz.id;
                            const sMeta = STATUS_META[biz.plan_status] ?? STATUS_META.active;
                            const tMeta = TIER_META[biz.plans?.tier] ?? TIER_META.basic;
                            return (
                                <button key={biz.id} onClick={() => selectBusiness(biz)}
                                    className={`w-full text-left px-3.5 py-3 rounded-2xl border transition-all duration-200 group flex items-center gap-3 ${
                                        isActive ? 'bg-navy-900 border-navy-900/20 shadow-card' : 'bg-white/40 border-white/60 hover:bg-white/60'}`}>
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-navy-900/10 text-navy-900'}`}>
                                        {(biz.name ?? 'N').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[12px] font-bold leading-none truncate ${isActive ? 'text-white' : 'text-navy-900'}`}>{biz.name}</p>
                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${isActive ? 'bg-white/20 text-white border-white/20' : sMeta.cls}`}>{sMeta.label}</span>
                                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${isActive ? 'bg-white/10 text-white/60 border-white/10' : tMeta.cls}`}>{tMeta.label}</span>
                                            {biz.ai_paused && (
                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${isActive ? 'bg-amber-400/30 text-amber-100 border-amber-300/30' : 'bg-amber-500/10 text-amber-700 border-amber-500/20'}`}><Power size={8} /> IA</span>
                                            )}
                                            {usagePct(biz) >= 0.8 && (
                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${isActive ? 'bg-white/20 text-white border-white/20' : usagePct(biz) >= 1 ? 'bg-rose-500/10 text-rose-700 border-rose-500/20' : 'bg-amber-500/10 text-amber-700 border-amber-500/20'}`}><AlertTriangle size={8} /> {Math.round(usagePct(biz) * 100)}%</span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className={`flex-shrink-0 transition-colors ${isActive ? 'text-white/40' : 'text-navy-900/20 group-hover:text-navy-900/50'}`} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right detail */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {!selected || !form ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-white/40 border border-white/60 flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <Building2 size={26} className="text-navy-900/20" />
                                </div>
                                <p className="text-[13px] font-bold text-navy-900/30">Selecciona un negocio</p>
                                <p className="text-[11px] text-navy-700/30 font-medium mt-1">para ver y editar sus detalles</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-4">
                            {/* Detail header */}
                            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl px-6 py-5 flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h2 className="text-xl font-bold text-navy-900 leading-tight">{selected.name}</h2>
                                        <Badge value={selected.plan_status} meta={STATUS_META} />
                                        <Badge value={selected.plans?.tier} meta={TIER_META} />
                                        {selected.ai_paused && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-700 border-amber-500/20"><Power size={9} /> IA pausada</span>
                                        )}
                                    </div>
                                    <p className="text-[12px] text-navy-700/50 font-medium">
                                        ID: <span className="font-mono">{selected.id}</span> · Creado {new Date(selected.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-navy-800 transition-colors duration-200 disabled:opacity-50">
                                    {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
                                    Guardar
                                </button>
                            </div>

                            {/* Tab nav */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {TABS.map(t => {
                                    const Icon = t.icon;
                                    return (
                                        <button key={t.id} onClick={() => setTab(t.id)}
                                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 ${tab === t.id ? 'bg-navy-900 text-white shadow-card' : 'bg-white/40 border border-white/60 text-navy-700/60 hover:bg-white/60'}`}>
                                            <Icon size={13} /> {t.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* ── Tab: Datos ── */}
                            {tab === 'datos' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <MetricBar label="Pacientes" count={selected.patient_count ?? 0} max={selected.limit_overrides?.max_patients ?? selected.plans?.max_patients} icon={Users} />
                                        <MetricBar label="Turnos" count={selected.appointment_count ?? 0} max={selected.limit_overrides?.max_appointments ?? selected.plans?.max_appointments} icon={Calendar} />
                                        <MetricBar label="Staff activo" count={selected.staff_count ?? 0} max={selected.limit_overrides?.max_staff ?? selected.plans?.max_staff} icon={UserCheck} />
                                        {selected.plans && (
                                            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-4">
                                                <p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-2">Plan actual</p>
                                                <p className="text-[15px] font-bold text-navy-900">{selected.plans.name}</p>
                                                <p className="text-[12px] text-navy-700/50 font-medium mt-0.5">${selected.plans.monthly_price}/mes · {selected.plans.tier}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="lg:col-span-2 bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-5 space-y-4">
                                        <p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest">Datos del negocio</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="sm:col-span-2">
                                                <label className={labelCls}>Nombre</label>
                                                <input value={form.name} onChange={e => setField('name', e.target.value)} className="glass-input w-full text-[13px]" />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Tipo de negocio</label>
                                                <input value={form.business_type} onChange={e => setField('business_type', e.target.value)} className="glass-input w-full text-[13px]" />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Zona horaria</label>
                                                <select value={form.timezone} onChange={e => setField('timezone', e.target.value)} className="glass-input w-full text-[13px]">
                                                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Plan</label>
                                                <select value={form.plan_id} onChange={e => setField('plan_id', e.target.value)} className="glass-input w-full text-[13px]">
                                                    <option value="">— Sin plan —</option>
                                                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.tier}) · ${p.monthly_price}/mes</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Estado</label>
                                                <select value={form.plan_status} onChange={e => setField('plan_status', e.target.value)} className="glass-input w-full text-[13px]">
                                                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>)}
                                                </select>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className={labelCls}>Email de notificaciones</label>
                                                <input value={form.notification_email} onChange={e => setField('notification_email', e.target.value)} type="email" className="glass-input w-full text-[13px]" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Tab: Módulos + Límites ── */}
                            {tab === 'modulos' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-4"><Layers size={14} className="text-navy-700/50" /><p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest">Módulos activos</p></div>
                                        <p className="text-[11px] text-navy-700/40 font-medium mb-3">Sobre-escribe lo que trae el plan, por cliente.</p>
                                        <div className="space-y-1">
                                            {FEATURE_DEFS.map(f => (
                                                <div key={f.key} className="flex items-center justify-between py-2 border-b border-white/40 last:border-0">
                                                    <span className="text-[12px] font-bold text-navy-900">{f.label}</span>
                                                    <Toggle checked={featureValue(f.key)} onChange={() => toggleFeature(f.key)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-4"><SlidersHorizontal size={14} className="text-navy-700/50" /><p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest">Override de límites</p></div>
                                        <p className="text-[11px] text-navy-700/40 font-medium mb-3">Vacío = usa el límite del plan.</p>
                                        <div className="space-y-3">
                                            {LIMIT_DEFS.map(l => (
                                                <div key={l.key} className="flex items-center justify-between gap-3">
                                                    <label className="text-[12px] font-bold text-navy-900">{l.label}</label>
                                                    <input type="number" min="0"
                                                        value={form.limit_overrides?.[l.key] ?? ''}
                                                        onChange={e => setLimit(l.key, e.target.value)}
                                                        placeholder={String(selected.plans?.[l.key] ?? '∞')}
                                                        className="glass-input w-32 text-[13px] text-right" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Tab: Horario + IA ── */}
                            {tab === 'horario' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-5 space-y-4">
                                        <div className="flex items-center gap-2"><Clock size={14} className="text-navy-700/50" /><p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest">Horario de atención</p></div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className={labelCls}>Apertura</label>
                                                <select value={form.schedule_start} onChange={e => setField('schedule_start', Number(e.target.value))} className="glass-input w-full text-[13px]">
                                                    {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Cierre</label>
                                                <select value={form.schedule_end} onChange={e => setField('schedule_end', Number(e.target.value))} className="glass-input w-full text-[13px]">
                                                    {HOURS.filter(h => h > form.schedule_start).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Duración turno</label>
                                                <input type="number" min="5" step="5" value={form.appointment_duration} onChange={e => setField('appointment_duration', e.target.value)} className="glass-input w-full text-[13px]" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Días de atención</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {DAYS.map(d => {
                                                    const on = (form.schedule_days || '').split(',').map(s => s.trim()).includes(d);
                                                    return (
                                                        <button key={d} type="button" onClick={() => toggleDay(d)}
                                                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${on ? 'bg-navy-900 text-white' : 'bg-white/40 border border-white/60 text-navy-700/50 hover:bg-white/60'}`}>{d}</button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center gap-2"><Bot size={14} className="text-navy-700/50" /><p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest">Contexto / Prompt de la IA</p></div>
                                        <textarea rows={8} value={form.custom_prompt} onChange={e => setField('custom_prompt', e.target.value)}
                                            placeholder="Personalidad e instrucciones del asistente…"
                                            className="glass-input w-full text-[13px] resize-none custom-scrollbar" />
                                        <div>
                                            <label className={labelCls}>WhatsApp phone_number_id</label>
                                            <input value={form.phone_number_id} onChange={e => setField('phone_number_id', e.target.value)} className="glass-input w-full text-[13px] font-mono" />
                                            <p className="text-[10px] text-navy-700/40 font-medium mt-1">El token de WhatsApp se gestiona cifrado (Vault) en la sección Keys.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Tab: Uso + acciones ── */}
                            {tab === 'uso' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <MetricBar label="Mensajes (mes)" count={selected.messages_used ?? 0} max={maxConv} icon={MessageSquare} warn />
                                        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-7 h-7 rounded-full bg-navy-900/5 flex items-center justify-center"><Activity size={13} className="text-navy-900/50" /></div>
                                                <span className="text-[11px] font-bold text-navy-700/60 uppercase tracking-wider">Tokens (mes)</span>
                                            </div>
                                            <p className="text-[18px] font-bold text-navy-900 tabular-nums">{(selected.tokens_used ?? 0).toLocaleString('es-GT')}</p>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-5 space-y-4">
                                        <p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest">Acciones</p>

                                        {/* Pausa IA global */}
                                        <div className="flex items-center justify-between py-2 border-b border-white/40">
                                            <div>
                                                <p className="text-[12px] font-bold text-navy-900">Pausar IA (human takeover global)</p>
                                                <p className="text-[11px] text-navy-700/40 font-medium">La IA deja de responder; el negocio atiende manual.{form.ai_paused && form.ai_paused_reason === 'usage_limit' ? ' (Corte automático por límite)' : ''}</p>
                                            </div>
                                            <Toggle checked={!!form.ai_paused} onChange={v => setForm(f => ({ ...f, ai_paused: v, ai_paused_reason: v ? 'manual' : null }))} />
                                        </div>

                                        {/* Estado de cuenta rápido */}
                                        <div className="flex items-center justify-between py-2 border-b border-white/40">
                                            <div>
                                                <p className="text-[12px] font-bold text-navy-900">Estado de la cuenta</p>
                                                <p className="text-[11px] text-navy-700/40 font-medium">Suspender bloquea el acceso del cliente.</p>
                                            </div>
                                            <select value={form.plan_status} onChange={e => setField('plan_status', e.target.value)} className="glass-input w-40 text-[13px]">
                                                {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>)}
                                            </select>
                                        </div>

                                        {/* Reset password */}
                                        <div className="flex items-center justify-between py-2">
                                            <div>
                                                <p className="text-[12px] font-bold text-navy-900">Administrador del negocio</p>
                                                <p className="text-[11px] text-navy-700/40 font-medium">{selected.admin_name ?? '—'} · {selected.admin_email ?? selected.notification_email ?? '—'}</p>
                                            </div>
                                            <button onClick={handleResetPassword} disabled={resetting || (!selected.admin_email && !selected.notification_email)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/60 bg-white/30 hover:bg-white/60 text-[11px] font-bold text-navy-900/60 hover:text-navy-900 transition-all duration-200 disabled:opacity-40 uppercase tracking-widest flex-shrink-0">
                                                {resetting ? <div className="w-3.5 h-3.5 border-2 border-navy-900/20 border-t-navy-900 rounded-full animate-spin" /> : <Mail size={13} />}
                                                Reset contraseña
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-navy-700/40 font-medium">Los cambios (incluida la pausa de IA) se aplican al pulsar <b>Guardar</b>.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}
