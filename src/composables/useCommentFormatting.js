export function useCommentFormatting() {
  const isValidImageUrl = (url) => {
    try {
      const urlObj = new URL(url)
      const isValid =
        (urlObj.hostname === 'cdn.7tv.app' && urlObj.protocol === 'https:') ||
        (urlObj.pathname.includes('/api/7tv') && urlObj.protocol === 'https:')

      if (!isValid) {
        console.warn('URL изображения отклонен:', {
          url: url,
          hostname: urlObj.hostname,
          protocol: urlObj.protocol,
          reason:
            urlObj.hostname !== 'cdn.7tv.app' ? 'неразрешенный домен' : 'неразрешенный протокол'
        })
      }

      return isValid
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

    processedContent = processedContent.replace(/\[img\](.*?)\[\/img\]/g, (match, url) => {
      const trimmedUrl = url.trim()
      if (isValidImageUrl(trimmedUrl)) {
        const safeUrl = escapeHtml(trimmedUrl)
        return `<img src="${safeUrl}" alt="7TV emote" class="inline-emoji" loading="lazy" />`
      }
      return `[недопустимое изображение: ${escapeHtml(trimmedUrl)}]`
    })

    processedContent = processedContent.replace(
      /\[spoiler\](.*?)\[\/spoiler\]/gs,
      (match, spoilerText, offset, string) => {
        const escapedText = escapeHtml(spoilerText.trim())

        const beforeChar = offset > 0 ? string[offset - 1] : ' '
        const afterChar =
          offset + match.length < string.length ? string[offset + match.length] : ' '

        const needSpaceBefore =
          beforeChar && beforeChar !== ' ' && beforeChar !== '\n' && beforeChar !== '\t'
        const needSpaceAfter =
          afterChar && afterChar !== ' ' && afterChar !== '\n' && afterChar !== '\t'

        const spaceBefore = needSpaceBefore ? ' ' : ''
        const spaceAfter = needSpaceAfter ? ' ' : ''

        return `${spaceBefore}<span class="spoiler-text" onclick="this.classList.toggle('revealed')" title="Нажмите, чтобы показать спойлер">${escapedText}</span>${spaceAfter}`
      }
    )

    processedContent = processedContent.replace(
      /\[link=([^\]]+)\](.*?)\[\/link\]/g,
      (match, url, linkText) => {
        const trimmedUrl = url.trim()
        const trimmedText = linkText.trim()

        const isValidUrl = /^https?:\/\/.+/.test(trimmedUrl)

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

  const formatContentWithTruncation = (content, maxLength = 300, isExpanded = false) => {
    if (!content) return ''

    let processedContent = content

    if (content.length > maxLength && !isExpanded) {
      let truncatedContent = content.slice(0, maxLength)

      const fullContent = content
      const allImagesCount = (fullContent.match(/\[img\].*?\[\/img\]/g) || []).length
      const visibleImagesCount = (truncatedContent.match(/\[img\].*?\[\/img\]/g) || []).length
      const hiddenImagesCount = allImagesCount - visibleImagesCount

      const lastOpenTag = truncatedContent.lastIndexOf('[img]')
      const lastCloseTag = truncatedContent.lastIndexOf('[/img]')

      if (lastOpenTag > lastCloseTag && lastOpenTag !== -1) {
        truncatedContent = content.slice(0, lastOpenTag)
      }

      truncatedContent = truncatedContent.trim()

      const partialOpenTags = ['[img', '[im', '[i', '[']
      for (const partialTag of partialOpenTags) {
        if (truncatedContent.endsWith(partialTag)) {
          const lastBracket = truncatedContent.lastIndexOf('[')
          if (lastBracket !== -1) {
            truncatedContent = truncatedContent.slice(0, lastBracket).trim()
            break
          }
        }
      }

      const partialCloseTags = ['[/img', '[/im', '[/i', '[/']
      for (const partialTag of partialCloseTags) {
        if (truncatedContent.endsWith(partialTag)) {
          const lastBracket = truncatedContent.lastIndexOf('[')
          if (lastBracket !== -1) {
            truncatedContent = truncatedContent.slice(0, lastBracket).trim()
            break
          }
        }
      }

      let ellipsis = '...'
      if (hiddenImagesCount > 0) {
        ellipsis = `... (+${hiddenImagesCount} ${hiddenImagesCount === 1 ? 'изображение' : 'изображений'})`
      }

      processedContent = truncatedContent + ellipsis
    }

    return formatContent(processedContent)
  }

  return {
    formatContent,
    formatContentWithTruncation,
    isValidImageUrl,
    escapeHtml
  }
}
