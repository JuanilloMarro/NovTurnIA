import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE TEMPO
// 120 BPM @60fps → 1 beat = 30 frames
// Stagger 0.1s = 6 frames por elemento
// ─────────────────────────────────────────────────────────────────────────────
export const BEAT = 30;
export const STAGGER_FRAMES = 6;

// ─────────────────────────────────────────────────────────────────────────────
/**
 * useDirectionalExit — salida unidireccional con ease-in cúbico y motion blur
 *
 * direction: 'left' | 'right' | 'up' | 'down'
 * - 'left'  → translateX hacia -travel
 * - 'right' → translateX hacia +travel
 * - 'up'    → translateY hacia -travel
 * - 'down'  → translateY hacia +travel
 *
 * Ease-in cúbico (t³): empieza lento, acelera dramáticamente al final.
 * Motion blur proporcional a la velocidad.
 *
 * @returns { translateX, translateY, blurPx, opacity, style }
 *          style es un shorthand listo para spread en el elemento
 */
export function useDirectionalExit(
  direction: "left" | "right" | "up" | "down",
  exitFrame: number,
  duration = 20,
  travel = 1100
) {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [exitFrame, exitFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ease-in cúbico — aceleración progresiva
  const eased = progress * progress * progress;

  // Motion blur crece hacia el final (cuando la velocidad es máxima)
  const blurPx = eased * eased * 24;

  // Fade out en la segunda mitad de la salida
  const opacity = interpolate(progress, [0.5, 1.0], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateX =
    direction === "left"  ? -eased * travel :
    direction === "right" ?  eased * travel : 0;

  const translateY =
    direction === "up"   ? -eased * travel :
    direction === "down" ?  eased * travel : 0;

  const style: React.CSSProperties = {
    transform: `translateX(${translateX}px) translateY(${translateY}px)`,
    filter: blurPx > 0.5 ? `blur(${blurPx}px)` : undefined,
    opacity,
  };

  return { translateX, translateY, blurPx, opacity, style };
}



// ─────────────────────────────────────────────────────────────────────────────
/**
 * useStaggeredEntrance — hook de entrada escalonada desde abajo
 *
 * Cada índice tiene un offset de STAGGER_FRAMES frames.
 * Spring con alta fricción (ease-out) → los elementos "aterrizan" en posición
 * y se frenan suavemente (no rebotan).
 *
 * @param index       Índice del elemento (0, 1, 2...)
 * @param startFrame  Frame global donde inicia el primer elemento
 * @param offsetY     Píxeles de origen (desde dónde sube), default 70px
 *
 * @returns { translateY, opacity } listas para aplicar a style
 */
export function useStaggeredEntrance(
  index: number,
  startFrame: number,
  offsetY = 70
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elementStart = startFrame + index * STAGGER_FRAMES;

  // Spring de alta fricción → ease-out muy marcado, sin rebote
  const sp = spring({
    frame: frame - elementStart,
    fps,
    config: {
      damping: 42,    // alta fricción → desacelera rápido
      stiffness: 160, // respuesta rápida al inicio
      mass: 0.9,
    },
    durationInFrames: BEAT, // 1 beat (30f)
  });

  const translateY = interpolate(sp, [0, 1], [offsetY, 0]);
  const opacity    = interpolate(sp, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });

  return { translateY, opacity };
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * useMicroFloat — oscilación Y muy sutil para que un componente no se vea estático
 *
 * @param index       Índice del elemento (da fase propia a cada uno)
 * @param startFrame  Frame desde donde comienza a flotar (cuando ya entró)
 * @param amplitude   Amplitud en px (default 4px)
 * @param period      Período en frames (default 66 = ~1.1s @ 60fps)
 *
 * @returns número de px de desplazamiento Y
 */
export function useMicroFloat(
  index: number,
  startFrame: number,
  amplitude = 4,
  period = 66
) {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame);
  const phase = index * (Math.PI * 0.618); // offset de fase por índice (ratio áureo)
  return Math.sin((t / period) * Math.PI * 2 + phase) * amplitude;
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * useDivergentExit — salida horizontal divergente con motion blur
 *
 * Los elementos pares salen hacia la DERECHA, los impares hacia la IZQUIERDA.
 * Ease-in cúbico (aceleración progresiva) + blur proporcional a la velocidad.
 *
 * @param index       Índice del elemento (determina dirección: par=right, impar=left)
 * @param exitFrame   Frame donde comienza la salida
 * @param duration    Duración de la salida en frames (default 18 = ~0.3s, snapped a tempo)
 * @param travelPx    Distancia de viaje en px (default 1200)
 *
 * @returns { translateX, blur, opacity } listos para style
 */
export function useDivergentExit(
  index: number,
  exitFrame: number,
  duration = 18,
  travelPx = 1200
) {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [exitFrame, exitFrame + duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Ease-in cúbico: empieza lento, termina muy rápido
  const eased = progress * progress * progress;

  // Dirección: par → derecha (+), impar → izquierda (-)
  const direction = index % 2 === 0 ? 1 : -1;

  const translateX = eased * travelPx * direction;

  // Motion blur: proporcional a la velocidad (derivada del eased)
  // El blur máximo ocurre al final cuando la velocidad es mayor
  const blurPx = eased * eased * 28; // hasta 28px al final

  const opacity = interpolate(progress, [0.55, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return { translateX, blurPx, opacity };
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * StaggeredItem — componente wrapper que aplica el sistema completo
 *
 * Combina:
 *   1. Entrada escalonada desde abajo (ease-out alta fricción)
 *   2. Micro-float (oscilación Y independiente)
 *   3. Salida divergente horizontal (ease-in + motion blur)
 *
 * La salida NO es el reverso de la entrada — los elementos salen por los lados.
 *
 * @param index         Índice del elemento (0, 1, 2...) — controla stagger y dirección de salida
 * @param entranceStart Frame donde inicia la entrada del primer elemento
 * @param entranceDone  Frame donde el elemento ya está en su posición final (inicia micro-float)
 * @param exitStart     Frame donde inicia la salida divergente
 * @param style         Estilos adicionales del contenedor
 * @param children      Contenido del elemento
 */
export const StaggeredItem: React.FC<{
  index: number;
  entranceStart: number;
  entranceDone: number;
  exitStart: number;
  exitDuration?: number;
  entranceOffsetY?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({
  index,
  entranceStart,
  entranceDone,
  exitStart,
  exitDuration = 18,
  entranceOffsetY = 70,
  style,
  children,
}) => {
  const { translateY, opacity: entranceOpacity } = useStaggeredEntrance(
    index,
    entranceStart,
    entranceOffsetY
  );
  const floatY = useMicroFloat(index, entranceDone, 4, 66);
  const { translateX, blurPx, opacity: exitOpacity } = useDivergentExit(
    index,
    exitStart,
    exitDuration
  );

  const frame = useCurrentFrame();
  const isExiting = frame >= exitStart;
  const hasEntered = frame >= entranceDone + index * STAGGER_FRAMES;

  // Compone la transformación:
  // - Durante entrada: solo translateY (de abajo hacia arriba)
  // - Una vez en posición: micro-float en Y + divergent exit en X
  const composedTranslateY = isExiting ? floatY : translateY + floatY * (hasEntered ? 1 : 0);
  const composedTranslateX = isExiting ? translateX : 0;
  const composedBlur       = isExiting ? blurPx : 0;
  const composedOpacity    = isExiting
    ? exitOpacity
    : entranceOpacity;

  return (
    <div
      style={{
        transform: `translateX(${composedTranslateX}px) translateY(${composedTranslateY}px)`,
        filter: composedBlur > 0 ? `blur(${composedBlur}px)` : undefined,
        opacity: composedOpacity,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * SceneShell — wrapper de escena completo
 *
 * Recibe un array de children y aplica StaggeredItem a cada uno.
 * El primer elemento entra en entranceStart, el último en
 * entranceStart + (children.length - 1) * STAGGER_FRAMES.
 *
 * Ejemplo de uso:
 * ```tsx
 * <SceneShell entranceStart={30} exitStart={280}>
 *   <Button>Reservar</Button>       // índice 0 → sale a la derecha
 *   <Card>Info</Card>               // índice 1 → sale a la izquierda
 *   <TextBlock>Descripción</TextBlock> // índice 2 → sale a la derecha
 * </SceneShell>
 * ```
 */
export const SceneShell: React.FC<{
  entranceStart: number;
  exitStart: number;
  exitDuration?: number;
  entranceOffsetY?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({
  entranceStart,
  exitStart,
  exitDuration = 18,
  entranceOffsetY = 70,
  style,
  children,
}) => {
  const items = React.Children.toArray(children);
  // El micro-float inicia cuando el último elemento ha terminado su entrada
  const lastEntrance = entranceStart + (items.length - 1) * STAGGER_FRAMES + BEAT;

  return (
    <div style={{ position: "relative", ...style }}>
      {items.map((child, i) => (
        <StaggeredItem
          key={i}
          index={i}
          entranceStart={entranceStart}
          entranceDone={lastEntrance}
          exitStart={exitStart}
          exitDuration={exitDuration}
          entranceOffsetY={entranceOffsetY}
        >
          {child}
        </StaggeredItem>
      ))}
    </div>
  );
};
