export const normalizeBasePath = (value) => {
  const normalized = `/${String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')}`

  return normalized === '/' ? '' : normalized
}
