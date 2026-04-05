import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../../../types/constants";

/**
 * Escena 7 — Control Humano (600 frames / 10s @60fps)
 *
 * Misma estructura que Escena 2. Ícono: ambulancia conduciendo
 * (ruedas girando, carrocería rebotando, luz cuadrada parpadeando).
 */
export const Scene7HumanControl: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── AMBULANCIA — animaciones ────────────────────────────────────
  const iconPopIn = spring({
    frame,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1.2 },
    durationInFrames: 60,
  });

  // Carrocería rebota suavemente (conduciendo)
  const bounceY = Math.sin(frame / 5) * 1.4;
  // Luz cuadrada de emergencia — parpadeo ~3 veces/s a 60fps
  const alarmPulse = Math.sin(frame / 10) * 0.5 + 0.5;  // 0 a 1
  const alarmFill = `rgba(239,68,68,${(alarmPulse * 0.85 + 0.15).toFixed(2)})`;
  const alarmGlow = `0 12px 60px rgba(15,32,68,0.26), 0 0 ${Math.round(36 * alarmPulse)}px rgba(239,68,68,${(alarmPulse * 0.45).toFixed(2)})`;

  // ── SLIDE icono ← pregunta → ───────────────────────────────────
  const slideSpring = spring({
    frame: frame - 70,
    fps,
    config: { damping: 25, stiffness: 120 },
    durationInFrames: 60,
  });

  const iconTranslateX = interpolate(slideSpring, [0, 1], [0, -200]);
  const questionTranslateX = interpolate(slideSpring, [0, 1], [-100, 110]);
  const questionOpacity = interpolate(slideSpring, [0.2, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const questionScaleIn = interpolate(slideSpring, [0, 1], [0.85, 1]);

  const exitSpring = spring({ frame: frame - 180, fps, config: { damping: 200 }, durationInFrames: 40 });
  const exitScale = interpolate(exitSpring, [0, 1], [1, 0]);
  const finalIconScale = interpolate(iconPopIn, [0, 1], [0, 1]) * exitScale;

  // ── MENSAJES ────────────────────────────────────────────────────
  const pillPop = spring({ frame: frame - 205, fps, config: { damping: 20, stiffness: 160 } });

  const msg1Pop = spring({ frame: frame - 240, fps, config: { damping: 20, stiffness: 180 } });
  const check1Pop = spring({ frame: frame - 290, fps, config: { damping: 10, stiffness: 200 } });

  const msg2Pop = spring({ frame: frame - 325, fps, config: { damping: 20, stiffness: 180 } });
  const check2Pop = spring({ frame: frame - 370, fps, config: { damping: 10, stiffness: 200 } });

  const msg3Pop = spring({ frame: frame - 405, fps, config: { damping: 20, stiffness: 180 } });
  const check3Pop = spring({ frame: frame - 450, fps, config: { damping: 10, stiffness: 200 } });

  const msg4Pop = spring({ frame: frame - 475, fps, config: { damping: 20, stiffness: 180 } });
  const check4Pop = spring({ frame: frame - 525, fps, config: { damping: 10, stiffness: 200 } });

  // Push-up
  const PUSH_RIGHT = 94;
  const PUSH_LEFT = 114;
  const push1 = interpolate(msg1Pop, [0, 1], [0, -PUSH_RIGHT]);
  const push2 = interpolate(msg2Pop, [0, 1], [0, -PUSH_RIGHT]);
  const push3 = interpolate(msg3Pop, [0, 1], [0, -PUSH_RIGHT]);
  const push4 = interpolate(msg4Pop, [0, 1], [0, -PUSH_LEFT]);

  const INITIAL_OFFSET = 173;
  const containerY = INITIAL_OFFSET + push1 + push2 + push3 + push4;

  const msg1X = interpolate(msg1Pop, [0, 1], [60, 0]);
  const msg2X = interpolate(msg2Pop, [0, 1], [60, 0]);
  const msg3X = interpolate(msg3Pop, [0, 1], [60, 0]);
  const msg4X = interpolate(msg4Pop, [0, 1], [-60, 0]);

  // ── SALIDA ──────────────────────────────────────────────────────
  const exitOpacity = interpolate(frame, [555, 595], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── ✓✓ doble check ─────────────────────────────────────────────
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
      <svg width="12" height="10" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 0 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <svg width="12" height="10" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 4 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>

        {/* ── AMBULANCIA + PREGUNTA ── */}
        {frame < 240 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "100%", height: "100%" }}>

            {/* Pregunta */}
            {frame >= 70 && (
              <div style={{
                position: "absolute",
                transform: `translateX(${questionTranslateX}px) scale(${questionScaleIn * exitScale})`,
                opacity: questionOpacity * exitScale,
                textAlign: "right",
                width: 430,
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
                  lineHeight: 1.18,
                  margin: 0,
                }}>
                  ¿Y si hay un <br />
                  caso que requiera<br />
                  un humano?
                </h2>
              </div>
            )}

            {/* Navy box con ambulancia */}
            <div style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: `translateX(${iconTranslateX}px) scale(${finalIconScale})`,
            }}>
              <div style={{
                width: 180, height: 180, borderRadius: 48,
                background: COLORS.navy900,
                border: "2px solid rgba(255,255,255,0.12)",
                boxShadow: alarmGlow,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg
                  width={96} height={96}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: `translateY(${bounceY}px)` }}
                >
                  {/* Sirena */}
                  <line x1={8} y1={0.2} x2={8} y2={1.3} strokeWidth={1.2} opacity={alarmPulse} />
                  <line x1={6.1} y1={0.7} x2={6.6} y2={1.5} strokeWidth={1.1} opacity={alarmPulse * 0.7} />
                  <line x1={9.9} y1={0.7} x2={9.4} y2={1.5} strokeWidth={1.1} opacity={alarmPulse * 0.7} />
                  <circle cx={8} cy={2.9} r={1.35} fill={alarmFill} stroke="white" strokeWidth={1.2} />
                  {/* Cuerpo */}
                  <rect x={0.8} y={4.2} width={14.8} height={11.2} rx={2.2} strokeWidth={1.7} />
                  {/* Cruz */}
                  <line x1={7.7} y1={7.2} x2={7.7} y2={12.2} strokeWidth={1.7} />
                  <line x1={5.2} y1={9.7} x2={10.2} y2={9.7} strokeWidth={1.7} />
                  {/* Cabina */}
                  <path d="M 15.6 7.2 L 19.8 7.2 L 23.2 11.2 L 23.2 15.4 L 15.6 15.4" strokeWidth={1.7} />
                  <path d="M 16.1 7.7 L 19.4 7.7 L 22.5 11.0 L 16.1 11.0 Z" fill="rgba(255,255,255,0.11)" stroke="none" />
                  {/* Ruedas */}
                  <circle cx={5} cy={17.5} r={2.5} fill={COLORS.navy900} stroke="white" strokeWidth={1.6} />
                  <circle cx={17} cy={17.5} r={2.5} fill={COLORS.navy900} stroke="white" strokeWidth={1.6} />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* ── MENSAJES ── */}
        {frame >= 200 && (
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
              background: "rgba(255,255,255,0.75)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(0,0,0,0.04)", borderRadius: 12, padding: "6px 14px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
            }}>
              <span style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 700, color: "rgba(0,0,0,0.45)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                1 CASO URGENTE
              </span>
            </div>

            {/* Msg 1 */}
            <div style={{ alignSelf: "flex-end", transform: `translateX(${msg1X}px)`, opacity: interpolate(msg1Pop, [0, 1], [0, 1]), maxWidth: 400 }}>
              <div style={{ background: "#DCF8C6", borderRadius: "18px 18px 4px 18px", padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>
                  Tengo mucho dolor, necesito ver al doctor HOY 🆘
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>11:53 PM</span>
                  <DoubleCheck scale={interpolate(check1Pop, [0, 1], [0, 1])} />
                </div>
              </div>
            </div>

            {/* Msg 2 */}
            <div style={{ alignSelf: "flex-end", transform: `translateX(${msg2X}px)`, opacity: interpolate(msg2Pop, [0, 1], [0, 1]), maxWidth: 400 }}>
              <div style={{ background: "#DCF8C6", borderRadius: "18px 18px 4px 18px", padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>
                  Es urgente, por favor 🥺
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>11:53 PM</span>
                  <DoubleCheck scale={interpolate(check2Pop, [0, 1], [0, 1])} />
                </div>
              </div>
            </div>

            {/* Msg 3 */}
            <div style={{ alignSelf: "flex-end", transform: `translateX(${msg3X}px)`, opacity: interpolate(msg3Pop, [0, 1], [0, 1]), maxWidth: 400 }}>
              <div style={{ background: "#DCF8C6", borderRadius: "18px 18px 4px 18px", padding: "14px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ fontFamily: "Inter", fontSize: 19, color: "#111827", lineHeight: 1.45 }}>
                  ¿Hay alguien disponible? 😰
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>11:53 PM</span>
                  <DoubleCheck scale={interpolate(check3Pop, [0, 1], [0, 1])} />
                </div>
              </div>
            </div>

            {/* Msg 4 — IA responde */}
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
                  Entendido. He notificado al equipo médico de tu caso urgente. 🏥
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <span style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(0,0,0,0.4)" }}>11:53 PM</span>
                  <DoubleCheck scale={interpolate(check4Pop, [0, 1], [0, 1])} />
                </div>
              </div>
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
