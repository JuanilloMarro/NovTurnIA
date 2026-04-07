import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

/**
 * OrbBackground — esferas de vidrio flotantes
 *
 * Opacidades individuales por orb para equilibrar visibilidad:
 * - Orbs 1, 2, 4: parcialmente fuera del canvas → opacidad más alta (0.60-0.65)
 * - Orb 3: completamente dentro del canvas → reducida (0.34) para igualar
 */
export const OrbBackground: React.FC<{
  opacityMultiplier?: number;
  staticMode?: boolean;
}> = ({ opacityMultiplier = 1, staticMode = false }) => {
  const frame = useCurrentFrame();
  const f = staticMode ? 600 : frame;

  // ─── FLOTACIÓN MUY LENTA ─────────────────────────────────────────
  const orbY1 = Math.sin((f / 240) * Math.PI * 2) * 12;
  const orbX1 = Math.sin((f / 340) * Math.PI * 2 + 0.5) * 7;
  const orbY2 = Math.sin((f / 300) * Math.PI * 2 + 1.2) * 15;
  const orbX2 = Math.sin((f / 400) * Math.PI * 2 + 1.8) * 9;
  const orbY3 = Math.sin((f / 260) * Math.PI * 2 + 2.4) * 9;
  const orbY4 = Math.sin((f / 200) * Math.PI * 2 + 0.8) * 7;

  const orbOpacity = staticMode
    ? 1
    : interpolate(f, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  // ─── INTERIOR DE VIDRIO (casi transparente — waves pasan a través) ─
  const glassInterior = [
    // Relleno navy muy suave — da cuerpo sin tapar el fondo
    "radial-gradient(circle at 50% 50%, rgba(180,210,240,0.06) 0%, rgba(29,95,173,0.02) 60%, transparent 85%)",
    // Highlight especular (top-left)
    "radial-gradient(circle at 30% 27%, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.18) 22%, transparent 44%)",
    // Sombra de curvatura inferior sutil
    "radial-gradient(circle at 55% 78%, rgba(29,95,173,0.04) 0%, transparent 45%)",
    // Reflejo back-lit pequeño
    "radial-gradient(circle at 68% 72%, rgba(255,255,255,0.10) 0%, transparent 28%)",
  ].join(", ");

  const glassBorder = "1px solid rgba(255,255,255,0.30)";

  const glassShadow = [
    "0 0 0 1px rgba(29, 95, 173, 0.11)",
    "0 0 12px 2px rgba(255,255,255,0.10)",
    "inset 0 0 0 1px rgba(255,255,255,0.16)",
    "inset 0 3px 10px rgba(255,255,255,0.12)",
    "inset 0 -6px 18px rgba(29, 95, 173, 0.05)",
    "0 8px 24px rgba(29, 95, 173, 0.08)",
  ].join(", ");

  // Opacidades individuales — equilibran la visibilidad según posición en canvas
  const op1 = orbOpacity * 0.38 * opacityMultiplier; // top-left
  const op2 = orbOpacity * 0.26 * opacityMultiplier; // bottom-right → bajado para igualar
  const op3 = orbOpacity * 0.34 * opacityMultiplier; // bottom-left
  const op4 = orbOpacity * 0.38 * opacityMultiplier; // top-right

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>

      {/* ── ORB 1 — grande, top-left ── */}
      <div
        style={{
          position: "absolute",
          width: 494,
          height: 494,
          top: -80 + orbY1,
          left: -200 + orbX1,
          borderRadius: "50%",
          opacity: op1,
          background: glassInterior,
          border: glassBorder,
          boxShadow: glassShadow,
        }}
      />

      {/* ── ORB 2 — grande, bottom-right ── */}
      <div
        style={{
          position: "absolute",
          width: 646,
          height: 646,
          bottom: -260 + orbY2,
          right: -420 + orbX2,
          borderRadius: "50%",
          opacity: op2,
          background: glassInterior,
          border: glassBorder,
          boxShadow: glassShadow,
        }}
      />

      {/* ── ORB 3 — mediana, bottom-left (completamente visible → opacidad baja) ── */}
      <div
        style={{
          position: "absolute",
          width: 266,
          height: 266,
          top: "62%",
          left: "2%",
          borderRadius: "50%",
          opacity: op3,
          transform: `translateY(${orbY3}px)`,
          background: glassInterior,
          border: glassBorder,
          boxShadow: glassShadow,
        }}
      />

      {/* ── ORB 4 — mediana, top-right ── */}
      <div
        style={{
          position: "absolute",
          width: 228,
          height: 228,
          top: "5%",
          right: "7%",
          borderRadius: "50%",
          opacity: op4,
          transform: `translateY(${orbY4}px)`,
          background: glassInterior,
          border: glassBorder,
          boxShadow: glassShadow,
        }}
      />

    </div>
  );
};
