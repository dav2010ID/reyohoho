<template>
  <div class="modal" @click.self="$emit('close')">
    <div class="modal-content">
      <button class="close" @click="$emit('close')">&times;</button>

      <h2 v-if="!activeGroup">Выберите плеер</h2>
      <h2 v-else>
        <button class="back-btn" @click="collapseGroup">← Назад</button>
        {{ activeGroup === 'hdrezka' ? 'ReYohoho - HDrezka' : 'Kodik' }}
      </h2>

      <ul class="players-list">
        <template v-if="!activeGroup">
          <li v-for="player in mainPlayers" :key="player.key">
            <button
              :class="['player-item', { active: isSelected(player) }]"
              @click="selectPlayer(player)"
            >
              {{ cleanName(player.translate) }}
              <span v-if="player.warning" class="warning-icon material-icons" title="Внимание!"
                >warning</span
              >
            </button>
          </li>
          <li v-if="hasHdrezkaGroup">
            <button
              :class="['group-item', { active: isGroupSelected('hdrezka') }]"
              @click="expandGroup('hdrezka')"
            >
              <span class="material-icons group-icon">folder</span>
              ReYohoho - HDrezka
              <span
                v-if="groupHasWarning('hdrezka')"
                class="warning-icon material-icons"
                title="Внимание!"
                >warning</span
              >
            </button>
          </li>
          <li v-if="hasKodikGroup">
            <button
              :class="['group-item', { active: isGroupSelected('kodik') }]"
              @click="expandGroup('kodik')"
            >
              <span class="material-icons group-icon">folder</span>
              Kodik
              <span
                v-if="groupHasWarning('kodik')"
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
              {{ cleanName(player.translate) }}
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

const mainPlayers = computed(() =>
  props.players.filter((player) => !isHdrezka(player) && !isKodik(player))
)
const hasHdrezkaGroup = computed(() => props.players.some((player) => isHdrezka(player)))
const hasKodikGroup = computed(() => props.players.some((player) => isKodik(player)))

const isHdrezka = (player) => player.key.toUpperCase().includes('HDREZKA')
const isKodik = (player) => player.key.toUpperCase().includes('KODIK')

const cleanName = (name) =>
  name
    .replace(/^REYOHOHO_PLAYER>HDREZKA>/, '')
    .replace(/KODIK>/, '')
    .trim()

const selectPlayer = (player) => {
  emit('select', player)
  emit('close')
}

const isSelected = (player) => props.selectedPlayer && props.selectedPlayer.key === player.key

const isGroupSelected = (group) => {
  if (!props.selectedPlayer) return false
  return (
    (group === 'hdrezka' && isHdrezka(props.selectedPlayer)) ||
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
    (player) => (group === 'hdrezka' && isHdrezka(player)) || (group === 'kodik' && isKodik(player))
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
  background-color: #555;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.player-item.active,
.group-item.active {
  background-color: #4caf50;
  box-shadow: 0 0 5px rgba(76, 175, 80, 0.7);
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
