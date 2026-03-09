# Skill: Design System — Tailwind + Glass

## Cuándo usar esta skill
- Al crear o modificar cualquier componente visual
- Al agregar un módulo nuevo
- Al revisar consistencia de diseño

---

## Filosofía
**"Frosted Glass Medical"** — minimalista, limpio, profesional.
- Blanco y gris muy claro dominan todo
- Azul marino como único color de acento
- Sin morado dominante
- Cards diferenciadas por sombra suave, no bordes duros
- Bordes redondeados en todo (mínimo `rounded-xl`)

---

## tailwind.config.js

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#F5F8FD',
          100: '#EBF2FB',
          300: '#5B8AC4',
          500: '#1D5FAD',
          700: '#1A3A6B',
          900: '#0F2044',
        },
        glass: {
          card:    'rgba(255,255,255,0.82)',
          border:  'rgba(255,255,255,0.90)',
          input:   'rgba(255,255,255,0.65)',
          hover:   'rgba(255,255,255,0.60)',
        }
      },
      boxShadow: {
        'card':  '0 2px 8px rgba(15,32,68,0.06), 0 1px 3px rgba(15,32,68,0.04)',
        'card-hover': '0 4px 20px rgba(15,32,68,0.08), 0 2px 8px rgba(15,32,68,0.04)',
        'modal': '0 16px 48px rgba(15,32,68,0.12), 0 8px 20px rgba(15,32,68,0.06)',
        'btn':   '0 2px 8px rgba(26,58,107,0.25)',
        'btn-hover': '0 4px 14px rgba(26,58,107,0.35)',
      },
      backdropBlur: {
        'card': '12px',
        'modal': '20px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'sans-serif'],
      }
    }
  },
  plugins: []
}
```

---

## index.css — Variables globales y fondo

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

body {
  background-color: #F4F5F9;
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Orbes decorativos de fondo — NO modificar */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 15% 15%, rgba(100,149,210,0.12) 0%, transparent 70%),
    radial-gradient(ellipse 40% 40% at 85% 80%, rgba(100,190,210,0.08) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* Animaciones */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes drawerIn {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.animate-fade-up   { animation: fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }
.animate-drawer-in { animation: drawerIn 0.25s cubic-bezier(0.16,1,0.3,1) both; }
.animate-shimmer   {
  background: linear-gradient(90deg, rgba(220,228,240,0.5) 25%, rgba(235,240,250,0.8) 50%, rgba(220,228,240,0.5) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite ease-in-out;
}
```

---

## Componentes Base

### Card
```jsx
// Uso estándar
<div className="bg-white/80 backdrop-blur-card border border-white/90 rounded-2xl shadow-card p-6 hover:shadow-card-hover transition-shadow duration-200">
  {children}
</div>
```

### Botón primario
```jsx
<button className="bg-navy-700 hover:bg-navy-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-btn hover:shadow-btn-hover hover:-translate-y-px transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
  Guardar
</button>
```

### Botón ghost
```jsx
<button className="bg-white/70 hover:bg-white border border-white/60 hover:border-navy-300 text-gray-600 hover:text-navy-700 text-sm font-medium px-5 py-2.5 rounded-full transition-all duration-200">
  Cancelar
</button>
```

### Input
```jsx
<input className="w-full bg-white/65 border border-navy-100/50 rounded-xl px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:bg-white focus:border-navy-500 focus:ring-2 focus:ring-navy-100 transition-all duration-200" />
```

### Badge de estado
```jsx
// confirmed
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Confirmado
</span>

// pending
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pendiente
</span>

// cancelled
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
  <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Cancelado
</span>
```

### Modal
```jsx
<div className="fixed inset-0 bg-navy-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div className="bg-white/95 backdrop-blur-modal border border-white/90 rounded-2xl shadow-modal w-full max-w-md p-7 animate-fade-up">
    {children}
  </div>
</div>
```

### Drawer lateral
```jsx
<div className="fixed top-3 right-3 bottom-3 w-80 bg-white/95 backdrop-blur-modal border border-white/90 rounded-2xl shadow-modal p-6 z-50 overflow-y-auto animate-drawer-in">
  {children}
</div>
```

### Skeleton loader
```jsx
<div className="animate-shimmer rounded-xl h-16 w-full" />
```

---

## Sidebar

```jsx
// Item activo — card blanca con sombra
<NavLink
  to="/patients"
  className={({ isActive }) =>
    isActive
      ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white shadow-card border border-white/60 text-navy-700 font-semibold text-sm'
      : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-white/60 hover:text-navy-700 text-sm transition-all duration-150'
  }
>
  <Icon size={16} />
  Pacientes
</NavLink>
```

---

## Stagger animation en listas

```jsx
{items.map((item, i) => (
  <div
    key={item.id}
    className="animate-fade-up"
    style={{ animationDelay: `${i * 0.04}s` }}
  >
    <ItemCard item={item} />
  </div>
))}
```

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| Glass sin efecto | Falta `backdrop-blur` | Agregar `backdrop-blur-card` a la card |
| Tailwind clase no aplica | Clase dinámica con template string | Usar clases completas, no concatenadas |
| Colores fuera de paleta | Hex directo en className | Usar solo colores del theme de Tailwind |
| Animación brusca | Sin `cubic-bezier` | Usar clases `.animate-fade-up` del index.css |
