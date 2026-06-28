import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, TextInput, AmountInput, DateWheels, OptionWheel, NotesField, ModalButtons, PAY_OPTIONS, todayISO, isoToTimestamp, isoToDateInput } from './financeUi';

// initial = entrada a editar (o null para crear). onSubmit(fields) → Promise.
export default function RecordIncomeModal({ initial = null, onClose, onSubmit }) {
    const editing = !!initial;
    const [description, setDescription] = useState(initial?.description || '');
    const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
    const [date, setDate] = useState(initial?.occurred_at ? isoToDateInput(initial.occurred_at) : todayISO());
    const [method, setMethod] = useState(initial?.payment_method || 'cash');
    const [notes, setNotes] = useState(initial?.notes || '');
    const [saving, setSaving] = useState(false);

    async function submit() {
        const amt = Number(amount);
        if (!description.trim()) { showErrorToast('Falta descripción', 'Describe el ingreso.'); return; }
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa un monto válido.'); return; }
        setSaving(true);
        try {
            await onSubmit({ description: description.trim(), amount: amt, payment_method: method, occurred_at: isoToTimestamp(date), notes: notes.trim() || null, source: 'manual' });
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
                <FieldLabel title="Fecha" subtitle="¿Cuándo ocurrió el ingreso?" />
                <DateWheels value={date} onChange={setDate} />
            </div>
            <div>
                <FieldLabel title="Método de pago" subtitle="¿Cómo te pagaron?" />
                <OptionWheel options={PAY_OPTIONS} value={method} onChange={setMethod} />
            </div>
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional." />
                <NotesField value={notes} onChange={setNotes} placeholder="Información adicional…" />
            </div>
        </ModalShell>
    );
}
