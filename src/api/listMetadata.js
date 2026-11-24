import { getKpInfo } from '@/api/movies.worker'
import { getMovieSeoSlug } from '@/utils/movieSeo'
import { cardRatings } from '../../shared/history-data.js'
import {
  fillCardMetadata,
  needsCardMetadata
} from '../../shared/movie-metadata.js'

const pending = new Map()
const queue = []
let active = 0
async function boundedLoad(load) {
  if (active >= 3) await new Promise((resolve) => queue.push(resolve))
  else active++
  try {
    return await load()
  } finally {
    if (queue.length) queue.shift()()
    else active--
  }
}
async function loadMetadata(id) {
  if (!pending.has(id)) {
    const promise = boundedLoad(() => getKpInfo(id, { timeout: 8000 }))
      .then((movie) =>
        movie
          ? {
              ...movie,
              ...cardRatings(movie),
              ratings_checked: 1,
              slug: getMovieSeoSlug(movie, id)
            }
          : null
      )
      .catch(() => null)
      .finally(() => pending.delete(id))
    pending.set(id, promise)
  }
  return pending.get(id)
}

// One list load fetches details for at most this many cards; the rest keep
// their IDs and are filled on later loads, so a large import is not N GETs + N PATCHes.
export const ENRICH_LIMIT = 60

// Bounded requests; failures keep the imported ID and are retried on the next load.
export async function enrichListMetadata(
  items,
  { persist, onItem, includeRatings = false, isCurrent = () => true, limit = ENRICH_LIMIT } = {}
) {
  const result = [...items]
  let budget = limit
  let persistFailures = 0
  for (let offset = 0; offset < items.length && budget > 0; offset += 3) {
    if (!isCurrent()) throw new Error('Аккаунт изменился. Повторите операцию')
    await Promise.all(
      items.slice(offset, offset + 3).map(async (item, index) => {
        const id = String(item?.kp_id || '')
        const missingRatings =
          item?.ratings_checked !== 1 &&
          !cardRatings(item).rating_kp &&
          !cardRatings(item).rating_imdb
        if (
          !/^[1-9]\d{0,11}$/.test(id) ||
          (!needsCardMetadata(item) && !(includeRatings && missingRatings)) ||
          budget <= 0
        )
          return
        budget -= 1
        const movie = await loadMetadata(id)
        if (!isCurrent() || !movie) return
        const enriched = fillCardMetadata(item, movie)
        result[offset + index] = enriched
        onItem?.(enriched, offset + index)
        if (persist && JSON.stringify(enriched) !== JSON.stringify(item)) {
          // A storage failure must not hide a usable card. Subsequent loads retry.
          await persist(enriched).catch(() => {
            persistFailures += 1
          })
        }
      })
    )
  }
  if (persistFailures)
    console.warn(`[listMetadata] ${persistFailures} metadata updates not saved; retried on next load`)
  if (!isCurrent()) throw new Error('Аккаунт изменился. Повторите операцию')
  return result
}
