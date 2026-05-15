import {
  getPlayers,
  getShikiPlayers,
  searchKinoBDPlayerCandidates,
  getKinoBDPlayerDataByInid
} from '@/api/movies'
import { handleApiError } from '@/constants'
import { useMainStore } from '@/store/main'
import { usePlayerStore } from '@/store/player'
import { computed, ref } from 'vue'

const normalizePlayerKey = (key) => String(key || '').toUpperCase()
const NO_PLAYERS_MESSAGE =
  'Плееры не найдены. Попробуйте выбрать другой источник или включить VPN.'

export function usePlayerSources({ props, getProviderDisplayName, onSelectedPlayerChange }) {
  const mainStore = useMainStore()
  const playerStore = usePlayerStore()

  const playersInternal = ref([])
  const selectedPlayerInternal = ref(null)
  const showPlayerModal = ref(false)
  const showSourceModal = ref(false)
  const sourceCandidates = ref([])
  const sourceLoading = ref(false)
  const sourceError = ref('')
  const errorMessage = ref('')
  const errorCode = ref(null)
  const playersEmptyMessage = ref('')

  const preferredPlayer = computed(() => playerStore.preferredPlayer)
  const isKinoBdProvider = computed(
    () => mainStore.contentApiProvider === 'kinobd' && !String(props.kpId || '').startsWith('shiki')
  )
  const canPickKinoBdSource = computed(() => !String(props.kpId || '').startsWith('shiki'))
  const showSourceButton = computed(
    () => isKinoBdProvider.value || (canPickKinoBdSource.value && !!playersEmptyMessage.value)
  )
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

  const applyPlayersData = (players) => {
    const dedupedPlayers = []
    const seenProviders = new Set()

    for (const [key, value] of Object.entries(players || {})) {
      const player = {
        key: normalizePlayerKey(key),
        ...value
      }
      const providerName = normalizePlayerKey(getProviderDisplayName(player))
      if (providerName && seenProviders.has(providerName)) {
        continue
      }
      if (providerName) {
        seenProviders.add(providerName)
      }
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
      setSelectedPlayer(preferred || playersInternal.value[0])
    } else {
      setSelectedPlayer(playersInternal.value[0])
    }

    return true
  }

  const fetchPlayers = async () => {
    try {
      errorMessage.value = ''
      errorCode.value = null
      playersEmptyMessage.value = ''

      const kpId = String(props.kpId || '')
      let players
      if (kpId.startsWith('shiki')) {
        const cleanShikiId = kpId.replace('shiki', '')
        players = await getShikiPlayers(cleanShikiId)
      } else {
        const savedInid = playerStore.kinobdSourceByKpId?.[kpId] || null
        players = await getPlayers(kpId, {
          mode: 'kp_id',
          usePlayerData: true,
          forceInid: isKinoBdProvider.value ? savedInid : null
        })
      }
      const hasPlayers = applyPlayersData(players)
      if (!hasPlayers) {
        playersEmptyMessage.value = NO_PLAYERS_MESSAGE
      }
    } catch (error) {
      const { message, code } = handleApiError(error)
      errorMessage.value = message
      errorCode.value = code
      console.error('Ошибка при загрузке плееров:', error)
    }
  }

  const openPlayerModal = () => {
    showPlayerModal.value = true
  }

  const closePlayerModal = () => {
    showPlayerModal.value = false
  }

  const openSourceModal = async () => {
    showSourceModal.value = true
    sourceError.value = ''
    sourceLoading.value = true

    try {
      const query =
        props.movieInfo?.title ||
        props.movieInfo?.name_ru ||
        props.movieInfo?.name_en ||
        props.movieInfo?.name_original ||
        props.kpId

      let candidates = []
      if (query) {
        candidates = await searchKinoBDPlayerCandidates(query, { type: 'title', page: 1 })
      }
      if (!candidates.length && props.kpId) {
        candidates = await searchKinoBDPlayerCandidates(props.kpId, { type: 'kp_id', page: 1 })
      }
      sourceCandidates.value = candidates
    } catch (error) {
      sourceError.value = 'Не удалось загрузить список источников'
      console.error('Ошибка при загрузке источников KinoBD:', error)
    } finally {
      sourceLoading.value = false
    }
  }

  const closeSourceModal = () => {
    showSourceModal.value = false
  }

  const applySourceCandidate = async (candidate) => {
    if (!candidate?.id) return

    sourceLoading.value = true
    sourceError.value = ''

    try {
      const players = await getKinoBDPlayerDataByInid(candidate.id, {
        playerUrl: candidate.iframe
      })
      const hasPlayers = applyPlayersData(players)
      if (!hasPlayers) {
        sourceError.value = NO_PLAYERS_MESSAGE
        return
      }
      playersEmptyMessage.value = ''
      playerStore.setKinoBdSource(props.kpId, candidate.id)
      closeSourceModal()
    } catch (error) {
      sourceError.value = 'Не удалось применить выбранный источник'
      console.error('Ошибка применения источника KinoBD:', error)
    } finally {
      sourceLoading.value = false
    }
  }

  return {
    playersInternal,
    selectedPlayerInternal,
    showPlayerModal,
    showSourceModal,
    sourceCandidates,
    sourceLoading,
    sourceError,
    errorMessage,
    errorCode,
    playersEmptyMessage,
    isKinoBdProvider,
    showSourceButton,
    selectedPlayerLabel,
    fetchPlayers,
    openPlayerModal,
    closePlayerModal,
    openSourceModal,
    closeSourceModal,
    applySourceCandidate,
    normalizePlayerKey
  }
}
