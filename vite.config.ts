import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Large, rarely-changing libraries get their own cacheable chunks.
        // recharts is left out on purpose: it then ships with the lazily-loaded admin dashboard.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\/]node_modules[\/]@?firebase[\/]/.test(id)) return 'firebase';
          if (/[\/]node_modules[\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\/]/.test(id)) return 'react';
        },
      },
    },
  },
})
