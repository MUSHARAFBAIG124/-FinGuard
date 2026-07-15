import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.includes('node_modules')) {
            if (normalizedId.includes('@tanstack')) return 'vendor-react-query';
            if (normalizedId.includes('recharts') || normalizedId.includes('d3-')) {
              return 'vendor-recharts';
            }
            if (normalizedId.includes('react-router')) return 'vendor-router';
            if (normalizedId.includes('lucide-react')) return 'vendor-icons';
            if (normalizedId.includes('date-fns')) return 'vendor-date-fns';
            if (normalizedId.includes('react') || normalizedId.includes('react-dom')) {
              return 'vendor-react';
            }
            if (normalizedId.includes('axios')) return 'vendor-http';
            return 'vendor-misc';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
});
