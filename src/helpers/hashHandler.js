export const handleHashNavigation = (to, next) => {
  if (to.hash.startsWith('#/')) {
    const route = to.hash.substring(2)
    const [routePath, queryString] = route.split('?')
    const queryParams = new URLSearchParams(queryString)
    const query = Object.fromEntries(queryParams)

    next({ path: routePath || '/', query })
  } else if (to.hash.startsWith('#search=')) {
    next()
  } else if (to.hash.startsWith('#imdb=')) {
    next()
  } else if (to.hash.startsWith('#shiki')) {
    next()
  } else {
    const hash = to.hash.slice(1)
    next({ path: `/movie/${hash}` })
  }
}