<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content all-timings-modal" @click.stop>
      <div class="modal-header">
        <h3>Все тайминги</h3>
        <button class="close-modal-btn" type="button" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div v-if="isLoadingAllTimings" class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
          <span>Загрузка всех таймингов...</span>
        </div>
        <div v-else-if="allTimings.length === 0" class="no-timings">
          <p>Тайминги не найдены</p>
        </div>
        <div v-else-if="filteredTimings.length === 0" class="no-timings">
          <p>Тайминги по выбранному фильтру не найдены</p>
        </div>
        <div v-else class="all-timings-list">
          <div v-for="timing in filteredTimings" :key="timing.id" class="timing-item">
            <div class="timing-header">
              <div class="timing-meta">
                <span class="timing-author">{{ timing.username }}</span>
                <span class="timing-date">{{ formatDate(timing.submitted_at) }}</span>
              </div>
              <div class="timing-movie-info">
                <router-link
                  :to="getMovieSeoPath({ kp_id: timing.kp_id })"
                  class="timing-kp-id clickable"
                  :title="`Перейти к фильму ${timing.kp_id}`"
                >
                  KP: {{ timing.kp_id }}
                </router-link>
                <div v-if="authUser?.is_admin && timing.status === 'pending'" class="admin-controls">
                  <button
                    class="approve-btn"
                    type="button"
                    :disabled="isProcessingTiming"
                    title="Одобрить тайминг"
                    @click="$emit('approve', timing.id)"
                  >
                    <i v-if="processingTimingId === timing.id && isApproving" class="fas fa-spinner fa-spin"></i>
                    <i v-else class="fas fa-check"></i>
                  </button>
                  <button
                    class="reject-btn"
                    type="button"
                    :disabled="isProcessingTiming"
                    title="Отклонить тайминг"
                    @click="$emit('reject', timing.id)"
                  >
                    <i
                      v-if="processingTimingId === timing.id && !isApproving && !isMarkingCleanText"
                      class="fas fa-spinner fa-spin"
                    ></i>
                    <i v-else class="fas fa-times"></i>
                  </button>
                  <button
                    class="clean-text-btn"
                    type="button"
                    :disabled="isProcessingTiming"
                    title="Отметить как clean_text"
                    @click="$emit('mark-clean-text', timing.id)"
                  >
                    <i
                      v-if="processingTimingId === timing.id && isMarkingCleanText"
                      class="fas fa-spinner fa-spin"
                    ></i>
                    <i v-else class="fas fa-eye-slash"></i>
                  </button>
                </div>
              </div>
            </div>
            <div class="timing-content">
              <pre class="timing-text">{{ timing.timing_text }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatDate } from '@/utils/dateUtils'
import { getMovieSeoPath } from '@/utils/movieSeo'

defineProps({
  allTimings: {
    type: Array,
    default: () => []
  },
  filteredTimings: {
    type: Array,
    default: () => []
  },
  isLoadingAllTimings: {
    type: Boolean,
    default: false
  },
  authUser: {
    type: Object,
    default: null
  },
  isProcessingTiming: {
    type: Boolean,
    default: false
  },
  processingTimingId: {
    type: [String, Number],
    default: null
  },
  isApproving: {
    type: Boolean,
    default: false
  },
  isMarkingCleanText: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close', 'approve', 'reject', 'mark-clean-text'])
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  width: min(920px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 20px;
}

.modal-header,
.timing-header,
.timing-meta,
.timing-movie-info,
.admin-controls,
.loading-spinner {
  display: flex;
  align-items: center;
}

.modal-header {
  justify-content: space-between;
  margin-bottom: 16px;
}

.modal-header h3 {
  margin: 0;
}

.close-modal-btn,
.admin-controls button {
  border: none;
  color: #fff;
  cursor: pointer;
}

.close-modal-btn {
  background: transparent;
  font-size: 20px;
}

.loading-spinner,
.no-timings {
  justify-content: center;
  padding: 24px;
  color: var(--text-secondary);
}

.all-timings-list {
  display: grid;
  gap: 12px;
}

.timing-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
}

.timing-header {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.timing-meta,
.timing-movie-info,
.admin-controls {
  gap: 8px;
}

.timing-date {
  color: var(--text-muted);
  font-size: 13px;
}

.timing-kp-id {
  color: var(--accent-light);
}

.admin-controls button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.approve-btn {
  background: var(--success-color);
}

.reject-btn,
.clean-text-btn {
  background: var(--error-color);
}

.timing-text {
  white-space: pre-wrap;
  margin: 0;
  color: var(--text-secondary);
}
</style>
