import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import legacy from '@vitejs/plugin-legacy'
import eslintPlugin from 'vite-plugin-eslint'

const base = process.env.VITE_BASE_URL || '/'

export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }
  const isDistEnv = process.env.NODE_ENV === 'production'
  const now = new Date()
  const formattedDate =
    now
      .toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC'
      })
      .replace(/[.,]/g, '_')
      .replace(/\s+/g, '') + '_UTC'
  process.env.VITE_APP_VERSION_FULL_VERSION = process.env.VITE_APP_VERSION + '_' + formattedDate

  return {
    base: base,
    plugins: [
      vue(),
      legacy({
        targets: ['defaults', 'not IE 11', 'Chrome >= 47'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      }),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        includeAssets: ['favicon.ico', 'robots.txt', 'icons/*'],
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 3000000
        },
        build: {
          rollupOptions: {
            output: {
              assetFileNames: (assetInfo) => {
                const extType = assetInfo.name.split('.')[1]
                return `assets/${extType}/[name][extname]`
              },
              chunkFileNames: 'assets/js/[name]-[hash].js'
            }
          }
        },
        manifest: {
          name: 'ReYohoho',
          short_name: 'Re',
          description: 'Просмотр фильмов и сериалов онлайн',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          scope: base,
          start_url: base,

          icons: [
            {
              src: `${base}icons/icon-72x72.png`,
              sizes: '72x72',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: `${base}icons/icon-96x96.png`,
              sizes: '96x96',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: `${base}icons/icon-128x128.png`,
              sizes: '128x128',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: `${base}icons/icon-144x144.png`,
              sizes: '144x144',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: `${base}icons/icon-152x152.png`,
              sizes: '152x152',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: `${base}icons/icon-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: `${base}icons/icon-384x384.png`,
              sizes: '384x384',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: `${base}icons/icon-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      }),
      eslintPlugin({
        include: ['src/**/*.js', 'src/**/*.vue', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx'],
        failOnError: true,
        failOnWarning: false,
        cache: false,
        emitError: true
      })
    ],
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  }
})
