import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { COLORS } from "../../../types/constants";

/**
 * Escena 2 — El Problema (600 frames / 10s @60fps)
 *
 * f   0–180  → Reloj + pregunta
 * f 160–560  → Mensajes (uno cada ~1.5s)
 * f 555–595  → Salida suave
 */
export const Scene2Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── RELOJ ──────────────────────────────────────────────────────
  const clockPopIn = spring({
    frame,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1.2 },
    durationInFrames: 60,
  });

  const hourAngleDeg = interpolate(frame, [0, 60], [90, 420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const hourRad = (hourAngleDeg * Math.PI) / 180;
  const hourX2 = 12 + Math.sin(hourRad) * 5;
  const hourY2 = 12 - Math.cos(hourRad) * 5;

  const slideSpring = spring({
    frame: frame - 60,
    fps,
    config: { damping: 25, stiffness: 120 },
    durationInFrames: 60,
  });

  const clockTranslateX = interpolate(slideSpring, [0, 1], [0, -220]);
  const questionTranslateX = interpolate(slideSpring, [0, 1], [-100, 120]);
  const questionOpacity = interpolate(slideSpring, [0.2, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const questionScaleIn = interpolate(slideSpring, [0, 1], [0.8, 1]);

  const labelReveal = spring({ frame: frame - 30, fps, config: { damping: 200 } });

  const exitSpring = spring({ frame: frame - 180, fps, config: { damping: 200 }, durationInFrames: 40 });
  const exitScale = interpolate(exitSpring, [0, 1], [1, 0]);
  const finalClockScale = interpolate(clockPopIn, [0, 1], [0, 1]) * exitScale;

  // ── MENSAJES (espaciados ~1.5s entre cada uno) ─────────────────
  const pillPop = spring({ frame: frame - 165, fps, config: { damping: 20, stiffness: 160 } });

  const msg1Pop = spring({ frame: frame - 210, fps, config: { damping: 20, stiffness: 180 } });
  const check1Pop = spring({ frame: frame - 265, fps, config: { damping: 10, stiffness: 200 } });

  const msg2Pop = spring({ frame: frame - 305, fps, config: { damping: 20, stiffness: 180 } });
  const check2Pop = spring({ frame: frame - 360, fps, config: { damping: 10, stiffness: 200 } });

  const msg3Pop = spring({ frame: frame - 390, fps, config: { damping: 20, stiffness: 180 } });
  const check3Pop = spring({ frame: frame - 440, fps, config: { damping: 10, stiffness: 200 } });

  const msg4Pop = spring({ frame: frame - 475, fps, config: { damping: 20, stiffness: 180 } });

  // Push-up centrado
  const PUSH_MSG_RIGHT = 94;
  const PUSH_MSG_LEFT = 114;

  const push1 = interpolate(msg1Pop, [0, 1], [0, -PUSH_MSG_RIGHT]);
  const push2 = interpolate(msg2Pop, [0, 1], [0, -PUSH_MSG_RIGHT]);
  const push3 = interpolate(msg3Pop, [0, 1], [0, -PUSH_MSG_RIGHT]);
  const push4 = interpolate(msg4Pop, [0, 1], [0, -PUSH_MSG_LEFT]);

  const INITIAL_OFFSET = 173;
  const containerY = INITIAL_OFFSET + push1 + push2 + push3 + push4;

  const msg1X = interpolate(msg1Pop, [0, 1], [60, 0]);
  const msg2X = interpolate(msg2Pop, [0, 1], [60, 0]);
  const msg3X = interpolate(msg3Pop, [0, 1], [60, 0]);
  const msg4X = interpolate(msg4Pop, [0, 1], [-60, 0]);

  // ── SALIDA ────────────────────────────────────────────────────
  const exitOpacity = interpolate(frame, [555, 595], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const CheckIcon = ({ scale }: { scale: number }) => (
    <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>

        {/* ── RELOJ Y PREGUNTA ── */}
        {frame < 220 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "100%", height: "100%" }}>

            {frame >= 60 && (
              <div style={{
                position: "absolute",
                transform: `translateX(${questionTranslateX}px) scale(${questionScaleIn * exitScale})`,
                opacity: questionOpacity * exitScale,
                textAlign: "right",
                width: 500,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}>
                <h2 style={{
                  fontFamily: "Inter, -apple-system, sans-serif",
                  fontSize: 47,
                  fontWeight: 800,
                  color: COLORS.navy900,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.15,
                  margin: 0,
                }}>
                  ¿Quién agenda<br />
                  cuando tu<br />
                  negocio cierra?
                </h2>
              </div>
            )}

            <div style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: `translateX(${clockTranslateX}px) scale(${finalClockScale})`,
            }}>
              <div style={{
                width: 170, height: 170, borderRadius: 48, background: COLORS.navy900,
                border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 12px 60px rgba(15,32,68,0.26)",
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}>
                <svg width={96} height={96} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx={12} cy={12} r={10} />
                  <line x1={12} y1={3} x2={12} y2={4.5} strokeWidth={1.5} />
                  <line x1={21} y1={12} x2={19.5} y2={12} strokeWidth={1.5} />
                  <line x1={12} y1={21} x2={12} y2={19.5} strokeWidth={1.5} />
                  <line x1={3} y1={12} x2={4.5} y2={12} strokeWidth={1.5} />
                  <line x1={12} y1={12} x2={hourX2} y2={hourY2} strokeWidth={2} />
                  <line x1={12} y1={12} x2={12} y2={4.5} strokeWidth={1.5} />
                  <circle cx={12} cy={12} r={0.6} fill="white" stroke="none" />
                </svg>
                <span style={{
                  position: "absolute", top: 215, left: "50%", transform: "translateX(-50%)",
                  fontFamily: "Inter, -apple-system, sans-serif", fontSize: 28, fontWeight: 600,
                  color: COLORS.navy500, letterSpacing: "0.12em", textTransform: "uppercase" as const,
                  whiteSpace: "nowrap", opacity: interpolate(labelReveal, [0, 1], [0, 1]) * exitScale,
                }}>2 AM</span>
              </div>
            </div>
          </div>
        )}

        {/* ── MENSAJES ── */}
        {frame >= 160 && (
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
              <span style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 700, color: "rgba(0,0,0,0.45)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                3 MENSAJES SIN LEER (FUERA DE LÍNEA)
              </span>
            </div>

            {/* Msg 1 */}
            <div style={{ alignSelf: "flex-end", transform: `translateX(${msg1X}px)`, opacity: interpolate(msg1Pop, [0, 1], [0, 1]), maxWidth: 380 }}>
              <div style={{ background: "#DCF8C6", borderRadius: "18px 18px 4px 18px", padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>Hola! Me gustaría agendar una cita 😊</div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>2:14 AM</span>
                  <CheckIcon scale={interpolate(check1Pop, [0, 1], [0, 1])} />
                </div>
              </div>
            </div>

            {/* Msg 2 */}
            <div style={{ alignSelf: "flex-end", transform: `translateX(${msg2X}px)`, opacity: interpolate(msg2Pop, [0, 1], [0, 1]), maxWidth: 380 }}>
              <div style={{ background: "#DCF8C6", borderRadius: "18px 18px 4px 18px", padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>¿Hola?</div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>2:17 AM</span>
                  <CheckIcon scale={interpolate(check2Pop, [0, 1], [0, 1])} />
                </div>
              </div>
            </div>

            {/* Msg 3 */}
            <div style={{ alignSelf: "flex-end", transform: `translateX(${msg3X}px)`, opacity: interpolate(msg3Pop, [0, 1], [0, 1]), maxWidth: 380 }}>
              <div style={{ background: "#DCF8C6", borderRadius: "18px 18px 4px 18px", padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>🥺🥺🥺</div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>2:19 AM</span>
                  <CheckIcon scale={interpolate(check3Pop, [0, 1], [0, 1])} />
                </div>
              </div>
            </div>

            {/* Msg 4 — IA */}
            <div style={{ alignSelf: "flex-start", transform: `translateX(${msg4X}px)`, opacity: interpolate(msg4Pop, [0, 1], [0, 1]), maxWidth: 420 }}>
              <div style={{ background: "#FFFFFF", borderRadius: "4px 18px 18px 18px", padding: "16px 20px", boxShadow: "0 4px 20px rgba(15,32,68,0.06)", border: "1px solid rgba(255,255,255,0.6)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: COLORS.navy900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
                      <path d="M2 14h2" /><path d="M20 14h2" /><path d="M9 13v2" /><path d="M15 13v2" />
                    </svg>
                  </div>
                  <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 700, color: COLORS.navy700 }}>Asistente NovTurnIA</span>
                </div>
                <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>
                  Mientras tú descansas, tus clientes buscan opciones 📉
                </div>
              </div>
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
