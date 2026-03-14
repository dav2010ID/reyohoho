import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

const resolveViteConfig = (mode) =>
  typeof viteConfig === 'function' ? viteConfig({ mode, command: 'serve', isSsrBuild: false }) : viteConfig

export default defineConfig(({ mode }) =>
  mergeConfig(resolveViteConfig(mode), {
    base: process.env.VITE_BASE_URL || '/',
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/*'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      transformMode: {
        web: [/\.[jt]sx$/]
      }
    }
  })
)
