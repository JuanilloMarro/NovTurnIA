import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { COLORS } from "../../../types/constants";
import { useDirectionalExit } from "../components/SceneMotion";

const ChatGroup: React.FC<{
  x: number;
  y: number;
  delay: number;
  scale?: number;
  rotation?: number;
}> = ({ x, y, delay, scale = 1, rotation = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 100 } });

  return (
    <div style={{
      position: "absolute",
      left: x,
      top: y,
      opacity: interpolate(pop, [0, 1], [0, 0.95]),
      transform: `translate(-50%, -50%) scale(${interpolate(pop, [0, 1], [0.8, scale])}) rotate(${rotation}deg)`,
      pointerEvents: "none",
    }}>
      {/* Panel glass */}
      <div style={{
        width: 220,
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderRadius: 24,
        padding: "16px",
        border: "1px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 25px 50px rgba(15,23,42,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {/* 1. Cliente — verde, derecha */}
        <div style={{ alignSelf: "flex-end", width: "72%", height: 26, background: "#DCF8C6", borderRadius: "8px 8px 2px 8px" }} />

        {/* 2. IA — blanco, izquierda, línea azul + mini calendario */}
        <div style={{
          alignSelf: "flex-start", width: "92%", background: "white",
          borderRadius: "2px 10px 10px 10px", display: "flex", padding: "7px", gap: 6,
          border: "1px solid rgba(0,0,0,0.03)",
        }}>
          <div style={{ width: 3, flexShrink: 0, background: COLORS.primary, borderRadius: 2 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: COLORS.primary, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
                <div style={{ height: 3, background: "rgba(255,255,255,0.9)" }} />
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 5, height: 2, background: "rgba(255,255,255,0.7)", borderRadius: 1 }} />
                </div>
              </div>
              <div style={{ flex: 1, height: 3, background: COLORS.navy900, opacity: 0.12, borderRadius: 2 }} />
            </div>
            <div style={{ width: "60%", height: 3, background: COLORS.navy900, opacity: 0.08, borderRadius: 2 }} />
            <div style={{ width: "40%", height: 3, background: COLORS.primary, opacity: 0.3, borderRadius: 2 }} />
          </div>
        </div>

        {/* 3. Cliente — verde, derecha, corto */}
        <div style={{ alignSelf: "flex-end", width: "50%", height: 22, background: "#DCF8C6", borderRadius: "8px 8px 2px 8px" }} />
      </div>
    </div>
  );
};

export const Scene4Scale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Bloque central aparece primero
  const pop = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 120 } });

  // ── SALIDA: grupos de chat se disuelven hacia abajo ───────────
  const sceneExit = useDirectionalExit('down', 270, 22, 800);


  return (
    <AbsoluteFill style={{ overflow: "hidden", ...sceneExit.style }}>

      {/* ── POP: un sonido por cada ChatGroup que aparece ── */}
      {[25, 45, 65, 85, 105, 125, 145, 160].map((delay) => (
        <Sequence key={delay} from={delay} durationInFrames={60}>
          <Audio src={staticFile("sounds/pop1.mp3")} volume={0.65} />
        </Sequence>
      ))}

      {/*
        Nodos aparecen de a uno cada ~20 frames en orden radial (comprimido):
        1. Arriba centro    (25)
        2. Izq arriba       (45)
        3. Der arriba       (65)
        4. Izq centro       (85)
        5. Der centro       (105)
        6. Izq abajo        (125)
        7. Der abajo        (145)
        8. Abajo centro     (160)
      */}
      <ChatGroup x={540} y={550} delay={25} scale={0.78} rotation={1} />

      <ChatGroup x={180} y={700} delay={45} scale={0.85} rotation={2} />
      <ChatGroup x={900} y={700} delay={65} scale={0.7} rotation={-2} />

      <ChatGroup x={260} y={960} delay={85} scale={0.75} rotation={-4} />
      <ChatGroup x={820} y={960} delay={105} scale={0.85} rotation={5} />

      <ChatGroup x={200} y={1220} delay={125} scale={0.8} rotation={3} />
      <ChatGroup x={880} y={1220} delay={145} scale={0.75} rotation={-4} />

      <ChatGroup x={540} y={1370} delay={160} scale={0.78} rotation={-1} />

      {/* BLOQUE CENTRAL */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {(() => {
          const breathe = 1 + Math.sin(frame / 20) * 0.01;
          const popScale = interpolate(pop, [0, 1], [0.9, 1]);
          return (
            <div style={{
              width: 440,
              background: "rgba(255, 255, 255, 0.5)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderRadius: 40,
              padding: "50px 40px",
              textAlign: "center",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 25px 60px rgba(15,32,68,0.08)",
              transform: `scale(${popScale * breathe}) translateY(${interpolate(pop, [0, 1], [20, 0])}px)`,
              opacity: interpolate(pop, [0, 1], [0, 1]),
              display: "flex",
              flexDirection: "column",
              gap: 20,
              alignItems: "center",
            }}>
          <h2 style={{
            fontFamily: "Inter", fontSize: 42, fontWeight: 800,
            color: COLORS.navy900, margin: 0, lineHeight: 1.1, letterSpacing: "-0.04em",
          }}>
            Atiende cientos<br />
            de clientes<br />
            <span style={{ color: COLORS.primary }}>en simultáneo.</span>
          </h2>

          <div style={{ background: "rgba(29, 95, 173, 0.1)", borderRadius: 100, padding: "6px 16px", display: "inline-block" }}>
            <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 800, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Crecimiento Exponencial
            </span>
          </div>
        </div>
          );
        })()}
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
