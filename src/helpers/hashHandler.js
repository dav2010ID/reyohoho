import { getMovieSeoPath } from '@/utils/movieSeo'

export const handleHashNavigation = (to) => {
  if (to.hash.startsWith('#/')) {
    const route = to.hash.substring(2)
    const [routePath, queryString] = route.split('?')
    const queryParams = new URLSearchParams(queryString)
    const query = Object.fromEntries(queryParams)

    return { path: routePath || '/', query }
  } else if (to.hash.startsWith('#search=')) {
    return true
  } else if (to.hash.startsWith('#imdb=')) {
    return true
  } else if (to.hash.startsWith('#shiki')) {
    return true
  } else {
    const hash = to.hash.slice(1)
    return { path: getMovieSeoPath({ kp_id: hash }) }
  }
}
