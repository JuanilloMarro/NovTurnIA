import { useState, useEffect } from 'react';
import {
    Building2, Search, Shield, LogOut, Users, Calendar,
    UserCheck, ChevronRight, Save, Mail, RefreshCw,
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';
import { showSuccessToast, showErrorToast } from '../store/useToastStore';
import { adminListBusinesses, adminUpdateBusiness, adminResetPassword } from '../services/adminService';

const STATUS_META = {
    active:    { label: 'Activo',     cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
    trial:     { label: 'Trial',      cls: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
    suspended: { label: 'Suspendido', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
    cancelled: { label: 'Cancelado',  cls: 'bg-red-500/10 text-red-700 border-red-500/20' },
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

function Badge({ value, meta }) {
    const m = meta[value] ?? { label: value, cls: 'bg-navy-900/5 text-navy-900/50 border-navy-900/10' };
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${m.cls}`}>
            {m.label}
        </span>
    );
}

function MetricBar({ label, count, max, icon: Icon }) {
    const pct = max ? Math.min((count / max) * 100, 100) : 0;
    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-navy-900/5 flex items-center justify-center flex-shrink-0">
                        <Icon size={13} className="text-navy-900/50" />
                    </div>
                    <span className="text-[11px] font-bold text-navy-700/60 uppercase tracking-wider">{label}</span>
                </div>
                <span className="text-[13px] font-bold text-navy-900">
                    {count} <span className="text-navy-900/30 font-medium text-[11px]">/ {max ?? '∞'}</span>
                </span>
            </div>
            {!!max && (
                <div className="w-full h-1.5 bg-navy-900/5 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-amber-500' : 'bg-navy-900/30'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
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
    const profile = useAppStore(s => s.profile);

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
        setForm({
            name: biz.name ?? '',
            business_type: biz.business_type ?? '',
            timezone: biz.timezone ?? 'America/Guatemala',
            plan_status: biz.plan_status ?? 'active',
            plan_id: biz.plans?.id ?? '',
            notification_email: biz.notification_email ?? '',
        });
    }

    async function handleSave() {
        if (!selected || !form) return;
        setSaving(true);
        try {
            const updated = await adminUpdateBusiness(selected.id, form);
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
                    <button
                        onClick={load}
                        disabled={loading}
                        className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/60 bg-white/30 hover:bg-white/60 text-navy-900/40 hover:text-navy-900 transition-all duration-200 disabled:opacity-40"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <span className="text-[11px] text-navy-700/40 font-medium hidden sm:block">{businesses.length} negocios</span>
                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/60 bg-white/30 hover:bg-white/60 text-[11px] font-bold text-navy-900/50 hover:text-navy-900 transition-all duration-200 uppercase tracking-widest"
                    >
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
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar negocio o email..."
                            className="glass-input w-full pl-9 pr-3 py-2.5 text-[12px]"
                        />
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
                                <button
                                    key={biz.id}
                                    onClick={() => selectBusiness(biz)}
                                    className={`w-full text-left px-3.5 py-3 rounded-2xl border transition-all duration-200 group flex items-center gap-3 ${
                                        isActive
                                            ? 'bg-navy-900 border-navy-900/20 shadow-card'
                                            : 'bg-white/40 border-white/60 hover:bg-white/60'
                                    }`}
                                >
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-navy-900/10 text-navy-900'
                                    }`}>
                                        {(biz.name ?? 'N').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[12px] font-bold leading-none truncate ${isActive ? 'text-white' : 'text-navy-900'}`}>
                                            {biz.name}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${isActive ? 'bg-white/20 text-white border-white/20' : sMeta.cls}`}>
                                                {sMeta.label}
                                            </span>
                                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${isActive ? 'bg-white/10 text-white/60 border-white/10' : tMeta.cls}`}>
                                                {tMeta.label}
                                            </span>
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
                    {!selected ? (
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
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="text-xl font-bold text-navy-900 leading-tight">{selected.name}</h2>
                                        <Badge value={selected.plan_status} meta={STATUS_META} />
                                        <Badge value={selected.plans?.tier} meta={TIER_META} />
                                    </div>
                                    <p className="text-[12px] text-navy-700/50 font-medium">
                                        ID: <span className="font-mono">{selected.id}</span> · Creado {new Date(selected.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-navy-800 transition-colors duration-200 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={13} />
                                    )}
                                    Guardar
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                {/* Metrics column */}
                                <div className="space-y-2">
                                    <MetricBar
                                        label="Pacientes"
                                        count={selected.patient_count ?? 0}
                                        max={selected.plans?.max_patients}
                                        icon={Users}
                                    />
                                    <MetricBar
                                        label="Turnos"
                                        count={selected.appointment_count ?? 0}
                                        max={selected.plans?.max_appointments}
                                        icon={Calendar}
                                    />
                                    <MetricBar
                                        label="Staff activo"
                                        count={selected.staff_count ?? 0}
                                        max={selected.plans?.max_staff}
                                        icon={UserCheck}
                                    />
                                    {selected.plans && (
                                        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-4">
                                            <p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-2">Plan actual</p>
                                            <p className="text-[15px] font-bold text-navy-900">{selected.plans.name}</p>
                                            <p className="text-[12px] text-navy-700/50 font-medium mt-0.5">
                                                ${selected.plans.monthly_price}/mes · {selected.plans.tier}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Edit form */}
                                <div className="lg:col-span-2 bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-5 space-y-4">
                                    <p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest">Datos del negocio</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-1.5">Nombre</label>
                                            <input
                                                value={form.name}
                                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                                className="glass-input w-full text-[13px]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-1.5">Tipo de negocio</label>
                                            <input
                                                value={form.business_type}
                                                onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}
                                                className="glass-input w-full text-[13px]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-1.5">Zona horaria</label>
                                            <select
                                                value={form.timezone}
                                                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                                                className="glass-input w-full text-[13px]"
                                            >
                                                {TIMEZONES.map(tz => (
                                                    <option key={tz} value={tz}>{tz}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-1.5">Plan</label>
                                            <select
                                                value={form.plan_id}
                                                onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}
                                                className="glass-input w-full text-[13px]"
                                            >
                                                <option value="">— Sin plan —</option>
                                                {plans.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.tier}) · ${p.monthly_price}/mes
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-1.5">Estado</label>
                                            <select
                                                value={form.plan_status}
                                                onChange={e => setForm(f => ({ ...f, plan_status: e.target.value }))}
                                                className="glass-input w-full text-[13px]"
                                            >
                                                {STATUSES.map(s => (
                                                    <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-bold text-navy-700/50 uppercase tracking-wider mb-1.5">Email de notificaciones</label>
                                            <input
                                                value={form.notification_email}
                                                onChange={e => setForm(f => ({ ...f, notification_email: e.target.value }))}
                                                type="email"
                                                className="glass-input w-full text-[13px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Admin user */}
                            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-5">
                                <p className="text-[11px] font-bold text-navy-700/50 uppercase tracking-widest mb-4">Administrador del negocio</p>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-navy-900/5 border border-white/60 flex items-center justify-center text-[12px] font-bold text-navy-900/60 flex-shrink-0">
                                            {(selected.admin_name ?? selected.notification_email ?? 'A').slice(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-bold text-navy-900">
                                                {selected.admin_name ?? '—'}
                                            </p>
                                            <p className="text-[11px] text-navy-700/50 font-medium">
                                                {selected.admin_email ?? selected.notification_email ?? '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleResetPassword}
                                        disabled={resetting || (!selected.admin_email && !selected.notification_email)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/60 bg-white/30 hover:bg-white/60 text-[11px] font-bold text-navy-900/60 hover:text-navy-900 transition-all duration-200 disabled:opacity-40 uppercase tracking-widest flex-shrink-0"
                                    >
                                        {resetting ? (
                                            <div className="w-3.5 h-3.5 border-2 border-navy-900/20 border-t-navy-900 rounded-full animate-spin" />
                                        ) : (
                                            <Mail size={13} />
                                        )}
                                        Reset contraseña
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}
