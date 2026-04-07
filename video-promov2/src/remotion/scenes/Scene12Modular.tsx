import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../../../types/constants";
import { useDirectionalExit } from "../components/SceneMotion";

/**
 * Escena 12 — Modular a la Medida (400 frames / ~6.7s @60fps)
 *
 * Push-up real: cada elemento nuevo empuja todo el stack hacia arriba.
 * INITIAL_OFFSET calculado para que el estado final quede
 * exactamente centrado vertical y horizontalmente.
 *
 * Orden en el stack:
 *   1. Título
 *   2. Tarjeta Barbería
 *   3. Tarjeta Dental
 *   4. Tarjeta Salón
 *   5. Tarjeta Consultorio
 *   6. Badge "Modular · Adaptable · A tu medida"
 */

// Cuánto empuja hacia arriba cada elemento al aparecer
const PUSH_TITLE = 120; // altura título (~106px) + gap (14)
const PUSH_CARD = 104; // altura tarjeta (~90px)  + gap (14)
const PUSH_BADGE = 50; // marginTop (~16) + altura badge (~34)

// containerY final cuando todo está visible = -(suma total / 2)
const TOTAL_PUSH = PUSH_TITLE + PUSH_CARD * 4 + PUSH_BADGE; // 586
const INITIAL_OFFSET = TOTAL_PUSH / 2; // 293 — empieza debajo del centro

// ── TARJETA ──────────────────────────────────────────────────────
const BizCard: React.FC<{
  entryX: number;
  opacity: number;
  icon: React.ReactNode;
  accentBg: string;
  accentText: string;
  title: string;
  moduleName: string;
  description: string;
  badgeOffsetY?: number;
  phase?: number;
}> = ({ entryX, opacity, icon, accentBg, accentText, title, moduleName, description, badgeOffsetY = 0, phase = 0 }) => {
  const frame = useCurrentFrame();
  const breathe = 1 + Math.sin(frame * 0.035 + phase) * 0.004;
  return (
  <div style={{
    transform: `translateX(${entryX}px) scale(${breathe})`,
    opacity,
    background: "rgba(255,255,255,0.74)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.88)",
    borderRadius: 26,
    padding: "18px 24px",
    display: "flex",
    alignItems: "center",
    gap: 18,
    boxShadow: "0 10px 36px rgba(15,32,68,0.07)",
  }}>
    <div style={{
      width: 52, height: 52, borderRadius: 16,
      background: accentBg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
        <span style={{
          fontFamily: "Inter", fontSize: 15.5, fontWeight: 800,
          color: COLORS.navy900, letterSpacing: "-0.02em", lineHeight: 1,
        }}>{title}</span>
        <div style={{
          background: accentBg, borderRadius: 100, padding: "5px 12px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: `translateY(${badgeOffsetY}px)`,
        }}>
          <span style={{
            fontFamily: "Inter", fontSize: 9.5, fontWeight: 800,
            color: accentText, textTransform: "uppercase" as const, letterSpacing: "0.07em",
            lineHeight: 1,
          }}>{moduleName}</span>
        </div>
      </div>
      <p style={{
        fontFamily: "Inter", fontSize: 12, fontWeight: 500,
        color: "rgba(15,32,68,0.50)", margin: 0, lineHeight: 1.5,
      }}>{description}</p>
    </div>
  </div>
  );
};

export const Scene12Modular: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── SPRINGS DE ENTRADA ───────────────────────────────────────────
  const spTitle = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 130 } });
  const sp1 = spring({ frame: frame - 52, fps, config: { damping: 12, stiffness: 180 } });
  const sp2 = spring({ frame: frame - 92, fps, config: { damping: 12, stiffness: 180 } });
  const sp3 = spring({ frame: frame - 132, fps, config: { damping: 12, stiffness: 180 } });
  const sp4 = spring({ frame: frame - 172, fps, config: { damping: 12, stiffness: 180 } });
  const spBadge = spring({ frame: frame - 212, fps, config: { damping: 22, stiffness: 120 } });

  // ── PUSH-UP: cada elemento sube el stack al aparecer ─────────────
  const pushTitle = interpolate(spTitle, [0, 1], [0, -PUSH_TITLE]);
  const pushC1 = interpolate(sp1, [0, 1], [0, -PUSH_CARD]);
  const pushC2 = interpolate(sp2, [0, 1], [0, -PUSH_CARD]);
  const pushC3 = interpolate(sp3, [0, 1], [0, -PUSH_CARD]);
  const pushC4 = interpolate(sp4, [0, 1], [0, -PUSH_CARD]);
  const pushBadge = interpolate(spBadge, [0, 1], [0, -PUSH_BADGE]);

  const containerY =
    INITIAL_OFFSET +
    pushTitle + pushC1 + pushC2 + pushC3 + pushC4 + pushBadge;

  // ── ANIMACIONES INDIVIDUALES DE ENTRADA ──────────────────────────
  // Título: sube desde abajo
  const titleY = interpolate(spTitle, [0, 1], [28, 0]);
  const titleOp = interpolate(spTitle, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });

  // Tarjetas: deslizan desde la derecha (igual que mensajes en otras escenas)
  const cx = (sp: number) => interpolate(sp, [0, 1], [65, 0]);
  const co = (sp: number) => interpolate(sp, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });

  // Badge final: sube desde abajo
  const badgeY = interpolate(spBadge, [0, 1], [20, 0]);
  const badgeOp = interpolate(spBadge, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });

  // ── SALIDA: tarjetas salen hacia la DERECHA ───────────────────
  const sceneExit = useDirectionalExit('right', 433, 22, 1000);


  return (
    <AbsoluteFill style={{ ...sceneExit.style, overflow: "hidden" }}>
      <div style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translateX(-50%) translateY(${containerY}px)`,
        width: 720,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>


        {/* 1 — Título */}
        <div style={{
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOp,
          paddingBottom: 6,
        }}>
          <h2 style={{
            fontFamily: "Inter", fontSize: 46, fontWeight: 800,
            color: COLORS.navy900, letterSpacing: "-0.03em",
            lineHeight: 1.15, margin: 5,
          }}>
            No es solo<br />
            <span style={{ color: COLORS.primary }}>agendamiento.</span>
          </h2>
        </div>

        {/* 2 — Dental */}
        <BizCard
          entryX={cx(sp1)} opacity={co(sp1)}
          accentBg="rgba(16,185,129,0.10)" accentText="#065F46"
          title="Clínica Dental"
          moduleName="Control de tratamientos"
          badgeOffsetY={0.5}
          phase={0}
          description="Tratamientos activos, plan de visitas por paciente, seguimiento y presupuestos."
          icon={
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
              stroke="#10B981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C9.5 2 8 3.8 8 5.5c0 2.5 1.2 4.8 1.5 8 .2 1.5.3 2.5.8 3.5.3.7.9 1 1.7 1s1.4-.3 1.7-1l.3-1.5.3 1.5c.3.7.9 1 1.7 1s1.4-.3 1.7-1c.5-1 .6-2 .8-3.5.3-3.2 1.5-5.5 1.5-8C22 3.8 20.5 2 18 2c-1.2 0-2.3.7-3 1.8C14.3 2.7 13.2 2 12 2z" />
            </svg>
          }

        />

        {/* 2 — Consultorio */}
        <BizCard
          entryX={cx(sp2)} opacity={co(sp2)}
          accentBg="rgba(239,68,68,0.08)" accentText="#991B1B"
          title="Consultorio Médico"
          moduleName="Historial clínico"
          badgeOffsetY={1}
          phase={1.5}
          description="Motivo de consulta, diagnóstico, alergias, recetas y seguimiento post-consulta."
          icon={
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
              stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }

        />

        {/* 3 — Barbería */}
        <BizCard
          entryX={cx(sp3)} opacity={co(sp3)}
          accentBg="rgba(29,95,173,0.09)" accentText={COLORS.primary}
          title="Barbería / Estética"
          moduleName="Servicios & catálogo"
          badgeOffsetY={1}
          phase={3}
          description="Tipos de corte, duración por servicio, ficha de cliente y preferencias."
          icon={
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
              stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          }
        />

        {/* 4 — Salón */}
        <BizCard
          entryX={cx(sp4)} opacity={co(sp4)}
          accentBg="rgba(245,158,11,0.10)" accentText="#92400E"
          title="Salón de Belleza"
          moduleName="Fichas de procedimientos"
          phase={4.7}
          description="Colorimetría, insumos por servicio, historial de procedimientos y fórmulas."
          icon={
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
              stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c0 4.5 2.5 6.5 7 7-4.5.5-7 2.5-7 7 0-4.5-2.5-6.5-7-7 4.5-.5 7-2.5 7-7z" />
              <path d="M5 5.5C5 7 4 8 2.5 8.5 4 9 5 10 5 11.5 5 10 6 9 7.5 8.5 6 8 5 7 5 5.5z" />
            </svg>
          }

        />

        {/* 6 — Badge (reemplaza al tagline, aparece al final) */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 2,
          transform: `translateY(${badgeY}px)`,
          opacity: badgeOp,
        }}>
          <div style={{
            display: "inline-block",
            background: "rgba(29,95,173,0.09)",
            borderRadius: 100, padding: "9px 24px",
          }}>
            <span style={{
              fontFamily: "Inter", fontSize: 12, fontWeight: 800,
              color: COLORS.primary, textTransform: "uppercase" as const,
              letterSpacing: "0.08em",
            }}>Modular · Adaptable · A tu medida</span>
          </div>
        </div>

      </div>
    </AbsoluteFill>
  );
};
