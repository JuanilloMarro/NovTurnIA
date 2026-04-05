import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../../../types/constants";

/**
 * Escena 3 — La Solución (600 frames / 10s @60fps)
 *
 * Cada mensaje aparece con ~2s de separación para poder leer.
 */
export const Scene3Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── PILL ─────────────────────────────────────────────────────
  const pillPop = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 160 } });

  // ── MENSAJES (~2s = 120 frames entre cada uno) ────────────────
  const msg1Spring = spring({ frame: frame - 70, fps, config: { damping: 20, stiffness: 180 }, durationInFrames: 50 });
  const msg1Opacity = interpolate(msg1Spring, [0, 1], [0, 1]);
  const msg1X = interpolate(msg1Spring, [0, 1], [-60, 0]);

  const msg2Spring = spring({ frame: frame - 200, fps, config: { damping: 20, stiffness: 180 }, durationInFrames: 50 });
  const msg2Opacity = interpolate(msg2Spring, [0, 1], [0, 1]);
  const msg2X = interpolate(msg2Spring, [0, 1], [60, 0]);

  const msg3Spring = spring({ frame: frame - 330, fps, config: { damping: 20, stiffness: 180 }, durationInFrames: 50 });
  const msg3Opacity = interpolate(msg3Spring, [0, 1], [0, 1]);
  const msg3X = interpolate(msg3Spring, [0, 1], [-60, 0]);

  const cardPop = spring({ frame: frame - 380, fps, config: { damping: 15, stiffness: 120 }, durationInFrames: 50 });
  const cardScale = interpolate(cardPop, [0, 1], [0, 1]);

  const msg4Spring = spring({ frame: frame - 470, fps, config: { damping: 20, stiffness: 180 }, durationInFrames: 50 });
  const msg4Opacity = interpolate(msg4Spring, [0, 1], [0, 1]);
  const msg4X = interpolate(msg4Spring, [0, 1], [60, 0]);

  // ── CHECKS (aparecen ~1s después del mensaje) ──────────────────
  const check1Pop = spring({ frame: frame - 130, fps, config: { damping: 10, stiffness: 200 } });
  const check2Pop = spring({ frame: frame - 260, fps, config: { damping: 10, stiffness: 200 } });
  const check3Pop = spring({ frame: frame - 390, fps, config: { damping: 10, stiffness: 200 } });
  const check4Pop = spring({ frame: frame - 530, fps, config: { damping: 10, stiffness: 200 } });

  const DoubleCheck = ({ scale }: { scale: number }) => (
    <div style={{
      display: "flex",
      alignItems: "center",
      transform: `scale(${scale})`,
      transformOrigin: "right center",
      marginLeft: 4,
      position: "relative",
      width: 16,
      height: 10
    }}>
      {/* Primer Check (atrás) */}
      <svg width="12" height="10" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 0 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {/* Segundo Check (adelante) */}
      <svg width="12" height="10" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 4 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );

  // ── PUSH-UP CENTRADO ─────────────────────────────────────────
  const PUSH_M1 = 160;
  const PUSH_M2 = 105;
  const PUSH_M3 = 210;
  const PUSH_M4 = 94;

  const pushMsg1 = interpolate(msg1Spring, [0, 1], [0, -PUSH_M1]);
  const pushMsg2 = interpolate(msg2Spring, [0, 1], [0, -PUSH_M2]);
  const pushMsg3 = interpolate(msg3Spring, [0, 1], [0, -PUSH_M3]);
  const pushMsg4 = interpolate(msg4Spring, [0, 1], [0, -PUSH_M4]);

  const INITIAL_OFFSET = 269;
  const containerY = INITIAL_OFFSET + pushMsg1 + pushMsg2 + pushMsg3 + pushMsg4;

  // ── SALIDA ────────────────────────────────────────────────────
  const exitOpacity = interpolate(frame, [555, 595], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          position: "absolute",
          top: "50%",
          width: "100%",
          maxWidth: 600,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          transform: `translateY(${containerY}px)`,
        }}>

          {/* Pill */}
          <div style={{
            alignSelf: "center",
            transform: `scale(${interpolate(pillPop, [0, 1], [0, 1])})`,
            opacity: interpolate(pillPop, [0, 1], [0, 1]),
            background: "rgba(255, 255, 255, 0.75)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(0, 0, 0, 0.04)", borderRadius: 12, padding: "6px 14px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
          }}>
            <span style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 700, color: "rgba(0,0,0,0.45)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Inteligencia Artificial
            </span>
          </div>

          {/* Msg 1 — Bot */}
          <div style={{ alignSelf: "flex-start", opacity: msg1Opacity, transform: `translateX(${msg1X}px)` }}>
            <div style={{ background: "#FFFFFF", borderRadius: "4px 18px 18px 18px", padding: "16px 20px", boxShadow: "0 4px 20px rgba(15,32,68,0.06)", border: "1px solid rgba(255,255,255,0.6)", maxWidth: 420 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: COLORS.navy900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M9 13v2" /><path d="M15 13v2" />
                  </svg>
                </div>
                <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 700, color: COLORS.navy700 }}>Asistente NovTurnIA</span>
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>
                ¡Hola! Sí, claro ✨ Tengo disponibilidad para mañana. ¿Prefieres a las <b>10:00 AM</b> o a las <b>4:30 PM</b>?
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 6 }}>
                <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.3)" }}>2:20 AM</span>
                <DoubleCheck scale={interpolate(check1Pop, [0, 1], [0, 1])} />
              </div>
            </div>
          </div>

          {/* Msg 2 — Cliente */}
          <div style={{ alignSelf: "flex-end", opacity: msg2Opacity, transform: `translateX(${msg2X}px)` }}>
            <div style={{ background: "#DCF8C6", borderRadius: "18px 18px 4px 18px", padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", maxWidth: 380 }}>
              <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>Mañana a las 10 AM porfa! 🙏</div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
                <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>2:21 AM</span>
                <DoubleCheck scale={interpolate(check2Pop, [0, 1], [0, 1])} />
              </div>
            </div>
          </div>

          {/* Msg 3 — Bot Confirmación + Card */}
          <div style={{ alignSelf: "flex-start", opacity: msg3Opacity, transform: `translateX(${msg3X}px)` }}>
            <div style={{ background: "#FFFFFF", borderRadius: "4px 18px 18px 18px", padding: "16px 20px", boxShadow: "0 4px 20px rgba(15,32,68,0.06)", border: "1px solid rgba(255,255,255,0.6)", maxWidth: 420 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: COLORS.navy900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M9 13v2" /><path d="M15 13v2" />
                  </svg>
                </div>
                <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 700, color: COLORS.navy700 }}>Asistente NovTurnIA</span>
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45, marginBottom: 12 }}>
                ¡Listo! Tu turno está confirmado ✅ Nos vemos mañana.
              </div>

              {/* Card del turno */}
              <div style={{
                transform: `scale(${cardScale})`,
                transformOrigin: "center left",
                background: "rgba(255,255,255,0.7)", backdropFilter: "blur(20px)",
                border: `1px solid ${COLORS.glassBorder}`, borderRadius: 16,
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                boxShadow: "0 8px 30px rgba(15,32,68,0.05)",
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(29,95,173,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 700, color: COLORS.navy900 }}>Mañana, 10:00 AM</div>
                  <div style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.navy500 }}>Consulta General</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 8 }}>
                <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.3)" }}>2:21 AM</span>
                <DoubleCheck scale={interpolate(check3Pop, [0, 1], [0, 1])} />
              </div>
            </div>
          </div>

          {/* Msg 4 — Cliente */}
          <div style={{ alignSelf: "flex-end", opacity: msg4Opacity, transform: `translateX(${msg4X}px)` }}>
            <div style={{ background: "#DCF8C6", borderRadius: "18px 18px 4px 18px", padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", maxWidth: 380 }}>
              <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>¡Gracias por la excelente atención! 🙌</div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
                <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>2:22 AM</span>
                <DoubleCheck scale={interpolate(check4Pop, [0, 1], [0, 1])} />
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
