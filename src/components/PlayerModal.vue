<template>
  <div class="modal" @click.self="$emit('close')">
    <div class="modal-content" @click.stop>
      <button class="close" @click="$emit('close')">&times;</button>

      <h2 v-if="!activeGroup">Выберите плеер</h2>
      <h2 v-else>
        <button class="back-btn" @click="collapseGroup">← Назад</button>
        {{ activeGroup }}
      </h2>

      <ul class="players-list">
        <template v-if="!activeGroup">
          <li v-for="item in mixedPlayersList" :key="item.type === 'player' ? item.data.key : item.name">
            <button
              v-if="item.type === 'player'"
              :class="['player-item', { active: isSelected(item.data) }]"
              @click="selectPlayer(item.data)"
            >
              {{ formatPlayerLabel(item.data) }}
              <span v-if="item.data.warning" class="warning-icon material-icons" title="Внимание!"
                >warning</span
              >
            </button>
            <button
              v-else
              :class="['group-item', { active: isGroupSelected(item.name) }]"
              @click="expandGroup(item.name)"
            >
              <span class="material-icons group-icon">folder</span>
              {{ item.displayName }}
              <span
                v-if="groupHasWarning(item.name)"
                class="warning-icon material-icons"
                title="Внимание!"
                >warning</span
              >
            </button>
          </li>
        </template>
        <template v-else>
          <li v-for="player in groupPlayers(activeGroup)" :key="player.key">
            <button
              :class="['player-item', { active: isSelected(player) }]"
              @click="selectPlayer(player)"
            >
              {{ formatPlayerLabel(player) }}
              <span v-if="player.warning" class="warning-icon material-icons" title="Внимание!"
                >warning</span
              >
            </button>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  players: {
    type: Array,
    required: true
  },
  selectedPlayer: {
    type: Object,
    default: null
  }
})
const emit = defineEmits(['close', 'select'])

const activeGroup = ref(null)

const mixedPlayersList = computed(() => {
  const result = []
  const seenGroups = new Set()
  
  for (const player of props.players) {
    if (isVeoVeo(player)) {
      if (!seenGroups.has('veoveo')) {
        result.push({ type: 'group', name: 'veoveo', displayName: 'VeoVeo' })
        seenGroups.add('veoveo')
      }
    } else if (isKodik(player)) {
      if (!seenGroups.has('kodik')) {
        result.push({ type: 'group', name: 'kodik', displayName: 'Kodik' })
        seenGroups.add('kodik')
      }
    } else {
      result.push({ type: 'player', data: player })
    }
  }
  
  return result
})



const isVeoVeo = (player) => player.name.toUpperCase().includes('VEOVEO')
const isKodik = (player) => player.name.toUpperCase().includes('KODIK')

const cleanName = (name) =>
  String(name || '')
    .replace(/VEOVEO>/, '')
    .replace(/KODIK>/, '')
    .replace(/KINOBOX>/, '')
    .trim()

const getProviderName = (player) => {
  const directProvider = String(player?.provider || '').trim()
  if (directProvider) return cleanName(directProvider)

  const rawName = String(player?.name || player?.key || '')
  if (!rawName.includes('>')) return ''

  const segments = rawName
    .split('>')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (!segments.length) return ''

  const root = segments[0].toUpperCase()
  if ((root === 'KINOBOX' || root === 'KINOBD' || root === 'RHSERV') && segments[1]) {
    return cleanName(segments[1])
  }

  return cleanName(segments[0])
}

const formatPlayerLabel = (player) => {
  const voice = cleanName(player?.translate)
  const provider = getProviderName(player)

  if (!provider) return voice
  if (!voice || voice.toLowerCase() === provider.toLowerCase()) return provider

  return `${provider} / ${voice}`
}

const selectPlayer = (player) => {
  emit('select', player)
  emit('close')
}

const isSelected = (player) => props.selectedPlayer && props.selectedPlayer.key === player.key

const isGroupSelected = (group) => {
  if (!props.selectedPlayer) return false
  return (
    (group === 'veoveo' && isVeoVeo(props.selectedPlayer)) ||
    (group === 'kodik' && isKodik(props.selectedPlayer))
  )
}

const expandGroup = (group) => {
  activeGroup.value = group
}
const collapseGroup = () => {
  activeGroup.value = null
}
const groupPlayers = (group) => {
  let players = props.players.filter(
    (player) => (group === 'veoveo' && isVeoVeo(player)) || (group === 'kodik' && isKodik(player))
  )

  if (group === 'kodik') {
    return players.sort((a, b) => cleanName(a.translate).localeCompare(cleanName(b.translate)))
  }

  return players
}
const groupHasWarning = (group) => groupPlayers(group).some((player) => player.warning)
</script>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 5;
}

.modal-content {
  background: #2d2d2d;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  color: #fff;
  position: relative;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.7);
}

.close {
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 1.8rem;
  cursor: pointer;
}

h2 {
  margin-top: 0;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
}

.back-btn {
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 1rem;
  margin-right: 8px;
  cursor: pointer;
}

.players-list {
  list-style: none;
  padding: 0;
  margin: 15px 0;
}

.players-list li {
  margin: 8px 0;
}

.player-item,
.group-item {
  width: 100%;
  text-align: left;
  padding: 10px;
  background-color: #444;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background 0.2s;
}

.player-item:hover,
.group-item:hover {
  background-color: var(--accent-transparent);
  border: 1px solid var(--accent-semi-transparent);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  transform: translateY(-1px);
}

.player-item.active,
.group-item.active {
  background-color: var(--accent-color);
  box-shadow: 0 0 5px var(--accent-semi-transparent);
}

.warning-icon {
  font-size: 1.2rem;
  color: #ffcc00;
  margin-left: 8px;
}

.group-icon {
  font-size: 1.2rem;
  color: #aaa;
  margin-right: 8px;
}

@media (max-width: 768px) {
  .modal-content {
    padding: 15px;
    max-width: 90%;
  }
}

@media (max-width: 480px) {
  .modal-content {
    max-width: 95%;
  }
}
</style>
