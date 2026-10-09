import { getKpInfo } from '@/api/movies.kinobox'
import { getMovieSeoSlug } from '@/utils/movieSeo'
import { cardRatings } from '../../migration/history-transfer/history-data.js'
import {
  fillCardMetadata,
  needsCardMetadata
} from '../../migration/history-transfer/movie-metadata.js'

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

// Bounded requests; failures keep the imported ID and are retried on the next load.
export async function enrichListMetadata(
  items,
  { persist, includeRatings = false, isCurrent = () => true } = {}
) {
  const result = [...items]
  for (let offset = 0; offset < items.length; offset += 3) {
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
          (!needsCardMetadata(item) && !(includeRatings && missingRatings))
        )
          return
        const movie = await loadMetadata(id)
        if (!isCurrent() || !movie) return
        const enriched = fillCardMetadata(item, movie)
        result[offset + index] = enriched
        if (persist && JSON.stringify(enriched) !== JSON.stringify(item)) {
          // A storage failure must not hide a usable card. Subsequent loads retry.
          await persist(enriched).catch(() => {})
        }
      })
    )
  }
  if (!isCurrent()) throw new Error('Аккаунт изменился. Повторите операцию')
  return result
}
