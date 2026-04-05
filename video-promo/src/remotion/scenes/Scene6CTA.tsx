import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../../../types/constants";

/**
 * Escena 6 — CTA / Ambulancia (180 frames / 3s @60fps)
 * Mantiene armonía visual con la Escena 2 (Reloj)
 */
export const Scene6CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── ANIMACIÓN DE ENTRADA (Misma lógica que el reloj en Escena 2) ──
  const iconPopIn = spring({
    frame,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1.2 },
    durationInFrames: 60,
  });

  const slideSpring = spring({
    frame: frame - 60,
    fps,
    config: { damping: 25, stiffness: 120 },
    durationInFrames: 60,
  });

  // Posicionamiento idéntico al reloj para armonía
  const iconTranslateX = interpolate(slideSpring, [0, 1], [0, -220]);
  const textTranslateX = interpolate(slideSpring, [0, 1], [-100, 120]);
  const textOpacity = interpolate(slideSpring, [0.2, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textScaleIn = interpolate(slideSpring, [0, 1], [0.8, 1]);

  // Salida suave al final
  const exitOpacity = interpolate(frame, [150, 175], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>

        {/* ── TEXTO CTA ── */}
        <div style={{
          position: "absolute",
          transform: `translateX(${textTranslateX}px) scale(${textScaleIn})`,
          opacity: textOpacity,
          width: 550,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}>
          <h2 style={{
            fontFamily: "Inter, -apple-system, sans-serif",
            fontSize: 48,
            fontWeight: 800,
            color: COLORS.navy900,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            margin: 0,
          }}>
            Salva vidas,<br />
            nosotros gestionamos<br />
            tus procesos.
          </h2>
          <p style={{
            fontFamily: "Inter, -apple-system, sans-serif",
            fontSize: 20,
            fontWeight: 500,
            color: COLORS.navy500,
            marginTop: 12,
            maxWidth: 400,
          }}>
            NovTurnIA: Eficiencia total para que tu enfoque sea siempre la salud.
          </p>
        </div>

        {/* ── ICONO AMBULANCIA (Idéntico a Reloj de Escena 2) ── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateX(${iconTranslateX}px) scale(${iconPopIn})`,
        }}>
          <div style={{
            width: 180, height: 180, borderRadius: 48, background: COLORS.navy900,
            border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 12px 60px rgba(15,32,68,0.26)",
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          }}>
            {/* SVG Ambulancia — Tamaño idéntico al reloj (96x96) */}
            <svg width={96} height={96} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18h16v-9H9L4 13v5z" fill="rgba(255,255,255,0.1)" />
              <path d="M16 18V9h4l2 4v5" />
              <path d="M 12 9 L 12 7" stroke={COLORS.primary} strokeWidth={2.5} />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
              <path d="M7 13.5v3M5.5 15h3" stroke="white" strokeWidth={2} />
              <path d="M10 11h4v3h-4z" opacity={0.5} />
            </svg>

            <span style={{
              position: "absolute", top: 215, left: "50%", transform: "translateX(-50%)",
              fontFamily: "Inter, -apple-system, sans-serif", fontSize: 24, fontWeight: 700,
              color: COLORS.primary, letterSpacing: "0.15em", textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>Prioridad 1</span>
          </div>
        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};

