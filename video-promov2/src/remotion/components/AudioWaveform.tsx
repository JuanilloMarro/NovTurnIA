import React from "react";
import { useCurrentFrame } from "remotion";

/**
 * AudioWaveform — ondas de audio reactivas horizontales
 *
 * Cada barra oscila con fase propia, sincronizada al tempo.
 * El movimiento es HORIZONTAL (desplazamiento lateral), no vertical.
 * Las barras tienen diferentes amplitudes para simular reactividad real.
 *
 * @param barCount    Número de barras (default 24)
 * @param width       Ancho del componente en px (default 200)
 * @param height      Alto del componente en px (default 48)
 * @param color       Color base de las barras
 * @param tempoFrames Frames por beat (default 30 = 120bpm)
 * @param intensity   0..1 intensidad de la animación
 */
export const AudioWaveform: React.FC<{
  barCount?: number;
  width?: number;
  height?: number;
  color?: string;
  tempoFrames?: number;
  intensity?: number;
  opacity?: number;
}> = ({
  barCount = 24,
  width = 200,
  height = 48,
  color = "#1D5FAD",
  tempoFrames = 30,
  intensity = 1,
  opacity = 1,
}) => {
    const frame = useCurrentFrame();

    // Pre-defined "pseudo-random" amplitudes per bar (realistic waveform shape)
    const amplitudes = [
      0.3, 0.6, 0.9, 0.7, 1.0, 0.8, 0.5, 0.4,
      0.85, 0.95, 0.6, 0.75, 1.0, 0.7, 0.45, 0.8,
      0.55, 0.9, 0.65, 0.4, 0.75, 0.85, 0.5, 0.3,
    ];

    const barWidth = width / barCount;
    const gap = barWidth * 0.35;
    const actualBarW = barWidth - gap;

    return (
      <div
        style={{
          width,
          height,
          position: "relative",
          display: "flex",
          alignItems: "center",
          opacity,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: barCount }).map((_, i) => {
          const amp = amplitudes[i % amplitudes.length];

          // Cada barra tiene su propia fase (desplazamiento de onset)
          const phaseOffset = (i / barCount) * Math.PI * 2;
          const slowWave = Math.sin((frame / tempoFrames) * Math.PI * 2 + phaseOffset);
          const fastWave = Math.sin((frame / (tempoFrames * 0.5)) * Math.PI * 2 + phaseOffset * 1.3);

          // Movimiento HORIZONTAL: cada barra se desplaza lateralmente
          const horizontalShift = slowWave * amp * 6 * intensity;

          // Alto de la barra (reactivo al audio simulado)
          const barHeight =
            height * 0.2 +
            height * 0.7 * amp * Math.abs(0.5 + slowWave * 0.3 + fastWave * 0.2) * intensity;

          // Opacidad varía con la amplitud
          const barOpacity = 0.4 + amp * 0.55 * Math.abs(0.5 + slowWave * 0.5);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: i * barWidth + gap / 2 + horizontalShift,
                width: actualBarW,
                height: Math.max(2, barHeight),
                bottom: (height - Math.max(2, barHeight)) / 2,
                borderRadius: actualBarW / 2,
                background: color,
                opacity: barOpacity,
              }}
            />
          );
        })}
      </div>
    );
  };
