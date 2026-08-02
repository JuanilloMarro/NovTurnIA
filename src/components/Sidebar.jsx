import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, Users, BarChart2, MessageCircle, Bot, ShieldCheck, Settings, List, Layers, CreditCard, Lock, Tag, History, Wallet, Repeat } from 'lucide-react';
import AIStar from './Icons/AIStar';
import RealtimeStatusBanner from './RealtimeStatusBanner';
import { useAuroraPulse } from '../hooks/useAuroraPulse';
import { usePermissions } from '../hooks/usePermissions';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../store/useAppStore';
import { getBusinessInfo } from '../services/supabaseService';

// Glows en esquina — mismo patrón que los botones del listado de Ofertas, pero
// escalados al ancho del item (pill ancho y bajo) para que el difuminado se
// aprecie igual que en los botones/paneles del sistema.
function NavGlow() {
    return (
        <>
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
        </>
    );
}

// Item de navegación con el estilo de los botones de Ofertas:
// pill glass (bg-white/40 + blur + border-white/60 + shadow-md) y glows al estar activo.
// `aurora` envuelve el pill en el borde aurora de IA (.ai-aurora); el wrapper es
// necesario porque el overflow-hidden del pill recortaría el halo difuminado.
// `auroraClass` trae las clases de fase del pulso (is-live / is-on) desde useAuroraPulse.
function NavItem({ to, end, icon: Icon, label, locked, iconSize = 16, labelClass = '', onClick, aurora = false, auroraClass = '' }) {
    // `shrink-0` — los items conservan SU ALTO ORIGINAL siempre.
    // Sin esto, un hijo de flex tiene `flex-shrink: 1`: cuando los 14 items no
    // entraban, en vez de activarse el scroll se APLASTABAN uno por uno hasta
    // caber. Quedaba lo peor de los dos mundos — items de distinto alto que el
    // diseño original Y scroll a medias. Con `shrink-0` mantienen su medida y el
    // `overflow-y-auto` del <nav> hace su trabajo: o entra, o se desliza.
    const base = 'relative overflow-hidden shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-300';
    const link = (
        <NavLink
            to={to}
            end={end}
            onClick={onClick}
            className={({ isActive }) =>
                isActive
                    ? `${base} bg-white/40 backdrop-blur-2xl border border-white/60 shadow-md text-navy-700`
                    : `${base} border border-transparent text-navy-700/40 hover:bg-white/30 hover:text-navy-700`
            }
        >
            {({ isActive }) => (
                <>
                    {isActive && <NavGlow />}
                    <Icon size={iconSize} className="shrink-0 relative z-10" />
                    <span className={`flex-1 relative z-10 whitespace-nowrap ${labelClass}`}>{label}</span>
                    {locked && <Lock size={11} className="shrink-0 relative z-10" />}
                </>
            )}
        </NavLink>
    );
    if (!aurora) return link;
    return <div className={`ai-aurora ai-aurora--sm rounded-xl ${auroraClass}`}>{link}</div>;
}

export default function Sidebar({ onOpenPlans }) {
    const { canViewStats, canManageRoles, canManageServices, canViewPatients, canViewConversations, canViewFollowUp, canViewFinance, canUseAIHub, canViewPipeline } = usePermissions();
    const { hasFeature } = usePlanLimits();
    const statsUnlocked = hasFeature('dashboard');
    const aiHubUnlocked = hasFeature('stats_intelligence');
    const auditUnlocked = hasFeature('audit_log');
    const offersUnlocked = hasFeature('dynamic_pricing');
    const followUpUnlocked = hasFeature('followup');
    const pipelineUnlocked = hasFeature('pipeline');
    const financeUnlocked = hasFeature('finance');
    const { profile } = useAuth();
    const { isSidebarOpen, toggleSidebar } = useAppStore();
    const [businessName, setBusinessName] = useState('');
    // Aurora del botón de Centro IA: se enciende un ratito al hacer clic y se apaga sola.
    const { className: aiAuroraClass, pulse: pulseAiAurora } = useAuroraPulse();
    // Mismo efecto para "Configuración IA" — es igual de "IA" que Centro IA.
    const { className: configAuroraClass, pulse: pulseConfigAurora } = useAuroraPulse();

    const businessId = profile?.business_id || '';

    useEffect(() => {
        if (businessId) {
            getBusinessInfo()
                .then(info => setBusinessName(info?.name || 'Negocio'))
                .catch(() => setBusinessName('Negocio'));
        }
    }, [businessId]);

    // T7 · 1024 = el punto donde Tailwind activa `lg:` y el aside deja de ser
    // cajón. Debe coincidir con `lg:translate-x-0` de abajo: si no, en tablet el
    // menú se cerraría solo estando fijo, o quedaría abierto tapando el contenido.
    const closeMobile = () => {
        if (window.innerWidth < 1024) toggleSidebar();
    };

    // Estilo del botón "Planes" (no es ruta, nunca está activo) — variante inactiva del item.
    // `shrink-0` por la misma razón que los NavItem: alto original, y si no cabe
    // que deslice el <nav>, no que se aplaste el botón.
    const normalClass = 'relative overflow-hidden shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-300 border border-transparent text-navy-700/40 hover:bg-white/30 hover:text-navy-700';

    return (
        <>
            {isSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-navy-900/20 backdrop-blur-sm z-[19] cursor-pointer"
                    onClick={toggleSidebar}
                />
            )}

            {/* `sidebar-drawer` (index.css) solo tiene reglas dentro de la media query
                de pantalla chica: desde 1024px la clase existe pero está vacía, así que
                el estilo de escritorio queda intacto. Ver el bloque "AJUSTES DE PANTALLA
                CHICA" en index.css — su límite y el `lg:` de acá deben coincidir. */}
            <aside className={`sidebar-drawer absolute left-0 top-0 bottom-0 w-[272px] p-6 flex flex-col z-20 bg-transparent transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer transition-transform hover:scale-[1.02] group/logo">
                    <div className="w-9 h-9 rounded-[10px] bg-navy-900 border border-white/10 flex items-center justify-center text-white shadow-card transition-all duration-500 group-hover/logo:-translate-y-1">
                        <div className="relative">
                            <Bot size={18} strokeWidth={2.5} className="transition-transform duration-500 group-hover/logo:rotate-12" />
                            <AIStar
                                size={8}
                                className="absolute -top-1 -left-1 text-white transition-all duration-500 group-hover/logo:scale-125"
                                strokeWidth={2.5}
                            />
                        </div>
                    </div>
                    <span className="font-bold text-navy-900 tracking-tight text-lg">NovTurnIA</span>
                </div>

                {/* `min-h-0 overflow-y-auto` — sin esto el menú se CORTA. Son hasta 14
                    ítems; en un teléfono con la barra de direcciones del navegador
                    comiendo ~100px, los últimos (Usuarios y Planes) caían fuera del
                    cajón y no había forma de llegar a ellos: el <nav> era `flex-1`
                    pero sin scroll, así que el sobrante simplemente se recortaba.
                    `min-h-0` es obligatorio: un hijo de flex no baja de su tamaño de
                    contenido sin eso, y el overflow nunca se activaría. */}
                <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-1.5 mt-2">
                    <NavItem to="/" end icon={Calendar} label="Citas" onClick={closeMobile} />

                    {canViewFollowUp && (
                        <NavItem to="/followup" icon={History} label="Re-agendación" locked={!followUpUnlocked} onClick={closeMobile} />
                    )}

                    {canViewPipeline && (
                        <NavItem to="/pipeline" icon={Repeat} label="Seguimiento" locked={!pipelineUnlocked} onClick={closeMobile} />
                    )}

                    {canViewPatients && (
                        <NavItem to="/patients" icon={Users} label="Clientes" onClick={closeMobile} />
                    )}

                    {canViewConversations && (
                        <NavItem to="/conversations" icon={MessageCircle} label="Conversaciones" onClick={closeMobile} />
                    )}

                    {canViewStats && (
                        <NavItem to="/stats" icon={BarChart2} label="Estadísticas" locked={!statsUnlocked} onClick={closeMobile} />
                    )}

                    {(canManageServices || canManageRoles) && (
                        <NavItem to="/settings" icon={Layers} label="Servicios" onClick={closeMobile} />
                    )}

                    {canManageServices && (
                        <NavItem to="/offers" icon={Tag} label="Ofertas" locked={!offersUnlocked} onClick={closeMobile} />
                    )}

                    {canViewFinance && (
                        <NavItem to="/finance" icon={Wallet} label="Finanzas" locked={!financeUnlocked} onClick={closeMobile} />
                    )}

                    {canUseAIHub && (
                        <NavItem
                            to="/ai"
                            icon={AIStar}
                            label="Centro IA"
                            locked={!aiHubUnlocked}
                            aurora
                            auroraClass={aiAuroraClass}
                            onClick={() => { pulseAiAurora(2400); closeMobile(); }}
                        />
                    )}

                    {canManageRoles && (
                        <>
                            <NavItem
                                to="/business"
                                icon={Settings}
                                label="Configuración IA"
                                aurora
                                auroraClass={configAuroraClass}
                                onClick={() => { pulseConfigAurora(2400); closeMobile(); }}
                            />
                            <NavItem to="/audit-log" icon={List} label="Actividad" locked={!auditUnlocked} onClick={closeMobile} />
                            <NavItem to="/users" icon={ShieldCheck} label="Usuarios" onClick={closeMobile} />
                        </>
                    )}

                    <button
                        onClick={() => { onOpenPlans(); closeMobile(); }}
                        className={normalClass}
                    >
                        <CreditCard size={16} className="shrink-0 relative z-10" /> <span className="relative z-10">Planes</span>
                    </button>
                </nav>

                <div className="mt-auto pt-6 px-5 border-t border-white/20 shrink-0">
                    {/* El aviso de Realtime vive acá y no arriba del módulo: en el
                        pie del sidebar el espacio ya está reservado, así que aparecer
                        y desaparecer no mueve la altura del módulo. Ver el comentario
                        del propio componente. */}
                    <RealtimeStatusBanner />
                    <div className="font-bold text-navy-900/60 truncate tracking-tight text-[12px]">{businessName || 'Cargando...'}</div>
                    <div className="text-navy-900/30 text-[10px] font-semibold tracking-tight mt-1">© {new Date().getFullYear()} NovTurnIA</div>
                </div>
            </aside>
        </>
    );
}
