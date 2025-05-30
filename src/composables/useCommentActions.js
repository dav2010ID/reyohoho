import { onMounted, onBeforeUnmount } from 'vue'
import { useEmojiPicker } from './useEmojiPicker'
import { useImagePicker } from './useImagePicker'
import { useLinkModal } from './useLinkModal'
import { useTextareaAutoResize } from './useTextareaAutoResize'

export function useCommentActions() {
  const emojiPicker = useEmojiPicker()
  const imagePicker = useImagePicker()
  const linkModal = useLinkModal()
  const { autoResize, autoResizeElement } = useTextareaAutoResize()

  const handleButtonMouseEnter = () => {
    emojiPicker.isButtonHovered.value = true
    imagePicker.isButtonHovered.value = true
    emojiPicker.showEmojiPicker.value = true
    imagePicker.showImagePicker.value = false
  }

  const handleImageButtonMouseEnter = () => {
    emojiPicker.isButtonHovered.value = true
    imagePicker.isButtonHovered.value = true
    imagePicker.showImagePicker.value = true
    emojiPicker.showEmojiPicker.value = false
  }

  const handleButtonMouseLeave = () => {
    emojiPicker.isButtonHovered.value = false
    imagePicker.isButtonHovered.value = false
    setTimeout(() => {
      if (
        !emojiPicker.isEmojiHovered.value &&
        !imagePicker.isImageHovered.value &&
        !emojiPicker.isButtonHovered.value &&
        !imagePicker.isButtonHovered.value
      ) {
        emojiPicker.showEmojiPicker.value = false
        imagePicker.showImagePicker.value = false
      }
    }, 300)
  }

  const closeAllPickers = () => {
    emojiPicker.showEmojiPicker.value = false
    imagePicker.showImagePicker.value = false
  }

  const handleGlobalClick = (event) => {
    if (
      !event.target.closest('.emoji-picker') &&
      !event.target.closest('.image-picker') &&
      !event.target.closest('.emoji-button-inline')
    ) {
      closeAllPickers()
    }
  }

  const insertEmojiUniversal = (emoji, textareaRef, textModel, updateCallback) => {
    emojiPicker.insertEmoji(emoji, textareaRef, textModel, updateCallback)
  }

  const insertImageUniversal = (imageUrl, textareaRef, textModel, updateCallback) => {
    imagePicker.insertImage(imageUrl, textareaRef, textModel, updateCallback)
  }

  const insertLinkUniversal = (textareaRef, textModel, updateCallback) => {
    linkModal.insertLink(textareaRef, textModel, updateCallback)
  }

  const insertLinkFromModalUniversal = (linkData, textareaRef, textModel, updateCallback) => {
    linkModal.insertLinkFromModal(linkData, textareaRef, textModel, updateCallback)
  }

  const insertSpoilerUniversal = (textareaRef, textModel, updateCallback) => {
    linkModal.insertSpoiler(textareaRef, textModel, updateCallback)
  }

  onMounted(() => {
    document.addEventListener('click', handleGlobalClick)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleGlobalClick)
  })

  return {
    showEmojiPicker: emojiPicker.showEmojiPicker,
    handleEmojiMouseEnter: emojiPicker.handleEmojiMouseEnter,
    handleEmojiMouseLeave: emojiPicker.handleEmojiMouseLeave,
    closeEmojiPicker: emojiPicker.closeEmojiPicker,

    showImagePicker: imagePicker.showImagePicker,
    handleImageMouseEnter: imagePicker.handleImageMouseEnter,
    handleImageMouseLeave: imagePicker.handleImageMouseLeave,
    closeImagePicker: imagePicker.closeImagePicker,

    showLinkModal: linkModal.showLinkModal,
    selectedTextForLink: linkModal.selectedTextForLink,
    closeLinkModal: linkModal.closeLinkModal,

    handleButtonMouseEnter,
    handleImageButtonMouseEnter,
    handleButtonMouseLeave,
    closeAllPickers,

    insertEmojiUniversal,
    insertImageUniversal,
    insertLinkUniversal,
    insertLinkFromModalUniversal,
    insertSpoilerUniversal,

    autoResize,
    autoResizeElement
  }
}
