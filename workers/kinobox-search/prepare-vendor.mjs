import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'

const manifest = JSON.parse(await fs.readFile(new URL('./vendor-manifest.json', import.meta.url), 'utf8'))
const sha = text => createHash('sha256').update(text).digest('hex')
for (const [name, spec] of Object.entries(manifest)) {
  const response = await fetch(spec.url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error('Vendor download failed: ' + response.status)
  const raw = await response.text()
  if (sha(raw) !== spec.sha256) throw new Error('Vendor SHA256 mismatch: ' + name)
  let text = raw
  if (spec.trustStore) {
    const { start, end, spans } = spec.trustStore
    text = raw.slice(0, start) + '[' +
      spans.map(s => raw.slice(s.start, s.end)).join(',') + ']' + raw.slice(end)
  }
  text = text.replace(/"\/node\/([a-z_]+)\.mjs"/g, '"node:$1"')
  if (sha(text) !== spec.adaptedSha256) throw new Error('Adapted SHA256 mismatch: ' + name)
  await fs.writeFile(new URL('./vendor-' + name + '.mjs', import.meta.url), text)
  console.log('Verified vendor module:', name)
}
