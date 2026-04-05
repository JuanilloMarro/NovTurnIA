import { AbsoluteFill } from "remotion";
import { COLORS } from "../../../types/constants";

/**
 * Escena 6 — CTA (150 frames / 5s)
 * Placeholder — pendiente de desarrollo
 */
export const Scene6CTA: React.FC = () => {
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Inter, -apple-system, sans-serif",
            fontSize: 48,
            fontWeight: 800,
            color: COLORS.navy900,
            letterSpacing: "-0.03em",
          }}
        >
          NovTurnIA
        </span>
        <span
          style={{
            fontFamily: "Inter, -apple-system, sans-serif",
            fontSize: 22,
            fontWeight: 400,
            color: COLORS.navy500,
            marginTop: 16,
          }}
        >
          Agenda tu negocio con IA, 24/7
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
