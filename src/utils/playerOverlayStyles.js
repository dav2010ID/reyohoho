const OVERLAY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
const PANEL_BACKGROUND = 'rgba(20, 20, 20, 0.8)'
const PANEL_BACKDROP = 'blur(12px)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.14)'
const ACCENT_COLOR = '#6c5ce7'
const ACCENT_HOVER = '#5a4fcf'
const MUTED_TEXT = 'rgba(255, 255, 255, 0.6)'

export const overlayInlineStyles = {
  settingsTitle:
    'color: #6c5ce7; margin: 0 0 24px 0; font-size: 20px; font-weight: 600; text-align: center;',
  settingsOptions: 'display: flex; flex-direction: column; gap: 16px;',
  settingsLabel:
    'display: flex; align-items: center; gap: 12px; color: white; cursor: pointer; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.05);',
  settingsCheckbox: 'width: 18px; height: 18px; accent-color: #6c5ce7;',
  settingsLabelText: 'font-size: 16px;',
  settingsActions: 'display: flex; gap: 12px; margin-top: 24px; justify-content: center;',
  settingsSaveButton:
    'background: #6c5ce7; color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-size: 16px; font-weight: 500; transition: all 0.3s ease;',
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
      padding: 12px 16px !important;
      border-radius: 12px !important;
      background: rgba(255, 255, 255, 0.04) !important;
      border: 1px solid rgba(255, 255, 255, 0.06) !important;
      cursor: pointer !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      box-sizing: border-box !important;
    }
    .setting-row:hover {
      background: rgba(255, 255, 255, 0.08) !important;
      border-color: rgba(108, 92, 231, 0.3) !important;
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
      box-shadow: 0 0 8px rgba(108, 92, 231, 0.4) !important;
    }
    .checkbox-input:checked + .toggle-switch::before {
      transform: translateX(20px) !important;
    }
    .settings-actions {
      display: flex !important;
      gap: 12px !important;
      margin-top: 28px !important;
      justify-content: center !important;
      font-family: ${OVERLAY_FONT};
    }
    .btn-save {
      background: ${ACCENT_COLOR} !important;
      color: white !important;
      border: none !important;
      border-radius: 10px !important;
      padding: 10px 24px !important;
      cursor: pointer !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      transition: all 0.2s ease !important;
      box-shadow: 0 4px 12px rgba(108, 92, 231, 0.3) !important;
      font-family: ${OVERLAY_FONT};
    }
    .btn-cancel {
      background: rgba(255, 255, 255, 0.08) !important;
      color: rgba(255, 255, 255, 0.8) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      border-radius: 10px !important;
      padding: 10px 20px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      transition: all 0.2s ease !important;
      font-family: ${OVERLAY_FONT};
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
  background: rgba(18, 18, 18, 0.75) !important;
  backdrop-filter: blur(25px) !important;
  border-radius: 16px !important;
  padding: 32px !important;
  max-width: 420px !important;
  width: 90% !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6) !important;
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

export const getTimingsPanelStyle = ({ showBackground }) => `
  position: absolute !important;
  top: 80px !important;
  right: 20px !important;
  box-sizing: border-box !important;
  background: ${getPanelBackground(showBackground)} !important;
  backdrop-filter: ${getPanelBackdrop(showBackground)} !important;
  border: ${showBackground ? PANEL_BORDER : 'none'} !important;
  border-radius: 12px !important;
  padding: ${showBackground ? '12px 16px' : '0'} !important;
  width: auto !important;
  min-width: ${showBackground ? '220px' : 'auto'} !important;
  max-width: min(560px, calc(100% - 40px)) !important;
  box-shadow: ${showBackground ? '0 8px 24px rgba(0, 0, 0, 0.4)' : 'none'} !important;
  pointer-events: none !important;
  display: none !important;
  transition: opacity 0.3s ease, visibility 0.3s ease !important;
  opacity: 0 !important;
  visibility: hidden !important;
`

export const getTimingsContentStyle = ({ fontSize }) => `
  font-size: ${Math.max(11, fontSize - 5)}px !important;
  color: ${MUTED_TEXT} !important;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;
  line-height: 1.35 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
  min-width: 0 !important;
  overflow-wrap: anywhere !important;
`

export const getTimingsHeaderStyle = ({ fontSize }) => `
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 10px !important;
  min-width: 0 !important;
  font-size: ${Math.max(12, fontSize - 4)}px !important;
  line-height: 1.2 !important;
  margin-bottom: 8px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  padding-bottom: 8px !important;
`

export const getTimingsLabelStyle = () => `
  color: rgba(255, 255, 255, 0.82) !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0 !important;
`

export const getTimingCountBadgeStyle = () => `
  flex: 0 0 auto !important;
  min-width: 22px !important;
  height: 20px !important;
  padding: 0 7px !important;
  border-radius: 999px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: white !important;
  background: rgba(255, 255, 255, 0.12) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  font-weight: 700 !important;
`

export const getTimingsListStyle = () => `
  display: flex !important;
  flex-direction: column !important;
  gap: 5px !important;
  min-width: 0 !important;
`

export const getTimingChipStyle = ({ status, highlight }) => {
  const textStyle = getTimingTextStyle({ status, highlight })
  const isActive = status === 'active' && highlight
  const isUpcoming = status === 'upcoming' && highlight
  const background = isActive
    ? 'rgba(255, 68, 68, 0.18)'
    : isUpcoming
      ? 'rgba(255, 107, 53, 0.16)'
      : 'rgba(255, 255, 255, 0.08)'
  const borderColor = isActive
    ? 'rgba(255, 68, 68, 0.42)'
    : isUpcoming
      ? 'rgba(255, 107, 53, 0.38)'
      : 'rgba(255, 255, 255, 0.1)'

  return `
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    box-sizing: border-box !important;
    max-width: 100% !important;
    padding: 6px 10px !important;
    border-radius: 8px !important;
    color: ${textStyle.color} !important;
    background: ${background} !important;
    border: 1px solid ${borderColor} !important;
    font-weight: ${textStyle.fontWeight || 500} !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    transition: all 0.2s ease !important;
  `
}

export const getControlsContainerStyle = () => `
  position: absolute !important;
  top: 20px !important;
  right: 20px !important;
  display: flex !important;
  gap: 8px !important;
  pointer-events: all !important;
  background: rgba(20, 20, 20, 0.8) !important;
  padding: 8px !important;
  border-radius: 12px !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
`

export const getOverlayButtonStyle = ({ fontSize = 16, fontWeight = 'normal' } = {}) => `
  background: rgba(255, 255, 255, 0.1) !important;
  color: white !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 8px !important;
  width: 36px !important;
  height: 36px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
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

export const applyOverlayTimingsBackgroundStyle = (element, showBackground) => {
  element.style.setProperty('background', getPanelBackground(showBackground), 'important')
  element.style.setProperty('backdrop-filter', getPanelBackdrop(showBackground), 'important')
  element.style.border = showBackground ? PANEL_BORDER : 'none'
  element.style.boxShadow = showBackground ? '0 10px 30px rgba(0, 0, 0, 0.35)' : 'none'
  element.style.width = 'auto'
  element.style.minWidth = showBackground ? '220px' : 'auto'
}

export const getMutedTextColor = () => MUTED_TEXT

export const getTimingTextStyle = ({ status, highlight }) => {
  if (status === 'active' && highlight) {
    return { color: '#ff4444', fontWeight: 'bold' }
  }

  if (status === 'upcoming' && highlight) {
    return { color: ACCENT_COLOR, fontWeight: '500' }
  }

  return { color: MUTED_TEXT, fontWeight: '' }
}
