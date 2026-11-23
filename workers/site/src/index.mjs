import meta from '../generated/site-meta.json'
import { routeSite } from './router.mjs'

export default {
  fetch: (request, env) => routeSite(request, env, meta)
}
