import AIConfigPanel from '../components/AIHub/AIConfigPanel';
import { usePermissions } from '../hooks/usePermissions';

// Configuración — nombre del asistente, contexto, negocio, correo, horarios y
// el listado de "IA pausada". Vive aparte de Centro IA (que es análisis + chat
// de negocio); disponible en todos los planes, no es una feature Enterprise.
export default function AIConfig() {
    const { canManageRoles } = usePermissions();

    return (
        <div className="h-full flex flex-col mx-auto w-full max-w-[1220px] px-2">
            <div className="mb-4 shrink-0">
                <h1 className="text-xl font-bold text-navy-900 tracking-tight leading-none mb-1">Configuración</h1>
                <p className="text-xs text-navy-700/60 font-semibold tracking-wide">Asistente, negocio, horarios y clientes en atención humana</p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar pb-4">
                <div className="px-1 py-1 lg:h-full">
                    <AIConfigPanel canEdit={canManageRoles} />
                </div>
            </div>
        </div>
    );
}
