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

/**
 * Escena 8 — Datos orbitando el icono de correo en círculo (Más compactos)
 */
export const Scene8PaperPlane: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── ENTRADA DEL AVIÓN ────────────────────────────────────────────
  const planeEntry = spring({ frame, fps, config: { damping: 18, stiffness: 100 }, durationInFrames: 50 });
  const planeScale = interpolate(planeEntry, [0, 1], [0, 1]);
  const planeEntryY = interpolate(planeEntry, [0, 1], [80, 0]);

  // ── MOVIEMIENTO ARMÓNICO TOTAL ──────────
  const waveY = Math.sin(frame / 35) * 4 + Math.cos(frame / 60) * 2;
  const waveX = Math.cos(frame / 45) * 2;
  const tilt = Math.sin(frame / 40) * 3;
  const roll = Math.cos(frame / 50) * 1.5;

  // ── SALIDA: el avión y los datos salen hacia la DERECHA (volando)
  const sceneExit = useDirectionalExit('right', 245, 22, 1100);

  // ── SISTEMA DE DATOS CIRCULAR COMPACTO (8 FICHAS) ──────────────
  const DataCard = ({
    icon, label, value, delay, angle, radius,
  }: {
    icon: React.ReactNode; label: string; value: string; delay: number; angle: number; radius: number;
  }) => {
    const opacity = interpolate(frame, [delay, delay + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const scale = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140 } });

    const rad = (angle * Math.PI) / 180;
    const x = Math.cos(rad) * radius;
    const y = Math.sin(rad) * radius;

    return (
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        opacity,
        transform: `
          translate(-50%, -50%)
          translateX(${x + waveX}px)
          translateY(${y + waveY}px)
          scale(${scale})
          rotate(${tilt + roll}deg)
        `,
        transformOrigin: "center center",
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.7)", borderRadius: 18,
        padding: "10px 18px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 10px 35px rgba(15,32,68,0.1)", whiteSpace: "nowrap",
        zIndex: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(29,95,173,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>{icon}</div>
        <div>
          <div style={{ fontFamily: "Inter", fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.45)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 1 }}>{label}</div>
          <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: COLORS.navy900, lineHeight: 1.2 }}>{value}</div>
        </div>
      </div>
    );
  };

  const R = 300; // Radio más compacto para estar más cerca del icono

  return (
    <AbsoluteFill style={{ ...sceneExit.style }}>

      {/* ── POP: un sonido por cada DataCard que aparece ── */}
      {[10, 40, 70, 105, 135, 165, 195, 225].map((delay) => (
        <Sequence key={delay} from={delay} durationInFrames={60}>
          <Audio src={staticFile("sounds/pop.mp3")} volume={0.65} />
        </Sequence>
      ))}

      {/* ── SWOOSH: mail sale volando a la derecha ── */}
      <Sequence from={235} durationInFrames={60}>
        <Audio src={staticFile("sounds/swoosh.mp3")} volume={0.65} />
      </Sequence>

      {/* ── ÓRBITA DE DATOS COMPACTA ── */}
      <DataCard
        angle={-90} radius={R + 50} delay={10}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
        label="Registro" value="05 Abr · 14:30"
      />

      <DataCard
        angle={-45} radius={R} delay={40}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
        label="Intervención Humana" value="IA Pausada"
      />

      <DataCard
        angle={0} radius={R + 30} delay={70}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
        label="Paciente" value="Maggie Marroquín"
      />

      <DataCard
        angle={45} radius={R} delay={105}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>}
        label="Edad" value="22 años"
      />

      <DataCard
        angle={90} radius={R + 40} delay={135}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.31-2.31a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 13.92z" /></svg>}
        label="Celular" value="+502 4798-9357"
      />

      <DataCard
        angle={135} radius={R} delay={165}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
        label="Motivo" value="Control Post-Op"
      />

      <DataCard
        angle={180} radius={R + 30} delay={195}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
        label="Prioridad" value="Prioridad Alta (1)"
      />

      <DataCard
        angle={225} radius={R} delay={225}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>}
        label="Estado" value="Entregado con éxito"
      />

      {/* ── ICONO CAMPANA CENTRADA (NOTIFICACIÓN) ── */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        zIndex: 5,
        transform: `
          translate(-50%, -50%)
          translateX(${waveX}px)
          translateY(${planeEntryY + waveY}px)
          rotate(${tilt + roll}deg)
          scale(${planeScale})
        `,
      }}>
        <div style={{
          width: 140, height: 140, borderRadius: "50%", background: "white", 
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 25px 50px rgba(15,32,104,0.15)",
          border: "2px solid rgba(255,255,255,0.8)",
          color: COLORS.navy900
        }}>
          {/* Animación de campana más suave, sincronizada con el ritmo de aparición */}
          <div style={{ 
            transform: `rotate(${Math.sin(frame / 8) * 12}deg)`,
            transformOrigin: "top center"
          }}>
            <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
