import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * T22 · Campo de búsqueda que colapsa a lupa en móvil.
 *
 * Desde `sm` renderiza exactamente la barra de siempre — el markup expandido
 * es el que ya vivía inline en cada página (mismos glows, mismo pill glass),
 * así que tablet y escritorio no cambian.
 *
 * Por debajo de `sm` la barra se llevaba una fila entera con `w-full` y
 * empujaba los botones de acción a una segunda línea. Ahí se colapsa a un
 * botón redondo con la lupa, al tono de los demás controles de la barra; al
 * tocarlo el campo se expande sobre el espacio libre de la fila y se enfoca
 * solo. La X (o Escape) limpia el texto y vuelve a colapsar, de modo que
 * nunca queda un filtro activo escondido detrás del icono. Si aun así el
 * valor viene de fuera, la lupa lo señala con un punto.
 */
export default function SearchField({
    value,
    onChange,
    placeholder = 'Buscar...',
    // Ancho del campo expandido — cada página trae el suyo (sm:w-72, sm:w-64…).
    className = 'sm:w-72',
}) {
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const collapse = () => {
        onChange('');
        setOpen(false);
    };

    return (
        <>
            {/* Colapsado — solo por debajo de sm */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Buscar"
                aria-expanded={open}
                className={`${open ? 'hidden' : 'flex'} sm:hidden relative overflow-hidden shrink-0 w-10 h-10 items-center justify-center bg-white/40 backdrop-blur-2xl border border-white/60 text-navy-900 rounded-full shadow-md transition-all duration-300 outline-none`}
            >
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                <Search size={14} strokeWidth={2.5} className="relative z-10" />
                {value && <span className="absolute top-1.5 right-1.5 z-10 w-1.5 h-1.5 rounded-full bg-navy-700" />}
            </button>

            {/* Expandido — siempre desde sm, y por debajo solo al tocar la lupa.
                `w-full` a propósito: al abrirse toma la fila entera y empuja los
                botones a la siguiente línea, que es donde se quiere el espacio
                mientras se escribe. El estado por defecto (colapsado) es el que
                mantiene todo en una sola fila. */}
            <div className={`${open ? 'block' : 'hidden'} sm:block relative h-10 w-full ${className}`}>
                <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute -top-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(29,95,173,0.05)' }} />
                <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(120,110,230,0.05)' }} />
                <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(64,98,200,0.05)' }} />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-navy-700 z-10">
                    <Search size={14} strokeWidth={2.5} />
                </div>
                <input
                    ref={inputRef}
                    className="relative w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full pl-10 pr-10 sm:pr-4 text-xs font-semibold text-navy-900 outline-none focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all placeholder-navy-900/60 shadow-md"
                    placeholder={placeholder}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') collapse(); }}
                />
                {/* Cierre solo en móvil: desde sm el campo no colapsa nunca */}
                <button
                    type="button"
                    onClick={collapse}
                    aria-label="Cerrar búsqueda"
                    className="sm:hidden absolute inset-y-0 right-0 pr-3.5 flex items-center text-navy-700/60 hover:text-navy-900 z-10"
                >
                    <X size={15} strokeWidth={2.5} />
                </button>
            </div>
        </>
    );
}
