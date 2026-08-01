// Detecta utilidades de Tailwind que se escribieron en el código y NO existen
// en el CSS compilado — es decir, que compilan a nada, en silencio.
//
// ── EL BUG QUE ESTO CAZA ─────────────────────────────────────────────────────
// Se escribió `max-sm:no-scrollbar` esperando ocultar la barra de scroll solo en
// teléfono. `no-scrollbar` es una clase propia, definida en `index.css` FUERA de
// `@layer utilities`. Tailwind no genera variantes para clases que no conoce, así
// que esa utilidad **no produce ninguna regla**: sin error, sin warning, sin
// nada. El bug fue invisible hasta que alguien miró el CSS compilado a mano.
//
// ESLint no puede verlo: vive dentro de un string de `className`, que para el
// linter es texto opaco. Por eso este chequeo aparte.
//
// ── POR QUÉ CONTRA EL CSS COMPILADO ──────────────────────────────────────────
// El primer intento adivinaba qué clases eran "propias" leyendo los selectores
// de `index.css`. Dio 5 hallazgos y 4 eran FALSOS: marcaba `w-7` y `h-6` como
// propias solo porque aparecen dentro de la regla `button.w-7.h-7{…}` de T24.
// Comparar contra el CSS compilado no adivina nada: si Tailwind generó la regla,
// está; si no la generó, no está. Es la verdad, no una heurística.
//
//   npm run build && npm run check:tw

import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const DIST = path.join(RAIZ, 'dist', 'assets');

// ── CSS compilado ────────────────────────────────────────────────────────────
if (!fs.existsSync(DIST)) {
    console.error('No hay build. Corré `npm run build` primero.');
    process.exit(2);
}
const hojas = fs.readdirSync(DIST).filter(f => f.endsWith('.css'));
if (hojas.length === 0) {
    console.error('No se encontró ningún .css en dist/assets. Corré `npm run build`.');
    process.exit(2);
}
const css = hojas.map(f => fs.readFileSync(path.join(DIST, f), 'utf8')).join('\n');

/** Escapa un nombre de clase como lo hace Tailwind en el selector generado. */
function escapar(clase) {
    return clase.replace(/[.:/[\]()&>*!#%,+~^$|{}='"@\\]/g, c => '\\' + c);
}

// ── Recorrer los className del código ────────────────────────────────────────
function* archivos(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) yield* archivos(p);
        else if (/\.(jsx?|tsx?)$/.test(e.name)) yield p;
    }
}

// ⚠️ Hay que TOKENIZAR por espacios, no hacer match libre sobre la línea. Un
// regex suelto parte las clases largas por la mitad: de
// `group-hover/ia:max-w-[90px]` sacaba `ia:max-w-[90px]`, y de
// `[&::-ms-reveal]:hidden` sacaba `ms-reveal]:hidden`. Ocho falsos positivos.
// Una clase es un token completo entre espacios dentro de un className.

/** Extrae el contenido de cada `className=…` de una línea. */
function stringsDeClassName(linea) {
    const out = [];
    // className="…" / className='…' / className={`…`} y los trozos de template
    for (const m of linea.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) {
        out.push(m[1] ?? m[2] ?? m[3] ?? '');
    }
    // Dentro de un {`…`} pueden venir varios trozos con ${…} en el medio: se
    // parten para no pegar el final de un trozo con el principio del siguiente.
    return out.flatMap(s => s.split(/\$\{[^}]*\}|[`'"]/));
}

const hallazgos = new Map();
for (const archivo of archivos(SRC)) {
    const texto = fs.readFileSync(archivo, 'utf8');
    texto.split('\n').forEach((linea, i) => {
        if (!linea.includes('className')) return;
        for (const bloque of stringsDeClassName(linea)) {
            for (const token of bloque.split(/\s+/)) {
                // Solo interesan las que llevan variante: `algo:clase`. Una clase
                // sin variante que no exista es un typo visible a simple vista;
                // el bug silencioso es la variante sobre una clase desconocida.
                if (!token || !token.includes(':')) continue;
                if (/^(https?|data|blob|mailto):/.test(token)) continue;
                if (!/^[a-zA-Z[]/.test(token)) continue;

                const selector = '.' + escapar(token);
                if (css.includes(selector)) continue;   // Tailwind sí la generó

                if (!hallazgos.has(token)) hallazgos.set(token, []);
                hallazgos.get(token).push(`${path.relative(RAIZ, archivo)}:${i + 1}`);
            }
        }
    });
}

// ── Reporte ──────────────────────────────────────────────────────────────────
if (hallazgos.size === 0) {
    console.log('✅ Todas las utilidades con variante del código existen en el CSS compilado.\n');
    process.exit(0);
}

console.log(`❌ ${hallazgos.size} utilidad(es) escritas en el código que NO están en el CSS compilado.`);
console.log('   No producen ninguna regla: el estilo que esperabas no se aplica.\n');
for (const [clase, lugares] of hallazgos) {
    console.log(`   ${clase}`);
    for (const l of lugares.slice(0, 4)) console.log(`     ${l}`);
    if (lugares.length > 4) console.log(`     … y ${lugares.length - 4} más`);
    console.log('');
}
console.log('Causa habitual: variante de Tailwind sobre una clase PROPIA definida');
console.log('fuera de `@layer utilities`. Arreglo: o la movés dentro de esa capa,');
console.log('o escribís la regla directo en un bloque @media, como `.mobile-strip`.\n');
process.exit(1);
