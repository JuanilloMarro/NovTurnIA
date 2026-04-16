import { useEffect } from 'react';

const FOCUSABLE = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * T-46: Adds Escape-to-close + focus trap to modals.
 * @param {React.RefObject} containerRef - ref to the modal card div (not the backdrop)
 * @param {boolean} isOpen  - false → no-op (safe to call before early return)
 * @param {function} onClose - callback invoked on Escape key
 */
export function useModalFocus(containerRef, isOpen, onClose) {
    useEffect(() => {
        if (!isOpen) return;

        // Auto-focus first interactive element after animation frame
        const timer = setTimeout(() => {
            containerRef?.current?.querySelector(FOCUSABLE)?.focus();
        }, 60);

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab') return;

            const container = containerRef?.current;
            if (!container) return;
            const els = [...container.querySelectorAll(FOCUSABLE)];
            if (els.length === 0) return;

            if (e.shiftKey) {
                if (document.activeElement === els[0]) {
                    e.preventDefault();
                    els[els.length - 1].focus();
                }
            } else {
                if (document.activeElement === els[els.length - 1]) {
                    e.preventDefault();
                    els[0].focus();
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]); // containerRef is a stable ref — intentionally omitted from deps
}
