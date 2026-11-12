<template>
  <div v-show="hasOverflow" ref="root" class="ribbon-nav">
    <button
      type="button"
      class="ribbon-nav__btn"
      :aria-label="`${label}: назад`"
      :disabled="!canPrev"
      @click="scrollStep(-1)"
    >
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
    <button
      type="button"
      class="ribbon-nav__btn"
      :aria-label="`${label}: вперёд`"
      :disabled="!canNext"
      @click="scrollStep(1)"
    >
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Prev/next buttons for a horizontal ribbon: the first `scroller` element
// inside the closest `container` ancestor of this component.
const props = defineProps({
  container: { type: String, required: true },
  scroller: { type: String, required: true },
  label: { type: String, default: 'Лента' }
})

const root = ref(null)
const hasOverflow = ref(false)
const canPrev = ref(false)
const canNext = ref(false)
let target = null
let resizeObserver = null
let mutationObserver = null

const update = () => {
  if (!target) {
    hasOverflow.value = false
    return
  }
  const max = target.scrollWidth - target.clientWidth
  hasOverflow.value = max > 1
  canPrev.value = target.scrollLeft > 1
  canNext.value = target.scrollLeft < max - 1
}

const scrollStep = (direction) => {
  if (!target) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  target.scrollBy({ left: direction * target.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
}

const attach = (container) => {
  const next = container.querySelector(props.scroller)
  if (next !== target) {
    target?.removeEventListener('scroll', update)
    resizeObserver?.disconnect()
    target = next
    if (target) {
      target.addEventListener('scroll', update, { passive: true })
      resizeObserver?.observe(target)
    }
  }
  update()
}

onMounted(() => {
  const container = root.value?.closest(props.container)
  if (!container) return
  resizeObserver = window.ResizeObserver ? new window.ResizeObserver(update) : null
  attach(container)
  // Cards can render after this component mounts.
  if (window.MutationObserver) {
    mutationObserver = new window.MutationObserver(() => attach(container))
    mutationObserver.observe(container, { childList: true, subtree: true })
  }
})

onBeforeUnmount(() => {
  target?.removeEventListener('scroll', update)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  target = null
})
</script>

<style scoped>
.ribbon-nav {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  margin-left: auto;
}

.ribbon-nav__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.ribbon-nav__btn:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.06);
}

.ribbon-nav__btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Phones scroll ribbons by swipe. */
@media (hover: none), (max-width: 620px) {
  .ribbon-nav {
    display: none !important;
  }
}
</style>
