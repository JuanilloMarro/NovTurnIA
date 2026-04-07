import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../../../types/constants";


// ─── ICONOS SVG — Replicando Lucide React (mismos del sistema real) ───────────

const BellIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const CalendarIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const UsersIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const MessageCircleIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

const BarChart2Icon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="18" y1="20" y2="10" />
    <line x1="12" x2="12" y1="20" y2="4" />
    <line x1="6" x2="6" y1="20" y2="14" />
  </svg>
);

const SettingsIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const HistoryIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M7 8h10" />
    <path d="M7 12h10" />
    <path d="M7 16h10" />
  </svg>
);

const ChevronLeftIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronDownIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const ChevronRightIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);


const BotIcon = ({ size = 16, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M9 13v2" />
    <path d="M15 13v2" />
  </svg>
);

// Sidebar nav items — matches real system exactly
const NAV_ITEMS = [
  { label: "Turnos",         Icon: CalendarIcon,      active: true  },
  { label: "Pacientes",      Icon: UsersIcon,         active: false },
  { label: "Conversaciones", Icon: MessageCircleIcon, active: false },
  { label: "Estadísticas",   Icon: BarChart2Icon,     active: false },
  { label: "Configuración",  Icon: SettingsIcon,      active: false },
];

/**
 * Escena 5 — El Dashboard (240 frames / 8s)
 */
export const Scene5Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── PANEL PRINCIPAL ──────────────────────────────────────────
  const pop = spring({ frame: frame - 50, fps, config: { damping: 25, stiffness: 140 } });
  const macroScale = interpolate(pop, [0, 1], [0.88, 1]);
  const macroOpacity = interpolate(pop, [0, 1], [0, 1]);
  const macroY = interpolate(pop, [0, 1], [40, 0]);

  // ─── NOTIFICACIÓN ─────────────────────────────────────────────
  const notifTime = 220;
  const notifSpring = spring({ frame: frame - notifTime, fps, config: { damping: 12, stiffness: 200 } });
  const notifScale = interpolate(notifSpring, [0, 1], [0, 1]);

  // ─── NUEVO EVENTO ─────────────────────────────────────────────
  const eventTime = 190;

  // ─── SALIDA DE ESCENA: dashboard desaparece con fade suave ────
  const exitOpacity = interpolate(frame, [360, 400], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });


  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: exitOpacity }}>
      {/* PANEL MACRO — 920px ancho para respirar en 1080px canvas */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: 920,
          height: 740,
          background: "rgba(255, 255, 255, 0.45)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          borderRadius: 40,
          border: "1px solid rgba(255, 255, 255, 0.75)",
          boxShadow: "0 30px 80px rgba(15,32,68,0.12), inset 0 2px 4px rgba(255,255,255,0.8)",
          transform: `translateY(${macroY}px) scale(${macroScale})`,
          opacity: macroOpacity,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}>

          {/* ── SIDEBAR ── */}
          <aside style={{
            width: 220,
            flexShrink: 0,
            height: "100%",
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(255,255,255,0.35)",
          }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36, paddingLeft: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, background: COLORS.navy900,
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}>
                <BotIcon size={16} />
              </div>
              <span style={{
                fontFamily: "Inter", fontSize: 16, fontWeight: 800,
                color: COLORS.navy900, letterSpacing: "-0.03em",
              }}>NovTurnIA</span>
            </div>

            {/* Nav */}
            <nav style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 6 }}>
              {NAV_ITEMS.map(({ label, Icon, active }) => (
                <div key={label}>
                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 14px", borderRadius: 12,
                      background: active ? "rgba(255,255,255,0.6)" : "transparent",
                      color: active ? COLORS.navy900 : "rgba(15,32,104,0.38)",
                      fontFamily: "Inter", fontWeight: 700, fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon size={14} color={active ? COLORS.navy900 : "rgba(15,32,104,0.38)"} />
                      {label}
                    </div>
                    {label === "Configuración" && <ChevronDownIcon size={11} />}
                  </div>

                  {/* Submenú desplegado (Solo para Configuración) */}
                  {label === "Configuración" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 38, marginTop: 4, marginBottom: 6 }}>
                      {[
                        { sub: "Usuarios", SubIcon: UsersIcon },
                        { sub: "Actividad", SubIcon: HistoryIcon },
                      ].map(({ sub, SubIcon }) => (
                        <div key={sub} style={{ 
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "6px 0", fontFamily: "Inter", fontSize: 11.5, 
                          fontWeight: 600, color: "rgba(15,32,104,0.32)" 
                        }}>
                          <SubIcon size={12} color="rgba(15,32,104,0.25)" />
                          {sub}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </aside>

          {/* ── MAIN CONTENT ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.12)", minWidth: 0 }}>

            {/* TOPBAR */}
            <div style={{
              height: 64, padding: "0 24px",
              display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12,
            }}>
              {/* Bell */}
              <div style={{
                height: 36, padding: "0 4px",
                background: "rgba(255,255,255,0.65)", borderRadius: 100,
                border: "1px solid rgba(255,255,255,0.7)",
                display: "flex", alignItems: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}>
                <div style={{
                  position: "relative", width: 28, height: 28, borderRadius: "50%",
                  background: "white", display: "flex", alignItems: "center", justifyContent: "center",
                  color: COLORS.navy900,
                }}>
                  <BellIcon size={13} />
                  {frame >= notifTime && (
                    <div style={{
                      position: "absolute", top: -2, right: -2,
                      background: "#EF4444", width: 12, height: 12, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 7, fontWeight: 800, color: "white",
                      transform: `scale(${notifScale})`,
                      boxShadow: "0 2px 5px rgba(239,68,68,0.4)",
                      border: "1.5px solid white",
                    }}>1</div>
                  )}
                </div>
              </div>

              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: 11, background: COLORS.navy900,
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Inter", fontWeight: 800, fontSize: 11, letterSpacing: "0.02em",
              }}>JD</div>
            </div>

            {/* MODULE HEADER */}
            <div style={{ padding: "0 24px 16px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{
                    fontFamily: "Inter", fontSize: 16, fontWeight: 800,
                    color: COLORS.navy900, margin: "0 0 2px 0",
                  }}>Turnos</h3>
                  <p style={{
                    fontFamily: "Inter", fontSize: 9.5, fontWeight: 600,
                    color: "rgba(15,32,104,0.4)", margin: 0,
                    textTransform: "uppercase" as const, letterSpacing: "0.04em",
                  }}>Gestión de citas de la clínica</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Date nav pill */}
                  <div style={{
                    display: "flex", alignItems: "center",
                    background: "white", borderRadius: 100,
                    border: "1px solid rgba(0,0,0,0.05)", padding: "3px",
                    height: 32, boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#f8fafc",
                    }}>
                      <ChevronLeftIcon size={11} />
                    </div>
                    <div style={{ padding: "0 10px", display: "flex", alignItems: "center", gap: 5 }}>
                      <CalendarIcon size={11} color={COLORS.navy900} />
                      <span style={{
                        fontFamily: "Inter", fontSize: 9.5, fontWeight: 800,
                        color: COLORS.navy900, textTransform: "capitalize" as const,
                      }}>Octubre 2026</span>
                    </div>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#f8fafc",
                    }}>
                      <ChevronRightIcon size={11} />
                    </div>
                  </div>

                  {/* View toggle pill */}
                  <div style={{
                    display: "flex", alignItems: "center",
                    background: "white", borderRadius: 100,
                    border: "1px solid rgba(0,0,0,0.05)", padding: "3px", height: 32,
                  }}>
                    <div style={{
                      padding: "0 12px", height: 26, borderRadius: 100,
                      background: "white", display: "flex", alignItems: "center",
                      fontFamily: "Inter", fontSize: 9.5, fontWeight: 800, color: COLORS.navy900,
                      border: "1px solid rgba(0,0,0,0.05)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                    }}>Día</div>
                    <div style={{ padding: "0 12px", fontFamily: "Inter", fontSize: 9.5, fontWeight: 700, color: "rgba(0,0,0,0.28)" }}>Semana</div>
                    <div style={{ padding: "0 12px", fontFamily: "Inter", fontSize: 9.5, fontWeight: 700, color: "rgba(0,0,0,0.28)" }}>Mes</div>
                  </div>

                  {/* Add button */}
                  <div style={{
                    padding: "0 14px", height: 32, borderRadius: 100,
                    background: "white", display: "flex", alignItems: "center",
                    fontFamily: "Inter", fontSize: 9.5, fontWeight: 800, color: COLORS.navy900,
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}>+ Agregar Turno</div>
                </div>
              </div>
            </div>

            {/* CALENDAR PANEL */}
            <div style={{
              flex: 1, margin: "0 24px 24px 24px",
              background: "white", borderRadius: 24,
              border: "1px solid rgba(0,0,0,0.04)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              {/* Day header */}
              <div style={{
                height: 52, borderBottom: "1px solid rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, background: COLORS.navy900,
                  color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Inter", fontWeight: 800, fontSize: 14,
                }}>12</div>
                <div>
                  <div style={{
                    fontFamily: "Inter", fontSize: 10, fontWeight: 800,
                    color: COLORS.navy900, textTransform: "uppercase" as const, letterSpacing: "0.04em",
                  }}>Miércoles</div>
                  <div style={{ fontFamily: "Inter", fontSize: 9.5, fontWeight: 600, color: "rgba(0,0,0,0.32)" }}>
                    Octubre de 2026
                  </div>
                </div>
              </div>

              {/* Time grid */}
              <div style={{ flex: 1, display: "flex", position: "relative" }}>
                {/* Hour gutter */}
                <div style={{ width: 60, borderRight: "1px solid rgba(0,0,0,0.04)", paddingTop: 8, flexShrink: 0 }}>
                  {[9, 10, 11, 12, 1, 2, 3].map(h => (
                    <div key={h} style={{
                      height: 72, textAlign: "right", paddingRight: 12,
                      fontFamily: "Inter", fontSize: 9.5, fontWeight: 700,
                      color: "rgba(0,0,0,0.2)",
                    }}>{h}:00</div>
                  ))}
                </div>

                {/* Grid cells + events */}
                <div style={{ flex: 1, position: "relative" }}>
                  {/* Hour lines */}
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} style={{
                      position: "absolute", top: i * 72, left: 0, right: 0,
                      height: 1, background: "rgba(0,0,0,0.025)",
                    }} />
                  ))}

                  {/* Evento 1 — María López (confirmado, borde emerald) */}
                  <div style={{
                    position: "absolute", top: 8, left: 10, right: 10, height: 56,
                    background: "white",
                    border: "1px solid rgba(0,0,0,0.04)",
                    borderLeft: `3px solid #10B981`,
                    borderRadius: "2px 12px 12px 2px",
                    padding: "10px 14px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  }}>
                    <div style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 800, color: COLORS.navy900, marginBottom: 2 }}>
                      María López
                    </div>
                    <div style={{ fontFamily: "Inter", fontSize: 9.5, fontWeight: 600, color: "#10B981" }}>
                      9:00 AM · Confirmado ✅
                    </div>
                  </div>

                  {/* Evento 2 — Juan Pérez (agendado por IA, pop in) */}
                  {frame >= eventTime && (() => {
                    const popEvent = spring({ frame: frame - eventTime, fps, config: { damping: 10, stiffness: 120 } });
                    return (
                      <div style={{
                        position: "absolute", top: 80, left: 10, right: 10, height: 56,
                        background: "white",
                        border: "1px solid rgba(16,185,129,0.18)",
                        borderLeft: "3px solid #10B981",
                        borderRadius: "2px 12px 12px 2px",
                        padding: "10px 14px",
                        boxShadow: "0 8px 24px rgba(16,185,129,0.12)",
                        transform: `scale(${interpolate(popEvent, [0, 1], [0.85, 1])})`,
                        transformOrigin: "top center",
                        opacity: interpolate(popEvent, [0, 1], [0, 1]),
                        zIndex: 10,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 800, color: COLORS.navy900 }}>
                            Juan Diego
                          </span>
                          <span style={{
                            background: "#DCF8C6", padding: "1px 7px", borderRadius: 6,
                            fontFamily: "Inter", fontSize: 8, fontWeight: 800, color: "#166534",
                            letterSpacing: "0.02em",
                          }}>IA ✨</span>
                        </div>
                        <div style={{ fontFamily: "Inter", fontSize: 9.5, fontWeight: 600, color: "#10B981", marginTop: 2 }}>
                          10:00 AM · Confirmado
                        </div>
                      </div>
                    );
                  })()}

                  {/* Evento 3 — Carlos Ruiz (pendiente, borde navy) */}
                  <div style={{
                    position: "absolute", top: 152, left: 10, right: 10, height: 56,
                    background: "white",
                    border: "1px solid rgba(0,0,0,0.04)",
                    borderLeft: `3px solid ${COLORS.navy700}`,
                    borderRadius: "2px 12px 12px 2px",
                    padding: "10px 14px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  }}>
                    <div style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 800, color: COLORS.navy900, marginBottom: 2 }}>
                      Carlos Ruiz
                    </div>
                    <div style={{ fontFamily: "Inter", fontSize: 9.5, fontWeight: 600, color: COLORS.navy700 }}>
                      11:00 AM · Pendiente
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TOAST */}
            {frame >= notifTime && (() => {
              const toastSlide = spring({ frame: frame - notifTime, fps, config: { damping: 20, stiffness: 140 } });
              const progressTime = frame - notifTime;
              return (
                <div style={{
                  position: "absolute", bottom: 28, right: 28, width: 300,
                  background: "#f0fdf4", borderRadius: 18,
                  border: "1px solid #bbf7d0",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.07)", overflow: "hidden",
                  transform: `translateX(${interpolate(toastSlide, [0, 1], [380, 0])}px)`,
                  zIndex: 100,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, background: "#dcfce7",
                      color: "#059669", display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 800, color: "#064e3b" }}>
                        ¡Turno Agendado con Éxito!
                      </div>
                      <div style={{
                        fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "#047857",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        NovTurnIA agendó a <b>Juan Diego</b>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 3, width: "100%", background: "rgba(0,0,0,0.04)" }}>
                    <div style={{
                      height: "100%", background: "#10b981",
                      width: `${Math.min(100, (progressTime / 120) * 100)}%`,
                    }} />
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
