---
trigger: always_on
---

### 8.1 Vercel con Vite
- El proyecto usa Vite — Vercel lo detecta automáticamente.
- Build command: `npm run build` / Output directory: `dist`
- Siempre incluir `vercel.json` con el rewrite SPA: `"/(.*)" → "/index.html"` para que las rutas de React Router funcionen al recargar.

### 8.2 URL por cliente
```
turnia.app/?bid=1   → Cliente 1
turnia.app/?bid=2   → Cliente 2
```
El `BUSINESS_ID` siempre se lee desde la URL en `config/supabase.js`. Nunca hardcodearlo.