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
 * Escena 1 — Intro (360 frames / 6s @60fps)
 */
export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── POP IN ──────────────────────────────────────────────────
  const popIn = spring({
    frame,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1.2 },
    durationInFrames: 70,
  });
  const popScale = interpolate(popIn, [0, 1], [0, 1]);

  // ─── ROBOT: rotación ─────────────────────────────────────────
  const robotRotation = interpolate(
    frame,
    [0, 44, 74, 104, 124],
    [0, 0, 22, 0, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.sin),
    }
  );

  // ─── ROBOT: Y (salto) ────────────────────────────────────────
  const robotJumpY = interpolate(
    frame,
    [136, 144, 168, 190],
    [0, 0, -65, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    }
  );

  // Squash al aterrizar
  const landSquash = interpolate(
    frame,
    [188, 196, 208],
    [1, 0.78, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ─── GLOW ESTRELLA ───────────────────────────────────────────
  const starGlow = interpolate(
    frame,
    [44, 64, 84, 104],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    }
  );
  const starExtraScale = 1 + starGlow * 0.4;

  // ─── GUIÑO ───────────────────────────────────────────────────
  const winkScale = interpolate(
    frame,
    [52, 62, 72, 84],
    [1, 0, 0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    }
  );

  // ─── BOX ─────────────────────────────────────────────────────
  const BOX_LARGE = 400;
  const BOX_SMALL = 50;

  const shrinkSpring = spring({
    frame: frame - 190,
    fps,
    config: { damping: 200 },
    durationInFrames: 70,
  });

  const hasLanded = frame >= 190;
  const currentBoxSize = hasLanded
    ? interpolate(shrinkSpring, [0, 1], [BOX_LARGE, BOX_SMALL])
    : BOX_LARGE;
  const currentBoxRadius = hasLanded
    ? interpolate(shrinkSpring, [0, 1], [110, 11])
    : 110;

  const currentRobotSize = currentBoxSize * 0.45;
  const currentStarSize = currentRobotSize * 0.28;

  const boxTranslateX = interpolate(shrinkSpring, [0, 1], [0, -128]);
  const boxTranslateY = interpolate(shrinkSpring, [0, 1], [0, -51.5]);

  // ─── TEXTO ───────────────────────────────────────────────────
  const textReveal = spring({
    frame: frame - 196,
    fps,
    config: { damping: 200 },
    durationInFrames: 64,
  });
  const textOpacity = interpolate(textReveal, [0, 1], [0, 1]);
  const nameX = interpolate(textReveal, [0, 1], [24, 0]);
  const taglineY = interpolate(textReveal, [0, 1], [20, 0]);

  const subReveal = spring({
    frame: frame - 224,
    fps,
    config: { damping: 200 },
    durationInFrames: 56,
  });
  const subOpacity = interpolate(subReveal, [0, 1], [0, 1]);
  const subY = interpolate(subReveal, [0, 1], [16, 0]);

  // Micro-float (frecuencia /44 para mantener velocidad visual a 60fps)
  const floatY = frame > 260 ? Math.sin((frame - 260) / 44) * 4 : 0;

  // ─── SALIDA DE ESCENA ─────────────────────────────────────────
  const exitOpacity = interpolate(frame, [310, 355], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {/* ── CAPA 2: Texto (siempre detrás del box) ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "Inter, -apple-system, sans-serif",
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.navy900,
              letterSpacing: "-0.03em",
              whiteSpace: "nowrap",
              opacity: textOpacity,
              transform: `translateX(${nameX}px)`,
              display: "inline-block",
            }}
          >
            NovTurnIA
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            opacity: textOpacity,
            transform: `translateY(${taglineY}px)`,
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: "Inter, -apple-system, sans-serif",
              fontSize: 28,
              fontWeight: 500,
              color: COLORS.navy700,
              letterSpacing: "-0.01em",
            }}
          >
            Agenda tu negocio con IA, 24/7
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: "Inter, -apple-system, sans-serif",
              fontSize: 18,
              fontWeight: 400,
              color: `${COLORS.navy500}bb`,
              letterSpacing: "0.01em",
            }}
          >
            Clínicas · Barberías · Salones · y más
          </span>
        </div>
      </AbsoluteFill>

      {/* ── CAPA 3: Box del icono ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            transform: `
              translateY(${floatY + boxTranslateY}px)
              translateX(${boxTranslateX}px)
              scale(${popScale})
            `,
            transformOrigin: "center center",
          }}
        >
          <div
            style={{
              width: currentBoxSize,
              height: currentBoxSize,
              borderRadius: currentBoxRadius,
              background: COLORS.navy900,
              border: "1.5px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 40px rgba(15,32,68,0.26)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                transform: `
                  rotate(${robotRotation}deg)
                  translateY(${robotJumpY}px)
                  scaleY(${landSquash})
                `,
                transformOrigin: "center bottom",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <svg
                width={currentRobotSize}
                height={currentRobotSize}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <g transform={`translate(15 14) scale(1 ${winkScale}) translate(-15 -14)`}>
                  <path d="M15 13v2" />
                </g>
                <path d="M9 13v2" />
              </svg>

              <div
                style={{
                  position: "absolute",
                  top: -(currentRobotSize * 0.14),
                  left: -(currentRobotSize * 0.14),
                  transform: `scale(${starExtraScale})`,
                  transformOrigin: "center center",
                  filter: starGlow > 0
                    ? `drop-shadow(0 0 ${5 * starGlow}px rgba(255,255,255,0.95)) drop-shadow(0 0 ${10 * starGlow}px ${COLORS.navy300})`
                    : "none",
                }}
              >
                <svg
                  width={currentStarSize}
                  height={currentStarSize}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2c0 6 3 9 10 10-7 1-10 4-10 10-1-7-4-10-10-10 6-1 9-4 10-10z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
