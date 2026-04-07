import React from "react";
import { useCurrentFrame, useVideoConfig, } from "remotion";

/**
 * ZDollyWrapper — dolly-in constante en eje Z (push-in de cámara)
 *
 * Aplica un ligero zoom-in progresivo a su contenido a lo largo del video.
 * La escala va de 1.0 → dollyEndScale en `totalDuration` frames.
 *
 * Parámetros:
 * @param dollyEndScale  Escala final (default 1.06 → +6% de zoom al final)
 * @param children       Contenido a envolver
 * @param startFrame     Frame desde donde inicia el dolly (default 0)
 */
export const ZDollyWrapper: React.FC<{
  dollyEndScale?: number;
  startFrame?: number;
  children: React.ReactNode;
}> = ({ dollyEndScale = 1.06, startFrame = 0, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Interpolación suave del zoom (ease-in muy suave para no percibirse)
  // Se mapea desde startFrame hasta el final del video
  const t = Math.max(0, frame - startFrame);
  const totalRange = durationInFrames - startFrame;

  // scale: 1.0 → dollyEndScale durante toda la duración
  // Usando interpolación con easing cuadrático para que se sienta orgánico
  const rawProgress = Math.min(t / totalRange, 1);
  // ease-in cuadrático muy suave
  const easedProgress = rawProgress * rawProgress * 0.5 + rawProgress * 0.5;
  const scale = 1 + (dollyEndScale - 1) * easedProgress;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};
