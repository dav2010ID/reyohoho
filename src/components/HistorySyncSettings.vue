<template>
  <section class="history-sync">
    <h3 v-if="!compact">Облачная история и перенос</h3>
    <p v-if="!compact">
      Без входа история сохраняется только в этом браузере. Её можно перенести со старого сайта или
      сохранить в файл.
    </p>
    <p v-if="!compact && cloudHistoryAvailable">
      {{
        enabled
          ? 'История синхронизируется с облаком и доступна на других устройствах после входа в ваш аккаунт.'
          : 'Для синхронизации войдите через Telegram и включите облачную историю.'
      }}
    </p>
    <p v-else-if="!compact">Облачная синхронизация пока недоступна.</p>
    <p v-if="!compact && enabled">
      Фильмы, удалённые из облачной истории, не появятся снова при повторном импорте.
    </p>
    <div
      v-if="
        hasPendingSync || (!compact && (enabled || (cloudHistoryAvailable && auth.isAuthenticated)))
      "
      class="history-actions"
    >
      <router-link v-if="hasPendingSync" to="/auth-success" class="history-action"
        >Продолжить незавершённую синхронизацию</router-link
      >
      <button
        v-if="!compact && cloudHistoryAvailable && auth.isAuthenticated && !enabled"
        class="history-action"
        :disabled="busy"
        @click="enable"
      >
        Включить синхронизацию истории
      </button>
      <button v-if="!compact && enabled" class="history-action" :disabled="busy" @click="refresh">
        Загрузить из облака
      </button>
      <button
        v-if="!compact && enabled"
        class="history-action"
        :disabled="busy"
        @click="uploadLocal"
      >
        Добавить локальную историю в облако
      </button>
      <button
        v-if="!compact && enabled && !auth.isWorkerSession"
        class="history-action"
        :disabled="busy"
        @click="main.cloudHistoryAccount = null"
      >
        Отключить синхронизацию
      </button>
    </div>
    <!-- The main way in stands alone; the two file actions are a pair. -->
    <div class="history-actions">
      <button class="history-action" :disabled="busy" @click="transfer">
        Перенести со старого сайта
      </button>
      <button
        v-if="!compact && guestBackup.length"
        class="history-action"
        :disabled="busy"
        @click="pending = guestBackup"
      >
        Восстановить историю до входа в аккаунт
      </button>
    </div>
    <div class="history-actions">
      <button v-if="!compact" class="history-action" @click="download">
        Сохранить историю в файл
      </button>
      <label class="history-action history-file"
        >Загрузить историю из файла
        <input type="file" accept=".json,application/json" :disabled="busy" @change="readFile"
      /></label>
    </div>
    <div v-if="pending !== null">
      <p>
        Найдено {{ pending.length }} фильмов. Импорт добавит их к текущей истории, не удаляя её.
      </p>
      <p v-if="auth.isAuthenticated">История также будет сохранена в вашем аккаунте.</p>
      <div class="history-actions">
        <button class="history-action" :disabled="busy" @click="acceptImport">
          Подтвердить импорт
        </button>
        <button class="history-action" :disabled="busy" @click="pending = null">Отмена</button>
      </div>
    </div>
    <p role="status">{{ message }}</p>
    <details class="history-help">
      <summary>Если перенос не работает</summary>
      <p>
        Переносите историю в том же браузере и профиле, где пользовались старым сайтом. Если
        всплывающее окно заблокировано, разрешите его или
        <a :href="TRANSFER_URL" target="_blank" rel="noopener noreferrer"
          >откройте страницу переноса</a
        >, скачайте файл истории и выберите «Загрузить историю из файла».
      </p>
    </details>
    <!-- Destructive: last, behind a hairline. -->
    <div v-if="!compact && enabled" class="history-actions history-actions--danger">
      <button class="history-action history-action--danger" :disabled="busy" @click="clearCloud">
        Удалить облачную историю
      </button>
    </div>
  </section>
</template>

<script setup>
import { useConfirmation } from '@/composables/useConfirmation'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useMainStore } from '@/store/main'
import {
  cloudHistoryAvailable,
  getCloudHistory,
  historyRequest,
  importCloudHistory,
  isCloudHistoryEnabled
} from '@/api/cloudHistory'
import { startHistoryTransfer, TRANSFER_URL } from '@/utils/historyTransfer'
import { addToList, getMyLists } from '@/api/user'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { HISTORY_CAPACITY, mergeHistory, normalizeHistory } from '../../shared/history-data.js'
import { readPendingSync } from '@/utils/pendingAccountSync'

defineProps({ compact: { type: Boolean, default: false } })
const askConfirmation = useConfirmation()

const emit = defineEmits(['imported'])
const auth = useAuthStore()
const main = useMainStore()
const enabled = computed(isCloudHistoryEnabled)
const busy = ref(false)
const pending = ref(null)
const message = ref('')
const guestBackup = ref([])
const hasPendingSync = computed(() => {
  if (!auth.isAuthenticated) return false
  try {
    const data = readPendingSync(`worker:${auth.user.id}`)
    return (
      !!data && (data.history.length || Object.values(data.lists).some((items) => items.length))
    )
  } catch {
    return true
  }
})
onMounted(() => {
  try {
    const backup = JSON.parse(localStorage.getItem('reyohoho-guest-history-backup') || '[]')
    guestBackup.value = normalizeHistory(backup, HISTORY_CAPACITY)
  } catch {
    guestBackup.value = []
  }
})
let cancelTransfer = () => {}
onBeforeUnmount(() => cancelTransfer())

async function run(action) {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    await action()
    message.value = 'Готово'
  } catch (error) {
    message.value = error.message
  } finally {
    busy.value = false
  }
}
async function enable() {
  const confirmedToken = auth.token
  if (!(await askConfirmation('Синхронизировать локальную историю этого браузера с облаком?')))
    return
  if (auth.token !== confirmedToken) return
  run(async () => {
    const token = auth.token
    const history = await importCloudHistory(main.history.slice(0, HISTORY_CAPACITY))
    if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
    main.cloudHistoryAccount = String(auth.user.id)
    main.setHistory(history)
  })
}
function refresh() {
  run(async () => {
    const token = auth.token
    const history = await getCloudHistory()
    if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
    main.setHistory(history)
  })
}
async function uploadLocal() {
  const confirmedToken = auth.token
  if (
    !(await askConfirmation(
      'Добавить локальные записи в облако? Ранее удалённые записи не восстановятся.'
    ))
  )
    return
  if (auth.token !== confirmedToken) return
  run(async () => {
    const token = auth.token
    const history = await importCloudHistory(main.history.slice(0, HISTORY_CAPACITY))
    if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
    main.setHistory(history)
  })
}
async function clearCloud() {
  const confirmedToken = auth.token
  if (
    !(await askConfirmation(
      'Удалить историю в облаке для этого аккаунта? Это действие очистит и локальную историю.'
    ))
  )
    return
  if (auth.token !== confirmedToken) return
  run(async () => {
    const token = auth.token
    await historyRequest('', 'DELETE')
    if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
    main.clearAllHistory()
  })
}
function transfer() {
  cancelTransfer()
  cancelTransfer = startHistoryTransfer(
    (history) => {
      pending.value = history
    },
    (error) => {
      message.value = error
    }
  )
}
async function readFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    if (file.size > 4000000) throw new Error('Файл слишком большой (максимум 4 МБ)')
    let data
    try {
      data = JSON.parse(await file.text())
    } catch {
      throw new Error(
        'Не удалось прочитать файл истории. Выберите файл, сохранённый на странице переноса или в настройках сайта.'
      )
    }
    pending.value = normalizeHistory(Array.isArray(data) ? data : data.history, HISTORY_CAPACITY)
  } catch (error) {
    message.value = error.message
  }
}
function acceptImport() {
  run(async () => {
    const token = auth.token
    let history
    if (enabled.value) {
      history = await importCloudHistory(pending.value)
    } else if (auth.isAuthenticated) {
      const serverHistory = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY, { fresh: true })
      const existing = new Set(serverHistory.map((item) => String(item.kp_id)))
      for (const item of pending.value) {
        if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите импорт')
        if (!existing.has(item.kp_id))
          await addToList(item.kp_id, USER_LIST_TYPES_ENUM.HISTORY, item)
      }
      history = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY)
      if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите импорт')
    } else {
      history = mergeHistory(main.history, pending.value)
    }
    if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите импорт')
    main.setHistory(history)
    pending.value = null
    emit('imported')
  })
}
function download() {
  run(async () => {
    const token = auth.token
    const history = auth.isAuthenticated
      ? await getMyLists(USER_LIST_TYPES_ENUM.HISTORY, { fresh: true, awaitMetadata: true })
      : main.history
    if (auth.token !== token) throw new Error('Аккаунт изменился. Повторите экспорт')
    const url = URL.createObjectURL(
      new window.Blob([JSON.stringify({ version: 1, history: normalizeHistory(history, HISTORY_CAPACITY) })], {
        type: 'application/json'
      })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'reyohoho-history.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}
</script>

<style scoped>
.history-sync {
  margin-top: 16px;
  font-size: 14px;
  text-align: left;
}
.history-sync a {
  color: var(--accent-light, var(--accent-color));
}
.history-sync p[role='status']:empty {
  margin: 0;
}
.history-sync p {
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.history-actions + .history-actions {
  margin-top: 10px;
}
.history-actions--danger {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--hairline);
}
.history-action {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: transparent;
  color: #fff;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.history-sync a.history-action {
  color: #fff;
}
.history-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}
.history-action:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}
.history-action--danger {
  border-color: rgba(255, 123, 123, 0.4);
  color: #ff7b7b;
}
.history-action:disabled {
  opacity: 0.5;
  cursor: wait;
}
.history-help {
  margin-top: 4px;
  color: var(--text-dim);
}
.history-help summary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  list-style: none;
  cursor: pointer;
}
.history-help summary:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
  border-radius: var(--radius-s);
}
.history-help summary::-webkit-details-marker {
  display: none;
}
.history-help summary::before {
  content: '';
  width: 6px;
  height: 6px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
}
.history-help[open] summary::before {
  transform: rotate(45deg);
}
.history-help p {
  margin: 0 0 8px;
}
.history-file {
  position: relative;
}
.history-file:has(input:disabled) {
  opacity: 0.5;
  cursor: wait;
}
.history-sync h3 {
  margin-top: 0;
}
.history-file:focus-within {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}
.history-file input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>
