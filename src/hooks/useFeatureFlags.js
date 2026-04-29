import { useAppStore } from '../store/useAppStore';

/**
 * Hook para acceder a feature flags por negocio.
 *
 * Lee businesses.feature_flags (JSONB) desde el store. Los flags se cargan
 * en useAuth al iniciar sesión y se limpian al cerrar sesión.
 *
 * Uso típico — gating de un módulo entero:
 *
 *   const { isEnabled } = useFeatureFlags();
 *   if (!isEnabled('billing')) return null;
 *   return <BillingModule />;
 *
 * Uso típico — gating de un botón o feature menor:
 *
 *   const { flags } = useFeatureFlags();
 *   {flags.marketing_ai && <Button>Generar campaña con IA</Button>}
 *
 * Activación por cliente — desde la BD:
 *
 *   UPDATE businesses
 *   SET feature_flags = feature_flags || '{"billing": true}'::jsonb
 *   WHERE id = '<business-uuid>';
 *
 * Convenciones:
 *  - Nombres en snake_case ('billing', 'marketing_ai', 'multi_branch').
 *  - Default false: si el flag no existe, isEnabled lo trata como apagado.
 *    Esto significa que módulos nuevos están OFF por defecto y los activás
 *    explícitamente cuando vendés el upgrade — más seguro que lo opuesto.
 */
export function useFeatureFlags() {
    const flags = useAppStore(s => s.featureFlags) || {};

    const isEnabled = (flagName) => {
        if (!flagName) return false;
        return flags[flagName] === true;
    };

    return { flags, isEnabled };
}
