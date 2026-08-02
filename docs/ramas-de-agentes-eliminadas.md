# Ramas de agentes eliminadas — 2026-08-01

Las ramas de la sesión de flota se borraron tras verificar que **no contenían
nada que `main` no tuviera**. Este archivo guarda los SHA por si alguna vez hace
falta recuperarlas.

## Cómo se verificó (tres pruebas, no una)

1. **Archivos exclusivos de la rama** — `git diff --name-status main <rama>`,
   contando las `A`: **0 en las 9 ramas**. Ningún archivo existe solo en una rama.
2. **Contenido de los archivos que cada rama aportó** — comparados uno a uno
   contra `main`: `fetchUpstream.ts` (190 líneas), `aiBudget.ts` (99),
   `verb_asymmetry_detector.sql` (66), `auth.js` (114), `playwright.config.js`
   (93). **Byte por byte idénticos.**
3. **Antigüedad** — las ramas son del **2026-07-27**; `main` está en 2026-08-01,
   cinco días y 18 commits por delante. Prueba concreta: `Topbar.jsx` en las
   ramas no tiene `lg:justify-end` (el arreglo de alineación en iPad) y `main` sí.

⚠️ **Nota de método.** `git cherry -v main <rama>` marcaba `+` en 4 ramas, que a
primera vista parece "no aplicado". No lo es: `cherry` compara *patch-id*, y el
contenido se integró con correcciones encima, así que el id difiere aunque el
trabajo esté. Lo mismo pasa al leer `git diff main <rama>` y ver líneas `+`: esas
son las líneas **viejas** de main que la rama restauraría, no aportes de la rama.
La prueba que sí decide es la nº1 combinada con la nº2.

## SHA para recuperar

Si hiciera falta: `git branch <nombre> <sha>`

| Rama | SHA | Commit |
|---|---|---|
| a1-bot-cancel-appointment | `fe82286e94dd7ac80dba13fcea46feb52330bb21` | A1: RPC bot_cancel_appointment con aislamiento de tenant |
| b1-b2-b7-outbound-metering | `dd448e723892017aec65d2803fc685ea8b5e70e8` | B1/B2/B7: medir mensajes salientes |
| edge1-edge2-fetch-upstream | `b6e5bb80a8aca99d3166cb2362cbb6a807ffbbb2` | EDGE-1/EDGE-2: timeouts y reintentos |
| f1-f3-outbound-cap | `4a8d2059abce5eff4c5031a33e7e9eb7132a65d5` | F1/F2/F3: tope de salientes en el dashboard |
| qa-fase-a-harness | `79f0db14ce9c7b9f83ea9702338ff03119d007f7` | qa: verificación del harness contra el negocio semilla |
| sec-regression-and-verb-asymmetry | `4c32d24699a408231b4340eeed283640fc4ba1cc` | SEC-1/SEC-2: regression probes + detector |
| sec3-sec4-ai-budget-fail-closed | `859f2b01c7cd76812f56722ffacf1b5af056c72b` | SEC-3/SEC-4: presupuesto de IA fail-closed |
| dec1-inf2-inf13-hardening | `e80e95e` | (sin commits propios sobre main) |
| responsive-fase1-shell | `0644e9b` | (sin commits propios sobre main) |

Las `worktree-agent-*` eran ramas auxiliares que los worktrees crean solas, todas
apuntando al mismo commit `e80e95e` de main. No tenían trabajo propio.

---

## Ramas remotas — evaluadas, NO eliminadas

Quedan tres en `origin`, todas de abril 2026:

| Rama | Último commit | ¿Contenida en main? |
|---|---|---|
| `origin/feat/business-evaluation` | 2026-04-29 | ✅ es ancestro de main |
| `origin/feat/nueva-funcionalidad` | 2026-04-29 | ✅ es ancestro de main |
| `origin/fix/calendar-noshow-reschedule` | 2026-04-29 | ✅ es ancestro de main |

`git merge-base --is-ancestor` confirma que las tres están **completamente
fusionadas**: cero commits fuera de main.

Reportan "87 archivos que main no tiene", pero no es trabajo perdido — son cosas
**borradas de main a propósito** después del merge:

- **41 + 41** — una copia vieja del pack de skills `supabase-postgres-best-practices`
  en `.claude/` y `.agents/`, más un `.txt` de transcripción de sesión.
- **3 docs** — `Costos.pdf`, `Fases de Implementacion con Costos.pdf` y
  `evaluation.md`. Son los "documentos contradictorios" que se eliminaron porque
  mantenían precios obsoletos en paralelo (ver Completadas §11).
- **1 src** — `BusinessSettings.jsx`, reemplazado por `AIConfig.jsx`; la ruta
  `/business` hoy renderiza ese.

Los cuatro siguen recuperables desde el historial de `main` (2, 2, 3 y 16 commits
respectivamente), así que borrar las ramas no perdería nada.

**Se dejan igual**: borrar ramas del remoto afecta el repo compartido y no es
urgente — estando fusionadas no molestan ni ensucian el historial. Queda como
decisión del dueño.
