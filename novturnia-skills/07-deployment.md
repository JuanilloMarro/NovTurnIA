# Skill: Deployment — Vite + React en Vercel

## Cuándo usar esta skill
- Al preparar el proyecto para subir a Vercel
- Al agregar páginas o rutas nuevas
- Al revisar que todo esté listo para producción

---

## package.json

```json
{
  "name": "turnia-dashboard",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev":     "vite",
    "build":   "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react":              "^18.2.0",
    "react-dom":          "^18.2.0",
    "react-router-dom":   "^6.22.0",
    "@supabase/supabase-js": "^2.39.0",
    "recharts":           "^2.12.0",
    "zustand":            "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite":                 "^5.1.0",
    "tailwindcss":          "^3.4.0",
    "autoprefixer":         "^10.4.0",
    "postcss":              "^8.4.0"
  }
}
```

---

## vite.config.js

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

---

## tailwind.config.js

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Ver 02-design-system.md para la config completa
    }
  },
  plugins: []
};
```

---

## postcss.config.js

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
```

---

## vercel.json — Manejo de rutas SPA

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Sin este archivo, al recargar una ruta como `/patients` Vercel devuelve 404.

---

## main.jsx — Router principal

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

---

## App.jsx — Layout global con rutas

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar  from './components/Topbar';
import Calendar       from './pages/Calendar';
import Patients       from './pages/Patients';
import PatientHistory from './pages/PatientHistory';
import Stats          from './pages/Stats';

export default function App() {
  return (
    <div className="flex min-h-screen relative z-10">
      <Sidebar />
      <div className="flex-1 ml-[220px] flex flex-col">
        <Topbar />
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/"                       element={<Calendar />} />
            <Route path="/patients"               element={<Patients />} />
            <Route path="/patients/:id/history"   element={<PatientHistory />} />
            <Route path="/stats"                  element={<Stats />} />
            <Route path="*"                       element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
```

---

## URL por cliente

```
https://turnia-dashboard.vercel.app/?bid=1   → Cliente 1
https://turnia-dashboard.vercel.app/?bid=2   → Cliente 2
```

El `BUSINESS_ID` siempre se lee desde la URL en `config/supabase.js`. Nunca hardcodearlo.

---

## Checklist antes de deploy

### Funcionalidad
- [ ] `SUPABASE_ANON_KEY` correcta en `config/supabase.js`
- [ ] `BUSINESS_ID` se lee desde `?bid=` correctamente
- [ ] Todas las queries incluyen `.eq('business_id', BUSINESS_ID)`
- [ ] Supabase Realtime activado para `appointments` y `users`
- [ ] El calendario carga y muestra eventos
- [ ] Crear y cancelar turnos funciona
- [ ] La búsqueda de pacientes funciona
- [ ] El historial conversacional carga correctamente
- [ ] Las gráficas de estadísticas muestran datos

### Build
- [ ] `npm run build` sin errores
- [ ] `npm run preview` funciona correctamente
- [ ] `vercel.json` tiene el rewrite `"/(.*)" → "/index.html"`

### Deploy en Vercel
1. Subir a GitHub
2. Importar en vercel.com → New Project
3. Framework: **Vite** (se detecta automáticamente)
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Click Deploy

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| 404 al recargar ruta | Falta `vercel.json` | Agregar rewrite `/(.*) → /index.html` |
| Tailwind no aplica en prod | `content` incorrecto en config | Verificar que incluya `./src/**/*.{js,jsx}` |
| Build falla con import | Ruta relativa incorrecta | Usar rutas desde `src/` consistentemente |
| Supabase no conecta en prod | URL o key incorrecta | Verificar variables en `config/supabase.js` |
