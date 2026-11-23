// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPwaShell } from './pwa-shell.js'

const directories = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  )
})

describe('offline shell dependency selection', () => {
  it('preserves the shell across ViteSSG config instances without downloading optional routes or dialogs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reyohoho-pwa-'))
    directories.push(root)
    const configure = (shell, ssr = false) =>
      shell.plugin.configResolved({ root, build: { outDir: 'dist', ssr } })
    const initialConfig = createPwaShell()
    const client = createPwaShell()
    configure(initialConfig)
    configure(client)
    const chunk = (fileName, imports = [], extra = {}) => ({
      type: 'chunk',
      fileName,
      imports,
      ...extra
    })
    const bundle = {
      'entry.js': chunk('entry.js', ['shared.js'], {
        isEntry: true,
        dynamicImports: ['workbox.js'],
        viteMetadata: {
          importedCss: new Set(),
          // The default stars background is precached; the opt-in garland is left to the
          // runtime cache.
          importedAssets: new Set([
            'assets/immutable/image-back-stars-AbC123.webp',
            'assets/immutable/trn-christmas-lights-x_Y9.webp'
          ])
        }
      }),
      'shared.js': chunk('shared.js', ['entry.js']),
      'workbox.js': chunk('workbox.js', ['workbox-helper.js'], {
        modules: {
          'C:\\repo\\node_modules\\workbox-window\\build\\workbox-window.prod.es5.mjs': {}
        }
      }),
      'workbox-helper.js': chunk('workbox-helper.js'),
      'movie.js': chunk('movie.js', ['shared.js'], {
        facadeModuleId: 'C:\\repo\\src\\components\\MovieInfo.vue',
        dynamicImports: ['comments.js', 'dialog.js', 'scenes.js', 'overlay.js'],
        viteMetadata: {
          importedCss: new Set(['movie.css']),
          importedAssets: new Set(['poster.webp'])
        }
      }),
      'comments.js': chunk('comments.js'),
      'dialog.js': chunk('dialog.js'),
      'scenes.js': chunk('scenes.js', [], {
        facadeModuleId: '/repo/src/components/RandomMovieModal.vue'
      }),
      'overlay.js': chunk('overlay.js', [], {
        facadeModuleId: '/repo/src/utils/playerVideoOverlayRuntime.js'
      }),
      'settings.js': chunk('settings.js', [], {
        facadeModuleId: '/repo/src/components/Settings.vue'
      })
    }
    const emitted = []
    client.plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) }, {}, bundle)
    for (const file of emitted) {
      const target = path.join(root, 'dist', file.fileName)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, file.source)
    }
    const ssr = createPwaShell()
    configure(ssr, 'src/main.js')
    const emitFile = vi.fn()
    ssr.plugin.generateBundle.call(
      { emitFile },
      {},
      { 'main.mjs': chunk('main.mjs', [], { isEntry: true }) }
    )
    expect(emitFile).not.toHaveBeenCalled()
    const urls = [
      'index.html',
      'manifest.webmanifest',
      'favicon.ico',
      'icons/icon-192x192.png',
      'icons/icon-512x512.png',
      'icons/icon-72x72.png',
      'entry.js',
      'shared.js',
      'workbox.js',
      'workbox-helper.js',
      'movie.js',
      'movie.css',
      'poster.webp',
      'assets/immutable/image-back-stars-AbC123.webp',
      'assets/immutable/trn-christmas-lights-x_Y9.webp',
      'comments.js',
      'comments.css',
      'dialog.js',
      'scenes.js',
      'overlay.js',
      'settings.js',
      'unrelated.png',
      'personal.json',
      '.vite/ssr-manifest.json'
    ]
    const entries = urls.map((url) => ({ url, revision: 'final-ssg-revision' }))
    const transformed = await initialConfig.transform(entries)
    expect(transformed.manifest.map(({ url }) => url)).toEqual([
      'index.html',
      'manifest.webmanifest',
      'favicon.ico',
      'icons/icon-192x192.png',
      'icons/icon-512x512.png',
      'entry.js',
      'shared.js',
      'workbox.js',
      'workbox-helper.js',
      'movie.js',
      'movie.css',
      'poster.webp',
      'assets/immutable/image-back-stars-AbC123.webp'
    ])
    expect(transformed.manifest.every(({ revision }) => revision === 'final-ssg-revision')).toBe(
      true
    )
  })
})
