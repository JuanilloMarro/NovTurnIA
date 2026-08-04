import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * T12/T13 · Flotante que vive fuera de su tarjeta.
 *
 * POR QUÉ EXISTE. Los desplegables de "Filtros" eran `absolute` dentro de la
 * fila de acciones. Cuando esa fila se volvió una tira deslizable en teléfono
 * (`max-sm:overflow-x-auto`), pasó algo que no es obvio: **poner `overflow-x`
 * en algo distinto de `visible` obliga al navegador a calcular `overflow-y`
 * como `auto`** — no se puede recortar un eje y dejar el otro libre. Resultado
 * medido: un menú de 220px de alto desbordaba 228px una tira de 40px y quedaba
 * recortado dentro de ella.
 *
 * Sacarlo por portal a `document.body` lo saca de todo contexto de recorte y
 * de apilamiento de un plumazo. Es el mismo camino que ya usaban
 * `CommandPalette`, `DealActionsMenu` y `DealStepsPopover`.
 *
 * ⚠️ `position: fixed` NO alcanzaría por sí solo: un ancestro con
 * `backdrop-filter` crea bloque contenedor y el fijo se ancla a ÉL, no a la
 * pantalla (medido: 300x200 dentro del marco en vez de 768x1024). El shell de
 * la app tiene `backdrop-blur-xl`, así que el portal es obligatorio.
 *
 * Trae detección de borde: si no cabe abajo se abre hacia arriba, y siempre se
 * mantiene dentro de la pantalla con un margen. Eso también es lo que pedía
 * T19 para los tooltips.
 */
export default function Popover({
    open,
    onClose,
    anchorRef,
    children,
    // Alineación respecto del botón que lo dispara.
    align = 'right',
    // Ancho del panel. Se pasa como clase para conservar el look de cada página.
    className = 'w-52',
    // Separación entre el botón y el panel (el `mt-2` de antes).
    gap = 8,
}) {
    const panelRef = useRef(null);
    const [pos, setPos] = useState(null);

    useLayoutEffect(() => {
        if (!open || !anchorRef?.current) return;

        const place = () => {
            const a = anchorRef.current?.getBoundingClientRect();
            const panel = panelRef.current;
            if (!a || !panel) return;

            const margen = 8;
            const ancho = panel.offsetWidth;
            const alto = panel.offsetHeight;

            let left = align === 'right' ? a.right - ancho : a.left;
            // Nunca dejar que se salga por los lados — importante en teléfono,
            // donde el botón puede estar pegado al borde de la tira.
            left = Math.min(Math.max(left, margen), window.innerWidth - ancho - margen);

            // Debajo del botón; si no cabe, arriba.
            let top = a.bottom + gap;
            if (top + alto > window.innerHeight - margen) {
                const arriba = a.top - gap - alto;
                top = arriba >= margen ? arriba : Math.max(margen, window.innerHeight - alto - margen);
            }

            setPos({ top, left });
        };

        place();
        window.addEventListener('resize', place);
        // `true` para capturar el scroll de cualquier contenedor, no solo el de
        // la ventana: el panel va anclado a un botón que puede estar dentro de
        // la tira deslizable.
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, anchorRef, align, gap]);

    useEffect(() => {
        if (!open) return;

        const fuera = (e) => {
            if (panelRef.current?.contains(e.target)) return;
            if (anchorRef?.current?.contains(e.target)) return; // el botón ya alterna solo
            onClose?.();
        };
        const escape = (e) => { if (e.key === 'Escape') onClose?.(); };

        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [open, onClose, anchorRef]);

    // Al cerrarse se olvida la posición, para que al reabrirse no parpadee en
    // el lugar viejo antes de recalcular.
    useEffect(() => { if (!open) setPos(null); }, [open]);

    if (!open) return null;

    return createPortal(
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                // Invisible hasta tener medida: si no, el primer cuadro se pinta
                // en la esquina y se ve un salto.
                visibility: pos ? 'visible' : 'hidden',
            }}
            /* `bg-white/80` + `backdrop-blur-3xl` — antes era `/70` con `blur-2xl` y
               el contenido de atrás se transparentaba lo suficiente como para
               competir con las opciones del panel. Más opacidad y más desenfoque
               separan el panel del fondo sin cambiar el lenguaje de vidrio. */
            className={`overflow-hidden ${className} bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[24px] shadow-lg z-[300] p-2 animate-fade-up`}
        >
            <div className="absolute -top-8 -right-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="absolute -top-8 -left-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(29,95,173,0.05)' }} />
            <div className="absolute -bottom-8 -right-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(120,110,230,0.05)' }} />
            <div className="absolute -bottom-8 -left-8 pointer-events-none z-0" style={{ width: '70%', height: '70%', borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(64,98,200,0.05)' }} />
            <div className="relative z-10">{children}</div>
        </div>,
        document.body
    );
}
