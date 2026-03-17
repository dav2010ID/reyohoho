import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveCanonicalMovieIdentity } from '../src/utils/movieSlug.js'

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/movies.json')
const API_BASE_URL = process.env.SEO_SOURCE_API_URL || 'https://kinobd.net'
const PAGE_SIZE = Number(process.env.SEO_PAGE_SIZE || 100)
const PAGE_COUNT = Number(process.env.SEO_PAGE_COUNT || 3)

export const ensureOutputFile = async (outputPath = OUTPUT_PATH) => {
  const normalizedOutputPath = path.resolve(outputPath)

  await fs.mkdir(path.dirname(normalizedOutputPath), { recursive: true })

  try {
    await fs.access(normalizedOutputPath)
  } catch {
    await fs.writeFile(normalizedOutputPath, '[]\n', 'utf8')
  }
}

export const readMoviesFile = async (outputPath = OUTPUT_PATH) => {
  try {
    const content = await fs.readFile(path.resolve(outputPath), 'utf8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export const writeMoviesFile = async (movies, outputPath = OUTPUT_PATH) => {
  await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true })
  await fs.writeFile(path.resolve(outputPath), `${JSON.stringify(movies, null, 2)}\n`, 'utf8')
}

export const resolveMoviesToPersist = (existingMovies = [], fetchedMovies = []) => {
  return Array.isArray(fetchedMovies) && fetchedMovies.length > 0 ? fetchedMovies : existingMovies
}

export const fetchPage = async (page, apiBaseUrl = API_BASE_URL) => {
  const url = `${apiBaseUrl}/api/films/top?page=${page}&per_page=${PAGE_SIZE}`
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

export const mapMovie = (movie) => {
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

export const dedupeMovies = (movies) => {
  const unique = new Map()

  for (const movie of movies) {
    if (!movie) continue
    if (!unique.has(movie.kp_id)) unique.set(movie.kp_id, movie)
  }

  return Array.from(unique.values())
}

export const fetchSeoMovies = async ({
  apiBaseUrl = API_BASE_URL,
  pageCount = PAGE_COUNT
} = {}) => {
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => fetchPage(index + 1, apiBaseUrl))
  )

  return dedupeMovies(pages.flat().map(mapMovie))
}

export async function updateSeoDataFile({
  outputPath = OUTPUT_PATH,
  apiBaseUrl = API_BASE_URL,
  pageCount = PAGE_COUNT
} = {}) {
  await ensureOutputFile(outputPath)

  const existingMovies = await readMoviesFile(outputPath)
  const fetchedMovies = await fetchSeoMovies({ apiBaseUrl, pageCount })
  const moviesToPersist = resolveMoviesToPersist(existingMovies, fetchedMovies)

  await writeMoviesFile(moviesToPersist, outputPath)
  return moviesToPersist
}

async function main() {
  const movies = await updateSeoDataFile()
  if (movies.length === 0) {
    console.warn(`SEO fetch returned 0 movies from ${API_BASE_URL}, keeping existing ${OUTPUT_PATH}`)
  }

  console.log(`Wrote ${movies.length} SEO entries to ${OUTPUT_PATH}`)
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectRun) {
  main().catch(async (error) => {
    await ensureOutputFile()
    console.warn(`SEO fetch failed, keeping existing ${OUTPUT_PATH}`)
    console.warn(error)
  })
}
