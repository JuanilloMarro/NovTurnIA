import { useState } from 'react';
import { Check } from 'lucide-react';
import { showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, AmountInput, OptionWheel, NotesField, ModalButtons, PAY_OPTIONS } from './financeUi';

// onConfirm({ amount, paymentMethod, notes }) → Promise. Cierra al terminar bien.
export default function ConfirmDeliveryModal({ serviceName, clientName, defaultAmount, onClose, onConfirm }) {
    const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : '');
    const [method, setMethod] = useState('cash');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    async function submit() {
        const amt = Number(amount);
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa un monto válido.'); return; }
        setSaving(true);
        try {
            await onConfirm({ amount: amt, paymentMethod: method, notes: notes.trim() || null });
            onClose();
        } catch (err) {
            showErrorToast('No se pudo confirmar', err.message || 'Intenta de nuevo.');
            setSaving(false);
        }
    }

    return (
        <ModalShell
            title="Cobrar servicio"
            subtitle={`${serviceName || 'Servicio'} · ${clientName || 'Cliente'}`}
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Confirmar ingreso" loading={saving} confirmIcon={Check} />}
        >
            <div>
                <FieldLabel title="Monto cobrado" subtitle="Lo que el cliente realmente pagó por el servicio." />
                <AmountInput value={amount} onChange={setAmount} autoFocus />
            </div>
            <div>
                <FieldLabel title="Método de pago" subtitle="¿Cómo se realizó el pago?" />
                <OptionWheel options={PAY_OPTIONS} value={method} onChange={setMethod} />
            </div>
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional sobre el cobro." />
                <NotesField value={notes} onChange={setNotes} placeholder="Ej: incluyó producto adicional…" />
            </div>
        </ModalShell>
    );
}
