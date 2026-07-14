<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>
          Топ авторов таймингов
          <span class="hint-text">
            (Хотите добавить ссылку на свой стрим/соцсети? Напишите нам в
            <a href="https://t.me/reyohoho_sup" target="_blank" rel="noopener noreferrer">
              телеграм</a
            >)
          </span>
        </h3>
        <div class="modal-header-controls">
          <button class="close-modal-btn" type="button" @click="$emit('close')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="modal-body">
        <button
          class="show-all-timings-btn"
          type="button"
          :disabled="isLoadingAllTimings"
          @click="$emit('show-all')"
        >
          <i v-if="isLoadingAllTimings" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-list"></i>
          <span>Все тайминги</span>
        </button>
        <div class="top-submitters-list">
          <div
            v-for="(submitter, index) in topSubmitters"
            :key="submitter.username"
            class="top-submitter-item"
          >
            <div class="submitter-rank" :class="{ gold: index === 0, silver: index === 1, bronze: index === 2 }">
              {{ index + 1 }}
            </div>
            <div class="submitter-info">
              <div class="submitter-name">
                <template v-if="submitter.stream_link">
                  <a :href="submitter.stream_link" target="_blank" rel="noopener noreferrer">
                    {{ submitter.username }}
                    <TwitchIcon />
                  </a>
                </template>
                <template v-else>
                  {{ submitter.username }}
                </template>
              </div>
              <div class="submitter-count">
                {{ submitter.approved_submissions_count }}
                {{ getNounForm(submitter.approved_submissions_count, ['фильм', 'фильма', 'фильмов']) }}
              </div>
            </div>
            <div class="submitter-contribution">
              <div
                class="contribution-bar"
                :style="{ width: getContributionWidth(submitter.approved_submissions_count) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TwitchIcon from '@/components/icons/TwitchIcon.vue'
const props = defineProps({
  topSubmitters: {
    type: Array,
    default: () => []
  },
  isLoadingAllTimings: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close', 'show-all'])

const getNounForm = (number, forms) => {
  const cases = [2, 0, 1, 1, 1, 2]
  return forms[number % 100 > 4 && number % 100 < 20 ? 2 : cases[Math.min(number % 10, 5)]]
}

const getContributionWidth = (count) => {
  if (!props.topSubmitters.length) return 0
  const maxCount = Math.max(...props.topSubmitters.map((item) => item.approved_submissions_count))
  return (count / maxCount) * 100
}
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
  width: min(760px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 20px;
}

.modal-header,
.modal-header-controls,
.show-all-timings-btn,
.top-submitter-item,
.submitter-info {
  display: flex;
  align-items: center;
}

.modal-header {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.modal-header h3 {
  margin: 0;
}

.hint-text {
  display: block;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 400;
  margin-top: 6px;
}

.close-modal-btn {
  border: none;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 20px;
}

.show-all-timings-btn {
  gap: 8px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: #fff;
  padding: 10px 14px;
  cursor: pointer;
  margin-bottom: 16px;
}

.top-submitters-list {
  display: grid;
  gap: 10px;
}

.top-submitter-item {
  gap: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 10px;
}

.submitter-rank {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #444;
  font-weight: 700;
}

.submitter-rank.gold {
  background: #c9a227;
}

.submitter-rank.silver {
  background: #9a9a9a;
}

.submitter-rank.bronze {
  background: #9c6332;
}

.submitter-info {
  flex: 1;
  align-items: flex-start;
  flex-direction: column;
}

.submitter-name a {
  color: var(--accent-light);
}

.submitter-count {
  color: var(--text-muted);
  font-size: 13px;
}

.submitter-contribution {
  width: 120px;
  height: 6px;
  background: #333;
  border-radius: 999px;
  overflow: hidden;
}

.contribution-bar {
  height: 100%;
  background: var(--accent-color);
}
</style>
