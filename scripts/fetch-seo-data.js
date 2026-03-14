import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveCanonicalMovieIdentity } from '../src/utils/movieSlug.js'

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/movies.json')
const API_BASE_URL = process.env.SEO_SOURCE_API_URL || 'https://kinobd.net'
const PAGE_SIZE = Number(process.env.SEO_PAGE_SIZE || 100)
const PAGE_COUNT = Number(process.env.SEO_PAGE_COUNT || 3)

const fetchPage = async (page) => {
  const url = `${API_BASE_URL}/api/films/top?page=${page}&per_page=${PAGE_SIZE}`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`SEO fetch failed for page ${page}: ${response.status}`)
  }

  const payload = await response.json()
  return Array.isArray(payload?.data) ? payload.data : []
}

const mapMovie = (movie) => {
  const identity = resolveCanonicalMovieIdentity(movie)
  const kpId = identity.kpId
  const title = identity.localizedTitle || identity.originalTitle

  if (!kpId || !title) return null

  return {
    kp_id: String(kpId),
    slug: identity.slug,
    title,
    name_original: identity.originalTitle,
    year: String(movie?.year || movie?.year_start || ''),
    description: String(movie?.description || '').trim(),
    poster: String(movie?.best_poster || movie?.big_poster || movie?.small_poster || '').trim(),
    updatedAt: String(movie?.updated_at || '').trim()
  }
}

const dedupeMovies = (movies) => {
  const unique = new Map()

  for (const movie of movies) {
    if (!movie) continue
    if (!unique.has(movie.kp_id)) unique.set(movie.kp_id, movie)
  }

  return Array.from(unique.values())
}

async function main() {
  const pages = await Promise.all(
    Array.from({ length: PAGE_COUNT }, (_, index) => fetchPage(index + 1))
  )

  const movies = dedupeMovies(pages.flat().map(mapMovie))
  if (movies.length === 0) {
    console.warn(`SEO fetch returned 0 movies from ${API_BASE_URL}, keeping existing ${OUTPUT_PATH}`)
    return
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(movies, null, 2)}\n`, 'utf8')

  console.log(`Wrote ${movies.length} SEO entries to ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
