import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../../../types/constants";

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

  // ── SALIDA FINAL ──────────────────
  const exitOpacity = interpolate(frame, [550, 595], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
    <AbsoluteFill style={{ opacity: exitOpacity }}>

      {/* ── ÓRBITA DE DATOS COMPACTA ── */}
      <DataCard
        angle={-90} radius={R + 50} delay={20}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
        label="Registro" value="05 Abr · 14:30" 
      />

      <DataCard
        angle={-45} radius={R} delay={60}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
        label="Intervención Humana" value="IA Pausada" 
      />

      <DataCard
        angle={0} radius={R + 30} delay={100}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
        label="Paciente" value="Maggie Marroquín" 
      />

      <DataCard
        angle={45} radius={R} delay={140}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>}
        label="Edad" value="22 años" 
      />

      <DataCard
        angle={90} radius={R + 40} delay={180}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.31-2.31a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 13.92z" /></svg>}
        label="Celular" value="+502 4798-9357" 
      />

      <DataCard
        angle={135} radius={R} delay={220}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
        label="Motivo" value="Control Post-Op" 
      />

      <DataCard
        angle={180} radius={R + 30} delay={260}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
        label="Prioridad" value="Prioridad Alta (1)" 
      />

      <DataCard
        angle={225} radius={R} delay={300}
        icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>}
        label="Estado" value="Entregado con éxito" 
      />

      {/* ── ICONO MAIL SEND CENTRADO ── */}
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
        <svg width={220} height={140} viewBox="0 0 40 30" fill="none" style={{ filter: "drop-shadow(0 20px 45px rgba(29,173,255,0.2))" }}>
          <defs>
            <linearGradient id="mailBody" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#eef4fa" />
            </linearGradient>
          </defs>
          <line x1="2" y1="11" x2="10" y2="11" stroke={COLORS.primary} strokeWidth={2.4} strokeLinecap="round" />
          <line x1="5" y1="15" x2="10" y2="15" stroke={COLORS.primary} strokeWidth={2.4} strokeLinecap="round" />
          <line x1="7" y1="19" x2="10" y2="19" stroke={COLORS.primary} strokeWidth={2.4} strokeLinecap="round" />
          <rect x="11" y="7" width="26" height="18" rx="2" fill="url(#mailBody)" stroke={COLORS.primary} strokeWidth={2.8} />
          <path d="M11 9 L24 18 L37 9" stroke={COLORS.primary} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
