import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { COLORS } from "../../../types/constants";

/**
 * Escena 11 — Outro (660 frames / 11s @60fps)
 *
 * 1. Ícono (navy box + Bot GRANDE) sube desde abajo.
 *    Durante el peek: gira cabeza, brilla estrella (upper-left del bot),
 *    guiña ojo derecho — idéntico al comportamiento de Scene1Intro.
 * 2. Brinco hacia atrás (underdamped): bot vuelve a tamaño normal.
 * 3. Slide final: ícono se achica a logo → "NovTurnIA" desliza desde la derecha.
 */
export const Scene11Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── SPRINGS ─────────────────────────────────────────────────────
  const spIn = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 68 } });
  const spJump = spring({ frame: frame - 85, fps, config: { damping: 9, stiffness: 62 } });
  const spLogo = spring({ frame: frame - 210, fps, config: { damping: 18, stiffness: 92 } });

  // ── TAMAÑO DEL ÍCONO ────────────────────────────────────────────
  const BOX_PEEK = 700;
  const BOX_JUMP = 240;
  const BOX_LOGO = 84;

  const boxSize =
    BOX_PEEK * spIn +
    (BOX_JUMP - BOX_PEEK) * spJump +
    (BOX_LOGO - BOX_JUMP) * spLogo;

  const radius = boxSize * 0.26;

  // Bot más grande durante peek, vuelve a normal tras el brinco (igual que Intro)
  const iconRatio = interpolate(spJump, [0, 1], [0.68, 0.46]);
  const iconSize = boxSize * iconRatio;

  // Estrella: misma proporción que la intro → iconSize * 0.28
  const starSize = iconSize * 0.28;

  // ── ANIMACIONES DURANTE PEEK (mismas que Scene1Intro) ───────────
  // Rotación de cabeza: 0 → 22° → 0, ventana frames 40-84
  const robotRotation = interpolate(
    frame,
    [40, 50, 62, 76, 84],
    [0, 0, 22, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) }
  );

  // Brillo estrella durante la rotación
  const starGlow = interpolate(
    frame,
    [50, 60, 72, 82],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) }
  );
  const starExtraScale = 1 + starGlow * 0.4;

  // Guiño ojo derecho (mismo mecanismo que Intro: scaleY en SVG g)
  const winkScale = interpolate(
    frame,
    [55, 63, 70, 80],
    [1, 0, 0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) }
  );

  // ── POSICIÓN Y (offset desde centro del canvas) ─────────────────
  // Y_PEEK=500 → robot mayormente visible durante peek (cabeza + ojos + estrella en frame)
  // Con iconRatio=0.68: body bottom en canvas y≈1334 (casi al borde inferior)
  const Y_HIDE = 1045;
  const Y_PEEK = 500;
  const Y_JUMP = -15;
  const Y_LOGO = -30; // Posición para centrado visual óptimo

  const boxY =
    Y_HIDE +
    (Y_PEEK - Y_HIDE) * spIn +
    (Y_JUMP - Y_PEEK) * spJump +
    (Y_LOGO - Y_JUMP) * spLogo;

  // ── NOMBRE ─────────────────────────────────────────────────────
  const NAME_WIDTH = 420;
  const nameW = interpolate(spLogo, [0, 1], [0, NAME_WIDTH]);
  const nameOp = interpolate(spLogo, [0, 0.25, 1], [0, 1, 1]);
  const nameX = interpolate(spLogo, [0, 1], [60, 0]);
  const gapSize = interpolate(spLogo, [0, 1], [0, 28]);

  // ── SALIDA ──────────────────────────────────────────────────────
  const exitOp = interpolate(frame, [438, 465], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: exitOp }}>

      {/* ── SPARKLES: estrella brilla frames 50–82 ── */}
      <Sequence from={50} durationInFrames={32}>
        <Audio src={staticFile("sounds/sparkles.mp3")} volume={0.65} />
      </Sequence>

      {/* ── SWOOSH: robot hace el brinco ── */}
      <Sequence from={85} durationInFrames={60}>
        <Audio src={staticFile("sounds/swoosh.mp3")} volume={0.65} />
      </Sequence>

      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>

        {/* ── CONTENEDOR PRINCIPAL ── */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          // Transform simple para centrar el bloque completo sin desplazamientos asimétricos
          transform: `translateX(-50%) translateY(calc(-50% + ${boxY}px))`,
          display: "flex",
          alignItems: "center",
          gap: gapSize,
        }}>

          {/* ── ÍCONO DEL SISTEMA ── */}
          <div style={{
            width: boxSize,
            height: boxSize,
            borderRadius: radius,
            background: COLORS.navy900,
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            flexShrink: 0,
            overflow: "hidden",
            boxShadow: `0 ${boxSize * 0.05}px ${boxSize * 0.14}px rgba(15,32,68,0.30)`,
          }}>

            {/* Robot container — recibe la rotación de cabeza (igual que Intro) */}
            <div style={{
              transform: `rotate(${robotRotation}deg)`,
              transformOrigin: "center bottom",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}>

              {/* Lucide Bot SVG */}
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
                {/* Ojo derecho — guiña con scaleY + opacidad para que no desaparezca mal */}
                <g transform={`translate(15 14) scale(1 ${winkScale}) translate(-15 -14)`} style={{ opacity: winkScale < 0.1 ? 0 : 1 }}>
                  <path d="M15 13v2" />
                </g>
                {/* Ojo izquierdo — siempre abierto */}
                <path d="M9 13v2" />
              </svg>

              {/* AIStar — pegada al robot para evitar recortes al girar */}
              <div style={{
                position: "absolute",
                top: -(iconSize * 0.08), // Más pegada (era 0.14)
                left: -(iconSize * 0.08), // Más pegada (era 0.14)
                transform: `scale(${starExtraScale})`,
                transformOrigin: "center center",
                filter: starGlow > 0
                  ? `drop-shadow(0 0 ${5 * starGlow}px rgba(255,255,255,0.95)) drop-shadow(0 0 ${10 * starGlow}px ${COLORS.navy300})`
                  : "none",
              }}>
                <svg
                  width={starSize}
                  height={starSize}
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

          {/* ── NOMBRE: se revela deslizándose desde la derecha ── */}
          <div style={{
            overflow: "hidden",
            width: nameW,
            flexShrink: 0,
          }}>
            <span style={{
              display: "block",
              fontFamily: "Inter, -apple-system, sans-serif",
              fontSize: 82,
              fontWeight: 800,
              color: COLORS.navy900,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              opacity: nameOp,
              transform: `translateX(${nameX}px)`,
            }}>
              NovTurnIA
            </span>
          </div>

        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
