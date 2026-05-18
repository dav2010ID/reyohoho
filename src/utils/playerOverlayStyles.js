const OVERLAY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
const PANEL_BACKGROUND = 'rgba(0, 0, 0, 0.7)'
const PANEL_BACKDROP = 'blur(10px)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.14)'
const ACCENT_COLOR = '#ff6b35'
const ACCENT_HOVER = '#e55a2b'
const MUTED_TEXT = 'rgba(255, 255, 255, 0.6)'

export const overlayInlineStyles = {
  settingsTitle:
    'color: #ff6b35; margin: 0 0 24px 0; font-size: 20px; font-weight: 600; text-align: center;',
  settingsOptions: 'display: flex; flex-direction: column; gap: 16px;',
  settingsLabel:
    'display: flex; align-items: center; gap: 12px; color: white; cursor: pointer; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.05);',
  settingsCheckbox: 'width: 18px; height: 18px; accent-color: #ff6b35;',
  settingsLabelText: 'font-size: 16px;',
  settingsActions: 'display: flex; gap: 12px; margin-top: 24px; justify-content: center;',
  settingsSaveButton:
    'background: #ff6b35; color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-size: 16px; font-weight: 500; transition: all 0.3s ease;',
  settingsCancelButton:
    'background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 10px 16px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;',
  monospaceMuted: `font-family: 'Courier New', monospace; color: ${MUTED_TEXT};`,
  progressSeparator: 'opacity: 0.6;'
}

export const getOverlaySettingsMarkup = (settings) => `
  <h3 style="${overlayInlineStyles.settingsTitle}">Настройки оверлея</h3>

  <div style="${overlayInlineStyles.settingsOptions}">
    <label style="${overlayInlineStyles.settingsLabel}">
      <input type="checkbox" id="showTitle" ${settings.showTitle ? 'checked' : ''} style="${overlayInlineStyles.settingsCheckbox}">
      <span style="${overlayInlineStyles.settingsLabelText}">Показывать название фильма</span>
    </label>

    <label style="${overlayInlineStyles.settingsLabel}">
      <input type="checkbox" id="showDuration" ${settings.showDuration2 ? 'checked' : ''} style="${overlayInlineStyles.settingsCheckbox}">
      <span style="${overlayInlineStyles.settingsLabelText}">Показывать продолжительность</span>
    </label>

    <label style="${overlayInlineStyles.settingsLabel}">
      <input type="checkbox" id="showBackground" ${settings.showBackground ? 'checked' : ''} style="${overlayInlineStyles.settingsCheckbox}">
      <span style="${overlayInlineStyles.settingsLabelText}">Показывать затемненный фон</span>
    </label>

    <label style="${overlayInlineStyles.settingsLabel}">
      <input type="checkbox" id="showTimingsOnMouseMove" ${settings.showTimingsOnMouseMove ? 'checked' : ''} style="${overlayInlineStyles.settingsCheckbox}">
      <span style="${overlayInlineStyles.settingsLabelText}">Показывать тайминги только при движении мышки</span>
    </label>

    <label style="${overlayInlineStyles.settingsLabel}">
      <input type="checkbox" id="highlightTimings" ${settings.highlightTimings ? 'checked' : ''} style="${overlayInlineStyles.settingsCheckbox}">
      <span style="${overlayInlineStyles.settingsLabelText}">Подсвечивать близкие и текущие тайминги</span>
    </label>
  </div>

  <div style="${overlayInlineStyles.settingsActions}">
    <button id="saveSettings" style="${overlayInlineStyles.settingsSaveButton}">
      Сохранить
    </button>
    <button id="cancelSettings" style="${overlayInlineStyles.settingsCancelButton}">
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
  background: rgba(0, 0, 0, 0.8) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 9999 !important;
  font-family: ${OVERLAY_FONT} !important;
`

export const getSettingsModalContentStyle = () => `
  background: rgba(30, 30, 30, 0.95) !important;
  backdrop-filter: blur(20px) !important;
  border-radius: 16px !important;
  padding: 32px !important;
  max-width: 400px !important;
  width: 90% !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5) !important;
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
  top: 18px !important;
  right: 116px !important;
  box-sizing: border-box !important;
  background: ${getPanelBackground(showBackground)} !important;
  backdrop-filter: ${getPanelBackdrop(showBackground)} !important;
  border: ${showBackground ? PANEL_BORDER : 'none'} !important;
  border-radius: 10px !important;
  padding: ${showBackground ? '10px 12px' : '0'} !important;
  width: auto !important;
  min-width: ${showBackground ? '220px' : 'auto'} !important;
  max-width: min(560px, calc(100% - 148px)) !important;
  box-shadow: ${showBackground ? '0 10px 30px rgba(0, 0, 0, 0.35)' : 'none'} !important;
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
  font-size: ${Math.max(11, fontSize - 6)}px !important;
  line-height: 1.2 !important;
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
    display: block !important;
    box-sizing: border-box !important;
    max-width: 100% !important;
    padding: 5px 7px !important;
    border-radius: 7px !important;
    color: ${textStyle.color} !important;
    background: ${background} !important;
    border: 1px solid ${borderColor} !important;
    font-weight: ${textStyle.fontWeight || 600} !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
  `
}

export const getControlsContainerStyle = () => `
  position: absolute !important;
  top: 20px !important;
  right: 20px !important;
  display: flex !important;
  gap: 8px !important;
  pointer-events: all !important;
`

export const getOverlayButtonStyle = ({ fontSize = 18, fontWeight = 'normal' } = {}) => `
  background: rgba(0, 0, 0, 0.8) !important;
  backdrop-filter: blur(10px) !important;
  color: white !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 50% !important;
  width: 40px !important;
  height: 40px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
  font-size: ${fontSize}px !important;
  font-weight: ${fontWeight} !important;
`

export const applyOverlayButtonHoverStyle = (button, hovered) => {
  button.style.background = hovered ? ACCENT_COLOR : 'rgba(0, 0, 0, 0.8)'
  button.style.borderColor = hovered ? ACCENT_COLOR : 'rgba(255, 255, 255, 0.2)'
  button.style.transform = hovered ? 'scale(1.1)' : 'scale(1)'
}

export const applyOverlayVisibilityStyle = (element, visible) => {
  element.style.opacity = visible ? '1' : '0'
  element.style.visibility = visible ? 'visible' : 'hidden'
}

export const applyOverlayTitleBackgroundStyle = (element, showBackground) => {
  element.style.background = `${getPanelBackground(showBackground)} !important`
  element.style.backdropFilter = `${getPanelBackdrop(showBackground)} !important`
  element.style.width = `${showBackground ? 'fit-content' : 'auto'} !important`
  element.style.display = 'inline-block !important'
}

export const applyOverlayProgressBackgroundStyle = (element, showBackground) => {
  element.style.background = `${getPanelBackground(showBackground)} !important`
  element.style.backdropFilter = `${getPanelBackdrop(showBackground)} !important`
  element.style.borderRadius = `${showBackground ? '6px' : '0'} !important`
  element.style.padding = `${showBackground ? '8px 12px' : '0'} !important`
  element.style.width = `${showBackground ? 'fit-content' : 'auto'} !important`
  element.style.display = `${showBackground ? 'inline-flex' : 'flex'} !important`
}

export const applyOverlayTimingsBackgroundStyle = (element, showBackground) => {
  element.style.background = `${getPanelBackground(showBackground)} !important`
  element.style.backdropFilter = `${getPanelBackdrop(showBackground)} !important`
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
