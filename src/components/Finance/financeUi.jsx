import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import WheelColumn from '../ui/WheelColumn';

// ── Helpers compartidos para mantener la armonía con Nuevo Turno / Nuevo Cliente ──

export const money = (n) => `Q${Number(n || 0).toFixed(2)}`;

export const PAY_OPTIONS = [
    { id: 'cash', label: 'Efectivo' },
    { id: 'card', label: 'Tarjeta' },
    { id: 'transfer', label: 'Transferencia' },
    { id: 'other', label: 'Otro' },
];
export const EXPENSE_CATS = [
    { id: 'insumo', label: 'Insumos' },
    { id: 'renta', label: 'Renta' },
    { id: 'salario', label: 'Salarios' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'general', label: 'General' },
    { id: 'otro', label: 'Otro' },
];
export const FREQ_OPTIONS = [
    { id: 'one_time', label: 'Una vez' },
    { id: 'monthly', label: 'Mensual (fijo)' },
];

export function todayISO() {
    const d = new Date(); const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function isoToTimestamp(dateISO) {
    return new Date(dateISO + 'T12:00:00').toISOString();
}
export function isoToDateInput(iso) {
    const d = new Date(iso); const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── Shell del modal (idéntico a Nuevo Turno / Nuevo Cliente) ──
export function ModalShell({ title, subtitle, onClose, children, footer, maxW = 'max-w-md' }) {
    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div onClick={e => e.stopPropagation()}
                className={`bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full ${maxW} overflow-hidden animate-fade-up flex flex-col max-h-[90vh]`}>
                <div className="flex items-start justify-between px-6 pt-6 pb-2 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-navy-900 tracking-tight leading-tight">{title}</h2>
                        {subtitle && <p className="text-[11px] font-semibold text-navy-700/50 mt-1 truncate">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/40 border border-white/50 text-navy-700 hover:bg-white/60 shadow-sm transition-colors shrink-0">
                        <X size={16} />
                    </button>
                </div>
                <div className="px-6 py-4 space-y-5 overflow-y-auto custom-scrollbar">{children}</div>
                <div className="flex items-center justify-center gap-4 px-6 pb-6 pt-2 shrink-0">{footer}</div>
            </div>
        </div>,
        document.body
    );
}

export function FieldLabel({ title, subtitle }) {
    return (
        <div className="mb-3 px-1">
            <label className="block text-[11px] font-bold text-navy-800 tracking-wide leading-none">{title}</label>
            {subtitle && <p className="text-[10px] font-semibold text-navy-700/40 mt-1.5 leading-tight">{subtitle}</p>}
        </div>
    );
}

export function WheelBox({ children }) {
    return <div className="flex bg-white/30 border border-white/60 rounded-2xl overflow-hidden shadow-sm">{children}</div>;
}

export function TextInput({ value, onChange, placeholder, autoFocus, maxLength }) {
    return (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} maxLength={maxLength}
            className="w-full bg-white/40 border border-white/60 rounded-full px-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900" />
    );
}

export function AmountInput({ value, onChange, autoFocus }) {
    return (
        <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-navy-700/60 font-bold text-sm pointer-events-none">Q</span>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus} placeholder="0.00"
                className="w-full bg-white/40 border border-white/60 rounded-full pl-9 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm text-navy-900" />
        </div>
    );
}

export function NotesField({ value, onChange, maxLength = 250, placeholder }) {
    return (
        <>
            <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength}
                className="w-full bg-white/40 border border-white/60 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-700/50 shadow-sm text-navy-900 min-h-[100px] resize-none custom-scrollbar" />
            <div className={`text-right text-[10px] font-bold mt-1.5 px-1 ${value.length > maxLength - 20 ? 'text-rose-500' : value.length > maxLength - 50 ? 'text-amber-500' : 'text-navy-700/40'}`}>{value.length}/{maxLength}</div>
        </>
    );
}

// ── Rollos (WheelColumn) ──
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_NUM = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const _cy = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(_cy - 3 + i));

export function DateWheels({ value, onChange }) {
    const [y, m, d] = value.split('-');
    const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
    const DAYS = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
    function sync(nd, nm, ny) {
        const maxD = new Date(Number(ny), Number(nm), 0).getDate();
        const cd = String(Math.min(Number(nd), maxD)).padStart(2, '0');
        onChange(`${ny}-${nm}-${cd}`);
    }
    return (
        <WheelBox>
            <WheelColumn key={`d-${m}-${y}-${daysInMonth}`} items={DAYS} selected={d} onSelect={nd => sync(nd, m, y)} />
            <div className="w-px bg-white/50" />
            <WheelColumn items={MONTHS_NUM} selected={m} displayFn={mm => MONTHS_ES[parseInt(mm) - 1]} onSelect={nm => sync(d, nm, y)} />
            <div className="w-px bg-white/50" />
            <WheelColumn items={YEARS} selected={y} onSelect={ny => sync(d, m, ny)} />
        </WheelBox>
    );
}

export function OptionWheel({ options, value, onChange }) {
    return (
        <WheelBox>
            <WheelColumn items={options.map(o => o.id)} selected={value} displayFn={id => options.find(o => o.id === id)?.label || id} onSelect={onChange} />
        </WheelBox>
    );
}

export function ModalButtons({ onCancel, onConfirm, confirmLabel, loading, confirmIcon: Icon = Save }) {
    return (
        <>
            <button type="button" onClick={onCancel}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/40 border border-white/60 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm min-w-[100px]">
                <X size={13} /> Cancelar
            </button>
            <button type="button" onClick={onConfirm} disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/40 border border-white/60 rounded-full text-navy-900 text-[11px] font-bold shadow-sm hover:bg-white/60 transition-all disabled:opacity-50 min-w-[100px]">
                <Icon size={13} /> {loading ? 'Guardando...' : confirmLabel}
            </button>
        </>
    );
}
