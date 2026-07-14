import { describe, expect, it } from 'vitest'
import { buildStaticCanonicalUrl, buildStaticPageHead } from './staticSeo'

describe('static route SEO', () => {
  it('builds canonical URLs that resolve directly to nested SSG pages', () => {
    expect(
      buildStaticCanonicalUrl('/top', {
        siteOrigin: 'https://example.com',
        basePath: '/app/'
      })
    ).toBe('https://example.com/app/top/')
  })

  it('keeps the homepage canonical at the base path', () => {
    expect(
      buildStaticCanonicalUrl('/', {
        siteOrigin: 'https://example.com',
        basePath: '/app'
      })
    ).toBe('https://example.com/app/')
  })

  it('uses the route canonical in Open Graph metadata', () => {
    const head = buildStaticPageHead({
      routePath: '/contact',
      title: 'Contacts',
      description: 'Contact page'
    })

    expect(head.link).toContainEqual({
      rel: 'canonical',
      href: 'https://dav2010id.github.io/reyohoho/contact/'
    })
    expect(head.meta).toContainEqual({
      property: 'og:url',
      content: 'https://dav2010id.github.io/reyohoho/contact/'
    })
  })
})
