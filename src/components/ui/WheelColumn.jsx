import { useRef, useLayoutEffect } from 'react';

const WH = 26;

export default function WheelColumn({ items, selected, onSelect, displayFn, disabled = false, height = WH * 3 }) {
    const containerRef = useRef(null);
    const trackRef = useRef(null);
    const offsetRef = useRef(0);
    const drag = useRef({ active: false, startY: 0, startOffset: 0, lastY: 0, lastTime: 0, velocity: 0, raf: null });

    function applyTransform(offset) {
        if (trackRef.current) trackRef.current.style.transform = `translateY(${WH - offset}px)`;
    }

    useLayoutEffect(() => {
        if (drag.current.active) return;
        const idx = items.indexOf(selected);
        if (idx === -1) {
            const numericSelected = parseInt(selected);
            const foundIdx = items.findIndex(it => parseInt(it) === numericSelected);
            if (foundIdx === -1) return;
            const targetOffset = foundIdx * WH;
            offsetRef.current = targetOffset;
            applyTransform(targetOffset);
            return;
        }
        cancelAnimationFrame(drag.current.raf);
        const targetOffset = idx * WH;
        offsetRef.current = targetOffset;
        applyTransform(targetOffset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, items]);

    function snapTo(fromOffset, velocity) {
        cancelAnimationFrame(drag.current.raf);
        const maxOffset = (items.length - 1) * WH;
        const projected = Math.max(0, Math.min(maxOffset, fromOffset + velocity * 100));
        const targetIdx = Math.round(projected / WH);
        const targetOffset = targetIdx * WH;
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
        Object.assign(drag.current, { active: true, startY: e.clientY, startOffset: offsetRef.current, lastY: e.clientY, lastTime: performance.now(), velocity: 0 });
        containerRef.current?.setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!drag.current.active) return;
        const dy = e.clientY - drag.current.startY;
        const maxOffset = (items.length - 1) * WH;
        const raw = drag.current.startOffset - dy;
        const clamped = raw < 0 ? raw * 0.3 : raw > maxOffset ? maxOffset + (raw - maxOffset) * 0.3 : raw;
        offsetRef.current = clamped;
        applyTransform(clamped);
        const now = performance.now();
        const dt = now - drag.current.lastTime;
        if (dt > 0) drag.current.velocity = -(e.clientY - drag.current.lastY) / dt;
        drag.current.lastY = e.clientY;
        drag.current.lastTime = now;
    }

    function onPointerUp() {
        if (!drag.current.active) return;
        drag.current.active = false;
        const maxOffset = (items.length - 1) * WH;
        snapTo(Math.max(0, Math.min(maxOffset, offsetRef.current)), drag.current.velocity);
    }

    return (
        <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden select-none touch-none"
            style={{ height, cursor: disabled ? 'default' : 'grab' }}
            onPointerDown={disabled ? undefined : onPointerDown}
            onPointerMove={disabled ? undefined : onPointerMove}
            onPointerUp={disabled ? undefined : onPointerUp}
            onPointerCancel={disabled ? undefined : onPointerUp}
        >
            <div className="absolute inset-x-1 pointer-events-none z-10 rounded-lg bg-white/60 border border-white/70 shadow-sm"
                style={{ top: WH, height: WH }} />
            <div className="absolute inset-0 pointer-events-none z-20"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.75) 0%, transparent 32%, transparent 68%, rgba(255,255,255,0.75) 100%)' }} />
            <div ref={trackRef} className="absolute inset-x-0 top-0 will-change-transform z-30">
                {items.map(item => {
                    const isSelected = item === selected;
                    return (
                        <div key={item} style={{ height: WH }}
                            className={`flex items-center justify-center transition-all duration-150 px-3 text-center leading-none ${isSelected ? 'text-navy-900 font-bold text-[12px]' : 'text-navy-900/30 font-medium text-[11px]'}`}>
                            <span className="truncate w-full text-center">{displayFn ? displayFn(item) : item}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
