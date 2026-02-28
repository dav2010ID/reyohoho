import DOMPurify from 'dompurify'

const commonConfig = {
  ALLOWED_ATTR: ['class', 'title'],
  FORBID_TAGS: ['style', 'script'],
  FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload']
}

const commentHtmlConfig = {
  ...commonConfig,
  ALLOWED_TAGS: ['a', 'img', 'span', 'br'],
  ALLOWED_ATTR: [
    ...commonConfig.ALLOWED_ATTR,
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'loading',
    'data-spoiler'
  ]
}

const toastHtmlConfig = {
  ...commonConfig,
  ALLOWED_TAGS: ['a', 'span', 'strong', 'em', 'br'],
  ALLOWED_ATTR: [...commonConfig.ALLOWED_ATTR, 'href', 'target', 'rel']
}

export const sanitizeCommentHtml = (html) => {
  return DOMPurify.sanitize(html, commentHtmlConfig)
}

export const sanitizeToastHtml = (html) => {
  return DOMPurify.sanitize(html, toastHtmlConfig)
}
