<template>
  <div ref="root">
    <div v-if="mode === 'guide'" class="nudity-info-popup">
      <div class="nudity-info-content">
        <div v-if="nudityInfoLoading" class="nudity-info-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>Загрузка информации...</span>
        </div>
        <div v-else>
          {{ nudityInfo }}
        </div>
      </div>
      <div class="nudity-info-actions">
        <a
          :href="`https://www.imdb.com/title/${movieInfo.imdb_id}/parentalguide`"
          target="_blank"
          rel="noopener noreferrer"
          class="nudity-info-button"
        >
          <i class="fas fa-external-link-alt"></i>
          <span>Parents Guide</span>
        </a>
        <button class="nudity-info-button" @click="copyNudityInfo">
          <i class="fas fa-copy"></i>
          <span>Copy</span>
        </button>
        <button class="nudity-info-button" @click="openInGoogleTranslate">
          <i class="fas fa-language"></i>
          <span>Translate</span>
        </button>
      </div>
    </div>
    <div v-if="mode === 'timings'" class="nudity-info-popup">
      <div class="nudity-info-content">
        <div class="acknowledgment-table">
          <div class="acknowledgment-header">
            <i class="fa-solid fa-heart"></i>
            <span>Благодарности</span>
          </div>
          <div class="acknowledgment-content">
            <div class="acknowledgment-row">
              <a
                href="https://www.twitch.tv/tanyabelkova"
                target="_blank"
                rel="noopener noreferrer"
                class="twitch-link"
              >
                <TwitchIcon />
                <span>TanyaBelkova</span>
              </a>
              <span class="acknowledgment-text">— за основу базы таймингов</span>
            </div>
            <div class="acknowledgment-row clickable" role="button" tabindex="0" @keydown.enter.prevent="showTopSubmitters" @keydown.space.prevent="showTopSubmitters" @click="showTopSubmitters">
              <div class="community-link">
                <i class="fa-solid fa-users"></i>
                <span>Сообщество</span>
              </div>
              <span class="acknowledgment-text">— за добавление таймингов</span>
            </div>
          </div>
        </div>
        <div class="timings-content" :class="{ 'no-border': !nudityTimings.length }">
          <div class="timings-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Тайминги не модерируются - проверьте перед просмотром</span>
          </div>
          <div class="timings-text">
            <div v-if="nudityTimings.length > 0" class="timing-entries">
              <div
                v-for="timing in sortedNudityTimings"
                :key="timing.id"
                class="timing-card"
                :class="{
                  pending: timing.status === 'pending',
                  'clean-text': timing.status === 'clean_text',
                  'top-rated': (timing.voteScore || 0) >= 5,
                  'highly-rated': (timing.voteScore || 0) >= 10
                }"
              >
                <!-- 1.  Верхняя строка: автор + источник + статус -->
                <div class="timing-card-header">
                  <span class="timing-card-author">
                    <i class="fas fa-user"></i>
                    by {{ timing.username }}
                    <span
                      v-if="timing.user_id && timing.user_id !== 0 && timing.user_timing_count > 0"
                      class="timing-card-count"
                      :title="`Авторизованный пользователь (${timing.user_timing_count} таймингов)`"
                    >
                      {{ timing.user_timing_count }}
                    </span>
                  </span>
                  <div class="timing-card-badges">
                    <div v-if="timing.status === 'pending'" class="pending-badge">На модерации</div>
                    <div
                      v-if="timing.status === 'clean_text'"
                      class="clean-text-badge"
                      title="Тайминги такого типа не модерируются, для уверенности сверяйтесь с ParentsGuide"
                    >
                      Clean Text
                    </div>
                    <div v-if="(timing.voteScore || 0) >= 10" class="highly-rated-badge">
                      <i class="fas fa-star"></i> Проверено сообществом
                    </div>
                    <div v-else-if="(timing.voteScore || 0) >= 5" class="top-rated-badge">
                      <i class="fas fa-thumbs-up"></i> Рекомендуется
                    </div>
                  </div>
                </div>

                <!-- 2. Тело: текст тайминга / парсер -->
                <div class="timing-card-body" :class="{ blurred: timing.status === 'pending' }">
                  <pre class="timing-card-text">{{ timing.timing_text }}</pre>
                </div>

                <!-- 3. Парсер (если открыт) -->
                <div
                  v-if="showParseResult[timing.id] && Array.isArray(showParseResult[timing.id])"
                  class="timing-card-parser"
                >
                  <b>Парсер:</b>
                  <span v-if="showParseResult[timing.id].length === 0">Не удалось распарсить</span>
                  <span v-else>
                    <span v-for="(range, idx) in showParseResult[timing.id]" :key="idx">
                      [{{ formatSecondsToTime(range[0]) }} - {{ formatSecondsToTime(range[1]) }}]{{
                        idx < showParseResult[timing.id].length - 1 ? ', ' : ''
                      }}
                    </span>
                  </span>
                </div>

                <!-- 4. Низ: действия слева, голоса справа -->
                <div class="timing-card-footer">
                  <div class="timing-card-actions">
                    <button class="timing-btn-action" @click="handleShowParse(timing)">
                      {{ showParseResult[timing.id] ? 'Скрыть парсер' : 'Показать парсер' }}
                    </button>

                    <button
                      class="timing-btn-action"
                      :class="{ 'overlay-active': overlayTimings.has(timing.id) }"
                      :title="
                        overlayTimings.has(timing.id) ? 'Удалить из оверлея' : 'Добавить в оверлей'
                      "
                      @click="toggleOverlay(timing.id)"
                    >
                      <i
                        :class="overlayTimings.has(timing.id) ? 'fas fa-eye-slash' : 'fas fa-eye'"
                      ></i>
                      <span>{{ overlayTimings.has(timing.id) ? 'Удалить' : 'Добавить' }}</span>
                    </button>

                    <template v-if="canEditTiming(timing)">
                      <button
                        class="timing-btn-action edit"
                        title="Редактировать тайминг"
                        @click="editTiming(timing)"
                      >
                        <i class="fas fa-edit"></i>
                      </button>
                      <button
                        class="timing-btn-action delete"
                        title="Удалить тайминг"
                        @click="deleteTimingHandler(timing.id)"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </template>

                    <button
                      v-if="!canEditTiming(timing)"
                      class="timing-btn-action report"
                      title="Пожаловаться на тайминг"
                      @click="reportTimingHandler(timing.id)"
                    >
                      <i class="fas fa-flag"></i>
                    </button>
                  </div>

                  <div class="timing-card-vote">
                    <button
                      class="vote-btn-arrow up"
                      :class="{ active: timing.userVote === 'upvote' }"
                      :disabled="votingTimingId === timing.id"
                      title="Этот тайминг полезен и точен"
                      @click="handleVote(timing.id, 'upvote')"
                    >
                      <i class="fas fa-arrow-up"></i>
                      <span class="vote-count-num">{{ timing.upvotes || 0 }}</span>
                    </button>
                    <span
                      class="vote-score-badge"
                      :class="getVoteScoreClass(timing.voteScore || 0)"
                    >
                      {{ timing.voteScore || 0 }}
                    </span>
                    <button
                      class="vote-btn-arrow down"
                      :class="{ active: timing.userVote === 'downvote' }"
                      :disabled="votingTimingId === timing.id"
                      title="Этот тайминг неточен или некорректен"
                      @click="handleVote(timing.id, 'downvote')"
                    >
                      <i class="fas fa-arrow-down"></i>
                      <span class="vote-count-num">{{ timing.downvotes || 0 }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else>
              {{ 'Записей о таймингах не найдено' }}
            </div>
          </div>
          <div
            v-if="showOverlayParserResult && overlayTimings.size > 0"
            class="overlay-parser-result"
          >
            <h4>Парсер оверлея ({{ overlayTimings.size }} таймингов):</h4>
            <div>
              <span v-if="overlayParserResult.length === 0"
                >Не удалось распарсить выбранные тайминги</span
              >
              <span v-else>
                <span v-for="(range, idx) in overlayParserResult" :key="idx">
                  [{{ formatSecondsToTime(range[0]) }} - {{ formatSecondsToTime(range[1]) }}]{{
                    idx < overlayParserResult.length - 1 ? ', ' : ''
                  }}
                </span>
              </span>
            </div>
          </div>
          <div class="nudity-info-actions">
            <button
              v-if="nudityTimings.length > 0"
              class="nudity-info-button"
              @click="copyNudityTimings"
            >
              <i class="fas fa-copy"></i>
              <span>Скопировать</span>
            </button>
            <button
              v-if="overlayTimings.size > 0"
              class="nudity-info-button"
              @click="showOverlayParser"
            >
              <i class="fas fa-layer-group"></i>
              <span>Парсер оверлея ({{ overlayTimings.size }})</span>
            </button>
            <button class="nudity-info-button" @click="handleAddTiming">
              <i class="fas fa-plus"></i>
              <span>Добавить/дополнить тайминг</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <MovieTimingFormModal
      v-if="showTimingForm"
      v-model="newTimingText"
      :editing-timing="editingTiming"
      :parsed-timing-preview="parsedTimingPreview"
      :can-submit="!!canSubmitTiming"
      :is-submitting="isSubmittingTiming"
      @close="closeTimingForm"
      @submit="saveTiming"
    />

    <MovieReportTimingModal
      v-if="showReportForm"
      v-model="reportText"
      :is-submitting="isSubmittingReport"
      @close="closeReportForm"
      @submit="submitReport"
    />

    <MovieTopSubmittersModal
      v-if="showTopSubmittersModal"
      :top-submitters="topSubmitters"
      :is-loading-all-timings="isLoadingAllTimings"
      @close="showTopSubmittersModal = false"
      @show-all="showAllTimingsModal"
    />

    <MovieAllTimingsModal
      v-if="showAllTimingsModalVisible"
      :all-timings="allTimings"
      :filtered-timings="allTimings"
      :is-loading-all-timings="isLoadingAllTimings"
      :auth-user="authStore.user"
      :is-processing-timing="isProcessingTiming"
      :processing-timing-id="processingTimingId"
      :is-approving="processingAction === 'approve'"
      :is-marking-clean-text="processingAction === 'clean'"
      @close="showAllTimingsModalVisible = false"
      @approve="moderateTiming($event, 'approve')"
      @reject="moderateTiming($event, 'reject')"
      @mark-clean-text="moderateTiming($event, 'clean')"
    />
  </div>
</template>

<script setup>
import { useConfirmation } from '@/composables/useConfirmation'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { handleApiError } from '@/constants'
import { parseTimingTextToSeconds, formatSecondsToTime } from '@/utils/dateUtils'
import TwitchIcon from '@/components/icons/TwitchIcon.vue'
import {
  getNudityInfoFromIMDB,
  submitTiming,
  updateTiming,
  deleteTiming,
  reportTiming,
  getTopTimingSubmitters,
  getAllTimingSubmissions,
  approveTiming,
  rejectTiming,
  markAsCleanText,
  voteOnTiming,
  getTimingVote
} from '@/api/movies'

const askConfirmation = useConfirmation()

const props = defineProps({
  movieId: { type: [String, Number], required: true },
  movieInfo: { type: Object, required: true },
  mode: { type: String, default: null },
  trigger: { type: Object, default: null },
  notify: { type: Function, required: true },
  refreshMovie: { type: Function, required: true }
})
const emit = defineEmits(['close', 'guide-loading', 'overlay-selection'])
const authStore = useAuthStore()
const router = useRouter()
const root = ref(null)
let active = true
const requestContext = () => {
  const id = props.movieId
  const token = authStore.token
  return () => active && props.movieId === id && authStore.token === token
}
const notifyError = (error) => props.notify(handleApiError(error).message, 5000)
const requireAuth = (action) => {
  if (authStore.token) return true
  props.notify(`Необходимо <a class="auth-link">авторизоваться</a> ${action}`, 5000, {
    onClick: () => router.push('/login')
  })
  return false
}

const MovieTimingFormModal = defineAsyncComponent(() => import('./MovieTimingFormModal.vue'))
const MovieReportTimingModal = defineAsyncComponent(() => import('./MovieReportTimingModal.vue'))
const MovieTopSubmittersModal = defineAsyncComponent(() => import('./MovieTopSubmittersModal.vue'))
const MovieAllTimingsModal = defineAsyncComponent(() => import('./MovieAllTimingsModal.vue'))

const nudityInfo = ref('')
const nudityInfoLoading = ref(false)
let guideRequest = 0
async function loadGuide() {
  const request = ++guideRequest
  const imdbId = props.movieInfo.imdb_id
  nudityInfo.value = ''
  nudityInfoLoading.value = true
  emit('guide-loading', true)
  try {
    const response = await getNudityInfoFromIMDB(imdbId)
    if (active && request === guideRequest) nudityInfo.value = response.nudity_info
  } catch {
    if (active && request === guideRequest) {
      nudityInfo.value =
        'Ошибка при загрузке информации о сценах. Попробуйте обратиться к Parents Guide на IMDb для получения подробной информации.'
    }
  } finally {
    if (active && request === guideRequest) {
      nudityInfoLoading.value = false
      emit('guide-loading', false)
    }
  }
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    if (active) props.notify('Текст скопирован')
  } catch {
    if (active) props.notify('Ошибка при копировании текста')
  } finally {
    if (active) emit('close')
  }
}
const copyNudityInfo = () => copyText(nudityInfo.value)
const copyNudityTimings = () =>
  copyText(
    nudityTimings.value
      .map((timing) => `${timing.timing_text} (by @${timing.username})`)
      .join('\n')
      .concat('\nReYohoho\n')
  )
const openInGoogleTranslate = () => {
  window.open(
    `https://translate.google.com/?sl=en&tl=ru&text=${encodeURIComponent(nudityInfo.value)}`,
    '_blank',
    'noopener,noreferrer'
  )
  emit('close')
}

const timingEntries = () =>
  Array.isArray(props.movieInfo.nudity_timings)
    ? props.movieInfo.nudity_timings.map((timing) => ({ ...timing }))
    : []
const nudityTimings = ref(timingEntries())
const sortedNudityTimings = computed(() =>
  [...nudityTimings.value].sort(
    (a, b) =>
      (b.voteScore || 0) - (a.voteScore || 0) || (b.upvotes || 0) - (a.upvotes || 0) || a.id - b.id
  )
)
const votingTimingId = ref(null)
const voteRevisions = new Map()
let voteRequest = 0
async function loadTimingVotes() {
  const request = ++voteRequest
  const isCurrent = requestContext()
  const entries = nudityTimings.value
  const votes = await Promise.all(
    entries.map(async (timing) => {
      const revision = voteRevisions.get(timing.id) || 0
      let vote
      try {
        const data = await getTimingVote(timing.id)
        vote = {
          upvotes: data.upvotes || 0,
          downvotes: data.downvotes || 0,
          voteScore: data.vote_score || 0,
          userVote: data.user_vote || null
        }
      } catch {
        vote = { upvotes: 0, downvotes: 0, voteScore: 0, userVote: null }
      }
      return { timing, revision, vote }
    })
  )
  if (!isCurrent() || request !== voteRequest) return
  for (const { timing, revision, vote } of votes) {
    // A successful submission invalidates only this card's earlier read.
    if ((voteRevisions.get(timing.id) || 0) === revision) Object.assign(timing, vote)
  }
}
watch(
  () => props.movieInfo.nudity_timings,
  () => {
    nudityTimings.value = timingEntries()
    if (props.mode === 'timings') void loadTimingVotes()
  }
)
watch(
  () => props.mode,
  (mode) => {
    ++guideRequest
    ++voteRequest
    nudityInfoLoading.value = false
    emit('guide-loading', false)
    if (mode === 'guide') void loadGuide()
    if (mode === 'timings') void loadTimingVotes()
  },
  { immediate: true }
)
const getVoteScoreClass = (score) => (score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral')
async function handleVote(timingId, voteType) {
  if (!requireAuth('для голосования') || votingTimingId.value !== null) return
  const isCurrent = requestContext()
  votingTimingId.value = timingId
  try {
    const response = await voteOnTiming(timingId, voteType)
    if (!isCurrent()) return
    const timing = nudityTimings.value.find((entry) => entry.id === timingId)
    if (timing) {
      voteRevisions.set(timingId, (voteRevisions.get(timingId) || 0) + 1)
      Object.assign(timing, {
        upvotes: response.upvotes,
        downvotes: response.downvotes,
        voteScore: response.vote_score,
        userVote: timing.userVote === voteType ? null : voteType
      })
    }
  } catch (error) {
    if (isCurrent()) notifyError(error)
  } finally {
    if (active) votingTimingId.value = null
  }
}

const overlayTimings = ref(new Set())
const showOverlayParserResult = ref(false)
const showParseResult = ref({})
const overlayParserResult = computed(() =>
  nudityTimings.value
    .filter((timing) => overlayTimings.value.has(timing.id))
    .flatMap((timing) => parseTimingTextToSeconds(timing.timing_text, true))
)
function handleShowParse(timing) {
  showParseResult.value[timing.id] = showParseResult.value[timing.id]
    ? false
    : parseTimingTextToSeconds(timing.timing_text, true)
}
function toggleOverlay(id) {
  if (!window.electronAPI) {
    props.notify('Доступно только в приложении')
    return
  }
  if (overlayTimings.value.has(id)) overlayTimings.value.delete(id)
  else overlayTimings.value.add(id)
  emit('overlay-selection', Array.from(overlayTimings.value))
}
const showOverlayParser = () => {
  showOverlayParserResult.value = !showOverlayParserResult.value
}

const showTimingForm = ref(false)
const editingTiming = ref(null)
const newTimingText = ref('')
const isSubmittingTiming = ref(false)
const canSubmitTiming = computed(() => Boolean(newTimingText.value.trim()))
const parsedTimingPreview = computed(() => parseTimingTextToSeconds(newTimingText.value, true))
const canEditTiming = (timing) =>
  Boolean(authStore.user && timing.user_id && timing.user_id === authStore.user.id)
function handleAddTiming() {
  if (!requireAuth('для добавления таймингов')) return
  editingTiming.value = null
  newTimingText.value = ''
  showTimingForm.value = true
}
function editTiming(timing) {
  editingTiming.value = timing
  newTimingText.value = timing.timing_text
  showTimingForm.value = true
}
function closeTimingForm() {
  showTimingForm.value = false
  editingTiming.value = null
  newTimingText.value = ''
}
async function saveTiming() {
  if (!canSubmitTiming.value || isSubmittingTiming.value) return
  const isCurrent = requestContext()
  const editing = editingTiming.value
  isSubmittingTiming.value = true
  try {
    if (editing) await updateTiming(editing.id, newTimingText.value)
    else await submitTiming(props.movieId, newTimingText.value)
    if (!isCurrent()) return
    props.notify(editing ? 'Тайминг обновлен успешно!' : 'Тайминг добавлен успешно!')
    closeTimingForm()
    await props.refreshMovie()
  } catch (error) {
    if (isCurrent()) notifyError(error)
  } finally {
    if (active) isSubmittingTiming.value = false
  }
}
async function deleteTimingHandler(timingId) {
  if (!await askConfirmation('Вы уверены, что хотите удалить этот тайминг?')) return
  const isCurrent = requestContext()
  try {
    await deleteTiming(timingId)
    if (!isCurrent()) return
    props.notify('Тайминг удален успешно!')
    await props.refreshMovie()
  } catch (error) {
    if (isCurrent()) notifyError(error)
  }
}

const showReportForm = ref(false)
const reportText = ref('')
const reportTimingId = ref(null)
const isSubmittingReport = ref(false)
function reportTimingHandler(id) {
  reportTimingId.value = id
  reportText.value = ''
  showReportForm.value = true
}
function closeReportForm() {
  showReportForm.value = false
  reportText.value = ''
  reportTimingId.value = null
}
async function submitReport() {
  if (!reportText.value.trim() || isSubmittingReport.value || !reportTimingId.value) return
  const isCurrent = requestContext()
  isSubmittingReport.value = true
  try {
    await reportTiming(reportTimingId.value, reportText.value)
    if (!isCurrent()) return
    props.notify('Жалоба отправлена успешно!')
    closeReportForm()
  } catch (error) {
    if (isCurrent()) notifyError(error)
  } finally {
    if (active) isSubmittingReport.value = false
  }
}

const topSubmitters = ref([])
const showTopSubmittersModal = ref(false)
const loadingSubmitters = ref(false)
async function showTopSubmitters() {
  if (loadingSubmitters.value) return
  const isCurrent = requestContext()
  loadingSubmitters.value = true
  try {
    const { submissions } = await getTopTimingSubmitters()
    if (!isCurrent()) return
    topSubmitters.value = submissions
    showTopSubmittersModal.value = true
  } catch (error) {
    if (isCurrent()) notifyError(error)
  } finally {
    if (active) loadingSubmitters.value = false
  }
}
const showAllTimingsModalVisible = ref(false)
const allTimings = ref([])
const isLoadingAllTimings = ref(false)
async function showAllTimingsModal() {
  if (isLoadingAllTimings.value) return
  const isCurrent = requestContext()
  isLoadingAllTimings.value = true
  showAllTimingsModalVisible.value = true
  try {
    const { timings } = await getAllTimingSubmissions()
    if (isCurrent()) allTimings.value = timings
  } catch (error) {
    if (isCurrent()) {
      notifyError(error)
      showAllTimingsModalVisible.value = false
    }
  } finally {
    if (active) isLoadingAllTimings.value = false
  }
}
const processingTimingId = ref(null)
const processingAction = ref(null)
const isProcessingTiming = computed(() => processingAction.value !== null)
const moderationActions = {
  approve: [approveTiming, 'approved', 'Тайминг одобрен'],
  reject: [rejectTiming, 'rejected', 'Тайминг отклонен'],
  clean: [markAsCleanText, 'clean_text', 'Тайминг отмечен как clean_text']
}
async function moderateTiming(id, action) {
  if (isProcessingTiming.value) return
  const isCurrent = requestContext()
  const [request, status, message] = moderationActions[action]
  processingTimingId.value = id
  processingAction.value = action
  try {
    await request(id)
    if (!isCurrent()) return
    const timing = allTimings.value.find((entry) => entry.id === id)
    if (timing) timing.status = status
    props.notify(message)
  } catch (error) {
    if (isCurrent()) notifyError(error)
  } finally {
    if (active) {
      processingTimingId.value = null
      processingAction.value = null
    }
  }
}

function onOutsideClick(event) {
  if (props.mode && !root.value?.contains(event.target) && !props.trigger?.contains(event.target))
    emit('close')
}
onMounted(() => document.addEventListener('click', onOutsideClick, true))
onUnmounted(() => {
  active = false
  ++guideRequest
  ++voteRequest
  document.removeEventListener('click', onOutsideClick, true)
})
</script>

<style scoped src="./MovieSceneTools.css"></style>
