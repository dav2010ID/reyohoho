import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { patchVendorModule } from './runtime-vendor-patches.mjs'

const manifest = JSON.parse(
  await fs.readFile(new URL('./vendor-manifest.json', import.meta.url), 'utf8')
)
const sha = (text) => createHash('sha256').update(text).digest('hex')
// esm.sh rebuilds bundles in place, so the verified modules are committed.
// Default: verify them offline. --download refetches and re-adapts them.
const download = process.argv.includes('--download')
for (const [name, spec] of Object.entries(manifest)) {
  const file = new URL('./vendor-' + name + '.mjs', import.meta.url)
  if (!download) {
    const bytes = await fs.readFile(file)
    if (bytes.length !== spec.adaptedSize || sha(bytes) !== spec.adaptedSha256)
      throw new Error('Committed vendor module mismatch: ' + name)
    console.log('Verified vendor module:', name)
    continue
  }
  const response = await fetch(spec.url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error('Vendor download failed: ' + response.status)
  const raw = await response.text()
  if (sha(raw) !== spec.sha256) throw new Error('Vendor SHA256 mismatch: ' + name)
  let text = raw
  if (spec.trustStore) {
    const { start, end, spans } = spec.trustStore
    text =
      raw.slice(0, start) +
      '[' +
      spans.map((s) => raw.slice(s.start, s.end)).join(',') +
      ']' +
      raw.slice(end)
  }
  text = text.replace(/"\/node\/([a-z_]+)\.mjs"/g, '"node:$1"')
  text = patchVendorModule(name, text)
  if (sha(text) !== spec.adaptedSha256) throw new Error('Adapted SHA256 mismatch: ' + name)
  await fs.writeFile(file, text)
  console.log('Verified vendor module:', name)
}
