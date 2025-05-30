export function useTextareaAutoResize() {
  const autoResize = (event) => {
    const textarea = event?.target
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  const autoResizeElement = (element) => {
    if (element) {
      element.style.height = 'auto'
      element.style.height = `${Math.min(element.scrollHeight, 200)}px`
    }
  }

  return {
    autoResize,
    autoResizeElement
  }
}
