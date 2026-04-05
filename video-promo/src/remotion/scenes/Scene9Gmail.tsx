import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../../../types/constants";

/**
 * Escena 9 — Gmail Delivery (Fin de la secuencia de datos)
 * Recrea el logo de Gmail fijo en el centro que se "apacha" al recibir el mensaje.
 */
export const Scene9Gmail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── MOVIEMIENTO ARMÓNICO (Base) ──────────────────
  const waveY = Math.sin(frame / 35) * 4;

  // ── CONFIGURACIÓN DE TIEMPOS ──────────────────────
  const gmailIn = 10;
  const deliveryStart = 80;

  // ── LOGO GMAIL FIJO EN EL CENTRO ──────────────────
  const gmailOpacity = interpolate(frame, [gmailIn, gmailIn + 20], [0, 1], { extrapolateLeft: "clamp" });
  const gmailScaleIn = spring({ frame: frame - gmailIn, fps, config: { damping: 20 } });

  // ── ANIMACIÓN AVIÓN VIENE DE LA IZQUIERDA ──────────
  const planeIn = 0;
  // El avión viaja hacia el centro absoluto
  const planeApproachX = interpolate(frame, [planeIn, deliveryStart], [-600, -50], { extrapolateRight: "clamp" });

  const deliveryProgress = interpolate(frame, [deliveryStart, deliveryStart + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const deliveryScale = interpolate(deliveryProgress, [0, 1], [1, 0.05]);
  const deliveryOpacity = interpolate(deliveryProgress, [0, 0.8, 1], [1, 1, 0]);
  const deliveryX = interpolate(deliveryProgress, [0, 1], [planeApproachX, 0]);

  // ── EFECTO DE "APACHADO" (SQUASH & STRETCH) POR IMPACTO ──────────
  const impactFrame = deliveryStart + 35;
  const impactSpring = spring({ frame: frame - impactFrame, fps, config: { damping: 12, stiffness: 150 } });

  // Apachado sutil: scaleY baja, scaleX sube un poco para compensar volumen (Squash)
  const squashY = interpolate(impactSpring, [0, 0.3, 1], [1, 0.88, 1]);
  const stretchX = interpolate(impactSpring, [0, 0.3, 1], [1, 1.08, 1]);

  const gmailFinalScale = gmailScaleIn;

  // ── SALIDA TOTAL ──────────────────────────────────
  const finishOpacity = interpolate(frame, [170, 195], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: finishOpacity }}>

      {/* ── ICONO SOBRE GLASS REALISTA ── */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: `translate(-50%, calc(-50% + ${waveY}px)) scaleX(${stretchX * gmailFinalScale}) scaleY(${squashY * gmailFinalScale})`,
        opacity: gmailOpacity,
      }}>
        {/* Sobre de Cristal Ultra-Realista */}
        <div style={{ position: "relative", width: 220, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="220" height="150" viewBox="0 0 24 24" fill="none" style={{ filter: "drop-shadow(0 20px 50px rgba(15,32,68,0.12))" }}>
            {/* Cuerpo del Sobre (Cristal Base) */}
            <rect x="2" y="4" width="20" height="16" rx="3" fill="rgba(255,255,255,0.25)" stroke={COLORS.navy900} strokeWidth={1} />

            {/* Solapa Superior de Cristal (Efecto Glassmorphism localizado) */}
            <path d="M22 6 L12 13 L2 6" fill="rgba(255,255,255,0.4)" stroke={COLORS.navy900} strokeWidth={1.5} style={{ backdropFilter: "blur(8px)" }} />

            {/* Pliegues laterales para realismo */}
            <path d="M2 20 L9 13 M22 20 L15 13" stroke={COLORS.navy900} strokeWidth={1} opacity={0.6} />

            {/* Detalle de Brillo en el Cristal */}
            <path d="M4 6 L10 6" stroke="white" strokeWidth={0.5} opacity={0.8} strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ── RECREACIÓN EXACTA ICONO MAIL SEND (Inclinación Sincronizada con Fichas) ── */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        zIndex: 15,
        transform: `
          translateX(calc(-50% + ${deliveryX}px))
          translateY(calc(-50% + ${waveY}px))
          rotate(${Math.sin(frame / 40) * 3 + Math.cos(frame / 50) * 1.5}deg)
          scale(${deliveryScale})
        `,
        opacity: deliveryOpacity,
      }}>
        <svg width={220} height={140} viewBox="0 0 40 30" fill="none" style={{ filter: "drop-shadow(0 20px 45px rgba(29,173,255,0.2))" }}>
          <defs>
            <linearGradient id="mailBodyImpact" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#eef4fa" />
            </linearGradient>
          </defs>

          {/* Líneas de velocidad en Azul Primary (Claro y visible) */}
          <line x1="2" y1="11" x2="10" y2="11" stroke={COLORS.primary} strokeWidth={2.4} strokeLinecap="round" />
          <line x1="5" y1="15" x2="10" y2="15" stroke={COLORS.primary} strokeWidth={2.4} strokeLinecap="round" />
          <line x1="7" y1="19" x2="10" y2="19" stroke={COLORS.primary} strokeWidth={2.4} strokeLinecap="round" />

          {/* Cuerpo Sobre en Azul Primary (Bordes Claramente Azules) */}
          <rect x="11" y="7" width="26" height="18" rx="2" fill="url(#mailBodyImpact)" stroke={COLORS.primary} strokeWidth={2.8} />

          {/* Cierre en Azul Primary (Triángulo Invertido) */}
          <path d="M11 9 L24 18 L37 9" stroke={COLORS.primary} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

    </AbsoluteFill>
  );
};
