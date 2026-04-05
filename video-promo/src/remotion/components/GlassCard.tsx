import React from "react";
import { COLORS } from "../../../types/constants";

interface GlassCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  premium?: boolean;
}

/**
 * Replica de .glass-morphism / .glass-premium del sistema.
 * Sin animaciones — el padre se encarga del motion.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  premium = false,
}) => {
  return (
    <div
      style={{
        background: premium ? COLORS.glassPremium : COLORS.glass,
        backdropFilter: premium ? "blur(32px) saturate(200%)" : "blur(12px)",
        WebkitBackdropFilter: premium
          ? "blur(32px) saturate(200%)"
          : "blur(12px)",
        border: `1px solid ${COLORS.glassBorder}`,
        boxShadow: premium
          ? "0 4px 24px rgba(26,58,107,0.04), 0 8px 48px rgba(26,58,107,0.08)"
          : "0 2px 8px rgba(15,32,68,0.06), 0 1px 3px rgba(15,32,68,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
