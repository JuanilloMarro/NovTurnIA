import { fontFamily, loadFont } from "@remotion/google-fonts/Inter";
import { AbsoluteFill, useVideoConfig, interpolate, staticFile, Sequence, Audio } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Scene1Intro } from "../scenes/Scene1Intro";
import { Scene2Problem } from "../scenes/Scene2Problem";
import { Scene3Solution } from "../scenes/Scene3Solution";
import { Scene5Dashboard } from "../scenes/Scene5Dashboard";
import { Scene4Scale } from "../scenes/Scene4Scale";
import { Scene10Conversation } from "../scenes/Scene10Conversation";
import { Scene7HumanControl } from "../scenes/Scene7HumanControl";
import { Scene8PaperPlane } from "../scenes/Scene8PaperPlane";
import { Scene11Outro } from "../scenes/Scene11Outro";
import { Scene12Modular } from "../scenes/Scene12Modular";
import { OrbBackground } from "../components/OrbBackground";
import { DynamicBackground } from "../components/DynamicBackground";
import { ZDollyWrapper } from "../components/ZDollyWrapper";
import { AudioWaveform } from "../components/AudioWaveform";
import { COLORS } from "../../../types/constants";



loadFont("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "700", "800"],
});

// Duración de cada escena en frames (60fps)
const S1 = 420;  //  7s — Intro (+1s para que vo-01 no solape con vo-02)
const S2 = 570;  //  9.5s — El Problema
const S3 = 511;  //  8.51s — La Solución
const S4 = 440;  //  7.3s — Dashboard
const S5 = 315;  //  5.25s — Escalabilidad
const S10 = 360; //  6s — Conversaciones
const S12 = 475; //  7.9s — Modular a la medida
const S11 = 465; //  7.75s — Outro
const S7 = 510;  //  8.5s — Control Humano
const S8 = 320;  //  5.3s — Datos en sobre

// Transición entre escenas
const FADE = 40;


/**
 * Composición principal de NovTurnIA promo video.
 *
 * Sistemas de animación integrados (Technical Motion Prompt):
 *
 * 1. DynamicBackground  — gradiente que evoluciona como fuente de luz ambiental,
 *                         pulso radial rítmico snapped al tempo (120 BPM),
 *                         bokeh blur activo cuando hay modal encima.
 *
 * 2. OrbBackground      — orbes de cristal con flotación sinusoidal real
 *                         en ejes X e Y con fases y frecuencias distintas.
 *
 * 3. ZDollyWrapper      — Z-axis dolly-in constante y lento (+6% zoom total),
 *                         easing orgánico para que no se note pero sí se sienta.
 *
 * 4. AudioWaveform      — ondas de audio reactivas con movimiento HORIZONTAL,
 *                         sincronizadas al tempo, visible en la parte inferior.
 *
 * Disponibles en escenas individuales (MotionBlurTransition.tsx):
 * 5. SpringBounceModal  — scale 0.9→1.0 con overshoot underdamped
 * 6. TypewriterText     — efecto máquina de escribir sincronizado al tempo
 * 7. OdometerNumber     — contador tipo cuentakilómetros con ease-out orgánico
 * 8. SlideUpEntry       — entrada vertical con ease-out de desaceleración
 * 9. MotionBlurSwipe    — salida con motion blur direccional de alta velocidad
 */
export const NovTurnVideo: React.FC = () => {
  const { durationInFrames, fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: '#F4F8FE' }}>
      {/* ── VOICEOVER UNIFICADO ── entra a los 0.15s (frame 9) ── */}
      <Sequence from={9}>
        <Audio
          src={staticFile("voiceover/video voiceover.mp3")}
          volume={1}
        />
      </Sequence>

      {/* ── MÚSICA DE FONDO ── */}
      {/* <Audio
        src={staticFile("music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps * 1.5, durationInFrames - fps * 2, durationInFrames],
            [0, 0.35, 0.35, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      /> */}


      {/* ══════════════════════════════════════════════════════════
          CAPA 0 — FONDO DINÁMICO
          Gradiente con luz ambiental orbitando + pulso radial al tempo
          ══════════════════════════════════════════════════════════ */}
      <DynamicBackground />

      {/* CAPA 1 — OrbBackground glass — flota sobre las waves */}
      <OrbBackground />

      {/* ══════════════════════════════════════════════════════════
          CAPA 2 — WAVEFORM DE AUDIO
          Ondas horizontales reactivas al tempo, sutiles (opacity 0.35)
          ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
          opacity: 0.2,
          pointerEvents: "none",
        }}
      >
        <AudioWaveform
          barCount={36}
          width={500}
          height={32}
          color={COLORS.navy500}
          intensity={0.8}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════
          CAPA 3 — ESCENAS con Z-DOLLY IN
          Push-in constante +6% durante toda la duración del video
          ══════════════════════════════════════════════════════════ */}
      <ZDollyWrapper dollyEndScale={1.06}>
        <TransitionSeries>
          {/* ── Escena 1: Intro ── */}
          <TransitionSeries.Sequence durationInFrames={S1}>
            <Scene1Intro />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 2: El Problema ── */}
          <TransitionSeries.Sequence durationInFrames={S2}>
            <Scene2Problem />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 3: La Solución ── */}
          <TransitionSeries.Sequence durationInFrames={S3}>
            <Scene3Solution />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 4: Dashboard ── */}
          <TransitionSeries.Sequence durationInFrames={S4}>
            <Scene5Dashboard />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 5: Escalabilidad ── */}
          <TransitionSeries.Sequence durationInFrames={S5}>
            <Scene4Scale />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 7: Control Humano ── */}
          <TransitionSeries.Sequence durationInFrames={S7}>
            <Scene7HumanControl />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 8: Datos en avión de papel ── */}
          <TransitionSeries.Sequence durationInFrames={S8}>
            <Scene8PaperPlane />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 10: Conversaciones ── */}
          <TransitionSeries.Sequence durationInFrames={S10}>
            <Scene10Conversation />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 12: Modular a la Medida ── */}
          <TransitionSeries.Sequence durationInFrames={S12}>
            <Scene12Modular />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />

          {/* ── Escena 11: Outro ── */}
          <TransitionSeries.Sequence durationInFrames={S11}>
            <Scene11Outro />
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </ZDollyWrapper>
    </AbsoluteFill>
  );
};
