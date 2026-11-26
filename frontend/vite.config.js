import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // the shared LoadingSpinner uses the CRA-style process.env.PUBLIC_URL
  define: { 'process.env.PUBLIC_URL': JSON.stringify('') },
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:4000', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 1200 },
});
