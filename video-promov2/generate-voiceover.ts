/**
 * Genera el voiceover unificado para el video promocional de NovTurnIA.
 *
 * Uso:
 *   ELEVENLABS_API_KEY=sk_xxx node --strip-types generate-voiceover.ts
 *
 * Requisitos:
 *   - Node 22+ (--strip-types nativo)
 *   - Variable de entorno ELEVENLABS_API_KEY
 *   - El audio resultante se guarda en: public/voiceover/voiceover.mp3
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ────────────────────────────────────────────────────────────

const VOICE_ID = "jsCqWAovK2LkecY7zXl4"; // ElevenLabs: "Matias" (Spanish male)
//                                          Otros buenos candidatos:
//                                          - "SAz9YHcvj6GT2YYXdXww" (River, multilingual)
//                                          - "CwhRBWXzGAHq8TQ4Fs17" (Roger, multilingual)
//                                          Cambia el ID según el voice que prefieras.

const MODEL_ID = "eleven_multilingual_v2";

const OUTPUT_PATH = join("public", "voiceover", "voiceover.mp3");

// ────────────────────────────────────────────────────────────
// GUION UNIFICADO CON MARCADORES EMOCIONALES
//
// Sintaxis ElevenLabs:
//   <break time="0.4s"/>  → pausa precisa
//   ...                   → pausa natural corta
//   Signos de puntuación  → emoción y ritmo
//   Énfasis en MAYÚSCULAS (o voz natural) para palabras clave
//
// Estructura de escenas y tiempos aproximados:
//   [S1  Intro]        ~0–7s
//   [S2  Problema]     ~7–17s
//   [S3  Solución]     ~17–26s
//   [S4  Dashboard]    ~26–33s
//   [S5  Escala]       ~33–38s
//   [S7  Control]      ~38–46s
//   [S8  Datos]        ~46–52s
//   [S10 Conversación] ~52–58s
//   [S12 Modular]      ~58–65s
//   [S11 Outro]        ~65–74s
// ────────────────────────────────────────────────────────────

const SCRIPT = `
NovTurnIA.
<break time="0.5s"/>
Tu asistente con inteligencia artificial... que agenda por ti, las veinticuatro horas del día.
<break time="0.9s"/>
Imagínalo: son las dos de la mañana. Tu negocio está cerrado. Y un cliente... está escribiendo ahora mismo.
<break time="0.4s"/>
¿Hola? ¿Me puedes dar una cita?
<break time="0.5s"/>
Nadie responde. Y ese cliente... se va con la competencia.
<break time="0.8s"/>
Con NovTurnIA... eso ya no vuelve a pasar.
<break time="0.3s"/>
La inteligencia artificial responde al instante, agenda la cita, y confirma todo — automáticamente.
<break time="0.4s"/>
Sin que tú tengas que mover un dedo.
<break time="0.9s"/>
Todo queda organizado en tu panel de control. Citas, pacientes, disponibilidad... de un solo vistazo.
<break time="0.8s"/>
¿Tienes muchos clientes llegando al mismo tiempo? Sin problema.
<break time="0.3s"/>
NovTurnIA los atiende a todos. A la vez.
<break time="0.9s"/>
Y tú... siempre tienes la última palabra.
<break time="0.3s"/>
Puedes intervenir cuando quieras, modificar, cancelar, reasignar. La IA trabaja para ti — no al revés.
<break time="0.9s"/>
Cada cita confirmada llega directo a tu correo. Nada se pierde. Todo queda registrado.
<break time="0.9s"/>
Las conversaciones son naturales... fluidas. Tus clientes se sienten atendidos, de verdad.
<break time="0.8s"/>
¿Tienes una clínica? ¿Una barbería? ¿Un salón? ¿Un consultorio?
<break time="0.3s"/>
NovTurnIA se adapta a cualquier negocio. Completamente a tu medida.
<break time="1.0s"/>
NovTurnIA.
<break time="0.4s"/>
Porque tu negocio no debería perder clientes... mientras tú descansas.
<break time="0.5s"/>
Empieza hoy.
`.trim();

// ────────────────────────────────────────────────────────────
// LLAMADA A LA API
// ────────────────────────────────────────────────────────────

async function generateVoiceover() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("❌  Falta la variable de entorno ELEVENLABS_API_KEY");
    process.exit(1);
  }

  console.log("🎙️  Generando voiceover unificado con ElevenLabs...");
  console.log(`   Voice ID : ${VOICE_ID}`);
  console.log(`   Model    : ${MODEL_ID}`);
  console.log(`   Output   : ${OUTPUT_PATH}`);
  console.log("");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: SCRIPT,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.38,          // Más variación → más natural, menos robótico
          similarity_boost: 0.80,   // Alta fidelidad a la voz original
          style: 0.55,              // Expresividad moderada-alta (emoción sin exagerar)
          use_speaker_boost: true,  // Claridad extra
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌  Error de ElevenLabs (${response.status}): ${error}`);
    process.exit(1);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  mkdirSync("public/voiceover", { recursive: true });
  writeFileSync(OUTPUT_PATH, audioBuffer);

  const sizeKB = (audioBuffer.byteLength / 1024).toFixed(1);
  console.log(`✅  Audio generado: ${OUTPUT_PATH} (${sizeKB} KB)`);
  console.log("");
  console.log("📌  Recuerda actualizar la duración del video si el audio");
  console.log("    cambia significativamente. Escucha el MP3 y ajusta las");
  console.log("    constantes de frame en src/remotion/MyComp/Main.tsx.");
}

generateVoiceover();
