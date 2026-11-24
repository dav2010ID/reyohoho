import noPosterImage from '@/assets/image-no-poster.gif'

const KP_SMALL_POSTER_BASE = 'https://kinopoiskapiunofficial.tech/images/posters/kp_small'
const KP_POSTER_BASE = 'https://kinopoiskapiunofficial.tech/images/posters/kp'
// Only these variants have been verified on the Kinopoisk image CDN. Other hosts
// and URLs with query strings (which may be signed) must keep their original URL.
const YANDEX_POSTER =
  /^(https?:\/\/(?:avatars\.mds\.yandex\.net|cdn[a-z0-9]+\.svc\.cdn\.yandex\.net)\/get-kinopoisk-image\/\d+\/[\w-]+\/)(?:orig|\d+x\d+|x\d+)$/
const POSTER_WIDTHS = [100, 200, 300, 600]

const normalizeUrl = (value) => {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `https:${value}`
  return value
}

export const optimizePosterUrl = (value) => {
  const url = normalizeUrl(value)
  if (!url) return ''

  const base = url.match(YANDEX_POSTER)?.[1]
  if (base) return `${base}300x450`
  if (!/[?#]/.test(url) && url.startsWith(`${KP_POSTER_BASE}/`)) {
    return url.replace(`${KP_POSTER_BASE}/`, `${KP_SMALL_POSTER_BASE}/`)
  }
  return url
}

const getKpIdFromMovie = (movie = {}) => {
  return (
    movie.kp_id || movie.kinopoisk_id || movie.id_kp || movie.id || movie.raw_data?.film_id || null
  )
}

export const resolvePosterByMovie = (movie = {}) => {
  const direct =
    optimizePosterUrl(movie.poster) ||
    optimizePosterUrl(movie.cover) ||
    optimizePosterUrl(movie.poster_url_preview) ||
    optimizePosterUrl(movie.poster_url) ||
    optimizePosterUrl(movie.small_poster) ||
    optimizePosterUrl(movie.big_poster) ||
    optimizePosterUrl(movie.raw_data?.poster_url_preview) ||
    optimizePosterUrl(movie.raw_data?.poster_url)

  if (direct) return direct

  const kpId = getKpIdFromMovie(movie)
  if (kpId) return `${KP_SMALL_POSTER_BASE}/${kpId}.jpg`

  return ''
}

export const resolvePosterSourcesByMovie = (movie = {}) => {
  const src = resolvePosterByMovie(movie)
  const base = src.match(YANDEX_POSTER)?.[1]
  return {
    src,
    srcset: base
      ? POSTER_WIDTHS.map((width) => `${base}${width}x${(width * 3) / 2} ${width}w`).join(', ')
      : undefined
  }
}

// Matches MovieList's full-width grid (24px side padding) and the 80px desktop rail in main.scss.
// Phones show three columns (one for L, 12px side padding). Explicit sizes select the right source
// before a lazy image has its final layout.
const gridPosterSizes = (minWidth, gap, phoneColumns = 3) => {
  const sizes = [
    phoneColumns === 1
      ? '(max-width: 620px) calc(100vw - 24px)'
      : '(max-width: 620px) calc((100vw - 44px) / 3)'
  ]
  const horizontalPadding = 80 + 48
  for (let columns = 1; columns <= 12; columns++) {
    const maxViewport = (minWidth + gap) * (columns + 1) + horizontalPadding - gap - 1
    if (maxViewport <= 620) continue
    sizes.push(
      `(max-width: ${maxViewport}px) calc((100vw - ${horizontalPadding + (columns - 1) * gap}px) / ${columns})`
    )
  }
  return [...sizes, `${minWidth}px`].join(', ')
}

export const CARD_POSTER_SIZES = {
  small: gridPosterSizes(140, 16),
  medium: gridPosterSizes(170, 16),
  large: gridPosterSizes(320, 20, 1)
}

export const setImageFallback = ({ target: image }) => {
  if (image.getAttribute('src') === noPosterImage) return
  if (image.parentElement?.tagName === 'PICTURE') {
    image.parentElement.querySelectorAll('source').forEach((source) => {
      source.removeAttribute('srcset')
    })
  }
  image.removeAttribute('srcset')
  image.removeAttribute('sizes')
  image.src = noPosterImage
}

export const resolvePosterSetByMovie = (movie = {}) => {
  const preview = resolvePosterByMovie(movie)

  const big =
    normalizeUrl(movie.poster_url) ||
    normalizeUrl(movie.big_poster) ||
    normalizeUrl(movie.raw_data?.poster_url) ||
    (() => {
      const kpId = getKpIdFromMovie(movie)
      return kpId ? `${KP_POSTER_BASE}/${kpId}.jpg` : ''
    })()

  return {
    preview,
    full: big || preview
  }
}
