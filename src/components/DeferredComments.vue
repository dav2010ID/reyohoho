<template>
  <div ref="container">
    <component :is="commentsComponent" v-if="commentsComponent" :movie-id="movieId" />
    <button
      v-else
      type="button"
      class="comments-placeholder"
      :disabled="loading"
      :aria-busy="loading"
      @click="loadComments"
    >
      {{
        loading
          ? 'Загрузка комментариев…'
          : loadError
            ? 'Не удалось загрузить комментарии. Повторить'
            : 'Показать комментарии'
      }}
    </button>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'

defineProps({ movieId: { type: [String, Number], required: true } })
const container = ref(null)
const commentsComponent = shallowRef(null)
const loading = ref(false)
const loadError = ref(false)
let observer
let active = true

async function loadComments() {
  if (!active || loading.value || commentsComponent.value) return
  observer?.disconnect()
  loading.value = true
  loadError.value = false
  try {
    const { default: Comments } = await import('./Comments.vue')
    if (active) commentsComponent.value = Comments
  } catch {
    if (active) loadError.value = true
  } finally {
    if (active) loading.value = false
  }
}

onMounted(() => {
  if (typeof window.IntersectionObserver !== 'function') {
    loadComments()
    return
  }
  observer = new window.IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadComments()
    },
    { rootMargin: '300px' }
  )
  observer.observe(container.value)
})
onUnmounted(() => {
  active = false
  observer?.disconnect()
})
</script>

<style scoped>
.comments-placeholder {
  width: 100%;
  min-height: 96px;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: var(--radius-l);
  cursor: pointer;
  font: inherit;
}
</style>
