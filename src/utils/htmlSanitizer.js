import DOMPurify from 'dompurify'

const isClient = typeof window !== 'undefined'

const commonConfig = {
  ALLOWED_ATTR: ['class', 'title'],
  FORBID_TAGS: ['style', 'script'],
  FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload']
}

const toastHtmlConfig = {
  ...commonConfig,
  ALLOWED_TAGS: ['a', 'span', 'strong', 'em', 'br'],
  ALLOWED_ATTR: [...commonConfig.ALLOWED_ATTR, 'href', 'target', 'rel']
}

export const sanitizeToastHtml = (html) => {
  if (!isClient) return html
  return DOMPurify.sanitize(html, toastHtmlConfig)
}
