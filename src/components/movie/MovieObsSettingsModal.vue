<template>
  <div class="timing-modal obs-modal">
    <div class="timing-modal-content obs-modal-content">
      <div class="timing-modal-header">
        <h3>Настройки OBS WebSocket</h3>
        <button class="close-modal-btn" type="button" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="obs-settings-form">
        <div class="obs-setting-group">
          <label class="obs-checkbox-label">
            <input
              :checked="enabled"
              type="checkbox"
              @change="handleEnabledChange($event.target.checked)"
            />
            <span>Использовать автоблюр в OBS</span>
          </label>
          <div class="obs-setting-description">
            Если включено, автоблюр будет применяться через OBS WebSocket вместо внутреннего блюра.
          </div>
        </div>

        <div v-if="enabled" class="obs-connection-settings">
          <div class="obs-setting-group">
            <label>Хост OBS WebSocket:</label>
            <input
              :value="host"
              type="text"
              placeholder="localhost"
              class="obs-input"
              @input="$emit('update:host', $event.target.value)"
            />
          </div>

          <div class="obs-setting-group">
            <label>Порт OBS WebSocket:</label>
            <input
              :value="port"
              type="number"
              placeholder="4455"
              class="obs-input"
              @input="$emit('update:port', Number($event.target.value))"
            />
          </div>

          <div class="obs-setting-group">
            <label>Пароль:</label>
            <input
              :value="password"
              type="password"
              placeholder="Оставьте пустым, если пароль не установлен"
              class="obs-input"
              @input="$emit('update:password', $event.target.value)"
            />
          </div>

          <div v-if="connected" class="obs-setting-group">
            <label>Выбор фильтра для блюра:</label>
            <div v-if="filtersFound.length === 0" class="obs-warning">
              Фильтры не найдены в OBS. Убедитесь, что в источниках есть фильтры.
            </div>
            <div v-else class="obs-filter-selection">
              <select
                :value="selectedFilterId"
                class="obs-filter-select"
                @change="handleFilterChange($event.target.value)"
              >
                <option value="">Выберите фильтр</option>
                <option v-for="filter in filtersFound" :key="filter.id" :value="filter.id">
                  {{ filter.sourceName }} - {{ filter.filterName }} ({{ filter.sceneName }})
                </option>
              </select>
              <div v-if="selectedFilter" class="selected-filter-info">
                <div class="filter-details">
                  <strong>{{ selectedFilter.filterName }}</strong> в источнике
                  <strong>{{ selectedFilter.sourceName }}</strong>
                </div>
                <span class="filter-status" :class="{ enabled: selectedFilter.enabled }">
                  Статус: {{ selectedFilter.enabled ? 'Включен' : 'Отключен' }}
                </span>
              </div>
              <div class="obs-info">
                Найдено {{ filtersFound.length }} фильтров. Выберите фильтр блюра.
              </div>
            </div>
          </div>

          <div class="obs-setting-group">
            <label class="obs-checkbox-label">
              <input
                :checked="showInOverlay"
                type="checkbox"
                @change="$emit('update:showInOverlay', $event.target.checked)"
              />
              <span>Показывать статус OBS в видео оверлее</span>
            </label>
          </div>

          <div class="obs-status" :class="{ connected }">
            {{ connected ? 'Подключен к OBS' : 'Не подключен к OBS' }}
          </div>

          <div class="obs-actions">
            <button class="obs-action-btn connect-btn" type="button" :disabled="connecting" @click="$emit('connect')">
              <i v-if="connecting" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-plug"></i>
              {{ connected ? 'Переподключиться' : 'Подключиться' }}
            </button>

            <button
              class="obs-action-btn test-btn"
              type="button"
              :disabled="!connected || filtersFound.length === 0"
              @click="$emit('test-blur')"
            >
              <i class="fas fa-eye"></i>
              Тестировать блюр
            </button>

            <button
              class="obs-action-btn refresh-btn"
              type="button"
              :disabled="!connected"
              @click="$emit('refresh-filters')"
            >
              <i class="fas fa-sync"></i>
              Обновить фильтры
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  enabled: {
    type: Boolean,
    default: false
  },
  host: {
    type: String,
    default: 'localhost'
  },
  port: {
    type: [String, Number],
    default: 4455
  },
  password: {
    type: String,
    default: ''
  },
  connected: {
    type: Boolean,
    default: false
  },
  connecting: {
    type: Boolean,
    default: false
  },
  filtersFound: {
    type: Array,
    default: () => []
  },
  selectedFilterId: {
    type: [String, Number],
    default: ''
  },
  selectedFilter: {
    type: Object,
    default: null
  },
  showInOverlay: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:enabled',
  'update:host',
  'update:port',
  'update:password',
  'update:selectedFilterId',
  'update:showInOverlay',
  'enabled-change',
  'filter-select',
  'close',
  'connect',
  'test-blur',
  'refresh-filters'
])

const handleEnabledChange = (value) => {
  emit('update:enabled', value)
  emit('enabled-change')
}

const handleFilterChange = (value) => {
  emit('update:selectedFilterId', value)
  emit('filter-select')
}
</script>

<style scoped>
.timing-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.timing-modal-content {
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 12px;
  width: min(760px, 100%);
  max-height: 90vh;
  overflow: auto;
  padding: 20px;
}

.timing-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.timing-modal-header h3 {
  margin: 0;
}

.close-modal-btn {
  border: none;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 20px;
}

.obs-settings-form,
.obs-connection-settings {
  display: grid;
  gap: 16px;
}

.obs-setting-group {
  display: grid;
  gap: 8px;
}

.obs-checkbox-label,
.obs-actions,
.obs-action-btn {
  display: flex;
  align-items: center;
}

.obs-checkbox-label,
.obs-action-btn {
  gap: 8px;
}

.obs-setting-description,
.obs-info {
  color: var(--text-muted);
  font-size: 13px;
}

.obs-input,
.obs-filter-select {
  border: 1px solid #444;
  border-radius: 8px;
  background: #111;
  color: #fff;
  padding: 10px;
}

.obs-status {
  color: var(--warning-color);
}

.obs-status.connected {
  color: var(--success-color);
}

.obs-actions {
  flex-wrap: wrap;
  gap: 10px;
}

.obs-action-btn {
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: #fff;
  cursor: pointer;
  padding: 10px 14px;
}

.obs-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.obs-warning {
  color: var(--warning-color);
}

.selected-filter-info {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.filter-status.enabled {
  color: var(--success-color);
}
</style>
