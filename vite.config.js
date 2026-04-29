import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
