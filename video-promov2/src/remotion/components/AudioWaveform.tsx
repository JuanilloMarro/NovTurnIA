import React from "react";
import { useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";

/**
 * AudioWaveform — barras reactivas al audio real del voiceover.
 *
 * Notas técnicas:
 * - La voz humana tiene energía en 85–3500 Hz → bins bajos del espectro.
 * - Audio de voz es mucho más silencioso que música → escala logarítmica.
 * - numberOfSamples: 64 → 64 bins; la voz vive en los primeros ~20 bins.
 */
export const AudioWaveform: React.FC<{
  barCount?: number;
  width?: number;
  height?: number;
  color?: string;
  intensity?: number;
  opacity?: number;
}> = ({
  barCount = 36,
  width = 500,
  height = 32,
  color = "#1D5FAD",
  intensity = 1,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({
    src: staticFile("voiceover/video voiceover.mp3"),
    frame,
    fps,
    windowInSeconds: 10,
  });

  if (!audioData) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", opacity, gap: 2 }}>
        {Array.from({ length: barCount }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: color, opacity: 0.15 }} />
        ))}
      </div>
    );
  }

  const frequencies = visualizeAudio({
    fps,
    frame,
    audioData,
    // 64 bins totales. La voz vive en los primeros ~20.
    // Tomamos los primeros barCount bins (frecuencias bajas-medias).
    numberOfSamples: 64,
    optimizeFor: "speed",
    dataOffsetInSeconds,
  });

  // Solo los primeros barCount bins — ahí está la energía de la voz
  const voiceBins = frequencies.slice(0, barCount);

  // Escala logarítmica: convierte valores casi-cero de voz en alturas visibles
  const MIN_DB = -80;
  const MAX_DB = -20; // rango ajustado para speech (más estrecho que música)

  const scaled = voiceBins.map((value) => {
    const db = 20 * Math.log10(Math.max(value, 1e-6));
    return Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB)));
  });

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
      {scaled.map((value, i) => {
        const barHeight = Math.max(2, value * height * intensity);
        const barOpacity = 0.25 + value * 0.75;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * barWidth + gap / 2,
              width: actualBarW,
              height: barHeight,
              bottom: (height - barHeight) / 2,
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
