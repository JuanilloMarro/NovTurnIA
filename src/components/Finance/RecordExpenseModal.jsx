import { useState } from 'react';
import { Plus } from 'lucide-react';
import { showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, TextInput, AmountInput, DateWheels, OptionWheel, NotesField, ModalButtons, EXPENSE_CATS, FREQ_OPTIONS, todayISO, isoToTimestamp } from './financeUi';

// onAdd({ description, amount, category, occurred_at, recurring, frequency, notes }) → Promise.
export default function RecordExpenseModal({ onClose, onAdd }) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('insumo');
    const [date, setDate] = useState(todayISO());
    const [frequency, setFrequency] = useState('one_time');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    async function submit() {
        const amt = Number(amount);
        if (!description.trim()) { showErrorToast('Falta descripción', 'Describe el egreso.'); return; }
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa un monto válido.'); return; }
        setSaving(true);
        try {
            await onAdd({
                description: description.trim(), amount: amt, category,
                occurred_at: isoToTimestamp(date),
                recurring: frequency === 'monthly', frequency,
                notes: notes.trim() || null,
            });
            onClose();
        } catch (err) {
            showErrorToast('No se pudo registrar', err.message || 'Intenta de nuevo.');
            setSaving(false);
        }
    }

    return (
        <ModalShell
            title="Registrar egreso"
            subtitle="Gasto o costo del negocio (insumos, renta, salarios…)."
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Agregar" loading={saving} confirmIcon={Plus} />}
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
