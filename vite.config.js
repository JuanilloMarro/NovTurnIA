import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // COD-3 · Limpieza de `console` en el bundle de producción.
  //
  // Al medirlo, el backlog estaba mal planteado: decía "30 archivos con
  // console.log/error/warn". La cuenta real es **45 console.error, 1
  // console.warn (ya con guard) y CERO console.log**.
  //
  // Y eso cambia el arreglo. `console.error` en producción no es ruido: es lo
  // que te deja diagnosticar cuando un cliente reporta algo raro. Borrarlo a
  // mano en 45 lugares sería trabajo para quedar peor. Lo que sí conviene sacar
  // es la familia informativa (`log`, `debug`, `info`, `trace`), que es la que
  // ensucia la consola y puede filtrar detalle interno.
  //
  // Se hace acá y no archivo por archivo: una línea que cubre todo el bundle,
  // sin tocar ni un `src/`, y sin depender de que alguien se acuerde del guard.
  // En `npm run dev` no aplica — ahí se quiere ver todo.
  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info', 'console.trace'],
  },

  build: {
    // Code splitting agresivo: vendors pesados en chunks separados.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase':     ['@supabase/supabase-js'],
          'charts':       ['recharts'],
          'sentry':       ['@sentry/react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
  },
});
