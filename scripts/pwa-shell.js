import fs from 'node:fs/promises'
import path from 'node:path'

const graphFile = '.vite/pwa-shell.json'
const shellFiles = new Set([
  'index.html',
  'manifest.webmanifest',
  'favicon.ico',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
])
// Imported by the entry but shown only when enabled; runtime-cached on first use.
const optionalAssets = /(?:^|\/)(?:image-back-stars|trn-christmas-lights)-[\w-]+\.webp$/

// Keep the offline screens and SW registration client, not every lazy feature.
export function createPwaShell() {
  let graphPath
  let isSsr = false
  const screens =
    /\/src\/components\/(?:MovieSearch|TopMovies|MovieInfo|PlayerComponent|MovieRating|NotFound)\.vue$/
  return {
    plugin: {
      name: 'pwa-shell-dependencies',
      apply: 'build',
      configResolved(config) {
        isSsr = Boolean(config.build.ssr)
        graphPath = path.resolve(config.root, config.build.outDir, graphFile)
      },
      generateBundle(_options, bundle) {
        if (isSsr) return
        const selected = new Set()
        const visit = (file) => {
          if (selected.has(file)) return
          selected.add(file)
          const chunk = bundle[file]
          if (chunk?.type !== 'chunk') return
          chunk.imports.forEach(visit)
          chunk.viteMetadata?.importedCss?.forEach(visit)
          chunk.viteMetadata?.importedAssets?.forEach(visit)
        }
        for (const entry of Object.values(bundle)) {
          if (
            entry.type === 'chunk' &&
            (entry.isEntry ||
              screens.test(entry.facadeModuleId?.replaceAll('\\', '/') || '') ||
              // registerSW imports this client on idle, including on offline reloads.
              Object.keys(entry.modules || {}).some((id) =>
                id.replaceAll('\\', '/').includes('/node_modules/workbox-window/')
              ))
          )
            visit(entry.fileName)
        }
        // ViteSSG regenerates the SW using a separately resolved config after SSR.
        // Persist the client graph so that final regeneration uses the same shell.
        this.emitFile({ type: 'asset', fileName: graphFile, source: JSON.stringify([...selected]) })
      }
    },
    async transform(entries) {
      const required = new Set(JSON.parse(await fs.readFile(graphPath, 'utf8')))
      if (!required.size) throw new Error('Offline shell dependency graph was not generated')
      return {
        manifest: entries.filter(
          ({ url }) => shellFiles.has(url) || (required.has(url) && !optionalAssets.test(url))
        ),
        warnings: []
      }
    }
  }
}
