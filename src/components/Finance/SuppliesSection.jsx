import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Package, ChefHat, Search } from 'lucide-react';
import { getServiceRecipe, setServiceRecipe } from '../../services/supabaseService';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, TextInput, AmountInput, ModalButtons, money } from './financeUi';

// ── Botón estilo lista "IA pausada" (pill glass + glows + label expandible) ──
function PillBtn({ icon: Icon, label, onClick, tone = 'default' }) {
    const tones = {
        default: 'text-navy-700 hover:bg-white',
        danger: 'text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white',
        emerald: 'text-emerald-600 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white',
    };
    return (
        <button onClick={onClick} title={label}
            className={`relative overflow-hidden group/pb h-8 flex items-center justify-center gap-0 hover:gap-1.5 px-2.5 hover:px-3 bg-white/40 backdrop-blur-2xl border border-white/60 text-[10px] font-bold rounded-full shadow-md transition-all duration-300 shrink-0 ${tones[tone]}`}>
            <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-3 -left-3 w-9 h-9 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
            <Icon size={13} className="shrink-0 relative z-10" />
            <span className="max-w-0 overflow-hidden group-hover/pb:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">{label}</span>
        </button>
    );
}

// Barra de búsqueda con el mismo estilo/dimensión que el módulo de Ofertas
function OffersSearch({ value, onChange, placeholder }) {
    return (
        <div className="relative flex-1 h-9 min-w-0">
            <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-navy-700"><Search size={14} strokeWidth={2.5} /></div>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full pl-10 pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-md" />
        </div>
    );
}

// Panel glass tipo Ofertas (header con título estilo Estadísticas + búsqueda + listado)
function Panel({ icon: Icon, title, action, searchValue, searchOnChange, searchPlaceholder, children }) {
    return (
        <div className="relative bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md flex flex-col overflow-hidden min-h-[360px] lg:min-h-0">
            <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="relative z-10 p-4 pb-3 shrink-0 flex items-center gap-2">
                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-9 h-9 rounded-2xl bg-navy-900/5 border border-navy-900/10 flex items-center justify-center text-navy-800 shrink-0"><Icon size={16} /></div>
                    <h3 className="text-[13px] font-bold text-navy-800 leading-none tracking-tight whitespace-nowrap">{title}</h3>
                </div>
                <OffersSearch value={searchValue} onChange={searchOnChange} placeholder={searchPlaceholder} />
                {action}
            </div>
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 pb-3 pt-1 space-y-3">{children}</div>
        </div>
    );
}

function Ficha({ children }) {
    return (
        <div className="relative overflow-hidden flex items-center gap-3 p-3.5 rounded-2xl border bg-white/40 backdrop-blur-2xl border-white/60 shadow-md hover:bg-white/60 transition-all">
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
            <div className="relative z-10 flex items-center gap-3 w-full min-w-0">{children}</div>
        </div>
    );
}
function Avatar({ text }) {
    return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900">
            {(text?.[0] || '?').toUpperCase()}
        </div>
    );
}

// ── Modal: crear / editar insumo ──
function SupplyModal({ initial, onClose, onSave }) {
    const [form, setForm] = useState(initial || { name: '', unit: 'unidad', unit_cost: '', category: '' });
    const [saving, setSaving] = useState(false);
    async function submit() {
        if (!form.name.trim()) { showErrorToast('Falta nombre', 'Ingresa el nombre del insumo.'); return; }
        setSaving(true);
        try { await onSave({ ...form, unit_cost: Number(form.unit_cost) || 0 }); onClose(); }
        catch (err) { showErrorToast('No se pudo guardar', err.message || ''); setSaving(false); }
    }
    return (
        <ModalShell title={initial ? 'Editar insumo' : 'Nuevo insumo'} subtitle="Material o costo que consume tu negocio (sirve para cualquier rubro)."
            onClose={onClose} footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Guardar" loading={saving} />}>
            <div>
                <FieldLabel title="Nombre" subtitle="¿Cómo se llama el insumo? (ej: tinte, anestesia, guantes)" />
                <TextInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nombre del insumo" autoFocus maxLength={80} />
            </div>
            <div>
                <FieldLabel title="Costo unitario" subtitle="Cuánto te cuesta una unidad de este insumo." />
                <AmountInput value={form.unit_cost} onChange={v => setForm(f => ({ ...f, unit_cost: v }))} />
            </div>
            <div>
                <FieldLabel title="Unidad" subtitle="Cómo se mide: unidad, ml, g, hora…" />
                <TextInput value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} placeholder="unidad" maxLength={20} />
            </div>
            <div>
                <FieldLabel title="Categoría" subtitle="Opcional, para agrupar tus insumos." />
                <TextInput value={form.category || ''} onChange={v => setForm(f => ({ ...f, category: v }))} placeholder="Opcional" maxLength={40} />
            </div>
        </ModalShell>
    );
}

// ── Modal: receta (BOM) por servicio. El costo total se ve siempre (footer fijo). ──
function RecipeModal({ service, supplies, onClose, onSaved }) {
    const [qty, setQty] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let alive = true;
        getServiceRecipe(service.id)
            .then(rows => { if (alive) setQty(Object.fromEntries(rows.map(r => [r.supply_id, String(r.quantity)]))); })
            .catch(() => { })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [service.id]);

    const total = supplies.reduce((s, sp) => s + (Number(qty[sp.id]) || 0) * Number(sp.unit_cost || 0), 0);

    async function save() {
        setSaving(true);
        try {
            const items = Object.entries(qty).map(([supply_id, q]) => ({ supply_id, quantity: Number(q) })).filter(it => it.quantity > 0);
            await setServiceRecipe(service.id, items);
            showSuccessToast('Receta guardada', `Costo: ${money(total)}`);
            onSaved?.(); onClose();
        } catch (err) { showErrorToast('No se pudo guardar', err.message || ''); setSaving(false); }
    }

    return (
        <ModalShell
            title={`Receta · ${service.name}`}
            subtitle="Cantidad de cada insumo que consume este servicio."
            onClose={onClose}
            footer={
                <div className="w-full flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[12px] font-bold text-navy-700/60">Costo del servicio</span>
                        <span className="text-sm font-bold text-navy-900 tabular-nums">{money(total)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                        <ModalButtons onCancel={onClose} onConfirm={save} confirmLabel="Guardar receta" loading={saving} />
                    </div>
                </div>
            }>
            {loading ? (
                <p className="text-[12px] text-navy-700/40 text-center py-8">Cargando…</p>
            ) : supplies.length === 0 ? (
                <p className="text-[12px] text-navy-700/40 text-center py-8">Primero crea insumos en el catálogo.</p>
            ) : (
                supplies.map(sp => (
                    <div key={sp.id} className="flex items-center gap-3 bg-white/45 border border-white/60 rounded-2xl px-3 py-2 shadow-sm">
                        <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-bold text-navy-900 truncate">{sp.name}</div>
                            <div className="text-[10px] font-semibold text-navy-700/50">{money(sp.unit_cost)} / {sp.unit}</div>
                        </div>
                        <input type="number" min="0" step="0.001" value={qty[sp.id] || ''} onChange={e => setQty(q => ({ ...q, [sp.id]: e.target.value }))} placeholder="0"
                            className="w-20 bg-white/60 border border-white/70 rounded-full px-3 py-1.5 text-[12px] font-semibold text-navy-900 text-center outline-none focus:bg-white focus:ring-1 focus:ring-white transition-all shadow-sm" />
                    </div>
                ))
            )}
        </ModalShell>
    );
}

export default function SuppliesSection({ supplies, services, canManage, costForService, create, update, remove, onReload }) {
    const [supplyModal, setSupplyModal] = useState(null);
    const [recipeService, setRecipeService] = useState(null);
    const [supplyQ, setSupplyQ] = useState('');
    const [serviceQ, setServiceQ] = useState('');

    const filteredSupplies = supplies.filter(s => s.name.toLowerCase().includes(supplyQ.toLowerCase().trim()));
    const filteredServices = services.filter(s => s.name.toLowerCase().includes(serviceQ.toLowerCase().trim()));

    async function removeSupply(s) {
        if (!window.confirm(`¿Eliminar el insumo "${s.name}"? Se quitará de las recetas que lo usen.`)) return;
        try { await remove(s.id); showSuccessToast('Insumo eliminado', ''); onReload?.(); }
        catch (err) { showErrorToast('No se pudo eliminar', err.message || ''); }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:h-full">
            {/* Panel Insumos */}
            <Panel
                icon={Package} title="Insumos"
                searchValue={supplyQ} searchOnChange={setSupplyQ} searchPlaceholder="Buscar insumo..."
                action={canManage && <PillBtn icon={Plus} label="Nuevo" onClick={() => setSupplyModal(true)} />}
            >
                {filteredSupplies.length === 0 ? (
                    <p className="text-[12px] font-semibold text-navy-700/40 text-center py-8">{supplyQ ? 'Sin coincidencias.' : 'Sin insumos. Crea el primero.'}</p>
                ) : filteredSupplies.map(s => (
                    <Ficha key={s.id}>
                        <Avatar text={s.name} />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-navy-900 truncate">{s.name}</div>
                            <div className="text-[11px] font-bold text-navy-700/60 mt-0.5">{money(s.unit_cost)} / {s.unit}{s.category ? ` · ${s.category}` : ''}</div>
                        </div>
                        {canManage && (
                            <div className="flex items-center gap-1.5 shrink-0">
                                <PillBtn icon={Pencil} label="Editar" onClick={() => setSupplyModal({ edit: s })} />
                                <PillBtn icon={Trash2} label="Eliminar" tone="danger" onClick={() => removeSupply(s)} />
                            </div>
                        )}
                    </Ficha>
                ))}
            </Panel>

            {/* Panel Recetas */}
            <Panel
                icon={ChefHat} title="Recetas"
                searchValue={serviceQ} searchOnChange={setServiceQ} searchPlaceholder="Buscar servicio..."
            >
                {filteredServices.length === 0 ? (
                    <p className="text-[12px] font-semibold text-navy-700/40 text-center py-8">{serviceQ ? 'Sin coincidencias.' : 'No hay servicios.'}</p>
                ) : filteredServices.map(svc => {
                    const cost = costForService(svc.id);
                    const price = Number(svc.price || 0);
                    const margin = price > 0 ? ((price - cost) / price) * 100 : null;
                    return (
                        <Ficha key={svc.id}>
                            <Avatar text={svc.name} />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-navy-900 truncate">{svc.name}</div>
                                <div className="text-[11px] font-bold text-navy-700/60 mt-0.5">
                                    Precio {money(price)} · Costo {money(cost)}
                                    {margin != null && <span className={margin >= 0 ? 'text-emerald-600' : 'text-rose-500'}> · {margin.toFixed(0)}%</span>}
                                </div>
                            </div>
                            {canManage && <PillBtn icon={ChefHat} label="Receta" onClick={() => setRecipeService(svc)} />}
                        </Ficha>
                    );
                })}
            </Panel>

            {supplyModal && (
                <SupplyModal
                    initial={supplyModal.edit || null}
                    onClose={() => setSupplyModal(null)}
                    onSave={async (fields) => {
                        if (supplyModal.edit) { await update(supplyModal.edit.id, fields); showSuccessToast('Insumo actualizado', ''); }
                        else { await create(fields); showSuccessToast('Insumo creado', ''); }
                        onReload?.();
                    }}
                />
            )}
            {recipeService && (
                <RecipeModal service={recipeService} supplies={supplies.filter(s => s.active)} onClose={() => setRecipeService(null)} onSaved={onReload} />
            )}
        </div>
    );
}
