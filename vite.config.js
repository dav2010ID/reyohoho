import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import legacy from '@vitejs/plugin-legacy'
import eslintPlugin from 'vite-plugin-eslint'
import { BugsnagBuildReporterPlugin, BugsnagSourceMapUploaderPlugin } from 'vite-plugin-bugsnag'

const base = process.env.VITE_BASE_URL || '/'

export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }
  const isDistEnv = process.env.NODE_ENV === 'production'
  process.env.VITE_APP_VERSION_FULL_VERSION = process.env.VITE_APP_VERSION + '_' + Date.now()
  const bugsnagOptions = {
    apiKey: process.env.VITE_BUGSNAG_API_KEY,
    appVersion: process.env.VITE_APP_VERSION_FULL_VERSION
  }

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
        includeAssets: ['favicon.ico', 'robots.txt', 'icons/*'], // Указываем папку с иконками
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
              src: `${base}icons/icon-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: `${base}icons/icon-512x512.png`,
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      }),
      eslintPlugin({
        include: ['src/**/*.js', 'src/**/*.vue', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx'], // Проверяемые файлы
        failOnError: true, // Останавливать сборку при ошибках ESLint
        failOnWarning: false, // Останавливать сборку только при ошибках, но не при предупреждениях
        cache: false, // Отключаем кэширование для корректной работы
        emitError: true
      }),
      isDistEnv &&
        BugsnagBuildReporterPlugin({
          ...bugsnagOptions,
          releaseStage: process.env.NODE_ENV
        }),
      isDistEnv &&
        BugsnagSourceMapUploaderPlugin({
          ...bugsnagOptions,
          overwrite: true
        })
    ],
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  }
})
