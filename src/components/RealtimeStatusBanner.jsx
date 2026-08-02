import { useAppStore } from '../store/useAppStore';
import { WifiOff } from 'lucide-react';

/**
 * T-11 · Aviso de caída de Realtime.
 *
 * DÓNDE VIVE Y POR QUÉ. Antes se pintaba arriba del módulo, entre el Topbar y
 * el contenido. Eso tenía un problema real: al aparecer y desaparecer **movía
 * la altura del módulo entero**, así que una caída momentánea de conexión hacía
 * saltar toda la pantalla — listas, gráficas y cajones incluidos.
 *
 * Ahora vive en el pie del sidebar, justo encima del nombre del negocio. Ahí el
 * espacio ya está reservado y el aviso no empuja nada: aparece y se va sin
 * mover un pixel del módulo.
 *
 * El estado cambia con debounce de 1500 ms en `useRealtime.js` para evitar
 * falsos positivos al navegar entre módulos (ver COD-4).
 */
export default function RealtimeStatusBanner() {
    const status = useAppStore(s => s.realtimeStatus);

    if (status !== 'disconnected') return null;

    return (
        <div
            className="mb-3 flex items-start gap-2 px-3 py-2 bg-amber-50/90 backdrop-blur-sm border border-amber-200/80 rounded-xl text-amber-700 shadow-sm animate-fade-up"
            role="status"
        >
            <WifiOff size={12} className="shrink-0 mt-[1px]" />
            <span className="text-[10px] font-bold leading-snug">
                Sin conexión en tiempo real — los datos pueden no estar actualizados
            </span>
        </div>
    );
}
