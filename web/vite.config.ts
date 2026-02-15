import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    hmr: {
      // Through Cloudflare tunnel, the WebSocket can't connect back.
      // Use the tunnel host so HMR works instead of causing full reloads.
      clientPort: 443,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
