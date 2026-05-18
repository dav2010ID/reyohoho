<template>
  <div
    class="swipe-container"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      v-show="!disabled && !isScrolling"
      class="swipe-background"
      :class="{
        'swipe-left': deltaX > 0,
        'swipe-right': deltaX < 0
      }"
    >
      <div v-show="startX" class="icon-container">
        <slot name="swipe-icon">
          <TrashIcon />
          <span>Удалить</span>
        </slot>
      </div>
    </div>

    <div
      ref="swipeElement"
      data-test-id="swipe-ref-element"
      class="swipe-wrapper"
      :class="{ swiping }"
      :style="{
        transform: `translateX(${translateValue}px)`,
        transition: swiping ? 'none' : 'transform 0.3s ease, opacity 0.3s ease'
      }"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import TrashIcon from '@/components/icons/TrashIcon.vue'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

const {
  thresholdPercent = 55,
  disabled = false,
  backgroundSwipeColor = '#e53935',
  showDelete = true
} = defineProps({
  thresholdPercent: Number,
  disabled: Boolean,
  backgroundSwipeColor: String,
  showDelete: Boolean
})

const emit = defineEmits(['slide'])

const swipeElement = useTemplateRef('swipeElement')
const startX = ref(0)
const currentX = ref(0)
const startY = ref(0)
const currentY = ref(0)
const swiping = ref(false)
const width = ref(0)
const height = ref(0)
const isScrolling = ref(false)

const deltaX = computed(() => currentX.value - startX.value)
const deltaY = computed(() => currentY.value - startY.value)
const translateValue = computed(() => (swiping.value ? deltaX.value : 0))
const actualThreshold = computed(() => (width.value * thresholdPercent) / 100)

function onTouchStart(e) {
  if (disabled || !showDelete) return

  width.value = swipeElement.value?.offsetWidth ?? 0
  height.value = swipeElement.value?.offsetHeight ?? 0
  startX.value = e.touches[0].clientX
  startY.value = e.touches[0].clientY
  currentX.value = startX.value
  currentY.value = startY.value
  swiping.value = false
  isScrolling.value = false
}

function onTouchMove(e) {
  if (disabled || isScrolling.value || !showDelete) return

  currentX.value = e.touches[0].clientX
  currentY.value = e.touches[0].clientY

  const absDeltaX = Math.abs(deltaX.value)
  const absDeltaY = Math.abs(deltaY.value)

  if (!swiping.value && !isScrolling.value) {
    if (absDeltaY > absDeltaX) {
      isScrolling.value = true
      swiping.value = false
    } else if (absDeltaX > absDeltaY && absDeltaX > 10) {
      swiping.value = true
    }
  }

  if (swiping.value) {
    e.preventDefault()
  }
}

function onTouchEnd() {
  if (disabled || !swiping.value || !showDelete) {
    resetSwipe()
    return
  }

  if (deltaX.value < -actualThreshold.value) {
    swiping.value = false
    nextTick(() => {
      swipeElement.value.style.transform = 'translateX(-100%)'
      swipeElement.value.style.opacity = '0'
    })
    setTimeout(() => {
      emit('slide')
      resetSwipe()
    }, 300)
    return
  }

  if (deltaX.value > actualThreshold.value) {
    swiping.value = false
    nextTick(() => {
      swipeElement.value.style.transform = 'translateX(100%)'
      swipeElement.value.style.opacity = '0'
    })
    setTimeout(() => {
      emit('slide')
      resetSwipe()
    }, 300)
    return
  }

  resetSwipe()
}

function resetSwipe() {
  startX.value = 0
  currentX.value = 0
  startY.value = 0
  currentY.value = 0
  swiping.value = false
  isScrolling.value = false
  if (swipeElement.value) {
    swipeElement.value.style.transform = ''
    swipeElement.value.style.opacity = ''
  }
  height.value = 0
}
</script>

<style scoped>
.swipe-container {
  position: relative;
  overflow: hidden;
  border-radius: 15px;
}

.swipe-background {
  z-index: 0;
  position: absolute;
  inset: 0;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 18px;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
  border-radius: inherit;
  min-height: v-bind('height ? `${height}px` : `100%`');
}

.swipe-background.swipe-left {
  background:
    linear-gradient(90deg, color-mix(in srgb, v-bind(backgroundSwipeColor) 88%, #000 12%), transparent 72%),
    v-bind(backgroundSwipeColor);
  justify-content: flex-start;
}

.swipe-background.swipe-right {
  background:
    linear-gradient(270deg, color-mix(in srgb, v-bind(backgroundSwipeColor) 88%, #000 12%), transparent 72%),
    v-bind(backgroundSwipeColor);
  justify-content: flex-end;
}

.swipe-wrapper {
  position: relative;
  z-index: 1;
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
  touch-action: pan-y;
}

.swipe-wrapper.swiping {
  transition: none;
}

.icon-container {
  min-width: 82px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
}

.icon-container :deep(.bin) {
  width: 24px;
  height: 28px;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35));
}

.icon-container :deep(.bin path) {
  fill: #fff;
}

@media (max-width: 620px) {
  .swipe-container {
    border-radius: 15px;
  }

  .swipe-background {
    padding: 0 16px;
    align-items: center;
  }
}
</style>
