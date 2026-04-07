import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../../../types/constants";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  delay?: number;
}

/** Ícono Bot exacto del sistema (Lucide Bot + AIStar) */
export const BotIcon: React.FC<{
  iconSize: number;
  boxSize: number;
  radius: number;
  starScale?: number;
}> = ({ iconSize, boxSize, radius, starScale = 1 }) => (
  <div
    style={{
      width: boxSize,
      height: boxSize,
      borderRadius: radius,
      background: COLORS.navy900,
      border: "1px solid rgba(255,255,255,0.12)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 20px rgba(15,32,68,0.25)",
      flexShrink: 0,
      position: "relative",
    }}
  >
    {/* Lucide Bot SVG — paths exactos */}
    <svg
      width={iconSize}
      height={iconSize}
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
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>

    {/* AIStar — esquina superior izquierda */}
    <svg
      style={{
        position: "absolute",
        top: -4 * starScale,
        left: -4 * starScale,
        transform: `scale(${starScale})`,
        transformOrigin: "center",
      }}
      width={10}
      height={10}
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
);

/** Logo NovTurnIA completo (ícono + texto) con entrance spring */
export const Logo: React.FC<LogoProps> = ({ size = "md", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(entrance, [0, 1], [20, 0]);

  const sizes = {
    sm: { box: 28, icon: 14, text: 16, gap: 8, radius: 7 },
    md: { box: 40, icon: 18, text: 22, gap: 12, radius: 10 },
    lg: { box: 56, icon: 26, text: 32, gap: 16, radius: 13 },
  };

  const s = sizes[size];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: s.gap,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <BotIcon boxSize={s.box} iconSize={s.icon} radius={s.radius} />
      <span
        style={{
          fontFamily: "Inter, -apple-system, sans-serif",
          fontSize: s.text,
          fontWeight: 700,
          color: COLORS.navy900,
          letterSpacing: "-0.02em",
        }}
      >
        NovTurnIA
      </span>
    </div>
  );
};
