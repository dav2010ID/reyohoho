import { getMovieSeoPath } from '@/utils/movieSeo'

export const handleHashNavigation = (to) => {
  if (to.hash.startsWith('#/')) {
    const route = to.hash.substring(2)
    const [routePath, queryString] = route.split('?')
    const queryParams = new URLSearchParams(queryString)
    const query = Object.fromEntries(queryParams)

    return { path: routePath || '/', query }
  }
  const legacyId = /^#([1-9]\d{0,11})$/.exec(to.hash)
  return legacyId ? { path: getMovieSeoPath({ kp_id: legacyId[1] }) } : true
}
