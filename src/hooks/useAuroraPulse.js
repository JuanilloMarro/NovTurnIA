import { useCallback, useEffect, useRef, useState } from 'react';

// Ciclo de vida del borde aurora de los componentes de IA (.ai-aurora):
// pulse() lo enciende ('on' → .is-live.is-on), tras holdMs entra en apagado
// ('fading' → solo .is-live: la luz sigue fluyendo mientras muere de a pocos)
// y al terminar el fade se detiene todo ('off' → sin animaciones en reposo).
// FADE_MS debe coincidir con la transición de --aurora-glow en index.css.
const FADE_MS = 2600;

export function useAuroraPulse() {
    const [phase, setPhase] = useState('off');
    const timers = useRef([]);

    const clear = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };
    useEffect(() => clear, []);

    const pulse = useCallback((holdMs = 3800) => {
        clear();
        setPhase('on');
        timers.current.push(setTimeout(() => setPhase('fading'), holdMs));
        timers.current.push(setTimeout(() => setPhase('off'), holdMs + FADE_MS));
    }, []);

    const className = phase === 'on' ? 'is-live is-on' : phase === 'fading' ? 'is-live' : '';
    return { className, pulse };
}
