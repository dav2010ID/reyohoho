// Keep runtime adaptations reproducible after prepare-vendor.mjs downloads the
// pinned upstream bundles. Match exactly once so a vendor update fails closed.
function replaceOnce(text, before, after) {
  const at = text.indexOf(before)
  if (at < 0 || text.indexOf(before, at + before.length) >= 0)
    throw new Error('Vendor patch no longer matches exactly once: ' + before)
  return text.slice(0, at) + after + text.slice(at + before.length)
}

export function patchVendorModule(name, text) {
  if (name === 'hpack') {
    // Workerd's node:util debuglog("stream") emits STREAM even without NODE_DEBUG.
    // Disable only this private readable-stream logger; leave node:util untouched.
    text = replaceOnce(
      text,
      'Le&&Le.debuglog?l=Le.debuglog("stream"):l=function(){};',
      'l=function(){};'
    )
  }
  if (name === 'tls') {
    // A no-op trace method still evaluates arguments, including per-byte hex.
    // Preserve the vendor's normal tracing unless the caller explicitly opts out.
    for (const payload of [
      '{cert:ar(m)},"sending zero certs"',
      '{finish:ar($)},"sending client finish"',
      '{...m,data:ar(m.data)},"writing enc packet"',
      '{...m,data:ar(m.data)},"writing packet"'
    ])
      text = replaceOnce(
        text,
        'k.trace(' + payload + ')',
        'k.traceEnabled!==!1&&k.trace(' + payload + ')'
      )
  }
  return text
}
