import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Plus, Copy, Check, Trash2, MessageCircle, X, Search, Clock3, CheckCircle2, FileDown, CalendarDays } from 'lucide-react';
import { getVouchers, createVoucher, cancelVoucher, searchPatients, getServices, getBusinessInfo } from '../../services/supabaseService';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { ModalShell, FieldLabel, TextInput, OptionWheel, CentsAmountInput, decimalToCents, centsToDecimal, ModalButtons } from './financeUi';
import { formatPhone } from '../../utils/format';

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const money = (n) => `Q${Number(n || 0).toFixed(2)}`;
const METHOD_LABEL = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };
const STATUS_META = {
    pending:   { label: 'Pendiente', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
    redeemed:  { label: 'Cobrado',   cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
    cancelled: { label: 'Cancelado', cls: 'bg-navy-900/5 text-navy-900/40 border-navy-900/10' },
    expired:   { label: 'Vencido',   cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
};

function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Botón de acción con etiqueta que aparece al hover (mismo lenguaje del sistema).
function ActionBtn({ icon: Icon, label, onClick, accent = 'text-navy-700 hover:bg-white/80', spin = false }) {
    return (
        <button onClick={onClick} title={label}
            className={`group/act flex items-center h-8 px-2.5 rounded-full bg-white/50 border border-white/70 shadow-sm transition-all duration-300 ${accent}`}>
            <Icon size={13} className={`shrink-0 ${spin ? 'animate-spin' : ''}`} />
            <span className="max-w-0 overflow-hidden group-hover/act:max-w-[90px] group-hover/act:ml-1.5 transition-all duration-300 whitespace-nowrap text-[10px] font-bold">{label}</span>
        </button>
    );
}

// Comprobante imprimible (PDF vía diálogo del navegador). Replica de recibo:
// cliente, servicio, concepto, fechas, método y monto — sin dependencias nuevas.
function exportVoucherPDF(v, methods, businessName) {
    const methodCode = v.redeemed_income?.payment_method;
    const methodLabel = methods.find(m => m.code === methodCode)?.label || METHOD_LABEL[methodCode] || '—';
    const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = [
        ['Cliente', v.patients?.display_name || 'Consumidor final'],
        ['Servicio', v.service_name || (v.payment_plans?.description ? `Abono a "${v.payment_plans.description}"` : '—')],
        v.note ? ['Concepto', v.note] : null,
        ['Emitido', fmt(v.created_at)],
        ['Cobrado', fmt(v.redeemed_at)],
        ['Método de pago', methodLabel],
    ].filter(Boolean);
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Voucher ${esc(v.code)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color:#0F2044; padding:36px 32px; max-width:420px; margin:0 auto; }
  .biz { font-size:15px; font-weight:800; letter-spacing:.02em; }
  .doc { font-size:10px; font-weight:700; color:#0F204466; text-transform:uppercase; letter-spacing:.18em; margin-top:2px; }
  .code { font-family:'Consolas','Courier New',monospace; font-size:26px; font-weight:800; letter-spacing:.35em; margin:18px 0 4px; }
  .chip { display:inline-block; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; border:1.5px solid #10B981; color:#059669; border-radius:999px; padding:3px 10px; }
  table { width:100%; border-collapse:collapse; margin-top:20px; }
  td { padding:9px 0; font-size:12px; border-bottom:1px dashed #0F204422; vertical-align:top; }
  td.k { color:#0F204480; font-weight:700; width:38%; }
  td.v { font-weight:700; text-align:right; }
  .total { display:flex; justify-content:space-between; align-items:baseline; margin-top:20px; padding-top:14px; border-top:2px solid #0F2044; }
  .total .l { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.14em; }
  .total .m { font-size:26px; font-weight:800; }
  .foot { margin-top:28px; font-size:9.5px; color:#0F204466; font-weight:600; line-height:1.6; text-align:center; }
  @media print { body { padding:24px 16px; } }
</style></head><body>
  <div class="biz">${esc(businessName || 'NovTurnIA')}</div>
  <div class="doc">Comprobante de pago</div>
  <div class="code">${esc(v.code)}</div>
  <span class="chip">Pago recibido</span>
  <table>${rows.map(([k, val]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(val)}</td></tr>`).join('')}</table>
  <div class="total"><span class="l">Total pagado</span><span class="m">${esc(money(v.amount))}</span></div>
  <div class="foot">Voucher ${esc(v.code)} · Generado con NovTurnIA<br>Este comprobante no sustituye una factura fiscal.</div>
<script>window.onload = () => setTimeout(() => window.print(), 150);</script>
</body></html>`;
    const w = window.open('', '_blank', 'width=460,height=700');
    if (!w) { showErrorToast('Ventana bloqueada', 'Permite ventanas emergentes para exportar el comprobante.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
}

// Vouchers de pago: código único compartible al paciente. Los genera el staff a
// mano o el propio cobro de turnos (fusión: nace pendiente en "Por confirmar").
// El cobro de un voucher ligado a un turno se confirma únicamente en Por
// confirmar — aquí ya no hay botón/ventana para cobrarlo directo.
export default function VouchersSection({ canManage, methods = [] }) {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('pending');
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [copied, setCopied] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [pendingCancel, setPendingCancel] = useState(null);
    const [businessName, setBusinessName] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try { setList(await getVouchers(filter)); }
        catch (err) { if (err.code !== '42P01') showErrorToast('Error al cargar', err.message || ''); setList([]); }
        finally { setLoading(false); }
    }, [filter]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { getBusinessInfo().then(b => setBusinessName(b?.name || '')).catch(() => {}); }, []);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter(v =>
            v.code.toLowerCase().includes(q)
            || v.patients?.display_name?.toLowerCase().includes(q)
            || v.service_name?.toLowerCase().includes(q)
        );
    }, [list, query]);

    function copyCode(code) {
        navigator.clipboard?.writeText(code);
        setCopied(code);
        setTimeout(() => setCopied(null), 1500);
    }
    // Chat del cliente dentro del dashboard (Conversaciones) — ya no WhatsApp
    // externo, conserva el ?bid= de la URL como el resto de accesos directos.
    function goToChat(v) {
        if (!v.patient_id) return;
        const bid = new URLSearchParams(window.location.search).get('bid');
        const path = `/conversations?patient=${v.patient_id}`;
        navigate(bid ? `${path}&bid=${bid}` : path);
    }

    return (
        <div className="relative h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex flex-col overflow-hidden animate-fade-up">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '45%', height: '45%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '45%', height: '45%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />

            {/* Barra superior — continua con el listado, sin divisor */}
            <div className="relative z-10 flex items-center justify-between gap-2 p-4 pb-2 flex-wrap">
                {/* Doble botón con iconos (mismo estilo que los toggles de Finanzas) */}
                <div className="flex items-center gap-1 h-10 bg-white/30 backdrop-blur-2xl border border-white/50 rounded-full p-1 shadow-sm text-[11px] font-bold">
                    <button onClick={() => setFilter('pending')}
                        className={`h-full px-4 flex items-center gap-1.5 rounded-full transition-all ${filter === 'pending' ? 'bg-white/70 border border-white/80 text-navy-900 shadow-sm' : 'text-navy-900/40 hover:text-navy-900/70'}`}>
                        <Clock3 size={12} /> Pendientes
                    </button>
                    <button onClick={() => setFilter('redeemed')}
                        className={`h-full px-4 flex items-center gap-1.5 rounded-full transition-all ${filter === 'redeemed' ? 'bg-white/70 border border-white/80 text-navy-900 shadow-sm' : 'text-navy-900/40 hover:text-navy-900/70'}`}>
                        <CheckCircle2 size={12} /> Cobrados
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Búsqueda por código */}
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-900/30 pointer-events-none" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar código…"
                            className="h-10 w-36 focus:w-52 transition-all duration-300 pl-8 pr-3 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full text-[11px] font-bold text-navy-900 outline-none placeholder:text-navy-900/30 placeholder:font-semibold shadow-md focus:bg-white/60" />
                    </div>

                    {canManage && (
                        <button onClick={() => setShowCreate(true)}
                            className="relative overflow-hidden group h-10 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md active:scale-95 transition-all duration-300 outline-none">
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                            <Plus size={14} className="shrink-0 relative z-10" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[110px] transition-all duration-300 whitespace-nowrap relative z-10">Nuevo voucher</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Listado */}
            <div className={`relative z-10 flex-1 overflow-y-auto custom-scrollbar p-3 pt-2 ${(!loading && visible.length === 0) ? 'flex items-center justify-center' : 'space-y-2'}`}>
                {loading ? (
                    <p className="text-[12px] font-semibold text-navy-700/40 text-center py-10">Cargando…</p>
                ) : visible.length === 0 ? (
                    <div className="text-center px-6">
                        <div className="w-14 h-14 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center mx-auto mb-3"><Ticket size={22} className="text-navy-900/25" /></div>
                        <p className="text-[12px] font-bold text-navy-900/40">
                            {query ? 'Sin resultados para esa búsqueda' : filter === 'pending' ? 'Sin vouchers pendientes' : 'Aún no hay vouchers cobrados'}
                        </p>
                        <p className="text-[11px] text-navy-700/40 font-medium mt-1">
                            {query ? 'Revisa el código e intenta de nuevo.' : filter === 'pending' ? 'Crea uno o cobra un turno: cada cobro genera su voucher.' : 'Al confirmar un pago, su voucher aparecerá aquí.'}
                        </p>
                    </div>
                ) : visible.map(v => {
                    const meta = STATUS_META[v.status] || STATUS_META.pending;
                    const isFusion = !!v.income_id;
                    const detail = [
                        v.patients?.display_name || null,
                        v.service_name || (v.payment_plans?.description ? `abono a "${v.payment_plans.description}"` : null),
                        !v.service_name && !v.payment_plans && v.note ? v.note : null,
                    ].filter(Boolean).join(' · ');
                    return (
                        <div key={v.id} className="flex items-center gap-3 bg-white/40 border border-white/60 rounded-2xl px-4 py-3 hover:bg-white/55 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-900 shrink-0">
                                <Ticket size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-[14px] font-bold text-navy-900 tracking-widest">{v.code}</span>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${meta.cls}`}>{meta.label}</span>
                                    {isFusion && (
                                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-0.5 bg-navy-900/5 border-navy-900/10 text-navy-900/45">
                                            <CalendarDays size={9} /> Turno
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] font-semibold text-navy-700/55 truncate mt-0.5">
                                    {detail || 'Sin detalle'}
                                </p>
                                <p className="text-[9.5px] font-bold text-navy-900/30 mt-0.5">
                                    Emitido {fmtDate(v.created_at)}{v.redeemed_at ? ` · cobrado ${fmtDate(v.redeemed_at)}` : ''}
                                </p>
                            </div>
                            <span className="text-[14px] font-bold text-navy-900 tabular-nums shrink-0">{money(v.amount)}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {v.status === 'pending' && (
                                    <>
                                        <ActionBtn icon={copied === v.code ? Check : Copy} label={copied === v.code ? 'Copiado' : 'Copiar'} onClick={() => copyCode(v.code)}
                                            accent={copied === v.code ? 'text-emerald-600' : 'text-navy-700 hover:bg-white/80'} />
                                        {v.patient_id && (
                                            <ActionBtn icon={MessageCircle} label="Chat" onClick={() => goToChat(v)}
                                                accent="text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500" />
                                        )}
                                        {canManage && !isFusion && (
                                            <ActionBtn icon={Trash2} label="Cancelar" onClick={() => setPendingCancel(v)}
                                                accent="text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500" />
                                        )}
                                    </>
                                )}
                                {v.status === 'redeemed' && (
                                    <ActionBtn icon={FileDown} label="PDF" onClick={() => exportVoucherPDF(v, methods, businessName)}
                                        accent="text-navy-700 hover:bg-white/80" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {showCreate && <CreateVoucherModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
            <ConfirmDialog open={!!pendingCancel} danger
                title="¿Cancelar este voucher?"
                message={pendingCancel ? `El código ${pendingCancel.code} (${money(pendingCancel.amount)}) dejará de ser válido.` : ''}
                confirmLabel="Sí, cancelar"
                onConfirm={async () => {
                    try { await cancelVoucher(pendingCancel.id); showSuccessToast('Voucher cancelado', ''); load(); }
                    catch (err) { showErrorToast('No se pudo cancelar', err.message || ''); }
                    finally { setPendingCancel(null); }
                }}
                onCancel={() => setPendingCancel(null)} />
        </div>
    );
}

// Ficha del cliente en el buscador — mismo avatar+nombre+teléfono que el
// selector de "Nuevo turno" (NewAppointmentModal), para que se vea igual.
function PatientSearchField({ patient, onPick, onClear }) {
    const [q, setQ] = useState('');
    const [opts, setOpts] = useState([]);

    useEffect(() => {
        if (patient) return;
        const term = q.trim();
        if (term.length < 2) { setOpts([]); return; }
        const t = setTimeout(() => searchPatients(term, 6).then(setOpts).catch(() => setOpts([])), 250);
        return () => clearTimeout(t);
    }, [q, patient]);

    if (patient) {
        return (
            <div className="flex items-center justify-between bg-white/50 border border-white/60 py-1.5 px-2.5 rounded-full shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-navy-900 flex items-center justify-center text-white text-xs font-bold shadow-md border border-white/20 shrink-0">
                        {getInitials(patient.display_name)}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-navy-900 text-sm leading-none truncate">{patient.display_name || 'Sin nombre'}</span>
                        {patient.phone && <span className="text-xs font-medium text-navy-700/70 leading-none shrink-0">{formatPhone(patient.phone)}</span>}
                    </div>
                </div>
                <button type="button" onClick={onClear} className="text-navy-700 hover:text-navy-900 hover:bg-white/40 rounded-full p-1 transition-colors shrink-0">
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-800">
                <Search size={16} />
            </div>
            <input
                className="w-full bg-white/40 border border-white/60 rounded-full pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar por nombre o teléfono del cliente..."
            />
            {opts.length > 0 && (
                <div className="absolute z-[200] mt-1.5 w-full bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-card overflow-hidden">
                    {opts.map(p => (
                        <button key={p.id} type="button"
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/50 transition-colors border-b border-white/40 last:border-0"
                            onClick={() => { onPick(p); setQ(''); setOpts([]); }}
                        >
                            <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-white text-xs font-bold border border-white/30 shadow-sm shrink-0">
                                {getInitials(p.display_name)}
                            </div>
                            <div className="text-left min-w-0">
                                <div className="font-bold text-navy-900 text-sm leading-tight truncate">{p.display_name || '—'}</div>
                                {p.phone && <div className="text-xs text-navy-700/70 font-medium">{formatPhone(p.phone)}</div>}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function CreateVoucherModal({ onClose, onCreated }) {
    const [amountCents, setAmountCents] = useState(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [services, setServices] = useState([]);
    const [serviceId, setServiceId] = useState('none');
    const [patient, setPatient] = useState(null); // { id, display_name, phone }

    useEffect(() => { getServices().then(s => setServices(s || [])).catch(() => {}); }, []);

    const serviceOptions = [{ id: 'none', label: 'Sin servicio' }, ...services.map(s => ({ id: s.id, label: s.name }))];

    function pickService(id) {
        setServiceId(id);
        const svc = services.find(s => s.id === id);
        if (svc && !amountCents && Number(svc.price) > 0) setAmountCents(decimalToCents(svc.price));
    }

    async function submit() {
        if (!amountCents || amountCents <= 0) { showErrorToast('Monto inválido', 'Ingresa un monto mayor a 0.'); return; }
        setBusy(true);
        try {
            const svc = services.find(s => s.id === serviceId);
            const v = await createVoucher({
                amount: centsToDecimal(amountCents),
                note: note.trim() || null,
                patient_id: patient?.id || null,
                service_name: svc?.name || null,
            });
            showSuccessToast('Voucher creado', `Código ${v.code} por ${money(v.amount)}.`);
            onCreated();
        } catch (err) { showErrorToast('No se pudo crear', err.message || ''); }
        finally { setBusy(false); }
    }

    return (
        <ModalShell
            title="Nuevo voucher"
            subtitle="Código de pago compartible con el cliente."
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Crear voucher" loading={busy} confirmIcon={Plus} />}
        >
            <div>
                <FieldLabel title="Cliente" subtitle="Opcional: liga el voucher a un cliente del sistema." />
                <PatientSearchField patient={patient} onPick={setPatient} onClear={() => setPatient(null)} />
            </div>
            <div>
                <FieldLabel title="Servicio" subtitle="Opcional: precarga el monto del servicio elegido." />
                <OptionWheel options={serviceOptions} value={serviceId} onChange={pickService} />
            </div>
            <div>
                <FieldLabel title="Monto" subtitle="Total que el cliente debe pagar con este voucher." />
                <CentsAmountInput cents={amountCents} onChange={setAmountCents} autoFocus />
            </div>
            <div>
                <FieldLabel title="Concepto" subtitle="Opcional: detalle corto del cobro." />
                <TextInput value={note} onChange={setNote} maxLength={80} placeholder="Ej. Anticipo consulta" />
            </div>
        </ModalShell>
    );
}
