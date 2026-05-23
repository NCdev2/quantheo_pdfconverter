import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'StirlingPDF',
        short_name: 'StirlingPDF',
        description: 'Mobile and web-friendly StirlingPDF interface for cloud-hosted PDF services.',
        theme_color: '#d5aa6d',
        background_color: '#f9f5ef',
        display: 'standalone',
        orientation: 'portrait'
      }
    })
  ],
  server: {
    port: 5173
  }
});
