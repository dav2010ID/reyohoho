import vuePlugin from 'eslint-plugin-vue'
import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'

// Runtime globals of Node scripts, Cloudflare Workers and the transfer page.
const serverGlobals = Object.fromEntries(
  [
    'Buffer', 'process', 'console', 'setTimeout', 'clearTimeout', 'setInterval',
    'clearInterval', 'queueMicrotask', 'structuredClone', 'fetch', 'Request', 'Response',
    'Headers', 'FormData', 'Blob', 'ReadableStream', 'WritableStream', 'TransformStream',
    'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'AbortController', 'AbortSignal',
    'crypto', 'btoa', 'atob', 'caches', 'HTMLRewriter', 'WebSocket', 'performance',
    'DOMException', 'Event', 'EventTarget', 'globalThis'
  ].map((name) => [name, 'readonly'])
)

export default [
  {
    ignores: [
      'dist/**',
      'workers/site/generated/**',
      // wrangler dev bundles
      '**/.wrangler/**'
    ]
  },
  js.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  prettierConfig,
  {
    // Настройка окружения
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        // Глобальные переменные для браузера
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        navigator: 'readonly',
        process: 'readonly', // Для переменных, связанных с Node.js
        URLSearchParams: 'readonly', // Для работы с URLSearchParams
        URL: 'readonly',
        Image: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        WebSocket: 'readonly',
        TextEncoder: 'readonly',
        crypto: 'readonly',
        btoa: 'readonly',
        atob: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      // Кавычки
      quotes: ['error', 'single', { avoidEscape: true }], // Одинарные кавычки, кроме случаев, когда нужны двойные
      // Точки с запятой
      semi: ['error', 'never'], // Без точек с запятой
      // Trailing commas
      'comma-dangle': ['error', 'never'], // Без trailing commas
      // Vue-specific rules
      'vue/html-self-closing': [
        'error',
        {
          html: {
            void: 'always',
            normal: 'never',
            component: 'always'
          },
          svg: 'always',
          math: 'always'
        }
      ],
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off' // Отключаем правило для однословных компонентов
    }
  },
  {
    files: ['workers/**/*.{js,mjs}', 'shared/**/*.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 'latest', globals: serverGlobals }
  },
  {
    // Browser checks pass functions to page.evaluate(); they run in the page.
    files: ['scripts/browser-*.js', 'scripts/frontend-profile-*.js'],
    languageOptions: {
      globals: Object.fromEntries(
        [
          'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
          'indexedDB', 'PerformanceObserver', 'getComputedStyle', 'requestAnimationFrame',
          'MutationObserver', 'IntersectionObserver'
        ].map((name) => [name, 'readonly'])
      )
    }
  },
  {
    files: ['migration/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...serverGlobals, window: 'readonly', document: 'readonly', location: 'readonly' }
    }
  }
]
