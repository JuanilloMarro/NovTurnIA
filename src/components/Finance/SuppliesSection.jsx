import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Package, ChefHat } from 'lucide-react';
import { getServiceRecipe, setServiceRecipe } from '../../services/supabaseService';
import { showSuccessToast, showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, TextInput, AmountInput, ModalButtons, money } from './financeUi';

function OfferButton({ icon: Icon, label, onClick }) {
    return (
        <button onClick={onClick}
            className="relative overflow-hidden group h-9 flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-md transition-all duration-300 outline-none">
            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
            <Icon size={14} className="shrink-0 relative z-10" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-[80px] transition-all duration-300 whitespace-nowrap relative z-10">{label}</span>
        </button>
    );
}

function Ficha({ children }) {
    return (
        <div className="relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl border bg-white/40 backdrop-blur-2xl border-white/60 shadow-md hover:bg-white/60 transition-all">
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-5 -left-5 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
            <div className="relative z-10 flex items-center gap-3 w-full min-w-0">{children}</div>
        </div>
    );
}

function Avatar({ text }) {
    return (
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border bg-gradient-to-b from-white to-gray-100 border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0px_rgba(255,255,255,1)] text-navy-900">
            {(text?.[0] || '?').toUpperCase()}
        </div>
    );
}

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
        <ModalShell
            title={initial ? 'Editar insumo' : 'Nuevo insumo'}
            subtitle="Material o costo que consume tu negocio (sirve para cualquier rubro)."
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Guardar" loading={saving} />}
        >
            <div>
                <FieldLabel title="Nombre" subtitle="Como se llama el insumo? (ej: tinte, anestesia, guantes)" />
                <TextInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nombre del insumo" autoFocus maxLength={80} />
            </div>
            <div>
                <FieldLabel title="Costo unitario" subtitle="Cuanto te cuesta una unidad de este insumo." />
                <AmountInput value={form.unit_cost} onChange={v => setForm(f => ({ ...f, unit_cost: v }))} />
            </div>
            <div>
                <FieldLabel title="Unidad" subtitle="Como se mide: unidad, ml, g, hora..." />
                <TextInput value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} placeholder="unidad" maxLength={20} />
            </div>
            <div>
                <FieldLabel title="Categoria" subtitle="Opcional, para agrupar tus insumos." />
                <TextInput value={form.category || ''} onChange={v => setForm(f => ({ ...f, category: v }))} placeholder="Opcional" maxLength={40} />
            </div>
        </ModalShell>
    );
}

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
            showSuccessToast('Receta guardada', 'Costo: ' + money(total));
            onSaved?.(); onClose();
        } catch (err) { showErrorToast('No se pudo guardar', err.message || ''); setSaving(false); }
    }

    return (
        <ModalShell
            title={'Receta - ' + service.name}
            subtitle="Cantidad de cada insumo que consume este servicio."
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={save} confirmLabel="Guardar receta" loading={saving} />}
        >
            {loading ? (
                <p className="text-[12px] text-navy-700/40 text-center py-8">Cargando...</p>
            ) : supplies.length === 0 ? (
                <p className="text-[12px] text-navy-700/40 text-center py-8">Primero crea insumos en el catalogo.</p>
            ) : (
                <>
                    {supplies.map(sp => (
                        <div key={sp.id} className="flex items-center gap-3 bg-white/45 border border-white/60 rounded-2xl px-3 py-2 shadow-sm">
                            <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-bold text-navy-900 truncate">{sp.name}</div>
                                <div className="text-[10px] font-semibold text-navy-700/50">{money(sp.unit_cost)} / {sp.unit}</div>
                            </div>
                            <input type="number" min="0" step="0.001" value={qty[sp.id] || ''} onChange={e => setQty(q => ({ ...q, [sp.id]: e.target.value }))} placeholder="0"
                                className="w-20 bg-white/60 border border-white/70 rounded-full px-3 py-1.5 text-[12px] font-semibold text-navy-900 text-center outline-none focus:bg-white focus:ring-1 focus:ring-white transition-all shadow-sm" />
                        </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 px-1 text-[12px] font-bold text-navy-700/60">
                        Costo del servicio <span className="text-navy-900">{money(total)}</span>
                    </div>
                </>
            )}
        </ModalShell>
    );
}

export default function SuppliesSection({ supplies, services, canManage, costForService, create, update, toggle, remove, onReload }) {
    const [supplyModal, setSupplyModal] = useState(null);
    const [recipeService, setRecipeService] = useState(null);

    async function removeSupply(s) {
        if (!window.confirm('Eliminar el insumo "' + s.name + '"? Se quitara de las recetas que lo usen.')) return;
        try { await remove(s.id); showSuccessToast('Insumo eliminado', ''); onReload?.(); }
        catch (err) { showErrorToast('No se pudo eliminar', err.message || ''); }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full h-[685px] p-6 overflow-y-auto">

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[12px] font-bold text-navy-800 flex items-center gap-2"><Package size={14} /> Insumos</h3>
                    {canManage && <OfferButton icon={Plus} label="Nuevo" onClick={() => setSupplyModal(true)} />}
                </div>
                <div className="space-y-3">
                    {supplies.length === 0 ? (
                        <p className="text-[12px] font-semibold text-navy-700/40 text-center py-8">Sin insumos. Crea el primero.</p>
                    ) : supplies.map(s => (
                        <Ficha key={s.id}>
                            <Avatar text={s.name} />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-navy-900 truncate">{s.name}</div>
                                <div className="text-[11px] font-bold text-navy-700/60 mt-0.5">{money(s.unit_cost)} / {s.unit}{s.category ? ' - ' + s.category : ''}</div>
                            </div>
                            {canManage && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => setSupplyModal({ edit: s })} title="Editar" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 border border-white/60 text-navy-700 hover:bg-white transition-colors shadow-sm"><Pencil size={13} /></button>
                                    <button onClick={() => removeSupply(s)} title="Eliminar" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 border border-white/60 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shadow-sm"><Trash2 size={13} /></button>
                                </div>
                            )}
                        </Ficha>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-[12px] font-bold text-navy-800 flex items-center gap-2 mb-3"><ChefHat size={14} /> Costo por servicio</h3>
                <div className="space-y-3">
                    {services.length === 0 ? (
                        <p className="text-[12px] font-semibold text-navy-700/40 text-center py-8">No hay servicios.</p>
                    ) : services.map(svc => {
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
                                {canManage && <OfferButton icon={ChefHat} label="Receta" onClick={() => setRecipeService(svc)} />}
                            </Ficha>
                        );
                    })}
                </div>
            </div>

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