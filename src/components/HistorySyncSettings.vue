<template>
  <section class="history-sync">
    <h4>Облачная история и перенос</h4>
    <p>
      Локальная история остаётся в браузере. JSON и перенос со старого сайта не содержат токенов.
    </p>
    <p v-if="cloudHistoryAvailable">
      {{
        enabled
          ? 'История хранится в Cloudflare для текущего аккаунта.'
          : 'Для синхронизации войдите через Telegram и включите облачную историю.'
      }}
    </p>
    <p v-else>Облачная история подготовлена, но ещё не включена на сервере.</p>
    <p v-if="enabled">
      После удаления в облаке остаются только ID как отметки удаления: повторный импорт их не
      восстановит.
    </p>
    <div class="history-actions">
      <button
        v-if="cloudHistoryAvailable && auth.isAuthenticated && !enabled"
        :disabled="busy"
        @click="enable"
      >
        Включить и импортировать локальную историю
      </button>
      <button v-if="enabled" :disabled="busy" @click="refresh">Загрузить из облака</button>
      <button v-if="enabled" :disabled="busy" @click="uploadLocal">
        Добавить локальную историю в облако
      </button>
      <button
        v-if="enabled && !auth.isWorkerSession"
        :disabled="busy"
        @click="main.cloudHistoryAccount = null"
      >
        Отключить синхронизацию
      </button>
      <button v-if="enabled" :disabled="busy" @click="clearCloud">Удалить облачную историю</button>
      <button :disabled="busy" @click="transfer">Перенести со старого сайта</button>
      <button v-if="guestBackup.length" :disabled="busy" @click="pending = guestBackup">
        Импортировать сохранённую гостевую историю
      </button>
      <button @click="download">Экспорт JSON</button>
      <label
        >Импорт JSON
        <input type="file" accept=".json,application/json" :disabled="busy" @change="readFile"
      /></label>
    </div>
    <div v-if="pending !== null">
      <p>
        Найдено {{ pending.length }} фильмов. Импорт добавит их к текущей истории, не удаляя её.
      </p>
      <p v-if="auth.isAuthenticated">
        Записи также будут отправлены в хранилище текущего аккаунта.
      </p>
      <button :disabled="busy" @click="acceptImport">Подтвердить импорт</button>
      <button :disabled="busy" @click="pending = null">Отмена</button>
    </div>
    <p role="status">{{ message }}</p>
    <p>
      Если старый адрес перенаправляет сюда, сначала нужно опубликовать отдельную страницу переноса
      на старом домене.
    </p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useMainStore } from '@/store/main'
import {
  cloudHistoryAvailable,
  historyRequest,
  importCloudHistory,
  isCloudHistoryEnabled
} from '@/api/cloudHistory'
import { startHistoryTransfer } from '@/utils/historyTransfer'
import { addToList, getMyLists } from '@/api/user'
import { USER_LIST_TYPES_ENUM } from '@/constants'
import { mergeHistory, normalizeHistory } from '../../migration/history-transfer/history-data.js'

const auth = useAuthStore()
const main = useMainStore()
const enabled = computed(isCloudHistoryEnabled)
const busy = ref(false)
const pending = ref(null)
const message = ref('')
const guestBackup = ref([])
onMounted(() => {
  try {
    const backup = JSON.parse(localStorage.getItem('reyohoho-guest-history-backup') || '[]')
    guestBackup.value = normalizeHistory(backup)
  } catch {
    guestBackup.value = []
  }
})
let cancelTransfer = () => {}
onBeforeUnmount(() => cancelTransfer())

async function run(action) {
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
function enable() {
  if (!window.confirm('Загрузить текущую локальную историю в ваш аккаунт Cloudflare?')) return
  run(async () => {
    const history = await importCloudHistory(main.history.slice(0, 1000))
    main.cloudHistoryAccount = String(auth.user.id)
    main.setHistory(history)
  })
}
function refresh() {
  run(async () => main.setHistory(normalizeHistory((await historyRequest()).history)))
}
function uploadLocal() {
  if (
    !window.confirm('Добавить локальные записи в облако? Ранее удалённые записи не восстановятся.')
  )
    return
  run(async () => main.setHistory(await importCloudHistory(main.history.slice(0, 1000))))
}
function clearCloud() {
  if (
    !window.confirm(
      'Удалить историю в облаке для этого аккаунта? Это действие очистит и локальную историю.'
    )
  )
    return
  run(async () => {
    await historyRequest('', 'DELETE')
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
    const data = JSON.parse(await file.text())
    pending.value = normalizeHistory(Array.isArray(data) ? data : data.history)
  } catch (error) {
    message.value = error.message
  }
}
function acceptImport() {
  run(async () => {
    let history
    if (enabled.value) {
      history = await importCloudHistory(pending.value)
    } else if (auth.isAuthenticated) {
      const token = auth.token
      const serverHistory = await getMyLists(USER_LIST_TYPES_ENUM.HISTORY)
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
    main.setHistory(history)
    pending.value = null
  })
}
function download() {
  const url = URL.createObjectURL(
    new window.Blob(
      [JSON.stringify({ version: 1, history: normalizeHistory(main.history.slice(0, 1000)) })],
      { type: 'application/json' }
    )
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'reyohoho-history.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<style scoped>
.history-sync {
  margin-top: 24px;
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
button,
label {
  padding: 10px 14px;
  border: 1px solid var(--accent-color);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
input {
  display: block;
  max-width: 100%;
  margin-top: 8px;
}
</style>
