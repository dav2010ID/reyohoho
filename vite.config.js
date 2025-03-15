import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa'  // Проверь, чтобы импорт был именно таким
const base = process.env.VITE_BASE_URL || '/';
export default defineConfig({
  base: base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
    })
  ],
  resolve: {
    alias: {
      '@': '/src',  // Убедитесь, что это соответствует вашей структуре проекта
    },
  },
});
