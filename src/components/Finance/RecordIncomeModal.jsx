import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import { useFinanceCategories } from '../../hooks/useFinanceCategories';
import { showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, TextInput, AmountInput, DateWheels, OptionWheel, NotesField, ModalButtons, useMethodOptions, useFinanceStaff, todayISO, isoToTimestamp, isoToDateInput } from './financeUi';

// initial = entrada a editar (o null para crear). onSubmit(fields) → Promise.
export default function RecordIncomeModal({ initial = null, onClose, onSubmit }) {
    const editing = !!initial;
    const { categories, loading: catsLoading } = useFinanceCategories();
    const incomeCats = categories.filter(c => c.kind === 'income' && c.active);
    const methodOptions = useMethodOptions();
    const staff = useFinanceStaff();

    const [description, setDescription] = useState(initial?.description || '');
    const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
    const [categoryId, setCategoryId] = useState(initial?.category_id || null);
    const [date, setDate] = useState(initial?.occurred_at ? isoToDateInput(initial.occurred_at) : todayISO());
    const [method, setMethod] = useState(initial?.payment_method || 'cash');
    const [staffId, setStaffId] = useState(initial?.staff_id || null);
    const [notes, setNotes] = useState(initial?.notes || '');
    const [saving, setSaving] = useState(false);

    const staffOptions = [{ id: 'none', label: 'Sin asignar' }, ...staff.map(s => ({ id: s.staff_id, label: s.staff_name }))];

    // Ver nota equivalente en RecordExpenseModal: el wheel necesita un `selected`
    // que exista en `items`, así que preseleccionamos la primera categoría disponible.
    useEffect(() => {
        if (!catsLoading && categoryId == null && incomeCats.length > 0) {
            setCategoryId(incomeCats[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catsLoading, incomeCats.length]);

    async function submit() {
        const amt = Number(amount);
        if (!description.trim()) { showErrorToast('Falta descripción', 'Describe el ingreso.'); return; }
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa un monto válido.'); return; }
        setSaving(true);
        try {
            await onSubmit({ description: description.trim(), amount: amt, payment_method: method, category_id: categoryId, occurred_at: isoToTimestamp(date), notes: notes.trim() || null, source: 'manual', staff_id: staffId === 'none' ? null : staffId });
            onClose();
        } catch (err) {
            showErrorToast('No se pudo guardar', err.message || 'Intenta de nuevo.');
            setSaving(false);
        }
    }

    return (
        <ModalShell
            title={editing ? 'Editar ingreso' : 'Registrar ingreso'}
            subtitle={editing ? 'Modifica los datos de este ingreso.' : 'Venta o ingreso manual que no proviene de un turno.'}
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel={editing ? 'Guardar' : 'Agregar'} loading={saving} confirmIcon={editing ? Save : Plus} />}
        >
            <div>
                <FieldLabel title="Descripción" subtitle="¿De qué es el ingreso? (ej: venta de producto)" />
                <TextInput value={description} onChange={setDescription} placeholder="Ej: Venta de shampoo" autoFocus maxLength={120} />
            </div>
            <div>
                <FieldLabel title="Monto" subtitle="Total recibido por este ingreso." />
                <AmountInput value={amount} onChange={setAmount} />
            </div>
            <div>
                <FieldLabel title="Categoría" subtitle="Tipo de ingreso para los reportes." />
                {incomeCats.length === 0 ? (
                    <p className="text-[11px] font-semibold text-navy-700/50 italic px-1">
                        {catsLoading ? 'Cargando categorías…' : 'Crea categorías en la pestaña Categorías de Finanzas.'}
                    </p>
                ) : (
                    <OptionWheel options={incomeCats.map(c => ({ id: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
                )}
            </div>
            <div>
                <FieldLabel title="Fecha" subtitle="¿Cuándo ocurrió el ingreso?" />
                <DateWheels value={date} onChange={setDate} />
            </div>
            <div>
                <FieldLabel title="Método de pago" subtitle="¿Cómo te pagaron?" />
                <OptionWheel options={methodOptions} value={method} onChange={setMethod} />
            </div>
            {!editing && staff.length > 0 && (
                <div>
                    <FieldLabel title="Atendido por" subtitle="Opcional — atribuye este ingreso a un profesional (comisiones)." />
                    <OptionWheel options={staffOptions} value={staffId ?? 'none'} onChange={setStaffId} />
                </div>
            )}
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional." />
                <NotesField value={notes} onChange={setNotes} placeholder="Información adicional…" />
            </div>
        </ModalShell>
    );
}
