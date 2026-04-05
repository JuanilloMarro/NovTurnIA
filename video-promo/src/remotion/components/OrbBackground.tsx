import { useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../../../types/constants";

/**
 * Fondo con gradiente radial y orbes flotantes —
 * replica exacta del body::before + .lg-orb del sistema NovTurnIA.
 * Todas las animaciones via useCurrentFrame(), CERO CSS animations.
 */
export const OrbBackground: React.FC<{ 
  opacityMultiplier?: number;
  staticMode?: boolean; 
}> = ({ opacityMultiplier = 1, staticMode = false }) => {
  const frame = useCurrentFrame();

  // Si está en modo estático, usamos un valor fijo para el cálculo de seno y sin fadein
  const f = staticMode ? 600 : frame; // Un offset arbitrario para que no todo nazca en sin(0)

  // Floating oscillation — solo Y
  // Grandes: lentas y suaves
  const orbY1 = 0;
  const orbY2 = 0;
  const orbY3 = 0;
  const orbY4 = 0;

  const orbOpacity = staticMode ? 1 : interpolate(f, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: [
          "radial-gradient(circle at 85% 10%, rgba(120,110,230,0.10) 0%, transparent 50%)",
          "radial-gradient(circle at 15% 15%, rgba(29,95,173,0.12) 0%, transparent 60%)",
          "radial-gradient(circle at 85% 85%, rgba(100,190,210,0.10) 0%, transparent 60%)",
          "radial-gradient(circle at 50% 110%, rgba(255,255,255,0.8) 0%, transparent 50%)",
          "radial-gradient(circle at 50% 50%, #F8FAFF 0%, #F0F4F8 100%)",
        ].join(", "),
      }}
    >
      {/* Orb 1 — top-left (más a la izquierda) */}
      <div
        style={{
          position: "absolute",
          width: 494,
          height: 494,
          top: -80 + orbY1,
          left: -200,
          borderRadius: "50%",
          opacity: orbOpacity * 0.54 * opacityMultiplier,
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, rgba(210,230,255,0.2) 40%, rgba(29,95,173,0.08) 70%, transparent 100%)",
          border: `1px solid ${COLORS.glassBorder}`,
          backdropFilter: "blur(80px)",
        }}
      />

      {/* Orb 2 — bottom-right (más a la derecha) */}
      <div
        style={{
          position: "absolute",
          width: 646,
          height: 646,
          bottom: -160 + orbY2,
          right: -320,
          borderRadius: "50%",
          opacity: orbOpacity * 0.54 * opacityMultiplier,
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, rgba(210,230,255,0.15) 40%, rgba(100,190,210,0.08) 70%, transparent 100%)",
          border: `1px solid ${COLORS.glassBorder}`,
          backdropFilter: "blur(80px)",
        }}
      />

      {/* Orb 3 — pequeña, zona inferior-izquierda (más a la izquierda) */}
      <div
        style={{
          position: "absolute",
          width: 266,
          height: 266,
          top: "62%",
          left: "2%",
          borderRadius: "50%",
          opacity: orbOpacity * 0.585 * opacityMultiplier,
          transform: `translateY(${orbY3}px)`,
          background:
            "radial-gradient(circle at 40% 40%, rgba(255,255,255,0.55) 0%, rgba(91,138,196,0.12) 60%, transparent 100%)",
          border: `1px solid rgba(255,255,255,0.28)`,
          backdropFilter: "blur(60px)",
        }}
      />

      {/* Orb 4 — pequeña, zona top-right (más a la derecha) */}
      <div
        style={{
          position: "absolute",
          width: 228,
          height: 228,
          top: "5%",
          right: "7%",
          borderRadius: "50%",
          opacity: orbOpacity * 0.72 * opacityMultiplier,
          transform: `translateY(${orbY4}px)`,
          background:
            "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.5) 0%, rgba(100,190,210,0.10) 60%, transparent 100%)",
          border: `1px solid rgba(255,255,255,0.22)`,
          backdropFilter: "blur(60px)",
        }}
      />

    </div>
  );
};
