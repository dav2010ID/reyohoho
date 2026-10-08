import { getKpInfo } from '@/api/movies.kinobox'
import { getMovieSeoSlug } from '@/utils/movieSeo'
import {
  fillCardMetadata,
  needsCardMetadata
} from '../../migration/history-transfer/movie-metadata.js'

const pending = new Map()
async function loadMetadata(id) {
  if (!pending.has(id)) {
    const promise = getKpInfo(id, { timeout: 8000 })
      .then((movie) => (movie ? { ...movie, slug: getMovieSeoSlug(movie, id) } : null))
      .catch(() => null)
      .finally(() => pending.delete(id))
    pending.set(id, promise)
  }
  return pending.get(id)
}

// Bounded requests; failures keep the imported ID and are retried on the next load.
export async function enrichListMetadata(items, { persist, isCurrent = () => true } = {}) {
  const result = [...items]
  for (let offset = 0; offset < items.length; offset += 3) {
    if (!isCurrent()) throw new Error('Аккаунт изменился. Повторите операцию')
    await Promise.all(
      items.slice(offset, offset + 3).map(async (item, index) => {
        const id = String(item?.kp_id || '')
        if (!/^[1-9]\d{0,11}$/.test(id) || !needsCardMetadata(item)) return
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
