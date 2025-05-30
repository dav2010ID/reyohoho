import { ref, nextTick } from 'vue'

export function useEmojiPicker() {
  const showEmojiPicker = ref(false)
  const isEmojiHovered = ref(false)
  const isButtonHovered = ref(false)

  const handleEmojiMouseEnter = () => {
    isEmojiHovered.value = true
  }

  const handleEmojiMouseLeave = () => {
    isEmojiHovered.value = false
    setTimeout(() => {
      if (!isEmojiHovered.value && !isButtonHovered.value) {
        showEmojiPicker.value = false
      }
    }, 300)
  }

  const handleButtonMouseEnter = () => {
    isButtonHovered.value = true
    showEmojiPicker.value = true
  }

  const handleButtonMouseLeave = () => {
    isButtonHovered.value = false
    setTimeout(() => {
      if (!isEmojiHovered.value && !isButtonHovered.value) {
        showEmojiPicker.value = false
      }
    }, 300)
  }

  const closeEmojiPicker = () => {
    showEmojiPicker.value = false
  }

  const insertEmoji = (emoji, textareaRef, textModel, updateCallback) => {
    const textarea = textareaRef.value
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const before = textModel.value.substring(0, start)
      const after = textModel.value.substring(end)
      const newValue = before + emoji + after

      updateCallback(newValue)

      nextTick(() => {
        textarea.focus()
        textarea.setSelectionRange(start + emoji.length, start + emoji.length)
        if (textarea.style.height) {
          textarea.style.height = 'auto'
          textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
        }
      })
    } else {
      updateCallback(textModel.value + emoji)
    }
  }

  const handleGlobalClick = (event) => {
    if (!event.target.closest('.emoji-picker') && !event.target.closest('.emoji-button-inline')) {
      closeEmojiPicker()
    }
  }

  return {
    showEmojiPicker,
    isEmojiHovered,
    isButtonHovered,
    handleEmojiMouseEnter,
    handleEmojiMouseLeave,
    handleButtonMouseEnter,
    handleButtonMouseLeave,
    closeEmojiPicker,
    insertEmoji,
    handleGlobalClick
  }
}
