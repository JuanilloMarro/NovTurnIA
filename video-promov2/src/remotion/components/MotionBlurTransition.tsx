import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/**
 * MotionBlurSwipe — salida de escena con motion blur direccional de alta velocidad
 *
 * Simula un swipe horizontal de alta velocidad mediante:
 * 1. Translación lateral acelerada
 * 2. Escalado X (compresión en dirección de movimiento)
 * 3. Desenfoque CSS progresivo
 *
 * @param direction  "left" | "right" (dirección del swipe)
 * @param startFrame Frame donde comienza el swipe
 * @param duration   Duración del swipe en frames (default 20)
 * @param children   Contenido de la escena saliente
 */
export const MotionBlurSwipe: React.FC<{
  direction?: "left" | "right";
  startFrame: number;
  duration?: number;
  children: React.ReactNode;
}> = ({ direction = "left", startFrame, duration = 20, children }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Easing acelerado (ease-in cúbico) para sensación de alta velocidad
  const eased = progress * progress * progress;

  const offset = direction === "left" ? -1 : 1;
  const translateX = eased * 1200 * offset; // px de desplazamiento
  const scaleX = 1 - eased * 0.15;         // compresión lateral
  const blurAmount = eased * 24;            // blur creciente
  const opacity = interpolate(progress, [0.7, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translateX(${translateX}px) scaleX(${scaleX})`,
        filter: `blur(${blurAmount}px)`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

/**
 * SpringBounceModal — aparición de modal con spring-bounce
 *
 * Transforma de 0.9x → 1.0x con overshoot (underdamped spring).
 * Snap al tempo: el inicio de la animación se puede sincronizar con un beat.
 *
 * @param startFrame  Frame donde inicia la animación
 * @param children    Contenido del modal
 */
export const SpringBounceModal: React.FC<{
  startFrame: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ startFrame, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring underdamped: damping bajo para el bounce característico
  const sp = spring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: 10,   // bajo → más rebote
      stiffness: 180, // alto → respuesta rápida
      mass: 0.8,      // ligero → velocidad al inicio
    },
    durationInFrames: 50,
  });

  // Parte de 0.9x (no de 0 para que el overshoot se sienta sobre la escala normal)
  const scale = interpolate(sp, [0, 1], [0.9, 1]);
  const opacity = interpolate(sp, [0, 0.15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: "center center",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * TypewriterText — efecto máquina de escribir para texto
 *
 * Revela el texto carácter por carácter, sincronizado al tempo.
 * Velocidad: un carácter cada `framesPerChar` frames.
 *
 * @param text          Texto a revelar
 * @param startFrame    Frame donde inicia
 * @param framesPerChar Frames por carácter (default 3)
 * @param style         Estilos del contenedor `span`
 */
export const TypewriterText: React.FC<{
  text: string;
  startFrame: number;
  framesPerChar?: number;
  style?: React.CSSProperties;
}> = ({ text, startFrame, framesPerChar = 3, style }) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const visibleChars = Math.min(text.length, Math.floor(elapsed / framesPerChar));
  const cursorVisible = elapsed >= 0 && visibleChars < text.length
    ? Math.floor(elapsed / 10) % 2 === 0
    : false;

  return (
    <span style={{ ...style, display: "inline-block" }}>
      {text.slice(0, visibleChars)}
      {cursorVisible && (
        <span style={{ opacity: 0.7, marginLeft: "1px" }}>|</span>
      )}
    </span>
  );
};

/**
 * OdometerNumber — animación de número tipo cuentakilómetros
 *
 * El número incrementa gradualmente desde `from` → `to` con easing orgánico.
 * Snap al tempo con organic easing (ease out cubic).
 *
 * @param from        Valor inicial
 * @param to          Valor final
 * @param startFrame  Frame donde inicia
 * @param duration    Duración de la animación en frames
 * @param decimals    Lugares decimales (default 0)
 * @param style       Estilos del span
 */
export const OdometerNumber: React.FC<{
  from: number;
  to: number;
  startFrame: number;
  duration: number;
  decimals?: number;
  suffix?: string;
  style?: React.CSSProperties;
}> = ({ from, to, startFrame, duration, decimals = 0, suffix = "", style }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ease-out cúbico muy orgánico (no lineal)
  const eased = 1 - Math.pow(1 - progress, 3);
  const value = from + (to - from) * eased;

  return (
    <span style={{ display: "inline-block", ...style }}>
      {value.toFixed(decimals)}{suffix}
    </span>
  );
};

/**
 * SlideUpEntry — entrada vertical desde abajo con ease-out de desaceleración
 *
 * @param startFrame  Frame donde inicia la entrada
 * @param offsetY     px desde donde sube (default 60)
 * @param children    Contenido
 */
export const SlideUpEntry: React.FC<{
  startFrame: number;
  offsetY?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ startFrame, offsetY = 60, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = spring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: 30,    // amortiguado → desacelera suavemente (ease-out)
      stiffness: 120,
      mass: 1,
    },
    durationInFrames: 45,
  });

  const translateY = interpolate(sp, [0, 1], [offsetY, 0]);
  const opacity = interpolate(sp, [0, 0.2], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
