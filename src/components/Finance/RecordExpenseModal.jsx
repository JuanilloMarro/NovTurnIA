import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import { useFinanceCategories } from '../../hooks/useFinanceCategories';
import { getSupplies } from '../../services/supabaseService';
import { showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, TextInput, AmountInput, DateWheels, OptionWheel, NotesField, ModalButtons, FREQ_OPTIONS, useMethodOptions, todayISO, isoToTimestamp, isoToDateInput } from './financeUi';

// initial = entrada a editar (o null para crear). onSubmit(fields) → Promise.
export default function RecordExpenseModal({ initial = null, onClose, onSubmit }) {
    const editing = !!initial;
    const { categories, loading: catsLoading } = useFinanceCategories();
    const expenseCats = categories.filter(c => c.kind === 'expense' && c.active);

    const methodOptions = useMethodOptions();

    // Inventario: si el egreso es una compra de insumo, el stock se suma solo.
    const [supplies, setSupplies] = useState([]);
    useEffect(() => {
        let alive = true;
        getSupplies({ activeOnly: true }).then(rows => { if (alive) setSupplies(rows); }).catch(() => {});
        return () => { alive = false; };
    }, []);

    const [description, setDescription] = useState(initial?.description || '');
    const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
    const [categoryId, setCategoryId] = useState(initial?.category_id || null);
    const [date, setDate] = useState(initial?.occurred_at ? isoToDateInput(initial.occurred_at) : todayISO());
    const [method, setMethod] = useState(initial?.payment_method || 'cash');
    const [frequency, setFrequency] = useState(initial?.frequency || (initial?.recurring ? 'monthly' : 'one_time'));
    const [supplyId, setSupplyId] = useState(initial?.supply_id || null);
    const [quantity, setQuantity] = useState(initial?.quantity != null ? String(initial.quantity) : '1');
    const [notes, setNotes] = useState(initial?.notes || '');
    const [saving, setSaving] = useState(false);

    const supplyOptions = [{ id: 'none', label: 'No es compra' }, ...supplies.map(s => ({ id: s.id, label: s.name }))];

    // El wheel necesita un `selected` que exista en `items`; si aún no hay categoría
    // elegida (alta nueva, o registro legacy sin category_id), preselecciona la primera
    // disponible en cuanto cargan — evita el estado ambiguo "se ve elegida pero es null".
    useEffect(() => {
        if (!catsLoading && categoryId == null && expenseCats.length > 0) {
            setCategoryId(expenseCats[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catsLoading, expenseCats.length]);

    async function submit() {
        const amt = Number(amount);
        if (!description.trim()) { showErrorToast('Falta descripción', 'Describe el egreso.'); return; }
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa un monto válido.'); return; }
        setSaving(true);
        try {
            const selectedCat = expenseCats.find(c => c.id === categoryId);
            const isPurchase = supplyId && supplyId !== 'none';
            await onSubmit({
                description: description.trim(),
                amount: amt,
                category: selectedCat?.name || 'General', // back-compat (texto legacy)
                category_id: categoryId,
                payment_method: method,
                occurred_at: isoToTimestamp(date),
                recurring: frequency === 'monthly',
                frequency,
                supply_id: isPurchase ? supplyId : null,
                quantity: isPurchase ? (Number(quantity) > 0 ? Number(quantity) : 1) : 1,
                notes: notes.trim() || null,
            });
            onClose();
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || 'Intenta de nuevo.');
            setSaving(false);
        }
    }

    return (
        <ModalShell
            title={editing ? 'Editar egreso' : 'Registrar egreso'}
            subtitle={editing ? 'Modifica los datos de este egreso.' : 'Gasto o costo del negocio (insumos, renta, salarios…).'}
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel={editing ? 'Guardar' : 'Agregar'} loading={saving} confirmIcon={editing ? Save : Plus} />}
        >
            <div>
                <FieldLabel title="Descripción" subtitle="¿En qué se gastó? (ej: pago de renta)" />
                <TextInput value={description} onChange={setDescription} placeholder="Ej: Renta del local" autoFocus maxLength={120} />
            </div>
            <div>
                <FieldLabel title="Monto" subtitle="Total del gasto." />
                <AmountInput value={amount} onChange={setAmount} />
            </div>
            <div>
                <FieldLabel title="Categoría" subtitle="Tipo de gasto para los reportes." />
                {expenseCats.length === 0 ? (
                    <p className="text-[11px] font-semibold text-navy-700/50 italic px-1">
                        {catsLoading ? 'Cargando categorías…' : 'Crea categorías en la pestaña Categorías de Finanzas.'}
                    </p>
                ) : (
                    <OptionWheel options={expenseCats.map(c => ({ id: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
                )}
            </div>
            <div>
                <FieldLabel title="Fecha" subtitle="¿Cuándo se realizó el gasto?" />
                <DateWheels value={date} onChange={setDate} />
            </div>
            <div>
                <FieldLabel title="Método de pago" subtitle="¿Cómo se pagó? (el efectivo descuenta de la caja del día)" />
                <OptionWheel options={methodOptions} value={method} onChange={setMethod} />
            </div>
            {!editing && supplies.length > 0 && (
                <div>
                    <FieldLabel title="Compra de insumo" subtitle="Si es una compra, el stock del inventario se suma solo." />
                    <OptionWheel options={supplyOptions} value={supplyId ?? 'none'} onChange={setSupplyId} />
                    {supplyId && supplyId !== 'none' && (
                        <div className="mt-3">
                            <FieldLabel title="Cantidad comprada" subtitle="Unidades que entran al inventario." />
                            <input type="number" min="0.001" step="0.001" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1"
                                className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold outline-none focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm text-navy-900" />
                        </div>
                    )}
                </div>
            )}
            <div>
                <FieldLabel title="Frecuencia" subtitle="Único o costo fijo: los mensuales se registran solos cada mes." />
                <OptionWheel options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} />
            </div>
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional." />
                <NotesField value={notes} onChange={setNotes} placeholder="Información adicional…" />
            </div>
        </ModalShell>
    );
}
