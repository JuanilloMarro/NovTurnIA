# Frontend — Auditoría Responsive

> El lenguaje visual de escritorio está resuelto y no se toca. Esta auditoría cubre lo que se rompe fuera de escritorio.
> **Método:** mediciones ejecutadas en navegador a 375px, 768px y 1024px inyectando las clases reales del shell, más análisis estático del código. La app pide autenticación y no se introdujeron credenciales, así que las pantallas internas se auditaron por sus reglas CSS y no por captura; el login sí se midió en vivo.

---

## 1. La tesis

**La aplicación está construida como un escritorio que se encoge, no como una interfaz que se reorganiza.** Tres decisiones que en 1440px son aciertos y en 768px son el problema:

1. **El marco es un objeto físico** — tarjeta de cristal con borde y padding que contiene todo. En teléfono cobra píxeles sin dar nada.
2. **El cristal está en todas partes** — 332 `backdrop-blur`, y cada uno crea un contexto de apilamiento. Por eso unos componentes quedan detrás de otros.
3. **Los controles son de tamaño fijo** — buscadores, filtros y botones se declaran una vez y se estiran. Ninguno cambia de forma.

---

## 2. Evidencia medida

### 2.1 El acantilado de los 768px

Ancho real del panel de detalle en pantallas maestro-detalle (Ofertas, Servicios, Finanzas, Conversaciones):

| Ancho de pantalla | Sidebar | Lista | **Panel de detalle** | % de pantalla |
|---|---|---|---|---|
| 767px | 0 | apilada | **701px** | 91% |
| **768px** | 272px | 360px | **58px** | **8%** |
| 834px (iPad) | 272px | 360px | 124px | 15% |
| 1024px (iPad Pro) | 272px | 360px | 282px | 28% |
| 1280px | 272px | 380px | 518px | 40% |

**Un píxel de ancho destruye el layout.** La causa: dos reglas `md:` disparan al mismo tiempo — el sidebar reclama 272px (`md:ml-[272px]`) y la lista maestra reclama 360px (`md:w-[360px]`). Juntas ocupan 632px de una pantalla de 768px. Ninguna de las dos sabe de la otra.

### 2.2 Seguimiento con el drawer abierto

`sm:pr-[440px]` reserva 440px desde los 640px de ancho:

| Pantalla | Contenido restante |
|---|---|
| 375px | 341px ✓ |
| **640px** | **166px** |
| **768px** | **22px** |
| 834px | 88px |
| 1280px | 518px ✓ |

### 2.3 Calendario mensual

`grid-cols-7` sin variante responsive:

| Pantalla | Ancho de celda de día |
|---|---|
| 375px | **49px** |
| 768px | 61px |
| 1280px | 130px |

Una celda de 49px debe mostrar número de día y turnos.

### 2.4 Verificado en vivo sobre el login

| Medición | Resultado |
|---|---|
| `meta viewport` | `width=device-width, initial-scale=1.0, viewport-fit=cover` |
| Uso de `env(safe-area-inset-*)` | **cero** — con `viewport-fit=cover` el contenido queda bajo la muesca y la barra de gestos |
| Font-size de los inputs | **13px** → Safari iOS hace zoom automático al enfocar |
| Desbordamiento horizontal | ninguno |
| Controles menores a 44px | 1 (el ojo de la contraseña, 15px) |

### 2.5 Inventario estático

| Medición | Valor |
|---|---|
| `backdrop-blur` | 332 (cada uno = contexto de apilamiento) |
| `overflow-hidden` | 369 (cada uno recorta) |
| Archivos con `createPortal` | 20 |
| `z-10` | 361 · valores z distintos: 11, sin escala |
| `title=""` nativos | 160 · componente `Tooltip` propio: **no existe** |
| `ResponsiveContainer` con alto en % | **7 de 7** |
| `h-screen`/100vh | 10 · `dvh`/`svh`: **0** |
| Buscadores que colapsan | **0 de 9** |
| Tipografía bajo 10px | **108** usos (`text-[9px]` 77 · `[8px]` 21 · `[7px]` 10) |
| Objetivos táctiles bajo 44px | `w-8 h-8` 72 · `w-7 h-7` 40 · `w-6 h-6` 16 |
| Grids sin variante responsive | `grid-cols-2` 15 · `grid-cols-7` 2 · `grid-cols-3` 1 |
| Modales con alto máximo y scroll interno | 1 de 4 revisados |

---

## 3. Hallazgos

| # | Sev | Hallazgo |
|---|---|---|
| **R1** | 🔴 | Maestro-detalle colapsa a 58px en 768px y no se recupera hasta 1280px (§2.1) |
| **R2** | 🔴 | Seguimiento deja 22px de contenido con el drawer abierto en tablet (§2.2) |
| **R3** | 🔴 | Componentes flotantes atrapados: `backdrop-filter` crea contexto de apilamiento, así que un menú `z-[200]` dentro de una tarjeta nunca supera a otra tarjeta hermana. 369 `overflow-hidden` recortan; solo 20 archivos usan portal |
| **R4** | 🔴 | `h-screen` (100vh) sin `dvh`: en Safari iOS y Chrome Android el alto incluye la barra del navegador, la app se dibuja más alta que la pantalla y el borde inferior queda cortado sin scroll posible |
| **R5** | 🔴 | Gráficas con alto porcentual (7 de 7): al pasar a una columna el padre resuelve a `auto` y renderizan con 0px |
| **R6** | 🟠 | El sidebar es `bg-transparent`: en móvil se desliza sobre el contenido sin superficie propia, solo con un velo al 20% |
| **R7** | 🟠 | Sidebar fijo desde `md` (768px), justo el ancho de tablet vertical: se lleva 272px de 768 |
| **R8** | 🟠 | `viewport-fit=cover` sin `safe-area-inset`: contenido bajo la muesca y la barra de gestos en iPhone |
| **R9** | 🟠 | Inputs a 13px sin `maximum-scale`: Safari iOS hace zoom al enfocar y descuadra el layout. 78 clases de texto pequeño en campos de formulario |
| **R10** | 🟠 | Calendario `grid-cols-7` fijo: celdas de 49px en teléfono |
| **R11** | 🟠 | Ningún buscador colapsa a botón (0 de 9), porque cada página lo escribe a mano |
| **R12** | 🟠 | Los filtros de período son filas de 6 botones sin colapso |
| **R13** | 🟠 | 128 objetivos táctiles bajo 44px (`w-8 h-8` y menores) — por debajo del mínimo recomendado |
| **R14** | 🟠 | 108 usos de tipografía bajo 10px; en teléfono son ilegibles |
| **R15** | 🟠 | 160 `title=""` nativos: invisibles en táctil, no estilizables, 500ms de retardo |
| **R16** | 🟡 | 18 grids sin variante responsive (`grid-cols-2/3/7`) |
| **R17** | 🟡 | Modales sin alto máximo ni scroll interno (3 de 4): en horizontal el contenido se sale |
| **R18** | 🟡 | El marco cuesta 5% del ancho en 375px y es puramente decorativo ahí |
| **R19** | 🟡 | Los orbes decorativos (`lg-orb`, 500px) exceden el viewport en móvil: coste de pintado sin aporte visual |

**Patrón que ya está bien resuelto y conviene replicar:** el panel de notificaciones del Topbar usa `fixed md:absolute`, `left-2 right-2` en móvil contra `md:w-[440px]` en escritorio, y `bg-white/90 md:bg-white/30` — opaco en teléfono, translúcido en escritorio. Es exactamente el criterio que le falta al resto.

---

## 4. Tareas

### Fase 1 — Shell (4 archivos, resuelve 4 hallazgos)

- [ ] **T1 · `h-[100dvh]` en lugar de `h-screen`** en `App.jsx` (5 usos), `Login.jsx`, `AdminPanel.jsx`, `ErrorBoundary.jsx`. → R4
- [ ] **T2 · Disolver el marco en móvil**: `p-0 sm:p-4 lg:p-6`, `rounded-none sm:rounded-[24px] lg:rounded-[32px]`, borde y sombra solo desde `sm`. → R18
- [ ] **T3 · Safe areas**: `padding: env(safe-area-inset-top/bottom/left/right)` en el shell, o quitar `viewport-fit=cover` si no se va a usar. → R8
- [ ] **T4 · Inputs a 16px en móvil**: `text-[16px] sm:text-[13px]` en campos de formulario, o `maximum-scale=1` en el meta viewport. → R9
- [ ] **T5 · Ocultar los orbes bajo `sm`** (`hidden sm:block`). → R19

### Fase 2 — Navegación (2 archivos, resuelve 2 hallazgos)

- [ ] **T6 · Superficie propia del sidebar en móvil**: `bg-white/80 backdrop-blur-2xl border-r border-white/60` bajo `md`, transparente desde `md`. → R6
- [ ] **T7 · Mover el sidebar de `md` a `lg`**: `lg:ml-[272px]` en `App.jsx`, `lg:translate-x-0` en `Sidebar.jsx`, `lg:hidden` en la hamburguesa del Topbar. Devuelve 272px a la tablet. → R7, R1 (parcial)

### Fase 3 — Layout maestro-detalle

- [ ] **T8 · Mover los anchos de lista de `md:` a `lg:`**: `w-full lg:w-[360px] xl:w-[380px]` en Ofertas, Servicios, Finanzas, Conversaciones. Con T7, elimina el acantilado de 768px. → R1
- [ ] **T9 · Drawer de Seguimiento a pantalla completa bajo `lg`**: reemplazar `sm:pr-[440px]` por `lg:pr-[440px]` y que el drawer se muestre como hoja completa por debajo. → R2
- [ ] **T10 · Patrón maestro-detalle móvil**: en pantallas chicas mostrar solo lista **o** solo detalle, con botón de volver. Ya existe en Ofertas (`hidden md:flex`); replicarlo en los otros tres. → R1

### Fase 4 — Contrato de capas

- [ ] **T11 · Tokens de z-index** en `index.css`: `--z-base 0`, `--z-content 10`, `--z-sticky 20`, `--z-nav 30`, `--z-overlay 100`, `--z-modal 200`, `--z-popover 300`, `--z-toast 400`, `--z-tooltip 500`. → R3
- [ ] **T12 · Regla del portal**: todo elemento flotante (menú, popover, dropdown, tooltip, drawer) se renderiza con `createPortal` en `document.body`. `DealStepsPopover` es el patrón de referencia, incluida su detección de borde. → R3
- [ ] **T13 · Auditar los flotantes que aún viven dentro de tarjetas** y migrarlos. Prioridad: menús de filtros, selectores de fecha, menús de tres puntos. → R3
- [ ] **T14 · Revisar los `position: fixed` dentro de tarjetas con `backdrop-blur`**: se anclan a la tarjeta, no a la pantalla. → R3

### Fase 5 — Gráficas

- [ ] **T15 · Hook `useChartHeight()`** que devuelva píxeles por breakpoint (200 móvil / 260 tablet / 320 escritorio). → R5
- [ ] **T16 · Sustituir los 7 altos porcentuales** por `height={n}` en `MainChart`, `AppointmentStatusChart`, `ClientsTrendChart`, `FinanceTrendChart` y las tres de `StatsIntelligence`. → R5
- [ ] **T17 · Variantes móviles de gráfica**: radar de predicción → lista ordenada con barra; donut de estados → barra apilada horizontal; LTV → solo el ranking. Retención y Nuevos-vs-recurrentes se conservan.
- [ ] **T18 · Calendario mensual en móvil**: vista de agenda vertical (lista por día) en lugar de la rejilla de 7 columnas. → R10

### Fase 6 — Componentes del sistema

- [ ] **T19 · Componente `<Tooltip>`**: por portal en `--z-tooltip`, lenguaje glass (`bg-white/70`, `backdrop-blur-2xl`, borde `white/60`, radio 24px), detección de borde, 300ms al entrar y 100ms al salir. → R15
- [ ] **T20 · Comportamiento táctil del tooltip**: los decorativos no se muestran; los que llevan información pasan a un ícono que abre el texto al tocar. → R15
- [ ] **T21 · Reemplazar los 160 `title=""`** por `<Tooltip>`, empezando por Finanzas (55 usos entre sus componentes). → R15
- [ ] **T22 · Componente `<Toolbar>`** con tres zonas (búsqueda, filtros, acciones) y comportamiento por ancho: ≥1024 todo expandido · 640–1024 búsqueda reducida y filtros en popover · <640 lupa que se expande al tocar y filtros en botón con contador que abre hoja inferior. → R11, R12
- [ ] **T23 · Adoptar `<Toolbar>` en las 9 páginas** con buscador. → R11, R12

### Fase 7 — Detalle fino

- [ ] **T24 · Objetivos táctiles a 44px en móvil**: `w-11 h-11 sm:w-8 sm:h-8` en los botones de ícono. → R13
- [ ] **T25 · Escalón tipográfico móvil**: mínimo 11px en teléfono; los `text-[7px]`/`[8px]`/`[9px]` suben un escalón bajo `sm`. → R14
- [ ] **T26 · Grids con variante**: `grid-cols-1 sm:grid-cols-2` en los 15 casos; revisar los `grid-cols-3`. → R16
- [ ] **T27 · Modales con `max-h-[85dvh]` y scroll interno** en `NewAppointmentModal`, `EditAppointmentModal`, `ConfirmDialog`. → R17
- [ ] **T28 · Prueba en horizontal** (landscape) a 812×375: es el caso donde los modales sin alto máximo fallan primero.

### Verificación

- [ ] **T29 · Recorrer los 9 módulos autenticados a 375, 414, 768, 834 y 1024px** — pendiente de credenciales de sesión; ninguna auditoría hasta hoy lo ha podido hacer.
- [ ] **T30 · Añadir los anchos críticos como casos fijos de revisión**: 767 y 768 (el acantilado), 640 (drawer de Seguimiento), 834 y 1024 (iPad).

---

## 5. Lo que no se toca

El cristal, los orbes en las esquinas, los botones que revelan texto en hover, la paleta navy y los radios de 24px son el activo del producto. Ninguna tarea de arriba los cambia: todas buscan que **sobrevivan al teléfono**, que hoy no lo hacen.
