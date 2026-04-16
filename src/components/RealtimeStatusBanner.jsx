import { useAppStore } from '../store/useAppStore';
import { WifiOff } from 'lucide-react';

/**
 * T-11: Muestra un banner cuando la conexión Realtime se cae.
 * Solo visible cuando realtimeStatus === 'disconnected'.
 * El estado cambia con debounce de 1500 ms en useRealtime.js para evitar
 * falsos positivos durante navegación entre módulos.
 */
export default function RealtimeStatusBanner() {
    const status = useAppStore(s => s.realtimeStatus);

    if (status !== 'disconnected') return null;

    return (
        <div className="mx-4 lg:mx-6 mb-2 flex items-center gap-2.5 px-4 py-2.5 bg-amber-50/90 backdrop-blur-sm border border-amber-200/80 rounded-2xl text-amber-700 text-xs font-bold shadow-sm animate-fade-up">
            <WifiOff size={12} className="shrink-0" />
            <span>Sin conexión en tiempo real — los datos pueden no estar actualizados</span>
        </div>
    );
}
