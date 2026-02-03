import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Disable icon requirement for development
      includeAssets: [],
      manifest: {
        name: 'S-IDE Studio IDE',
        short_name: 'S-IDE',
        description: 'A modern IDE for AI agent workflows',
        theme_color: '#2563eb',
        // Icons will be added later
        icons: []
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true
      }
    }
  }
});
