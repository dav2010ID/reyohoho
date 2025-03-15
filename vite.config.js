import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_URL || '/';

export default defineConfig({
  base: base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*'], // Указываем папку с иконками
      manifest: {
        name: 'Reyohoho',
        short_name: 'Re',
        description: 'Просмотр фильмов и сериалов онлайн',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [
          {
            src: `${base}icons/icon-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: `${base}icons/icon-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});