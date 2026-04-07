import React from "react";
import { useCurrentFrame } from "remotion";

/**
 * DynamicBackground — 2 ondas gigantes en movimiento de figura-8
 *
 * Problema anterior: 6-8 fuentes pequeñas → 4 puntos visibles separados.
 * Solución: SOLO 2 blobs ENORMES (250%×200%) en trayectorias de Lissajous.
 *
 * Una trayectoria de Lissajous (X con período T, Y con período T/2) crea
 * un camino de figura-8 que nunca se queda estático y cubre todo el canvas.
 *
 * Los dos blobs se mueven en fases opuestas: cuando A está arriba-izquierda,
 * B está abajo-derecha → siempre hay color en todo el canvas.
 *
 * Tamaño 250%×200% = el blob siempre es MÁS GRANDE que el canvas → sin
 * bordes duros visibles, solo transición suave de color por todo el fondo.
 */
export const DynamicBackground: React.FC<{
  modalActive?: boolean;
}> = ({ modalActive = false }) => {
  const frame = useCurrentFrame();

  // ─────────────────────────────────────────────────────────────────
  // TRAYECTORIAS DE LISSAJOUS
  // X: período largo (frame/180 → ~1131f = 18.8s)
  // Y: período corto (frame/90 → ~565f = 9.4s) = Y va 2x más rápido
  // Resultado: camino de figura-8 que cruza todo el canvas
  // ─────────────────────────────────────────────────────────────────

  // BLOB A — navy500 primario — oscila zona inferior
  const ax = 50 + Math.sin(frame / 180) * 78;   // -28% → 128%
  const ay = 62 + Math.sin(frame / 90) * 42;    // 20% → 104% (zona baja-media)

  // BLOB B — navy300 — oscila zona SUPERIOR (opuesto a A)
  // Desfasado en Y con base en 35% para que cubra la zona alta del canvas
  const bx = 50 - Math.sin(frame / 180) * 72;   // -22% → 122%
  const by = 35 - Math.sin(frame / 90) * 38;    // -3% → 73% (zona alta-media)

  // ─────────────────────────────────────────────────────────────────
  // CAPA AMBIENTAL — blob grande centrado, cubre la zona media
  // ─────────────────────────────────────────────────────────────────
  const cx = 50 + Math.cos(frame / 400) * 30;
  const cy = 42 + Math.sin(frame / 320) * 22;   // se mueve en zona central-alta

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        filter: modalActive ? "blur(20px)" : undefined,
      }}
    >
      {/* ── BASE SÓLIDA — siempre visible desde frame 0 ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(145deg, #F4F8FE 0%, #EEF4FB 50%, #E8F0F8 100%)",
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          CAPA AMBIENTAL — blob base muy grande y lento
          300%×280% → siempre cubre más que el canvas completo
          Opacidad baja (0.12) para dar el "tinte" base de navy
          ══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 300% 280% at ${cx}% ${cy}%,
            rgba(29, 95, 173, 0.11) 0%,
            rgba(29, 95, 173, 0.05) 40%,
            transparent 70%
          )`,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          BLOB A — Navy500 primario — figura-8 rápida
          250%×200% → SIEMPRE más grande que el canvas
          El centro se mueve, pero el blob nunca "desaparece"
          ya que sus bordes siempre sobrepasan los límites del canvas

          3 capas concéntricas del mismo blob para falloff ultra suave:
          sin bordes duros, sin "punto" concentrado
          ══════════════════════════════════════════════════════════════ */}

      {/* Capa exterior — halo difuso muy grande */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 250% 200% at ${ax}% ${ay}%,
            rgba(29, 95, 173, 0.10) 0%,
            rgba(29, 95, 173, 0.04) 35%,
            transparent 65%
          )`,
        }}
      />

      {/* Capa media — color más intenso */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 160% 130% at ${ax}% ${ay}%,
            rgba(29, 95, 173, 0.21) 0%,
            rgba(29, 95, 173, 0.10) 35%,
            rgba(29, 95, 173, 0.02) 60%,
            transparent 80%
          )`,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          BLOB B — Navy300 complementario — figura-8 opuesta al A
          Cuando A está en la esquina superiorizquierda,
          B está en la esquina inferior-derecha → todo el canvas cubierto
          ══════════════════════════════════════════════════════════════ */}

      {/* Capa exterior */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 240% 195% at ${bx}% ${by}%,
            rgba(91, 138, 196, 0.10) 0%,
            rgba(91, 138, 196, 0.04) 35%,
            transparent 65%
          )`,
        }}
      />

      {/* Capa media */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 155% 125% at ${bx}% ${by}%,
            rgba(91, 138, 196, 0.22) 0%,
            rgba(91, 138, 196, 0.10) 35%,
            rgba(91, 138, 196, 0.02) 60%,
            transparent 80%
          )`,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          BRILLO BLANCO CENTRAL FIJO
          Mantiene el fondo claro y legible — las waves flotan "encima"
          del blanco sin oscurecer el fondo
          ══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 110% 80% at 50% 42%,
            rgba(255, 255, 255, 0.68) 0%,
            rgba(255, 255, 255, 0.32) 45%,
            rgba(255, 255, 255, 0.08) 68%,
            transparent 85%
          )`,
        }}
      />

      {/* ── Vignette perimetral navy ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            ellipse 130% 130% at 50% 50%,
            transparent 50%,
            rgba(29, 95, 173, 0.10) 100%
          )`,
        }}
      />
    </div>
  );
};
