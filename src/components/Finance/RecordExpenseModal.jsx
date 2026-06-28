import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, TextInput, AmountInput, DateWheels, OptionWheel, NotesField, ModalButtons, EXPENSE_CATS, FREQ_OPTIONS, todayISO, isoToTimestamp, isoToDateInput } from './financeUi';

// initial = entrada a editar (o null para crear). onSubmit(fields) → Promise.
export default function RecordExpenseModal({ initial = null, onClose, onSubmit }) {
    const editing = !!initial;
    const [description, setDescription] = useState(initial?.description || '');
    const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
    const [category, setCategory] = useState(initial?.category || 'insumo');
    const [date, setDate] = useState(initial?.occurred_at ? isoToDateInput(initial.occurred_at) : todayISO());
    const [frequency, setFrequency] = useState(initial?.frequency || (initial?.recurring ? 'monthly' : 'one_time'));
    const [notes, setNotes] = useState(initial?.notes || '');
    const [saving, setSaving] = useState(false);

    async function submit() {
        const amt = Number(amount);
        if (!description.trim()) { showErrorToast('Falta descripción', 'Describe el egreso.'); return; }
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa un monto válido.'); return; }
        setSaving(true);
        try {
            await onSubmit({ description: description.trim(), amount: amt, category, occurred_at: isoToTimestamp(date), recurring: frequency === 'monthly', frequency, notes: notes.trim() || null });
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
                <OptionWheel options={EXPENSE_CATS} value={category} onChange={setCategory} />
            </div>
            <div>
                <FieldLabel title="Fecha" subtitle="¿Cuándo se realizó el gasto?" />
                <DateWheels value={date} onChange={setDate} />
            </div>
            <div>
                <FieldLabel title="Frecuencia" subtitle="Único o costo fijo que se repite cada mes." />
                <OptionWheel options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} />
            </div>
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional." />
                <NotesField value={notes} onChange={setNotes} placeholder="Información adicional…" />
            </div>
        </ModalShell>
    );
}
