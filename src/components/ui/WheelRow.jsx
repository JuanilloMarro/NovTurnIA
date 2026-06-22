import { useRef, useLayoutEffect } from 'react';

// Rollo HORIZONTAL: se arrastra de izquierda a derecha y se elige el ítem centrado.
// Hermano de WheelColumn (vertical); separado para no afectar sus usos existentes.
export default function WheelRow({ items, selected, onSelect, displayFn, itemWidth = 170, height = 96, disabled = false }) {
    const containerRef = useRef(null);
    const trackRef = useRef(null);
    const offsetRef = useRef(0);
    const drag = useRef({ active: false, startX: 0, startOffset: 0, lastX: 0, lastTime: 0, velocity: 0, raf: null });

    // El track arranca en left:50%; centramos el ítem seleccionado restando media tarjeta.
    function applyTransform(offset) {
        if (trackRef.current) trackRef.current.style.transform = `translateX(${-(offset + itemWidth / 2)}px)`;
    }

    useLayoutEffect(() => {
        if (drag.current.active) return;
        const idx = items.findIndex(item => item && selected && (item.id === selected.id || item === selected));
        if (idx === -1) return;
        cancelAnimationFrame(drag.current.raf);
        const targetOffset = idx * itemWidth;
        offsetRef.current = targetOffset;
        applyTransform(targetOffset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, items, itemWidth]);

    function snapTo(fromOffset, velocity) {
        cancelAnimationFrame(drag.current.raf);
        const maxOffset = (items.length - 1) * itemWidth;
        const projected = Math.max(0, Math.min(maxOffset, fromOffset + velocity * 100));
        const targetIdx = Math.round(projected / itemWidth);
        const targetOffset = targetIdx * itemWidth;
        const start = performance.now();
        const duration = 220;

        function step(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const cur = fromOffset + (targetOffset - fromOffset) * eased;
            offsetRef.current = cur;
            applyTransform(cur);
            if (t < 1) {
                drag.current.raf = requestAnimationFrame(step);
            } else {
                offsetRef.current = targetOffset;
                applyTransform(targetOffset);
                onSelect(items[targetIdx]);
            }
        }
        drag.current.raf = requestAnimationFrame(step);
    }

    function onPointerDown(e) {
        cancelAnimationFrame(drag.current.raf);
        Object.assign(drag.current, { active: true, startX: e.clientX, startOffset: offsetRef.current, lastX: e.clientX, lastTime: performance.now(), velocity: 0 });
        containerRef.current?.setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!drag.current.active) return;
        const dx = e.clientX - drag.current.startX;
        const maxOffset = (items.length - 1) * itemWidth;
        const raw = drag.current.startOffset - dx;
        const clamped = raw < 0 ? raw * 0.3 : raw > maxOffset ? maxOffset + (raw - maxOffset) * 0.3 : raw;
        offsetRef.current = clamped;
        applyTransform(clamped);
        const now = performance.now();
        const dt = now - drag.current.lastTime;
        if (dt > 0) drag.current.velocity = -(e.clientX - drag.current.lastX) / dt;
        drag.current.lastX = e.clientX;
        drag.current.lastTime = now;
    }

    function onPointerUp() {
        if (!drag.current.active) return;
        drag.current.active = false;
        const maxOffset = (items.length - 1) * itemWidth;
        snapTo(Math.max(0, Math.min(maxOffset, offsetRef.current)), drag.current.velocity);
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden select-none touch-none"
            style={{ height, cursor: disabled ? 'default' : 'grab' }}
            onPointerDown={disabled ? undefined : onPointerDown}
            onPointerMove={disabled ? undefined : onPointerMove}
            onPointerUp={disabled ? undefined : onPointerUp}
            onPointerCancel={disabled ? undefined : onPointerUp}
        >
            <div ref={trackRef} className="absolute top-0 left-1/2 h-full flex will-change-transform z-10">
                {items.map((item, i) => (
                    <div key={i} style={{ width: itemWidth, height }} className="flex items-center justify-center px-1">
                        {displayFn ? displayFn(item) : item}
                    </div>
                ))}
            </div>
        </div>
    );
}
