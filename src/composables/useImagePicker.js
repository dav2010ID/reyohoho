import { ref, nextTick } from 'vue'

export function useImagePicker() {
  const showImagePicker = ref(false)
  const isImageHovered = ref(false)
  const isButtonHovered = ref(false)

  const handleImageMouseEnter = () => {
    isImageHovered.value = true
  }

  const handleImageMouseLeave = () => {
    isImageHovered.value = false
    setTimeout(() => {
      if (!isImageHovered.value && !isButtonHovered.value) {
        showImagePicker.value = false
      }
    }, 300)
  }

  const handleImageButtonMouseEnter = () => {
    isButtonHovered.value = true
    showImagePicker.value = true
  }

  const handleButtonMouseLeave = () => {
    isButtonHovered.value = false
    setTimeout(() => {
      if (!isImageHovered.value && !isButtonHovered.value) {
        showImagePicker.value = false
      }
    }, 300)
  }

  const closeImagePicker = () => {
    showImagePicker.value = false
  }

  const insertImage = (imageUrl, textareaRef, textModel, updateCallback) => {
    const textarea = textareaRef.value
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const imageTag = `[img]${imageUrl}[/img]`
      const newValue = textModel.value.slice(0, start) + imageTag + textModel.value.slice(end)

      updateCallback(newValue)

      nextTick(() => {
        textarea.focus()
        textarea.setSelectionRange(start + imageTag.length, start + imageTag.length)
        if (textarea.style.height) {
          textarea.style.height = 'auto'
          textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
        }
      })
    } else {
      const imageTag = `[img]${imageUrl}[/img]`
      updateCallback(textModel.value + imageTag)
    }
  }

  const handleGlobalClick = (event) => {
    if (!event.target.closest('.image-picker') && !event.target.closest('.emoji-button-inline')) {
      closeImagePicker()
    }
  }

  return {
    showImagePicker,
    isImageHovered,
    isButtonHovered,
    handleImageMouseEnter,
    handleImageMouseLeave,
    handleImageButtonMouseEnter,
    handleButtonMouseLeave,
    closeImagePicker,
    insertImage,
    handleGlobalClick
  }
}
