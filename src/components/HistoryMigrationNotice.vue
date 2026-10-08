<template>
  <div v-if="visible || opened" class="migration-entry">
    <button v-if="visible" type="button" class="migration-entry__button" aria-haspopup="dialog" @click="open">
      Перенести историю со старого сайта
    </button>
    <dialog v-if="activated" ref="dialog" class="migration-dialog" aria-labelledby="migration-notice-title" @close="opened = false" @click="closeOnBackdrop">
      <div class="migration-dialog__content">
        <div class="migration-notice__header">
          <h2 id="migration-notice-title">Перенос истории</h2>
          <button
            class="migration-notice__dismiss"
            type="button"
            aria-label="Закрыть окно переноса"
            autofocus
            @click="close"
          >×</button>
        </div>
        <p>История осталась на старом сайте? Перенесите просмотры с dav2010id.github.io на reyhoho.fun. Текущая история сохранится.</p>
        <HistorySyncSettings compact @imported="imported = true" />
        <p v-if="imported" role="status">История импортирована. Фильмы уже доступны на главной.</p>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import HistorySyncSettings from './HistorySyncSettings.vue'
import {
  HISTORY_MIGRATION_NOTICE_END,
  shouldShowHistoryMigrationNotice
} from '@/utils/historyMigrationNotice'

const visible = ref(false)
const opened = ref(false)
const activated = ref(false)
const dialog = ref(null)
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
async function open() {
  activated.value = true
  opened.value = true
  await nextTick()
  dialog.value.showModal()
}
function close() {
  dialog.value.close()
}
function closeOnBackdrop(event) {
  if (event.target !== dialog.value) return
  const bounds = dialog.value.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) close()
}
</script>

<style scoped>
.migration-entry {
  margin: 0 0 16px;
  text-align: center;
}
.migration-entry__button {
  padding: 8px 12px;
  min-height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(20, 20, 20, 0.55);
  color: #aaa;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
.migration-entry__button:hover {
  color: #eee;
  border-color: rgba(255, 255, 255, 0.3);
}
.migration-entry__button:focus-visible,
.migration-notice__dismiss:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 3px;
}
.migration-dialog {
  width: min(560px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  box-sizing: border-box;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 16px;
  background: #171717;
  text-align: left;
  color: #ddd;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
}
.migration-dialog::backdrop {
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
}
.migration-dialog__content { padding: 24px; }
.migration-notice__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.migration-dialog h2 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.4;
}
.migration-dialog p {
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
.migration-dialog :deep(.history-sync) { margin-top: 20px; }
.migration-dialog :deep(a) { color: var(--accent-color); }
.migration-dialog :deep(.history-actions) { align-items: center; }
.migration-dialog :deep(.history-actions > *) { box-sizing: border-box; max-width: 100%; }
@media (max-width: 600px) {
  .migration-dialog__content { padding: 18px; }
}
</style>
