import { CONTENT_PROVIDERS, loadProvider } from './providerRegistry'

const PAUSE_MS = 5 * 60000
let pausedUntil = 0

// Extras are optional: a failure hides the extra blocks and never fails the card.
// Only Worker-sourced cards need them; backend cards carry their own related data.
export const getMovieExtras = async (movie, { signal } = {}) => {
  if (movie?.source !== 'kinobox' || !movie.kp_id || Date.now() < pausedUntil) return null
  try {
    const kinobox = await loadProvider(CONTENT_PROVIDERS.KINOBOX)
    return await kinobox.getMovieExtras(movie.kp_id, { signal })
  } catch {
    // Every attempt costs a Worker request, so do not repeat it on each card while it fails.
    if (!signal?.aborted) pausedUntil = Date.now() + PAUSE_MS
    return null
  }
}

const isEmpty = (value) =>
  value == null || value === '' || (Array.isArray(value) && value.length === 0)

// The card's own data always wins; extras only fill what it lacks.
export const missingMovieExtras = (movie, extras) =>
  Object.fromEntries(
    Object.entries(extras || {}).filter(
      ([field, value]) => !isEmpty(value) && isEmpty(movie?.[field])
    )
  )
