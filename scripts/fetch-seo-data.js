import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { resolveCanonicalMovieIdentity } from '../src/utils/movieSlug.js'

const catalogPath = path.resolve('src/data/movies.json')
const workerUrl = process.env.SEO_SOURCE_API_URL || 'https://api.reyhoho.fun'
const positiveId = /^[1-9]\d{0,11}$/

// The Worker permits 120 upstream attempts/minute. Space starts, including retries.
export function createReader(baseUrl, wait = sleep) {
  if (/(^|\.)kinobd\.net$/i.test(new URL(baseUrl).hostname))
    throw new Error('KinoBD is disabled; SEO_SOURCE_API_URL must point to the catalog Worker')
  let nextStart = 0
  return async (endpoint) => {
    for (let attempt = 0; ; attempt++) {
      await wait(Math.max(0, nextStart - Date.now()))
      nextStart = Date.now() + 650
      const response = await fetch(new URL(endpoint, baseUrl), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      })
      if (response.ok) return response.json()
      await response.body?.cancel()
      const seconds = Number(response.headers.get('Retry-After') || 2)
      if (
        attempt > 0 ||
        ![429, 502, 503, 504].includes(response.status) ||
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds > 60
      )
        throw new Error(`SEO: ${endpoint} returned HTTP ${response.status}`)
      nextStart = Math.max(nextStart, Date.now() + 1000 * seconds)
    }
  }
}

export function posterUrl(value) {
  // Both Worker endpoints use the Kinopoisk image CDN; list URLs have no size.
  const match =
    /^(?:https:)?\/\/(?:avatars\.mds\.yandex\.net|cdn[a-z0-9]+\.svc\.cdn\.yandex\.net)(\/get-kinopoisk-image\/\d+\/[\w-]+)(?:\/(?:orig|x\d+|\d+x\d+))?\/?$/i.exec(
      value || ''
    )
  return match ? `https://avatars.mds.yandex.net${match[1]}/600x900` : ''
}

async function readTop(type, read, size, pages) {
  const entries = []
  const ids = new Set()
  let total
  for (let page = 1; page <= pages && (total === undefined || entries.length < total); page++) {
    const { data } = await read(`/api/kinopoisk/top?type=${type}&page=${page}&limit=${size}`)
    if (
      !Number.isInteger(data?.total) ||
      data.total < 1 ||
      data.total > 250 ||
      (total !== undefined && data.total !== total) ||
      !Array.isArray(data.items) ||
      data.items.length !== Math.min(size, data.total - entries.length)
    )
      throw new Error(`Invalid or incomplete ${type} top at page ${page}`)
    total = data.total
    for (const { movie } of data.items) {
      if (!positiveId.test(movie?.id) || !(movie.title?.russian || movie.title?.original))
        throw new Error(`Invalid movie in ${type} top at page ${page}`)
      if (ids.has(String(movie.id))) throw new Error(`Duplicate ID ${movie.id} in ${type} top`)
      ids.add(String(movie.id))
      entries.push(movie)
    }
  }
  return entries
}

async function readMovie(read, id) {
  const { data } = await read('/api/movies/' + id)
  if (
    data?.isSuccess === false ||
    String(data?.movie?.id) !== id ||
    !(data.movie.title?.russian || data.movie.title?.original)
  )
    throw new Error(`Invalid details for Kinopoisk ID ${id}`)
  return data.movie
}

function withLastModified(entry, old, now) {
  return {
    ...entry,
    updatedAt:
      old?.updatedAt && Object.keys(entry).every((key) => entry[key] === old[key])
        ? old.updatedAt
        : now.toISOString()
  }
}

export async function refreshCatalog(
  existing,
  {
    read = createReader(workerUrl),
    pageSize = Number(process.env.SEO_PAGE_SIZE || 50),
    pageCount = Number(process.env.SEO_PAGE_COUNT || 3),
    now = new Date()
  } = {}
) {
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50 ||
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    (pageCount - 1) * pageSize >= 250
  )
    throw new Error('Invalid SEO pagination (Worker supports 50 per page and 250 per list)')
  const previous = new Map(existing.map((entry) => [entry.kp_id, entry]))
  const catalog = new Map()
  const top = [
    ...(await readTop('movie', read, pageSize, pageCount)),
    ...(await readTop('series', read, pageSize, pageCount))
  ]
  for (const item of top) {
    const id = String(item.id)
    if (catalog.has(id)) continue
    const old = previous.get(id)
    const movie = await readMovie(read, id)
    const original = movie.title?.original || item.title.original || old?.name_original || ''
    const entry = {
      kp_id: id,
      title: movie.title?.russian || item.title.russian || original,
      name_original: original,
      year: String(movie.year || item.year || old?.year || ''),
      description: (movie.description || movie.synopsis || old?.description || '').trim(),
      poster:
        posterUrl(movie.gallery?.posterUrl) ||
        posterUrl(item.gallery?.posterUrl) ||
        posterUrl(old?.poster)
    }
    entry.slug = resolveCanonicalMovieIdentity(entry, old).slug
    catalog.set(id, withLastModified(entry, old, now))
  }

  if (![...catalog.values()].some((entry) => entry.poster && entry.description))
    throw new Error('SEO top returned no titles with both artwork and a description')

  // Previously published URLs must keep their prerendered page when rankings change.
  for (const entry of existing) {
    if (!positiveId.test(entry.kp_id)) throw new Error('Invalid ID in existing SEO catalog')
    if (catalog.has(entry.kp_id)) continue
    if (posterUrl(entry.poster)) catalog.set(entry.kp_id, entry)
    else {
      const poster = posterUrl((await readMovie(read, entry.kp_id)).gallery?.posterUrl)
      // Some announced films have no official artwork. Omit the image rather
      // than publishing a dead URL or passing off a placeholder as a poster.
      catalog.set(
        entry.kp_id,
        poster === entry.poster ? entry : { ...entry, poster, updatedAt: now.toISOString() }
      )
    }
  }
  return [...catalog.values()]
}

async function writeJson(file, data) {
  const temp = file + '.' + randomUUID() + '.tmp'
  try {
    await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n', 'utf8')
    await fs.rename(temp, file)
  } finally {
    await fs.rm(temp, { force: true })
  }
}

export async function updateSeoDataFile({
  outputPath = catalogPath,
  now = new Date(),
  ...options
} = {}) {
  const existing = JSON.parse(await fs.readFile(outputPath, 'utf8'))
  if (!Array.isArray(existing)) throw new Error('Invalid SEO catalog')
  const movies = await refreshCatalog(existing, { ...options, now })
  await writeJson(outputPath, movies)
  await writeJson(path.join(path.dirname(outputPath), 'seo-refresh.json'), {
    refreshedAt: now.toISOString()
  })
  return movies
}

export function checkFreshness(stamp, now = Date.now()) {
  const age = now - Date.parse(stamp?.refreshedAt)
  if (!Number.isFinite(age) || age < 0 || age > 14 * 86400_000)
    throw new Error(
      'SEO catalog has no successful refresh in the last 14 days; run yarn seo:prepare'
    )
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    if (process.argv.includes('--check-freshness'))
      checkFreshness(
        JSON.parse(await fs.readFile(path.resolve('src/data/seo-refresh.json'), 'utf8'))
      )
    else {
      const movies = await updateSeoDataFile()
      console.log(`Updated ${movies.length} SEO entries in ${catalogPath}`)
    }
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
