---
trigger: always_on
---

### 6.1 Filosofía
**Frosted Glass Medical** — minimalista, limpio, profesional.
- Blanco y gris muy claro dominan todo
- Azul marino (`navy-700: #1A3A6B`) como único color de acento
- Sin morado dominante
- Cards diferenciadas por sombra suave, no bordes duros

### 6.2 Lo que nunca debe cambiar
- El fondo con orbes decorativos (`body::before` en `index.css`)
- El sidebar con item activo como card blanca con sombra
- El posicionamiento de eventos del calendario (`style` dinámico con `top`/`height` en px)
- La paleta de colores definida en `tailwind.config.js`

### 6.3 Lo que puede evolucionar
- Colores de eventos del calendario
- Tamaños de padding y spacing
- Animaciones de entrada
- Contenido interno de modales y drawers
