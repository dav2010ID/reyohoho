<template>
  <div
    class="swipe-container"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      v-show="!disabled"
      class="swipe-background"
      :class="{
        'swipe-left': deltaX > 0,
        'swipe-right': deltaX < 0
      }"
    >
      <div v-show="startX" class="icon-container">
        <slot name="swipe-icon">
          <TrashIcon />
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
  thresholdPercent = 50,
  disabled = false,
  backgroundSwipeColor = '#e53935'
} = defineProps({
  thresholdPercent: Number,
  disabled: Boolean,
  backgroundSwipeColor: String
})

const emit = defineEmits(['slide'])

const swipeElement = useTemplateRef('swipeElement')
const startX = ref(0)
const currentX = ref(0)
const swiping = ref(false)
const width = ref(0)

const deltaX = computed(() => currentX.value - startX.value)
const translateValue = computed(() => (swiping.value ? deltaX.value : 0))
const actualThreshold = computed(() => (width.value * thresholdPercent) / 100)

function onTouchStart(e) {
  if (disabled) return

  width.value = swipeElement.value?.offsetWidth ?? 0
  startX.value = e.touches[0].clientX
  currentX.value = startX.value
  swiping.value = true
}

function onTouchMove(e) {
  if (disabled) return

  currentX.value = e.touches[0].clientX
}

function onTouchEnd() {
  if (disabled) return

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
  swiping.value = false
  if (swipeElement.value) {
    swipeElement.value.style.transform = ''
    swipeElement.value.style.opacity = ''
  }
}
</script>

<style scoped>
.swipe-container {
  position: relative;
  overflow: hidden;
}

.swipe-background {
  z-index: 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 16px;
  transition: background-color 0.2s ease;
  border-radius: 10px;
}

.swipe-background.swipe-left {
  background-color: v-bind(backgroundSwipeColor);
  justify-content: flex-start;
}

.swipe-background.swipe-right {
  background-color: v-bind(backgroundSwipeColor);
  justify-content: flex-end;
  padding-right: 16px;
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
  width: 24px;
  height: 24px;
}

@media (max-width: 620px) {
  .swipe-background {
    height: 180px;
    border-radius: 15px;
  }
}
</style>
