const OVERLAY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
const PANEL_BACKGROUND = 'rgba(20, 20, 20, 0.8)'
const PANEL_BACKDROP = 'blur(12px)'
const ACCENT_COLOR = 'var(--accent-color, #6c5ce7)'
const ACCENT_HOVER = 'var(--accent-hover, #5a4fcf)'
const ACCENT_GLOW = 'color-mix(in srgb, var(--accent-color, #6c5ce7) 36%, transparent)'
const MUTED_TEXT = 'rgba(255, 255, 255, 0.6)'

export const overlayInlineStyles = {
  settingsTitle:
    'color: var(--accent-color, #6c5ce7); margin: 0 0 24px 0; font-size: 20px; font-weight: 600; text-align: center;',
  settingsOptions: 'display: flex; flex-direction: column; gap: 16px;',
  settingsLabel:
    'display: flex; align-items: center; gap: 12px; color: white; cursor: pointer; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.05);',
  settingsCheckbox: 'width: 18px; height: 18px; accent-color: var(--accent-color, #6c5ce7);',
  settingsLabelText: 'font-size: 16px;',
  settingsActions: 'display: flex; gap: 12px; margin-top: 24px; justify-content: center;',
  settingsSaveButton:
    'background: var(--accent-color, #6c5ce7); color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-size: 16px; font-weight: 500; transition: all 0.3s ease;',
  settingsCancelButton:
    'background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 10px 16px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;',
  monospaceMuted: `font-family: 'Courier New', monospace; color: ${MUTED_TEXT};`,
  progressSeparator: 'opacity: 0.6;'
}

export const getOverlaySettingsMarkup = (settings) => `
  <style>
    .settings-title {
      color: ${ACCENT_COLOR};
      margin: 0 0 24px 0;
      font-size: 22px;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.5px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      font-family: ${OVERLAY_FONT};
    }
    .settings-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-family: ${OVERLAY_FONT};
    }
    .setting-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 0 16px !important;
      height: 48px !important;
      border-radius: 12px !important;
      background: rgba(255, 255, 255, 0.04) !important;
      border: 1px solid rgba(255, 255, 255, 0.06) !important;
      cursor: pointer !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      box-sizing: border-box !important;
    }
    .setting-row:hover {
      background: rgba(255, 255, 255, 0.08) !important;
      border-color: color-mix(in srgb, var(--accent-color, #6c5ce7) 42%, transparent) !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    }
    .setting-row:active {
      transform: translateY(0) !important;
    }
    .setting-text {
      font-size: 14px !important;
      color: rgba(255, 255, 255, 0.9) !important;
      font-weight: 500 !important;
      user-select: none !important;
      line-height: 1.4 !important;
      font-family: ${OVERLAY_FONT};
    }
    .checkbox-input {
      position: absolute !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      pointer-events: none !important;
    }
    .toggle-switch {
      position: relative !important;
      width: 42px !important;
      height: 22px !important;
      background: rgba(255, 255, 255, 0.15) !important;
      border-radius: 11px !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      flex-shrink: 0 !important;
    }
    .toggle-switch::before {
      content: "" !important;
      position: absolute !important;
      top: 2px !important;
      left: 2px !important;
      width: 16px !important;
      height: 16px !important;
      background: #ffffff !important;
      border-radius: 50% !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4) !important;
    }
    .checkbox-input:checked + .toggle-switch {
      background: ${ACCENT_COLOR} !important;
      border-color: ${ACCENT_COLOR} !important;
      box-shadow: 0 0 8px ${ACCENT_GLOW} !important;
    }
    .checkbox-input:checked + .toggle-switch::before {
      transform: translateX(20px) !important;
    }
    .settings-actions {
      display: grid !important;
      grid-template-columns: 1fr 0.7fr !important;
      gap: 12px !important;
      margin-top: 28px !important;
      font-family: ${OVERLAY_FONT};
    }
    .btn-save,
    .btn-cancel {
      height: 42px !important;
      box-sizing: border-box !important;
      font-family: ${OVERLAY_FONT};
      border-radius: 10px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }
    .btn-save {
      background: ${ACCENT_COLOR} !important;
      color: white !important;
      border: none !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 12px ${ACCENT_GLOW} !important;
    }
    .btn-cancel {
      background: rgba(255, 255, 255, 0.08) !important;
      color: rgba(255, 255, 255, 0.8) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      font-size: 14px !important;
    }
  </style>

  <h3 class="settings-title">Настройки оверлея</h3>

  <div class="settings-options">
    <label class="setting-row">
      <span class="setting-text">Показывать название фильма</span>
      <input type="checkbox" id="showTitle" ${settings.showTitle ? 'checked' : ''} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>

    <label class="setting-row">
      <span class="setting-text">Показывать продолжительность</span>
      <input type="checkbox" id="showDuration" ${settings.showDuration2 ? 'checked' : ''} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>

    <label class="setting-row">
      <span class="setting-text">Показывать затемненный фон</span>
      <input type="checkbox" id="showBackground" ${settings.showBackground ? 'checked' : ''} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>

    <label class="setting-row">
      <span class="setting-text">Показывать тайминги только при движении мышки</span>
      <input type="checkbox" id="showTimingsOnMouseMove" ${settings.showTimingsOnMouseMove ? 'checked' : ''} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>

    <label class="setting-row">
      <span class="setting-text">Подсвечивать близкие и текущие тайминги</span>
      <input type="checkbox" id="highlightTimings" ${settings.highlightTimings ? 'checked' : ''} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>
    <label class="setting-row">
      <span class="setting-text">Автоблюр в выбранных таймингах</span>
      <input type="checkbox" id="autoBlurTimings" ${settings.autoBlurTimings !== false ? 'checked' : ''} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>
  </div>

  <div class="settings-actions">
    <button id="saveSettings" class="btn-save">
      Сохранить
    </button>
    <button id="cancelSettings" class="btn-cancel">
      Отмена
    </button>
  </div>
`

export const getDurationProgressMarkup = ({ currentTimeFormatted, totalTimeFormatted }) => `
  <span style="${overlayInlineStyles.monospaceMuted}">${currentTimeFormatted}</span>
  <span style="${overlayInlineStyles.progressSeparator}">/</span>
  <span style="${overlayInlineStyles.monospaceMuted}">${totalTimeFormatted}</span>
`

export const getObsStatusMarkup = ({ statusColor, statusText }) => `
  <span style="color: ${statusColor};">
    OBS: ${statusText}
  </span>
`

export const getSettingsModalStyle = () => `
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background: rgba(0, 0, 0, 0.55) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 9999 !important;
  font-family: ${OVERLAY_FONT} !important;
  backdrop-filter: blur(5px) !important;
`

export const getSettingsModalContentStyle = () => `
  background:
    linear-gradient(180deg, rgba(24, 24, 30, 0.92), rgba(14, 14, 18, 0.92)) !important;

  backdrop-filter: blur(28px) saturate(130%) !important;
  border-radius: 20px !important;

  padding: 34px !important;
  max-width: 460px !important;
  width: min(92vw, 460px) !important;

  border: 1px solid rgba(255, 255, 255, 0.11) !important;
  box-shadow:
    0 28px 90px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;

  box-sizing: border-box !important;
`

export const applySettingsButtonHoverStyle = (button, hovered) => {
  if (button.id === 'saveSettings') {
    button.style.background = hovered ? ACCENT_HOVER : ACCENT_COLOR
    button.style.transform = hovered ? 'translateY(-1px)' : 'translateY(0)'
    return
  }

  button.style.background = hovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)'
}

const getPanelBackground = (showBackground) => (showBackground ? PANEL_BACKGROUND : 'transparent')
const getPanelBackdrop = (showBackground) => (showBackground ? PANEL_BACKDROP : 'none')

export const getOverlayBaseStyle = () => `
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none !important;
  z-index: 999999999 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  font-family: ${OVERLAY_FONT} !important;
  visibility: visible !important;
  opacity: 1 !important;
`

export const getOverlayPositionStyle = ({
  fullscreen,
  top = 0,
  left = 0,
  width = '100%',
  height = '100%'
}) => `
  position: ${fullscreen ? 'fixed' : 'absolute'} !important;
  top: ${fullscreen ? '0' : `${top}px`} !important;
  left: ${fullscreen ? '0' : `${left}px`} !important;
  width: ${fullscreen ? '100vw' : `${width}px`} !important;
  height: ${fullscreen ? '100vh' : `${height}px`} !important;
  pointer-events: none !important;
  z-index: 999999999 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  font-family: ${OVERLAY_FONT} !important;
  visibility: visible !important;
  opacity: 1 !important;
  box-sizing: border-box !important;
`

export const getMainInfoStyle = () => `
  color: white !important;
  padding: 20px !important;
  text-align: left !important;
  pointer-events: none !important;
`

export const getMovieTitleStyle = ({ fontSize, showBackground }) => `
  font-size: ${fontSize + 2}px !important;
  font-weight: 600 !important;
  margin-bottom: 8px !important;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
  line-height: 1.2 !important;
  padding: 8px 12px !important;
  border-radius: 6px !important;
  display: inline-block !important;
  color: ${MUTED_TEXT} !important;
  background: ${getPanelBackground(showBackground)} !important;
  backdrop-filter: ${getPanelBackdrop(showBackground)} !important;
  width: ${showBackground ? 'fit-content' : 'auto'} !important;
`

export const getVideoProgressStyle = ({ fontSize, showBackground }) => `
  font-size: ${fontSize}px !important;
  font-weight: 500 !important;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
  display: ${showBackground ? 'inline-flex' : 'flex'} !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
  color: ${MUTED_TEXT} !important;
  margin-left: 12px !important;
  background: ${getPanelBackground(showBackground)} !important;
  backdrop-filter: ${getPanelBackdrop(showBackground)} !important;
  border-radius: ${showBackground ? '6px' : '0'} !important;
  width: ${showBackground ? 'fit-content' : 'auto'} !important;
`

export const getTimingsPanelStyle = () => `
  position: absolute !important;
  top: 50px !important;
  right: 10px !important;

  box-sizing: border-box !important;
  width: auto !important;
  min-width: auto !important;
  max-width: min(300px, calc(100% - 20px)) !important;

  background: transparent !important;
  backdrop-filter: none !important;
  border: none !important;
  border-radius: 0 !important;
  padding: 0 !important;

  box-shadow: none !important;
  pointer-events: none !important;

  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  transition: opacity 0.22s ease, visibility 0.22s ease !important;
`

export const getTimingsContentStyle = ({ fontSize }) => `
  font-size: ${Math.max(10, fontSize - 7)}px !important;
  color: ${MUTED_TEXT} !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95) !important;
  line-height: 1.25 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  min-width: 0 !important;
  overflow-wrap: anywhere !important;
`

export const getTimingsListStyle = () => `
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  min-width: 0 !important;
`

export const getTimingChipStyle = ({ status, highlight }) => {
  const isActive = status === 'active' && highlight
  const isUpcoming = status === 'upcoming' && highlight

  const background = isActive
    ? 'rgba(255, 72, 72, 0.16)'
    : isUpcoming
      ? 'rgba(255, 184, 77, 0.14)'
      : 'transparent'

  const color = isActive
    ? '#ff7a7a'
    : isUpcoming
      ? '#ffd184'
      : 'rgba(255, 255, 255, 0.56)'

  const textShadow = isActive
    ? '0 0 12px rgba(255, 72, 72, 0.55), 0 1px 3px rgba(0, 0, 0, 0.95)'
    : isUpcoming
      ? '0 0 12px rgba(255, 184, 77, 0.55), 0 1px 3px rgba(0, 0, 0, 0.95)'
      : '0 1px 3px rgba(0, 0, 0, 0.95)'

  return `
    display: flex !important;
    align-items: center !important;
    max-width: 100% !important;

    padding: ${isActive || isUpcoming ? '3px 6px' : '0 2px'} !important;
    border-radius: 6px !important;

    color: ${color} !important;
    background: ${background} !important;
    border: none !important;
    text-shadow: ${textShadow} !important;

    font-weight: ${isActive || isUpcoming ? 700 : 500} !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
  `
}

export const getControlsContainerStyle = () => `
  position: absolute !important;
  top: 10px !important;
  right: 10px !important;
  display: flex !important;
  gap: 4px !important;
  pointer-events: all !important;

  background: rgba(12, 13, 18, 0.58) !important;
  backdrop-filter: blur(10px) saturate(120%) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 10px !important;
  padding: 4px !important;

  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32) !important;
`

export const getOverlayButtonStyle = ({ fontSize = 13, fontWeight = '600' } = {}) => `
  width: 26px !important;
  height: 26px !important;
  border-radius: 7px !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  background: rgba(255, 255, 255, 0.07) !important;
  color: rgba(255, 255, 255, 0.82) !important;
  border: 1px solid rgba(255, 255, 255, 0.07) !important;

  cursor: pointer !important;
  transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease !important;

  font-size: ${fontSize}px !important;
  font-weight: ${fontWeight} !important;
`

export const applyOverlayButtonHoverStyle = (button, hovered) => {
  button.style.background = hovered ? ACCENT_COLOR : 'rgba(255, 255, 255, 0.1)'
  button.style.borderColor = hovered ? ACCENT_COLOR : 'rgba(255, 255, 255, 0.05)'
  button.style.transform = hovered ? 'scale(1.05)' : 'scale(1)'
}

export const applyOverlayVisibilityStyle = (element, visible) => {
  element.style.opacity = visible ? '1' : '0'
  element.style.visibility = visible ? 'visible' : 'hidden'
}

export const applyOverlayTitleBackgroundStyle = (element, showBackground) => {
  element.style.setProperty('background', getPanelBackground(showBackground), 'important')
  element.style.setProperty('backdrop-filter', getPanelBackdrop(showBackground), 'important')
  element.style.setProperty('width', showBackground ? 'fit-content' : 'auto', 'important')
  element.style.setProperty('display', 'inline-block', 'important')
}

export const applyOverlayProgressBackgroundStyle = (element, showBackground) => {
  element.style.setProperty('background', getPanelBackground(showBackground), 'important')
  element.style.setProperty('backdrop-filter', getPanelBackdrop(showBackground), 'important')
  element.style.setProperty('border-radius', showBackground ? '6px' : '0', 'important')
  element.style.setProperty('padding', showBackground ? '8px 12px' : '0', 'important')
  element.style.setProperty('width', showBackground ? 'fit-content' : 'auto', 'important')
  element.style.setProperty('display', showBackground ? 'inline-flex' : 'flex', 'important')
}

export const applyOverlayTimingsBackgroundStyle = (element) => {
  element.style.setProperty('background', 'transparent', 'important')
  element.style.setProperty('backdrop-filter', 'none', 'important')
  element.style.border = 'none'
  element.style.boxShadow = 'none'
  element.style.width = 'auto'
  element.style.minWidth = 'auto'
}
