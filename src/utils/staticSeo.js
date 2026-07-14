import { normalizeBasePath } from './basePath'

const DEFAULT_SITE_ORIGIN = 'https://dav2010id.github.io'
const DEFAULT_BASE_PATH = '/reyohoho'

export const buildStaticCanonicalUrl = (
  routePath,
  {
    siteOrigin = import.meta.env.VITE_SITE_ORIGIN || DEFAULT_SITE_ORIGIN,
    basePath = import.meta.env.VITE_BASE_URL || DEFAULT_BASE_PATH
  } = {}
) => {
  const normalizedBasePath = normalizeBasePath(basePath)
  const normalizedRoute = `/${String(routePath || '').replace(/^\/+|\/+$/g, '')}`
  const routeSuffix = normalizedRoute === '/' ? '/' : `${normalizedRoute}/`
  return `${siteOrigin}${normalizedBasePath}${routeSuffix}`
}

export const buildStaticPageHead = ({ routePath, title, description }) => {
  const canonicalUrl = buildStaticCanonicalUrl(routePath)

  return {
    title,
    link: [{ rel: 'canonical', href: canonicalUrl }],
    meta: [
      { name: 'description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonicalUrl },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description }
    ]
  }
}
