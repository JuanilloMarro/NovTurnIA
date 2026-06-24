import { useState } from 'react';
import { Plus } from 'lucide-react';
import { showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, TextInput, AmountInput, DateWheels, OptionWheel, NotesField, ModalButtons, PAY_OPTIONS, todayISO, isoToTimestamp } from './financeUi';

// onAdd({ description, amount, payment_method, occurred_at, notes, source }) → Promise.
export default function RecordIncomeModal({ onClose, onAdd }) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(todayISO());
    const [method, setMethod] = useState('cash');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    async function submit() {
        const amt = Number(amount);
        if (!description.trim()) { showErrorToast('Falta descripción', 'Describe el ingreso.'); return; }
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa un monto válido.'); return; }
        setSaving(true);
        try {
            await onAdd({ description: description.trim(), amount: amt, payment_method: method, occurred_at: isoToTimestamp(date), notes: notes.trim() || null, source: 'manual' });
            onClose();
        } catch (err) {
            showErrorToast('No se pudo registrar', err.message || 'Intenta de nuevo.');
            setSaving(false);
        }
    }

    return (
        <ModalShell
            title="Registrar ingreso"
            subtitle="Venta o ingreso manual que no proviene de un turno."
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Agregar" loading={saving} confirmIcon={Plus} />}
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
