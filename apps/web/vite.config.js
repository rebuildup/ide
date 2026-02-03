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
        name: 'Deck IDE',
        short_name: 'DeckIDE',
        description: 'A modern IDE for development',
        theme_color: '#2563eb',
        // Icons will be added later
        icons: []
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  }
});
