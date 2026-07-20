import { useState } from 'react';
import { Send } from 'lucide-react';
import { showErrorToast } from '../../store/useToastStore';
import { ModalShell, FieldLabel, AmountInput, OptionWheel, NotesField, ModalButtons, useMethodOptions, useFinanceStaff } from './financeUi';

// onConfirm({ amount, paymentMethod, notes, staffId }) → Promise. Cierra al terminar bien.
// Envía el cobro a la cola "Por confirmar" (ingreso 'pending'); no lo registra aún.
// Métodos de pago y equipo se cargan del negocio (Finanzas v2): el staff elegido
// queda atribuido al ingreso para el reporte de Producción/comisiones.
export default function ConfirmDeliveryModal({ serviceName, clientName, defaultAmount, onClose, onConfirm }) {
    const methodOptions = useMethodOptions();
    const staff = useFinanceStaff();
    const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : '');
    const [method, setMethod] = useState('cash');
    const [staffId, setStaffId] = useState(null);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const staffOptions = [{ id: 'none', label: 'Sin asignar' }, ...staff.map(s => ({ id: s.staff_id, label: s.staff_name }))];

    async function submit() {
        const amt = Number(amount);
        if (!(amt >= 0)) { showErrorToast('Monto inválido', 'Ingresa un monto válido.'); return; }
        setSaving(true);
        try {
            await onConfirm({ amount: amt, paymentMethod: method, notes: notes.trim() || null, staffId: staffId === 'none' ? null : staffId });
            onClose();
        } catch (err) {
            showErrorToast('No se pudo cobrar', err.message || 'Intenta de nuevo.');
            setSaving(false);
        }
    }

    return (
        <ModalShell
            title="Cobrar servicio"
            subtitle={`${serviceName || 'Servicio'} · ${clientName || 'Cliente'}`}
            onClose={onClose}
            footer={<ModalButtons onCancel={onClose} onConfirm={submit} confirmLabel="Enviar a validación" loading={saving} confirmIcon={Send} />}
        >
            <div>
                <FieldLabel title="Monto cobrado" subtitle="Lo que el cliente realmente pagó. Pasará a 'Por confirmar' para validación." />
                <AmountInput value={amount} onChange={setAmount} autoFocus />
            </div>
            <div>
                <FieldLabel title="Método de pago" subtitle="¿Cómo se realizó el pago?" />
                <OptionWheel options={methodOptions} value={method} onChange={setMethod} />
            </div>
            {staff.length > 0 && (
                <div>
                    <FieldLabel title="Atendido por" subtitle="Quién realizó el servicio, alimenta Producción y comisiones." />
                    <OptionWheel options={staffOptions} value={staffId ?? 'none'} onChange={setStaffId} />
                </div>
            )}
            <div>
                <FieldLabel title="Notas" subtitle="Detalle opcional sobre el cobro." />
                <NotesField value={notes} onChange={setNotes} placeholder="Ej: incluyó producto adicional…" />
            </div>
        </ModalShell>
    );
}
