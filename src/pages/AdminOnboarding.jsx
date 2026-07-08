import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminOnboardTenant } from '../services/adminService';
import { showTenantNewToast, showValidationToast, showErrorToast } from '../store/useToastStore';
import { Building2, User, Lock, Globe, Clock, ArrowLeft, MessageSquare, Phone, KeyRound, Eye, EyeOff } from 'lucide-react';

const PLANS = ['basic', 'pro', 'enterprise'];
const TIMEZONES = [
    'America/Guatemala', 'America/Mexico_City', 'America/Bogota',
    'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires',
    'America/Caracas', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
];

const DAYS = [
    { value: 0, label: 'Dom' },
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
];

export default function AdminOnboarding() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        business_name: '',
        admin_email: '',
        admin_name: '',
        admin_password: '',
        plan: 'basic',
        timezone: 'America/Guatemala',
        schedule_start: '09:00',
        schedule_end: '18:00',
        schedule_days: [1, 2, 3, 4, 5],
        phone_number_id: '',
        whatsapp_token: '',
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [showToken, setShowToken] = useState(false);

    function toggleDay(day) {
        setForm(f => ({
            ...f,
            schedule_days: f.schedule_days.includes(day)
                ? f.schedule_days.filter(d => d !== day)
                : [...f.schedule_days, day].sort(),
        }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (form.admin_password.length < 8) {
            showValidationToast('Contraseña inválida', 'La contraseña debe tener al menos 8 caracteres.');
            return;
        }
        setLoading(true);
        setResult(null);
        try {
            // fetch directo con timeout — no puede colgarse por el navigator lock
            // de gotrue como le pasaba a supabase.functions.invoke (2026-07-05).
            const data = await adminOnboardTenant(form);

            setResult(data);
            showTenantNewToast(data.message);
            setForm(f => ({ ...f, business_name: '', admin_email: '', admin_name: '', admin_password: '', phone_number_id: '', whatsapp_token: '' }));
        } catch (err) {
            showErrorToast('Error al crear tenant', err.message);
        } finally {
            setLoading(false);
        }
    }

    const inputClass = "w-full bg-white/60 backdrop-blur-card border border-white/90 rounded-2xl px-4 py-3 text-sm font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/80 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/40";
    const labelClass = "text-[11px] font-bold text-navy-700/60 uppercase tracking-wider mb-1.5 block";

    return (
        <div className="h-full flex flex-col max-w-2xl mx-auto w-full pt-2 px-0">
            <button type="button" onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 text-[11px] font-bold text-navy-700/50 hover:text-navy-900 uppercase tracking-widest mb-4 transition-colors w-fit">
                <ArrowLeft size={13} /> Volver al panel
            </button>
            <div className="mb-6">
                <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Nuevo Tenant</h1>
                <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Onboarding de nuevo negocio — solo super-admin</p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar pr-3 space-y-6 pb-8">
                {/* Negocio */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[28px] p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Building2 size={16} className="text-navy-900/60" />
                        <span className="text-sm font-bold text-navy-900">Datos del negocio</span>
                    </div>

                    <div>
                        <label className={labelClass}>Nombre del negocio *</label>
                        <input className={inputClass} placeholder="Clínica Dental San Juan" required
                            value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Plan</label>
                            <select className={inputClass} value={form.plan}
                                onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                                {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Timezone</label>
                            <select className={inputClass} value={form.timezone}
                                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Horario */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[28px] p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-navy-900/60" />
                        <span className="text-sm font-bold text-navy-900">Horario de atención</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Apertura</label>
                            <input type="time" className={inputClass} value={form.schedule_start}
                                onChange={e => setForm(f => ({ ...f, schedule_start: e.target.value }))} />
                        </div>
                        <div>
                            <label className={labelClass}>Cierre</label>
                            <input type="time" className={inputClass} value={form.schedule_end}
                                onChange={e => setForm(f => ({ ...f, schedule_end: e.target.value }))} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Días laborables</label>
                        <div className="flex gap-2 flex-wrap">
                            {DAYS.map(d => (
                                <button key={d.value} type="button"
                                    onClick={() => toggleDay(d.value)}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                                        form.schedule_days.includes(d.value)
                                            ? 'bg-navy-900 text-white border-navy-900'
                                            : 'bg-white/60 text-navy-900/60 border-white/80 hover:bg-white/80'
                                    }`}>
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* WhatsApp / Automatización */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[28px] p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare size={16} className="text-navy-900/60" />
                        <span className="text-sm font-bold text-navy-900">WhatsApp / Automatización (n8n)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Phone Number ID</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-900/40" />
                                <input className={`${inputClass} pl-10 font-mono`} placeholder="109876543210987"
                                    value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Access Token</label>
                            <div className="relative">
                                <KeyRound size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-900/40" />
                                <input type={showToken ? 'text' : 'password'} className={`${inputClass} pl-10 pr-10 font-mono`} placeholder="EAAG..."
                                    value={form.whatsapp_token} onChange={e => setForm(f => ({ ...f, whatsapp_token: e.target.value }))} />
                                <button type="button" onClick={() => setShowToken(s => !s)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-navy-900/40 hover:text-navy-900/70">
                                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-navy-700/50 font-semibold">Opcional al crear — se puede configurar después desde el panel del negocio, una vez aprobada la cuenta de WhatsApp Business.</p>
                </div>

                {/* Admin */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[28px] p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <User size={16} className="text-navy-900/60" />
                        <span className="text-sm font-bold text-navy-900">Administrador del negocio</span>
                    </div>

                    <div>
                        <label className={labelClass}>Nombre completo</label>
                        <input className={inputClass} placeholder="Dr. Juan García"
                            value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} />
                    </div>

                    <div>
                        <label className={labelClass}>Email *</label>
                        <input type="email" className={inputClass} placeholder="admin@clinica.com" required
                            value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} />
                    </div>

                    <div>
                        <label className={labelClass}>Contraseña temporal * (mín. 8 caracteres)</label>
                        <div className="relative">
                            <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-900/40" />
                            <input type="password" className={`${inputClass} pl-10`} placeholder="••••••••" required
                                minLength={8}
                                value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} />
                        </div>
                        <p className="text-[10px] text-navy-700/50 font-semibold mt-1.5">El admin deberá cambiar esta contraseña en su primer acceso.</p>
                    </div>
                </div>

                {/* Resultado */}
                {result && (
                    <div className="bg-emerald-50/60 border border-emerald-200/50 rounded-2xl p-4 text-sm text-emerald-700 font-semibold">
                        ✓ {result.message}<br />
                        <span className="text-[11px] text-emerald-600/80">Business ID: {result.business_id} · User ID: {result.admin_user_id}</span>
                    </div>
                )}

                <button type="submit" disabled={loading}
                    className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white text-sm font-bold rounded-full transition-colors shadow-md disabled:opacity-50">
                    {loading ? 'Creando tenant...' : 'Crear tenant'}
                </button>
            </form>
        </div>
    );
}
