// Shared focus behavior for existing modal layouts. State belongs to each element.
export const dialogFocus = {
  mounted(el, binding) {
    const previous = document.activeElement
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.tabIndex = -1
    const focusable = () => [...el.querySelectorAll('button, a[href], input, textarea, select, [tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length)
    const keydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        binding.value?.()
      }
      if (event.key !== 'Tab') return
      const nodes = focusable()
      const first = nodes[0] || el
      const last = nodes.at(-1) || el
      if (event.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !nodes.length)) {
        event.preventDefault(); first.focus()
      }
    }
    el.addEventListener('keydown', keydown)
    window.queueMicrotask(() => { if (el.isConnected) (focusable()[0] || el).focus() })
    el.__disposeDialog = () => {
      el.removeEventListener('keydown', keydown)
      if (previous?.isConnected) previous.focus()
    }
  },
  beforeUnmount(el) { el.__disposeDialog?.() },
  getSSRProps() { return { role: 'dialog', 'aria-modal': 'true', tabindex: '-1' } }
}
