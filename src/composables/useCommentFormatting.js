// import { getBaseURLSync } from '@/api/axios'

export function useCommentFormatting() {
  const isValidImageUrl = (url) => {
    try {
      const urlObj = new URL(url)
      const isValid =
        (urlObj.hostname === 'cdn.7tv.app' && urlObj.protocol === 'https:') ||
        (urlObj.hostname === 'cdn.rte.net.ru' && urlObj.protocol === 'https:') ||
        (urlObj.pathname.includes('/api/7tv') && urlObj.protocol === 'https:')

      if (!isValid) {
        console.warn('URL изображения отклонен:', {
          url: url,
          hostname: urlObj.hostname,
          protocol: urlObj.protocol,
          reason:
            urlObj.hostname !== 'cdn.7tv.app' ? 'неразрешенный домен' : 'неразрешенный протокол'
        })
        return false
      }

      // const modifiedUrl = `${getBaseURLSync()}${urlObj.pathname}${urlObj.search}${urlObj.hash}`
      // return modifiedUrl
      return url
    } catch (error) {
      console.warn('Недопустимый URL изображения:', url, 'Ошибка:', error.message)
      return false
    }
  }

  const escapeHtml = (text) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  const formatContent = (content) => {
    if (!content) return ''

    let processedContent = content

    // Remove empty tags
    processedContent = processedContent.replace(/\[spoiler\]\s*\[\/spoiler\]/g, '')
    processedContent = processedContent.replace(/\[img\]\s*\[\/img\]/g, '')
    processedContent = processedContent.replace(/\[link=[^\]]+\]\s*\[\/link\]/g, '')

    processedContent = processedContent.replace(
      /\[spoiler\](.*?)\[\/spoiler\]/gs,
      (match, spoilerText, offset, string) => {
        const trimmedSpoilerText = spoilerText.trim()
        if (!trimmedSpoilerText) return ''

        const parts = trimmedSpoilerText
          .split(/(\[img\].*?\[\/img\]|\[link=.*?\[\/link\])/)
          .filter(Boolean)

        const processedParts = parts.map((part) => {
          if (part.startsWith('[img]')) {
            return part.replace(/\[img\](.*?)\[\/img\]/g, (match, url) => {
              const trimmedUrl = url.trim()
              const validationResult = isValidImageUrl(trimmedUrl)

              if (validationResult && validationResult !== false) {
                const safeUrl = escapeHtml(validationResult)
                return `<span class="spoiler-hidden-content"><img src="${safeUrl}" alt="7TV emote" class="inline-emoji" loading="lazy" /></span>`
              }
              return `[недопустимое изображение: ${escapeHtml(trimmedUrl)}]`
            })
          } else if (part.startsWith('[link=')) {
            return part.replace(/\[link=([^\]]+)\](.*?)\[\/link\]/g, (match, url, linkText) => {
              const trimmedUrl = url.trim()
              const trimmedText = linkText.trim()
              if (!trimmedText) return ''

              const isValidUrl = /^https?:\/\//.test(trimmedUrl)

              if (isValidUrl && trimmedText) {
                const safeUrl = escapeHtml(trimmedUrl)
                const safeText = escapeHtml(trimmedText)
                return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="comment-link">${safeText}</a>`
              }

              return escapeHtml(trimmedText || trimmedUrl)
            })
          } else {
            return escapeHtml(part)
          }
        })

        const processedSpoilerContent = processedParts.join('')

        const beforeChar = offset > 0 ? string[offset - 1] : ' '
        const afterChar =
          offset + match.length < string.length ? string[offset + match.length] : ' '

        const needSpaceBefore =
          beforeChar && beforeChar !== ' ' && beforeChar !== '\n' && beforeChar !== '\t'
        const needSpaceAfter =
          afterChar && afterChar !== ' ' && afterChar !== '\n' && afterChar !== '\t'

        const spaceBefore = needSpaceBefore ? ' ' : ''
        const spaceAfter = needSpaceAfter ? ' ' : ''

        return `${spaceBefore}<span class="spoiler-text" onclick="this.classList.toggle('revealed')" title="Нажмите, чтобы показать спойлер">${processedSpoilerContent}</span>${spaceAfter}`
      }
    )

    processedContent = processedContent.replace(/\[img\](.*?)\[\/img\]/g, (match, url) => {
      const trimmedUrl = url.trim()
      const validationResult = isValidImageUrl(trimmedUrl)

      if (validationResult && validationResult !== false) {
        const safeUrl = escapeHtml(validationResult)
        return `<img src="${safeUrl}" alt="7TV emote" class="inline-emoji" loading="lazy" />`
      }
      return `[недопустимое изображение: ${escapeHtml(trimmedUrl)}]`
    })

    processedContent = processedContent.replace(
      /\[link=([^\]]+)\](.*?)\[\/link\]/g,
      (match, url, linkText) => {
        const trimmedUrl = url.trim()
        const trimmedText = linkText.trim()
        if (!trimmedText) return ''

        const isValidUrl = /^https?:\/\//.test(trimmedUrl)

        if (isValidUrl && trimmedText) {
          const safeUrl = escapeHtml(trimmedUrl)
          const safeText = escapeHtml(trimmedText)
          return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="comment-link">${safeText}</a>`
        }

        return escapeHtml(trimmedText || trimmedUrl)
      }
    )

    return processedContent
  }

  const formatContentWithTruncation = (content) => {
    if (!content) return ''

    let processedContent = content

    return formatContent(processedContent)
  }

  return {
    formatContent,
    formatContentWithTruncation,
    isValidImageUrl,
    escapeHtml
  }
}
