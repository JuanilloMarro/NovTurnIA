import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { COLORS } from "../../../types/constants";
import { useDirectionalExit } from "../components/SceneMotion";

// ─── ICONOS SVG (Lucide React) ───────────

const BellIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const CalendarIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const UsersIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const MessageCircleIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

const BarChart2Icon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" />
  </svg>
);

const SettingsIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const HistoryIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 8h10" /><path d="M7 12h10" /><path d="M7 16h10" />
  </svg>
);

const BotIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M9 13v2" /><path d="M15 13v2" />
  </svg>
);

const ChevronDownIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SearchIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

// Nav items
const NAV_ITEMS = [
  { label: "Turnos", Icon: CalendarIcon, active: false },
  { label: "Pacientes", Icon: UsersIcon, active: false },
  { label: "Conversaciones", Icon: MessageCircleIcon, active: true },
  { label: "Estadísticas", Icon: BarChart2Icon, active: false },
  { label: "Configuración", Icon: SettingsIcon, active: false, hasSub: true },
];

/**
 * Escena 10 — Conversaciones (Fidelidad total con Sidebar desplazada y Avatares corregidos)
 */
export const Scene10Conversation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const typingStart = 60;
  const messageSentTime = 180;
  const iaReactivedTime = 270;

  const pop = spring({ frame: frame, fps, config: { damping: 25, stiffness: 140 } });
  const macroScale = interpolate(pop, [0, 1], [0.88, 1]);
  const macroOpacity = interpolate(pop, [0, 1], [0, 1]);
  const macroY = interpolate(pop, [0, 1], [40, 0]);
  // ── SALIDA: el dashboard sale hacia ARRIBA ──────────────────────
  // Continuidad: la siguiente escena entra desde abajo → sensación de
  // que el contenido "fluye" hacia arriba de forma continua
  const sceneExit = useDirectionalExit('up', 320, 22, 900);


  // El mensaje nuevo crece desde abajo empujando los anteriores hacia arriba
  const msg5Spring = spring({ frame: frame - messageSentTime, fps, config: { damping: 20, stiffness: 120 } });
  const MSG5_H = 130;

  // ── MOTION AMBIENTE ──────────────────────────────────────────────
  // Punto naranja Maggie: pulsa suavemente
  const dotPulse = 1 + Math.sin(frame * 0.07) * 0.18;
  // Notificación campana: pulsa más rápido, como alerta
  const notifPulse = 1 + Math.sin(frame * 0.12) * 0.10;
  // Badge IA: pop de escala cuando cambia de estado en iaReactivedTime
  const badgePop = spring({ frame: frame - iaReactivedTime, fps, config: { damping: 8, stiffness: 220 } });
  const badgeScale = frame >= iaReactivedTime ? interpolate(badgePop, [0, 0.4, 1], [1, 1.18, 1]) : 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...sceneExit.style }}>

      {/* ── DING: doctor envía mensaje al paciente ── */}
      <Sequence from={messageSentTime} durationInFrames={150}>
        <Audio src={staticFile("sounds/ding3.mp3")} volume={0.65} />
      </Sequence>

      {/* ── NOTIFICATION: IA se reactiva ── */}
      <Sequence from={iaReactivedTime} durationInFrames={150}>
        <Audio src={staticFile("sounds/succes.mp3")} volume={0.65} />
      </Sequence>

      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>

        {/* PANEL DASHBOARD MACRO */}
        <div style={{
          width: 980, height: 780, background: "rgba(255, 255, 255, 0.45)", backdropFilter: "blur(32px)",
          borderRadius: 40, border: "1px solid rgba(255, 255, 255, 0.75)", boxShadow: "0 30px 80px rgba(15,32,68,0.12)",
          transform: `translateY(${macroY}px) scale(${macroScale * 0.95})`, opacity: macroOpacity, display: "flex", overflow: "hidden", position: "relative",
        }}>

          {/* SIDEBAR (Corriendo un poco a la derecha + Margen extra) */}
          <aside style={{ width: 220, flexShrink: 0, height: "100%", padding: "32px 24px", display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.35)", borderLeft: "1px solid rgba(255,255,255,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36, paddingLeft: 6 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: COLORS.navy900, display: "flex", alignItems: "center", justifyContent: "center" }}><BotIcon size={17} color="white" /></div>
              <span style={{ fontFamily: "Inter", fontSize: 17, fontWeight: 800, color: COLORS.navy900, letterSpacing: "-0.03em" }}>NovTurnIA</span>
            </div>

            <nav style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 6 }}>
              {NAV_ITEMS.map(({ label, Icon, active, hasSub }) => (
                <div key={label}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 12, background: active ? "rgba(255,255,255,0.6)" : "transparent", color: active ? COLORS.navy900 : "rgba(15,32,104,0.38)", fontFamily: "Inter", fontWeight: 700, fontSize: 13.5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}> <Icon size={14} color={active ? COLORS.navy900 : "rgba(15,32,104,0.38)"} /> {label} </div>
                    {hasSub && <ChevronDownIcon size={12} />}
                  </div>
                  {hasSub && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 40, marginTop: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", color: "rgba(15,32,104,0.25)", fontFamily: "Inter", fontSize: 12, fontWeight: 600 }}><UsersIcon size={12} /> Usuarios</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", color: "rgba(15,32,104,0.25)", fontFamily: "Inter", fontSize: 12, fontWeight: 600 }}><HistoryIcon size={12} /> Actividad</div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </aside>

          {/* MAIN COLUMN CONTENT Area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.12)", minWidth: 0 }}>
            <div style={{ height: 78, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 14 }}>
              <div style={{ width: 42, height: 42, background: "rgba(255,255,255,0.75)", backdropFilter: "blur(6px)", borderRadius: 14, border: "1.2px solid rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 5px 15px rgba(0,0,0,0.05)", position: "relative" }}>
                <BellIcon size={18} color={COLORS.navy900} />
                <div style={{ position: "absolute", top: -2, right: -2, background: "#EF4444", width: 13, height: 13, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "white", border: "1.8px solid white", transform: `scale(${notifPulse})` }}>1</div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: COLORS.navy900, color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 0 1px 0", boxShadow: "0 6px 18px rgba(15,32,104,0.2)" }}>
                <span style={{ fontFamily: "Inter", fontWeight: 800, fontSize: 14, lineHeight: "1em", height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>JD</span>
              </div>
            </div>

            <div style={{ padding: "0 32px 16px 32px" }}>
              <h1 style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 800, color: COLORS.navy900, margin: 0, letterSpacing: "-0.02em" }}>Conversaciones</h1>
              <p style={{ fontFamily: "Inter", fontSize: 11.5, fontWeight: 600, color: "rgba(15,32,104,0.4)" }}>Atención directa vía WhatsApp</p>
            </div>

            {/* INTERFAZ DE CHAT Area Area Area */}
            <div style={{ flex: 1, margin: "0 28px 28px 28px", background: "white", borderRadius: 32, border: "1px solid rgba(0,0,0,0.04)", display: "flex", overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
              <div style={{ width: 240, borderRight: "1px solid rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <div style={{ padding: "16px" }}> <div style={{ height: 40, background: "rgba(255,255,255,0.6)", borderRadius: 100, border: "1px solid rgba(0,0,0,0.04)", display: "flex", alignItems: "center", padding: "0 14px", gap: 7 }}><SearchIcon size={14} color="rgba(15,32,104,0.3)" /><span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: "rgba(15,32,104,0.2)" }}>Busca...</span></div> </div>
                <div style={{ flex: 1, padding: "0 6px" }}>
                  {[{ name: "Maggie Marroquín", initials: "MM", human: true, active: true }, { name: "Carlos Ruiz", initials: "CR", human: false, active: false }].map(p => (
                    <div key={p.name} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, background: p.active ? "rgba(29,95,173,0.05)" : "transparent", borderRadius: 14, margin: "0 6px" }}>
                      {/* Icono: Azul si Maggie esta seleccionada (p.active), blanco para Carlos Ruiz */}
                      <div style={{
                        width: 35, height: 35, borderRadius: "50%",
                        background: p.active ? COLORS.navy900 : "#F8FAFC",
                        color: p.active ? "white" : COLORS.navy900,
                        border: p.active ? "none" : "1px solid rgba(0,0,0,0.05)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11.5
                      }}>{p.initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 800, color: COLORS.navy900 }}>{p.name}</div>
                        <div style={{ fontSize: 10.5, color: "rgba(0,0,0,0.3)", fontWeight: 600 }}>+502 4798</div>
                      </div>
                      {p.human && <div style={{ width: 6.5, height: 6.5, borderRadius: "50%", background: "#F59E0B", transform: `scale(${dotPulse})` }} />}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
                <div style={{ height: 72, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.04)", background: "white", zIndex: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* El icono de cabecera siempre blanco como pediste */}
                    <div style={{ width: 35, height: 35, borderRadius: "50%", background: "#F8FAFC", color: COLORS.navy900, border: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11.5 }}>MM</div>
                    <span style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 800, color: COLORS.navy900 }}>Maggie Marroquín</span>
                  </div>
                  <div style={{ padding: "7px 16px", borderRadius: 100, border: "1.2px solid #FEF3C7", background: frame >= iaReactivedTime ? "#DCFCE7" : "#FFFBEB", color: frame >= iaReactivedTime ? "#065F46" : "#B45309", fontFamily: "Inter", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, transform: `scale(${badgeScale})`, transformOrigin: "right center" }}>
                    <BotIcon size={12} color={frame >= iaReactivedTime ? "#065F46" : "#B45309"} /> {frame >= iaReactivedTime ? "IA Reactivada" : "Reactivar IA"}
                  </div>
                </div>

                <div style={{ flex: 1, padding: "24px 36px", display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ alignSelf: "flex-start", background: "#F1F5F9", padding: "11px 18px", borderRadius: "18px 18px 18px 4px", maxWidth: "75%" }}>
                      <p style={{ margin: 0, fontSize: 13, fontFamily: "Inter", color: COLORS.navy900, fontWeight: 500 }}>Tengo mucho dolor, necesito ver al doctor HOY 🆘</p>
                    </div>
                    <div style={{ alignSelf: "flex-start", background: "#F1F5F9", padding: "11px 18px", borderRadius: "18px 18px 18px 4px", maxWidth: "75%" }}>
                      <p style={{ margin: 0, fontSize: 13, fontFamily: "Inter", color: COLORS.navy900, fontWeight: 500 }}>Es urgente, por favor 🥹</p>
                    </div>
                    <div style={{ alignSelf: "flex-start", background: "#F1F5F9", padding: "11px 18px", borderRadius: "18px 18px 18px 4px", maxWidth: "75%" }}>
                      <p style={{ margin: 0, fontSize: 13, fontFamily: "Inter", color: COLORS.navy900, fontWeight: 500 }}>¿Hay alguien disponible? 😮</p>
                    </div>

                    {/* Mensaje IA */}
                    <div style={{ alignSelf: "flex-end", background: COLORS.navy900, padding: "12px 20px", borderRadius: "20px 20px 4px 20px", maxWidth: "75%" }}>
                      <p style={{ margin: 0, fontSize: 13, fontFamily: "Inter", color: "white", fontWeight: 500 }}>Entendido. He notificado al equipo médico de tu caso urgente. ✅</p>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "Inter", fontWeight: 600 }}>11:53 PM</span>
                      </div>
                    </div>

                    {/* Mensaje nuevo Doctor */}
                    {frame >= messageSentTime && (
                      <div style={{ overflow: "hidden", maxHeight: `${MSG5_H * msg5Spring}px` }}>
                        <div style={{ alignSelf: "flex-end", display: "flex", justifyContent: "flex-end", opacity: Math.min(1, msg5Spring * 4) }}>
                          <div style={{ background: COLORS.navy900, padding: "12px 20px", borderRadius: "20px 20px 4px 20px", maxWidth: "75%" }}>
                            <p style={{ margin: 0, fontSize: 13.5, fontFamily: "Inter", color: "white", fontWeight: 500 }}>¡Hola Maggie! 🤝 ¿Cómo te puedo ayudar? Te habla el doctor Juan Diego, ya recibí tu aviso.</p>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "Inter", fontWeight: 600 }}>11:54 PM</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: "18px 24px", borderTop: "1px solid rgba(0,0,0,0.04)", display: "flex", gap: 14, background: "white", zIndex: 10 }}>
                  <div style={{ flex: 1, height: 46, background: "#F8FAFC", borderRadius: 14, border: "1px solid rgba(0,0,0,0.04)", display: "flex", alignItems: "center", padding: "0 18px", fontFamily: "Inter", fontSize: 12.5, color: "#94A3B8" }}> {frame >= typingStart && frame < messageSentTime ? "¡Hola Maggie! 🤝 ¿Cómo te puedo ayudar?..." : "Escribe un mensaje..."} </div>
                  <div style={{ width: 46, height: 46, background: frame >= messageSentTime ? "#F1F5F9" : COLORS.primary, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}> <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={frame >= messageSentTime ? COLORS.navy900 : "white"} strokeWidth={2.5}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg> </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
