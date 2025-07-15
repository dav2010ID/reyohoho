import vuePlugin from 'eslint-plugin-vue'
import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'

export default [
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
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
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
  }
]
