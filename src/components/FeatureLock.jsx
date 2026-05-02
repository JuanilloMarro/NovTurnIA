import { Lock, Sparkles, Star } from 'lucide-react';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useAppStore } from '../store/useAppStore';

// M-010: bloquea visualmente un control si el plan actual no incluye la feature.
// Mantiene los hijos visibles (greyed-out) para que el cliente vea qué se está
// perdiendo y se anime a subir de plan. Tres variantes:
//
//   - inline (default): overlay con candado encima del control. Bloquea pointer events.
//   - badge: pequeño chip "PRO" al costado, no bloquea. Ideal para items de menú.
//   - screen: pantalla completa de upsell — usado en páginas enteras (Stats, Auditoría).
//
// Uso:
//   <FeatureLock feature="custom_prompt"><textarea ... /></FeatureLock>
//   <FeatureLock feature="audit_log" variant="screen" title="Registro de Actividad" />

export default function FeatureLock({
    feature,
    children,
    variant = 'inline',
    title,
    description,
    requiredPlan = 'Pro',
}) {
    const { hasFeature, isLoading } = usePlanLimits();
    const openPlans = useAppStore(s => s.openPlans);

    // Mientras carga, no mostramos NADA — evita el flash del contenido limpio
    // antes de saber si el plan permite la feature. Con el cache module-level
    // de usePlanLimits sólo el primer mount paga este coste; el resto es sync.
    if (isLoading) return null;
    if (hasFeature(feature)) return children ?? null;

    if (variant === 'badge') {
        return (
            <div className="flex items-center gap-2">
                {children}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-navy-900/5 border border-navy-900/15 text-[9px] font-black uppercase tracking-widest text-navy-900">
                    <Lock size={9} strokeWidth={3} /> {requiredPlan}
                </span>
            </div>
        );
    }

    const LockCard = () => (
        <div className="max-w-md mx-auto w-full bg-navy-900/5 backdrop-blur-2xl border border-white/60 rounded-[40px] shadow-[0_20px_50px_rgba(26,58,107,0.15)] p-8 flex flex-col items-center animate-fade-up">
            <div className="w-16 h-16 rounded-[20px] bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card relative transition-transform hover:scale-105 duration-300 group mb-6">
                <div className="relative">
                    <Lock size={28} strokeWidth={2.5} className="transition-transform duration-500 group-hover:scale-110" />
                </div>
            </div>
            <h3 className="text-2xl font-black text-navy-900 tracking-tight mb-2 text-center max-w-xl">
                {title || 'Función no incluida'}
            </h3>
            <p className="text-navy-700/60 font-bold text-[13px] text-center max-w-2xl leading-relaxed mb-6">
                {description || `Esta función forma parte del plan ${requiredPlan}. Sube de plan para desbloquearla y aprovechar al máximo NovTurnIA.`}
            </p>
            <button
                onClick={openPlans}
                className="px-6 py-3 rounded-full bg-transparent border border-white/80 text-navy-900/50 hover:text-navy-900 hover:bg-white/30 transition-all duration-300 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
                <Star size={14} /> Desbloquear con {requiredPlan}
            </button>
        </div>
    );

    if (variant === 'screen') {
        return (
            <div className="h-full flex flex-col items-center justify-center px-6 py-12 text-center">
                <LockCard />
            </div>
        );
    }

    // blurred: renderiza el módulo real detrás de un cristal opaco con candado.
    if (variant === 'blurred') {
        return (
            <div className="relative h-full w-full rounded-[32px] overflow-hidden">
                <div
                    aria-hidden="true"
                    className="h-full w-full pointer-events-none select-none p-4"
                    style={{ filter: 'blur(5px) saturate(1.05)' }}
                >
                    {children}
                </div>
                <div className="absolute inset-0 bg-white/10 flex flex-col items-center justify-center px-6">
                    <LockCard />
                </div>
            </div>
        );
    }

    // inline: overlay con candado encima del control.
    return (
        <div className="relative group">
            <div
                aria-disabled="true"
                className="opacity-40 pointer-events-none select-none transition-opacity duration-300 group-hover:opacity-20"
                style={{ filter: 'blur(4px)' }}
            >
                {children}
            </div>
            <div className="absolute -inset-1 flex items-center justify-center z-10 pointer-events-none">
                <button
                    type="button"
                    onClick={openPlans}
                    className="flex items-center gap-3 px-4 py-2.5 bg-navy-900/5 backdrop-blur-2xl border border-white/60 rounded-2xl hover:bg-navy-900/10 transition-all duration-300 shadow-[0_8px_30px_rgba(26,58,107,0.15)] pointer-events-auto"
                >
                    <div className="w-7 h-7 rounded-lg bg-navy-900 flex items-center justify-center text-white shadow-sm">
                        <Lock size={12} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-black text-navy-900 uppercase tracking-widest pr-1">
                        Disponible en {requiredPlan}
                    </span>
                </button>
            </div>
        </div>
    );
}
