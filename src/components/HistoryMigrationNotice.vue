<template>
  <section v-if="visible" class="migration-notice" aria-labelledby="migration-notice-title">
    <div class="migration-notice__header">
      <h2 id="migration-notice-title">История осталась на старом сайте?</h2>
      <button
        class="migration-notice__dismiss"
        type="button"
        aria-label="Скрыть подсказку переноса истории"
        @click="dismiss"
      >×</button>
    </div>
    <p>Перенесите просмотры с dav2010id.github.io на reyhoho.fun. Текущая история сохранится.</p>
    <HistorySyncSettings compact @imported="imported = true" />
    <p v-if="imported" role="status">История импортирована. Фильмы уже доступны ниже.</p>
  </section>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import HistorySyncSettings from './HistorySyncSettings.vue'
import {
  HISTORY_MIGRATION_NOTICE_END,
  HISTORY_MIGRATION_DISMISSED_KEY,
  shouldShowHistoryMigrationNotice
} from '@/utils/historyMigrationNotice'

const visible = ref(false)
const imported = ref(false)
let expiryCheck
onMounted(() => {
  try {
    visible.value = shouldShowHistoryMigrationNotice(Date.now(), localStorage)
  } catch {
    visible.value = Date.now() < HISTORY_MIGRATION_NOTICE_END
  }
  expiryCheck = setInterval(() => {
    if (Date.now() >= HISTORY_MIGRATION_NOTICE_END) visible.value = false
  }, 60000)
})
onBeforeUnmount(() => clearInterval(expiryCheck))
function dismiss() {
  visible.value = false
  try {
    localStorage.setItem(HISTORY_MIGRATION_DISMISSED_KEY, 'dismissed')
  } catch { /* The notice can still be hidden for this visit. */ }
}
</script>

<style scoped>
.migration-notice {
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 24px;
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 55%, transparent);
  border-radius: 14px;
  background: rgba(20, 20, 20, 0.9);
  text-align: left;
  color: #eee;
}
.migration-notice__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.migration-notice h2 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.4;
}
.migration-notice p {
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.migration-notice__dismiss {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 28px;
  cursor: pointer;
}
.migration-notice__dismiss:hover {
  background: rgba(255, 255, 255, 0.1);
}
.migration-notice :deep(.history-sync) { margin-top: 14px; }
.migration-notice :deep(a) { color: var(--accent-color); }
@media (max-width: 600px) {
  .migration-notice { padding: 14px; }
}
</style>
