// Prerendered state ships as inert JSON instead of an inline script, so the
// Content-Security-Policy does not need a hash for every page.
export const SSG_STATE_ID = 'ssg-state'
const INLINE_STATE = /<script>window\.__INITIAL_STATE__=("(?:[^"\\]|\\.)*")<\/script>/

// vite-ssg escapes <, > and / in the literal, so it cannot close the element.
export const moveStateToJson = (html) =>
  html.replace(
    INLINE_STATE,
    (_, literal) => `<script type="application/json" id="${SSG_STATE_ID}">${literal}</script>`
  )

// vite-ssg reads window.__INITIAL_STATE__ (the serialized string) after DOM ready.
export const restoreSsgState = (doc = document, win = window) => {
  if (win.__INITIAL_STATE__ !== undefined) return
  const element = doc.getElementById(SSG_STATE_ID)
  if (!element) return
  try {
    win.__INITIAL_STATE__ = JSON.parse(element.textContent)
  } catch (error) {
    console.error('[ssg] unreadable prerendered state', error)
  }
}
