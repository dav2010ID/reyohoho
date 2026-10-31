// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { patchVendorModule } from './runtime-vendor-patches.mjs'

describe('pinned vendor runtime adaptations', () => {
  it('matches the committed manifest after deterministic patches', async () => {
    const manifest = JSON.parse(
      await fs.readFile(new URL('./vendor-manifest.json', import.meta.url))
    )
    for (const [name, spec] of Object.entries(manifest)) {
      const bytes = await fs.readFile(new URL('./vendor-' + name + '.mjs', import.meta.url))
      expect(bytes.length).toBe(spec.adaptedSize)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(spec.adaptedSha256)
    }
  })
  it('fails closed when a vendor update changes or duplicates the patch target', () => {
    const source = 'Le&&Le.debuglog?l=Le.debuglog("stream"):l=function(){};'
    expect(patchVendorModule('hpack', source)).toBe('l=function(){};')
    expect(() => patchVendorModule('hpack', 'changed')).toThrow('exactly once')
    expect(() => patchVendorModule('hpack', source + source)).toThrow('exactly once')
    expect(() => patchVendorModule('tls', 'changed')).toThrow('exactly once')
  })
  it('round trips HPACK without enabling the runtime stream logger', () => {
    const source = [
      "import assert from 'node:assert/strict'",
      "import util from 'node:util'",
      'let activations = 0',
      'util.debuglog = () => { activations++; return () => {} }',
      "const { default: hpack } = await import('./workers/kinobox-search/vendor-hpack.mjs')",
      'const comp = hpack.compressor.create({table: {size: 4096}})',
      "comp.write([{name: ':status', value: '200'}, {name: 'content-type', value: 'application/json'}])",
      'const decomp = hpack.decompressor.create({table: {maxSize: 4096}})',
      'decomp.write(comp.read()); decomp.execute()',
      "assert.equal(decomp.read().value, '200')",
      "assert.equal(decomp.read().value, 'application/json')",
      'assert.equal(decomp.read(), null)',
      'assert.equal(activations, 0)'
    ].join(';')
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      encoding: 'utf8'
    })
    expect(result.status, result.stderr).toBe(0)
  })
  it('skips hex formatting when tracing is disabled and preserves opt-in diagnostics', async () => {
    const { makeTLSClient, setCryptoImplementation } = await import('./vendor-tls.mjs')
    const { webcryptoCrypto } = await import('./vendor-crypto.mjs')
    setCryptoImplementation(webcryptoCrypto)
    const original = Number.prototype.toString
    let hex = 0
    Number.prototype.toString = function (radix) {
      if (radix === 16) hex++
      return original.call(this, radix)
    }
    try {
      for (const enabled of [false, true]) {
        const events = []
        const client = makeTLSClient({
          host: 'api.kinobox.tv',
          verifyServerCertificate: true,
          supportedProtocolVersions: ['TLS1_3'],
          applicationLayerProtocols: ['h2'],
          namedCurves: ['SECP256R1'],
          cipherSuites: ['TLS_AES_128_GCM_SHA256'],
          logger: {
            traceEnabled: enabled,
            trace: (...args) => events.push(args),
            debug() {},
            info() {},
            warn() {},
            error() {}
          },
          write: async () => {}
        })
        hex = 0
        await client.startHandshake()
        expect(events.some((args) => args[1] === 'writing packet')).toBe(enabled)
        expect(hex > 0).toBe(enabled)
      }
    } finally {
      Number.prototype.toString = original
    }
  })
})
