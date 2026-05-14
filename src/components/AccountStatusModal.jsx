import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban, Mail, X, LogOut, CreditCard } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getBusinessInfo } from '../services/supabaseService';

export default function AccountStatusModal({ status }) {
    const { logout } = useAuth();
    const [visible, setVisible] = useState(true);
    const [daysLeft, setDaysLeft] = useState(30);

    useEffect(() => {
        if (status === 'cancelled') {
            getBusinessInfo()
                .then(info => {
                    if (info?.updated_at) {
                        const cancelledAt = new Date(info.updated_at);
                        const deleteAt = new Date(cancelledAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                        setDaysLeft(Math.max(0, Math.ceil((deleteAt - Date.now()) / (24 * 60 * 60 * 1000))));
                    }
                })
                .catch(() => { });
        }
    }, [status]);

    if (!visible) return null;

    const isSuspended = status === 'suspended';
    const isCancelled = status === 'cancelled';

    return createPortal(
        <div className="fixed inset-0 bg-navy-900/10 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_8px_32px_rgba(26,58,107,0.15)] w-full max-w-sm overflow-hidden animate-fade-up">
                <div className="p-8 text-center relative">

                    {/* Botón cerrar — solo suspended */}
                    {isSuspended && (
                        <button
                            onClick={() => setVisible(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-navy-900/30 hover:text-navy-900 hover:bg-white/50 transition-all duration-200"
                        >
                            <X size={15} strokeWidth={2.5} />
                        </button>
                    )}

                    {/* Icono */}
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${isSuspended ? 'bg-amber-100/80' : 'bg-red-100/80'}`}>
                        {isSuspended
                            ? <AlertTriangle size={26} className="text-amber-500" strokeWidth={2} />
                            : <Ban size={26} className="text-red-500" strokeWidth={2} />
                        }
                    </div>

                    {/* Título */}
                    <h2 className="text-[17px] font-bold text-navy-900 tracking-tight mb-2">
                        {isSuspended ? 'Cuenta suspendida' : 'Cuenta cancelada'}
                    </h2>

                    {/* Descripción */}
                    <p className="text-[12.5px] text-navy-900/50 leading-relaxed mb-6">
                        {isSuspended
                            ? 'Hay un pago pendiente. Regulariza tus pagos para volver a operar con normalidad.'
                            : 'Regulariza tus pagos para reactivar tu cuenta y recuperar tus datos.'
                        }
                    </p>

                    {/* Countdown — solo cancelled */}
                    {isCancelled && (
                        <div className="flex items-center justify-center gap-3 bg-red-50/60 border border-red-100/60 rounded-2xl px-4 py-3 mb-6">
                            <span className="text-[30px] font-bold text-red-500 leading-none">{daysLeft}</span>
                            <span className="text-[11px] text-red-400 text-left leading-tight">días restantes<br />para el borrado de datos</span>
                        </div>
                    )}

                    {/* CTAs */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                            className={`group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 border border-white/60 text-[11px] font-bold rounded-full shadow-sm transition-all duration-300 overflow-hidden ${isSuspended ? 'text-amber-600 hover:bg-amber-50/70 hover:border-amber-200/50' : 'text-rose-600 hover:bg-rose-50/70 hover:border-rose-200/50'}`}
                        >
                            <CreditCard size={14} className="shrink-0" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">Regularizar pagos</span>
                        </button>
                        <a
                            href="mailto:soporte@novturnia.com"
                            className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-sm hover:bg-white/60 transition-all duration-300 overflow-hidden"
                        >
                            <Mail size={14} className="shrink-0" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">Contactar soporte</span>
                        </a>
                        <button
                            onClick={logout}
                            className="group flex items-center justify-center gap-0 hover:gap-1.5 px-3 hover:px-4 py-2.5 bg-white/40 border border-white/60 text-navy-900 text-[11px] font-bold rounded-full shadow-sm hover:bg-white/60 transition-all duration-300 overflow-hidden"
                        >
                            <LogOut size={14} className="shrink-0" />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-[90px] transition-all duration-300 whitespace-nowrap">Cerrar sesión</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
