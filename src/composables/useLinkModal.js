import { ref, nextTick } from 'vue'

export function useLinkModal() {
  const showLinkModal = ref(false)
  const selectedTextForLink = ref('')

  const insertLink = (textareaRef, textModel) => {
    const textarea = textareaRef.value
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = textModel.value.slice(start, end)
      selectedTextForLink.value = selectedText.trim() || ''
    }
    showLinkModal.value = true
  }

  const insertLinkFromModal = (linkData, textareaRef, textModel, updateCallback) => {
    const textarea = textareaRef.value
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const linkTag = `[link=${linkData.url}]${linkData.title}[/link]`
      const newValue = textModel.value.slice(0, start) + linkTag + textModel.value.slice(end)

      updateCallback(newValue)

      nextTick(() => {
        textarea.focus()
        textarea.setSelectionRange(start + linkTag.length, start + linkTag.length)
        if (textarea.style.height) {
          textarea.style.height = 'auto'
          textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
        }
      })
    }
  }

  const closeLinkModal = () => {
    showLinkModal.value = false
  }

  const insertSpoiler = (textareaRef, textModel, updateCallback) => {
    const textarea = textareaRef.value
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = textModel.value.slice(start, end)

      let spoilerTag
      if (selectedText.trim()) {
        spoilerTag = `[spoiler]${selectedText}[/spoiler]`
      } else {
        spoilerTag = '[spoiler][/spoiler]'
      }

      const newValue = textModel.value.slice(0, start) + spoilerTag + textModel.value.slice(end)
      updateCallback(newValue)

      nextTick(() => {
        textarea.focus()
        if (selectedText.trim()) {
          textarea.setSelectionRange(start + spoilerTag.length, start + spoilerTag.length)
        } else {
          const cursorPosition = start + '[spoiler]'.length
          textarea.setSelectionRange(cursorPosition, cursorPosition)
        }
        if (textarea.style.height) {
          textarea.style.height = 'auto'
          textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
        }
      })
    }
  }

  return {
    showLinkModal,
    selectedTextForLink,
    insertLink,
    insertLinkFromModal,
    closeLinkModal,
    insertSpoiler
  }
}
