import { createPortal } from 'react-dom';
import { X, Trash2, Check } from 'lucide-react';

// F-5: confirmación unificada del design system (glass) — reemplaza a los
// window.confirm nativos. Mismo lenguaje visual que el confirm de CategoriesSection.
//
// Uso:
//   const [confirming, setConfirming] = useState(false);
//   <ConfirmDialog open={confirming} title="¿Anular ingreso?" message="No se puede deshacer."
//       confirmLabel="Sí, anular" danger loading={busy}
//       onConfirm={doIt} onCancel={() => setConfirming(false)} />
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirmar',
    loadingLabel = 'Procesando...',
    danger = false,
    loading = false,
    onConfirm,
    onCancel,
}) {
    if (!open) return null;
    const Icon = danger ? Trash2 : Check;
    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={onCancel}>
            <div onClick={e => e.stopPropagation()}
                className="w-full max-w-sm bg-white/30 backdrop-blur-xl border border-white/50 p-6 animate-fade-up shadow-[0_8px_32px_rgba(26,58,107,0.15)] rounded-[32px] text-center">
                <p className="text-sm font-bold text-navy-900 mb-1">{title}</p>
                {message && <p className="text-xs text-navy-700/60 font-semibold mb-5 px-4">{message}</p>}
                <div className="flex justify-center gap-3">
                    <button onClick={onCancel}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/40 border border-white/60 text-navy-800 text-[11px] font-bold rounded-full hover:bg-white/60 transition-colors shadow-sm min-w-[100px]">
                        <X size={13} /> Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className={`flex items-center justify-center gap-2 px-6 py-2.5 text-[11px] font-bold rounded-full transition-colors shadow-sm disabled:opacity-50 min-w-[100px] ${danger
                            ? 'bg-rose-500/80 border border-rose-400 text-white hover:bg-rose-600'
                            : 'bg-navy-900 border border-navy-900 text-white hover:bg-navy-800'}`}>
                        <Icon size={13} /> {loading ? loadingLabel : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
