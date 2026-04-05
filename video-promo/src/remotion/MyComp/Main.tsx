import { fontFamily, loadFont } from "@remotion/google-fonts/Inter";
import { AbsoluteFill } from "remotion";
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
import { OrbBackground } from "../components/OrbBackground";

loadFont("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "700", "800"],
});

// Duración de cada escena en frames (60fps)
const S1 = 360;  //  6s — Intro
const S2 = 600;  // 10s — El Problema
const S3 = 600;  // 10s — La Solución
const S4 = 440;  //  7.3s — Dashboard (sale cuando termina el toast)
const S5 = 540;  //  5s — Escalabilidad (Scene4Scale)
const S10 = 600; // 10s — Conversaciones (Intervención Humana)
const S11 = 660; // 11s — Outro mascot + nombre del sistema
const S7 = 600;  //  4s — Control Humano (Círculos)
const S8 = 600;  //  10s — Datos en sobre volando

// Transición entre escenas
const FADE = 40; // frames de crossfade

/**
 * Composición principal de NovTurnIA promo video.
 */
export const NovTurnVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      {/* Fondo persistente — nunca se resetea entre escenas */}
      <OrbBackground />
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

        {/* ── Escena 5: Escalabilidad (Scene4Scale) ── */}
        <TransitionSeries.Sequence durationInFrames={S5}>
          <Scene4Scale />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />

        {/* ── Escena 7: Control Humano (Nodos y Círculos) ── */}
        <TransitionSeries.Sequence durationInFrames={S7}>
          <Scene7HumanControl />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE })}
        />

        {/* ── Escena 8: Datos en avión de papel (Entrega) ── */}
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

        {/* ── Escena 11: Outro Mascot + Nombre ── */}
        <TransitionSeries.Sequence durationInFrames={S11}>
          <Scene11Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

