import { getPlayers } from '@/api/movies'
import { handleApiError } from '@/constants'
import { useMainStore } from '@/store/main'
import { usePlayerStore } from '@/store/player'
import { trackAnalyticsEvent } from '@/utils/analytics'
import { computed, onBeforeUnmount, ref } from 'vue'
import { getSafePlayerUrl } from '@/utils/playerSecurity'

const normalizePlayerKey = (key) => String(key || '').toUpperCase()
const KINOBOX_LOW_PRIORITY_PROVIDERS = new Set(['YOUTUBE'])
const NO_PLAYERS_MESSAGE =
  'Плееры не найдены. Попробуйте выбрать другой источник или включить VPN.'

export function usePlayerSources({ props, getProviderDisplayName, onSelectedPlayerChange }) {
  const mainStore = useMainStore()
  const playerStore = usePlayerStore()

  const playersInternal = ref([])
  const selectedPlayerInternal = ref(null)
  const showPlayerModal = ref(false)
  const errorMessage = ref('')
  const errorCode = ref(null)
  const playersEmptyMessage = ref('')
  const searchingSource = ref('')
  let currentRequest
  onBeforeUnmount(() => currentRequest?.abort())

  const preferredPlayer = computed(() => playerStore.preferredPlayer)
  const selectedPlayerLabel = computed(() => {
    if (selectedPlayerInternal.value) {
      return getProviderDisplayName(selectedPlayerInternal.value).toUpperCase()
    }
    if (playersEmptyMessage.value) {
      return 'Плееры не найдены'
    }
    return 'Загрузка плееров...'
  })

  const setSelectedPlayer = (player) => {
    selectedPlayerInternal.value = player
    onSelectedPlayerChange?.(player)
  }

  const isKinoboxPlayer = (player) =>
    normalizePlayerKey(player?.source) === 'KINOBOX' || normalizePlayerKey(player?.key).startsWith('KINOBOX>')

  const isLowPriorityKinoboxPlayer = (player) =>
    isKinoboxPlayer(player) &&
    KINOBOX_LOW_PRIORITY_PROVIDERS.has(normalizePlayerKey(getProviderDisplayName(player)))

  const getDefaultPlayer = () => {
    if (mainStore.contentApiProvider === 'kinobox') {
      return (
        playersInternal.value.find((player) => isKinoboxPlayer(player) && !isLowPriorityKinoboxPlayer(player)) ||
        playersInternal.value.find(isKinoboxPlayer) ||
        playersInternal.value[0]
      )
    }

    return playersInternal.value[0]
  }

  const applyPlayersData = (players) => {
    const dedupedPlayers = []
    const seenPlayers = new Set()

    for (const [key, value] of Object.entries(players || {})) {
      const player = {
        key: normalizePlayerKey(key),
        ...value
      }
      const iframe = getSafePlayerUrl(player?.iframe)
      if (!iframe) continue
      player.iframe = iframe
      const identity = iframe || normalizePlayerKey(player.key)
      if (seenPlayers.has(identity)) continue
      seenPlayers.add(identity)
      dedupedPlayers.push(player)
    }

    playersInternal.value = dedupedPlayers

    if (playersInternal.value.length === 0) {
      setSelectedPlayer(null)
      return false
    }

    if (preferredPlayer.value) {
      const normalizedPreferred = normalizePlayerKey(preferredPlayer.value)
      const preferred = playersInternal.value.find(
        (player) =>
          normalizePlayerKey(player.key) === normalizedPreferred ||
          normalizePlayerKey(getProviderDisplayName(player)) === normalizedPreferred
      )
      setSelectedPlayer(isLowPriorityKinoboxPlayer(preferred) ? getDefaultPlayer() : preferred || getDefaultPlayer())
    } else {
      setSelectedPlayer(getDefaultPlayer())
    }

    return true
  }

  const fetchPlayers = async (retryProviders = false) => {
    currentRequest?.abort()
    const controller = new AbortController()
    currentRequest = controller
    const startedAt = Date.now()
    const kpId = String(props.kpId || '')

    try {
      errorMessage.value = ''
      errorCode.value = null
      playersEmptyMessage.value = ''
      searchingSource.value = ''
      playersInternal.value = []
      setSelectedPlayer(null)

      const source = mainStore.contentApiProvider
      const players = await getPlayers(kpId, {
        signal: controller.signal,
        retryProviders,
        onAttempt: (provider) => {
          searchingSource.value = provider.replace('_', ' ').toUpperCase()
        },
        mode: 'kp_id',
        usePlayerData: true
      })
      if (controller.signal.aborted) return
      const hasPlayers = applyPlayersData(players)
      if (!hasPlayers) {
        playersEmptyMessage.value = NO_PLAYERS_MESSAGE
      }
      trackAnalyticsEvent('player_list_load', {
        status: hasPlayers ? 'success' : 'empty',
        kp_id: kpId,
        source,
        player_count: playersInternal.value.length,
        duration_ms: Date.now() - startedAt
      })
    } catch (error) {
      if (controller.signal.aborted) return
      const { message, code } = handleApiError(error)
      errorMessage.value = message
      errorCode.value = code
      trackAnalyticsEvent('player_list_load', {
        status: 'error',
        kp_id: kpId,
        source: mainStore.contentApiProvider,
        error_code: code || 'unknown',
        duration_ms: Date.now() - startedAt
      })
      console.error('Ошибка при загрузке плееров:', error)
    } finally {
      if (currentRequest === controller) {
        currentRequest = null
        searchingSource.value = ''
      }
    }
  }

  const openPlayerModal = () => {
    showPlayerModal.value = true
  }

  const closePlayerModal = () => {
    showPlayerModal.value = false
  }

  return {
    playersInternal,
    selectedPlayerInternal,
    showPlayerModal,
    errorMessage,
    errorCode,
    playersEmptyMessage,
    selectedPlayerLabel,
    searchingSource,
    fetchPlayers,
    openPlayerModal,
    closePlayerModal,
    normalizePlayerKey
  }
}
