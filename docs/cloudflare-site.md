# Static hosting with HTTP 200 fallback

Build with VITE_PRERENDER_MOVIE_PAGES=true and yarn build:github. The config
workers/site/wrangler.jsonc serves existing prerendered documents first, then
index.html for unknown navigation paths with status 200. API remains on its
separate api.reyhoho.fun domain. The frontend validates movie IDs.

Preview: npx wrangler dev --config workers/site/wrangler.jsonc
Deploy a preview: npx wrangler deploy --config workers/site/wrangler.jsonc

Before switching reyhoho.fun: run browser-artifact-check.js, verify an uncatalogued
/movie/123456789 route returns 200, check a catalogued movie and /top, login,
and service-worker update/offline navigation. Configure the custom domain only
after preview verification, then disable the GitHub Pages deploy workflow to
avoid two production targets. Retain GitHub Pages for rollback until verified.

This configuration does not itself switch DNS or production hosting.
Apply the account Worker migration 0004 before enabling its corresponding release.
