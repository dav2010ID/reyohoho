<template>
  <div class="mobile-list-dropdown">
    <button class="mobile-list-toggle" type="button" @click="$emit('update:expanded', !expanded)">
      <span class="material-icons" :class="{ active: isInAnyList }">
        {{ isInAnyList ? 'bookmark_added' : 'bookmark_border' }}
      </span>
      <span class="button-label">Добавить в список</span>
      <span class="material-icons dropdown-arrow" :class="{ expanded }">expand_more</span>
    </button>

    <div v-show="expanded" class="mobile-list-content">
      <button class="mobile-list-btn" type="button" @click="$emit('toggle-list', listTypes.FAVORITE)">
        <span class="material-icons" :class="{ active: movieInfo?.lists?.isFavorite }">
          {{ movieInfo?.lists?.isFavorite ? 'favorite' : 'favorite_border' }}
        </span>
        <span class="button-label">В избранное</span>
      </button>

      <button class="mobile-list-btn" type="button" @click="$emit('toggle-list', listTypes.WATCHING)">
        <span class="material-icons" :class="{ active: movieInfo?.lists?.isWatching }">
          {{ movieInfo?.lists?.isWatching ? 'visibility' : 'visibility_off' }}
        </span>
        <span class="button-label">Смотрю</span>
      </button>

      <button class="mobile-list-btn" type="button" @click="$emit('toggle-list', listTypes.LATER)">
        <span class="material-icons" :class="{ active: movieInfo?.lists?.isLater }">watch_later</span>
        <span class="button-label">Позже</span>
      </button>

      <button class="mobile-list-btn" type="button" @click="$emit('toggle-list', listTypes.COMPLETED)">
        <span class="material-icons" :class="{ active: movieInfo?.lists?.isCompleted }">
          {{ movieInfo?.lists?.isCompleted ? 'check_circle' : 'check_circle_outline' }}
        </span>
        <span class="button-label">Просмотрено</span>
      </button>

      <button class="mobile-list-btn" type="button" @click="$emit('toggle-list', listTypes.ABANDONED)">
        <span class="material-icons" :class="{ active: movieInfo?.lists?.isAbandoned }">
          not_interested
        </span>
        <span class="button-label">Брошено</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { USER_LIST_TYPES_ENUM } from '@/constants'

defineProps({
  movieInfo: {
    type: Object,
    default: null
  },
  isInAnyList: {
    type: Boolean,
    default: false
  },
  expanded: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:expanded', 'toggle-list'])

const listTypes = USER_LIST_TYPES_ENUM
</script>

<style scoped>
.mobile-list-dropdown {
  position: relative;
  margin: 15px 0;
}

.mobile-list-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  padding: 12px 15px;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
}

.mobile-list-toggle:active {
  transform: scale(0.98);
}

.mobile-list-toggle .material-icons {
  font-size: 24px;
}

.mobile-list-toggle.active {
  background: transparent;
  box-shadow: none;
}

.mobile-list-toggle:not(.active):hover {
  background: rgba(255, 255, 255, 0.2);
}

.mobile-list-toggle .button-label {
  flex: 1;
}

.mobile-list-toggle .material-icons.active {
  color: var(--accent-color);
  text-shadow: 0 0 8px var(--accent-semi-transparent);
}

.mobile-list-content {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  width: 100%;
  background: rgba(0, 0, 0, 0.95);
  border-radius: 8px;
  padding: 10px;
  z-index: 1000;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  transform-origin: top center;
  animation: dropdownSlide 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes dropdownSlide {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mobile-list-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  padding: 12px 15px;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
  margin-bottom: 5px;
}

.mobile-list-btn:last-child {
  margin-bottom: 0;
}

.mobile-list-btn:active {
  transform: scale(0.98);
}

.mobile-list-btn .material-icons {
  font-size: 24px;
}

.mobile-list-btn.active {
  background: transparent;
  box-shadow: none;
}

.mobile-list-btn .material-icons.active {
  color: var(--accent-color);
  text-shadow: 0 0 8px var(--accent-semi-transparent);
}

.dropdown-arrow {
  transition: transform 0.2s ease;
}

.dropdown-arrow.expanded {
  transform: rotate(180deg);
}
</style>
