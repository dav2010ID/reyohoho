import{J as e,_ as t,et as n}from"./vendor-vue-DLV-ZM4Y.js";import"./logger-7fPYIPz_.js";import{i as r,r as i}from"./app-BkLFmsQJ.js";var a=`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,o=`rgba(20, 20, 20, 0.8)`,s=`blur(12px)`,c=`var(--accent-color, #6c5ce7)`,l=`var(--accent-hover, #5a4fcf)`,u=`color-mix(in srgb, var(--accent-color, #6c5ce7) 36%, transparent)`,d=`rgba(255, 255, 255, 0.6)`,f={settingsTitle:`color: var(--accent-color, #6c5ce7); margin: 0 0 24px 0; font-size: 20px; font-weight: 600; text-align: center;`,settingsOptions:`display: flex; flex-direction: column; gap: 16px;`,settingsLabel:`display: flex; align-items: center; gap: 12px; color: white; cursor: pointer; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.05);`,settingsCheckbox:`width: 18px; height: 18px; accent-color: var(--accent-color, #6c5ce7);`,settingsLabelText:`font-size: 16px;`,settingsActions:`display: flex; gap: 12px; margin-top: 24px; justify-content: center;`,settingsSaveButton:`background: var(--accent-color, #6c5ce7); color: white; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; font-size: 16px; font-weight: 500; transition: all 0.3s ease;`,settingsCancelButton:`background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 10px 16px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;`,monospaceMuted:`font-family: 'Courier New', monospace; color: ${d};`,progressSeparator:`opacity: 0.6;`},p=e=>`
  <style>
    .settings-title {
      color: ${c};
      margin: 0 0 24px 0;
      font-size: 22px;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.5px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      font-family: ${a};
    }
    .settings-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-family: ${a};
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
      font-family: ${a};
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
      background: ${c} !important;
      border-color: ${c} !important;
      box-shadow: 0 0 8px ${u} !important;
    }
    .checkbox-input:checked + .toggle-switch::before {
      transform: translateX(20px) !important;
    }
    .settings-actions {
      display: grid !important;
      grid-template-columns: 1fr 0.7fr !important;
      gap: 12px !important;
      margin-top: 28px !important;
      font-family: ${a};
    }
    .btn-save,
    .btn-cancel {
      height: 42px !important;
      box-sizing: border-box !important;
      font-family: ${a};
      border-radius: 10px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }
    .btn-save {
      background: ${c} !important;
      color: white !important;
      border: none !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 12px ${u} !important;
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
      <input type="checkbox" id="showTitle" ${e.showTitle?`checked`:``} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>

    <label class="setting-row">
      <span class="setting-text">Показывать продолжительность</span>
      <input type="checkbox" id="showDuration" ${e.showDuration2?`checked`:``} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>

    <label class="setting-row">
      <span class="setting-text">Показывать затемненный фон</span>
      <input type="checkbox" id="showBackground" ${e.showBackground?`checked`:``} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>

    <label class="setting-row">
      <span class="setting-text">Показывать тайминги только при движении мышки</span>
      <input type="checkbox" id="showTimingsOnMouseMove" ${e.showTimingsOnMouseMove?`checked`:``} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>

    <label class="setting-row">
      <span class="setting-text">Подсвечивать близкие и текущие тайминги</span>
      <input type="checkbox" id="highlightTimings" ${e.highlightTimings?`checked`:``} class="checkbox-input">
      <div class="toggle-switch"></div>
    </label>
    <label class="setting-row">
      <span class="setting-text">Автоблюр в выбранных таймингах</span>
      <input type="checkbox" id="autoBlurTimings" ${e.autoBlurTimings===!1?``:`checked`} class="checkbox-input">
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
`,m=({currentTimeFormatted:e,totalTimeFormatted:t})=>`
  <span style="${f.monospaceMuted}">${e}</span>
  <span style="${f.progressSeparator}">/</span>
  <span style="${f.monospaceMuted}">${t}</span>
`,h=()=>`
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
  font-family: ${a} !important;
  backdrop-filter: blur(5px) !important;
`,g=()=>`
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
`,_=(e,t)=>{if(e.id===`saveSettings`){e.style.background=t?l:c,e.style.transform=t?`translateY(-1px)`:`translateY(0)`;return}e.style.background=t?`rgba(255, 255, 255, 0.15)`:`rgba(255, 255, 255, 0.1)`},v=e=>e?o:`transparent`,y=e=>e?s:`none`,ee=()=>`
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
  font-family: ${a} !important;
  visibility: visible !important;
  opacity: 1 !important;
`,b=({fullscreen:e,top:t=0,left:n=0,width:r=`100%`,height:i=`100%`})=>`
  position: ${e?`fixed`:`absolute`} !important;
  top: ${e?`0`:`${t}px`} !important;
  left: ${e?`0`:`${n}px`} !important;
  width: ${e?`100vw`:`${r}px`} !important;
  height: ${e?`100vh`:`${i}px`} !important;
  pointer-events: none !important;
  z-index: 999999999 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  font-family: ${a} !important;
  visibility: visible !important;
  opacity: 1 !important;
  box-sizing: border-box !important;
`,te=()=>`
  color: white !important;
  padding: 20px !important;
  text-align: left !important;
  pointer-events: none !important;
`,ne=({fontSize:e,showBackground:t})=>`
  font-size: ${e+2}px !important;
  font-weight: 600 !important;
  margin-bottom: 8px !important;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
  line-height: 1.2 !important;
  padding: 8px 12px !important;
  border-radius: 6px !important;
  display: inline-block !important;
  color: ${d} !important;
  background: ${v(t)} !important;
  backdrop-filter: ${y(t)} !important;
  width: ${t?`fit-content`:`auto`} !important;
`,re=({fontSize:e,showBackground:t})=>`
  font-size: ${e}px !important;
  font-weight: 500 !important;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
  display: ${t?`inline-flex`:`flex`} !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
  color: ${d} !important;
  margin-left: 12px !important;
  background: ${v(t)} !important;
  backdrop-filter: ${y(t)} !important;
  border-radius: ${t?`6px`:`0`} !important;
  width: ${t?`fit-content`:`auto`} !important;
`,ie=()=>`
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
`,ae=({fontSize:e})=>`
  font-size: ${Math.max(10,e-7)}px !important;
  color: ${d} !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95) !important;
  line-height: 1.25 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  min-width: 0 !important;
  overflow-wrap: anywhere !important;
`,x=()=>`
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  min-width: 0 !important;
`,S=({status:e,highlight:t})=>{let n=e===`active`&&t,r=e===`upcoming`&&t;return`
    display: flex !important;
    align-items: center !important;
    max-width: 100% !important;

    padding: ${n||r?`3px 6px`:`0 2px`} !important;
    border-radius: 6px !important;

    color: ${n?`#ff7a7a`:r?`#ffd184`:`rgba(255, 255, 255, 0.56)`} !important;
    background: ${n?`rgba(255, 72, 72, 0.16)`:r?`rgba(255, 184, 77, 0.14)`:`transparent`} !important;
    border: none !important;
    text-shadow: ${n?`0 0 12px rgba(255, 72, 72, 0.55), 0 1px 3px rgba(0, 0, 0, 0.95)`:r?`0 0 12px rgba(255, 184, 77, 0.55), 0 1px 3px rgba(0, 0, 0, 0.95)`:`0 1px 3px rgba(0, 0, 0, 0.95)`} !important;

    font-weight: ${n||r?700:500} !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
  `},oe=()=>`
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
`,C=({fontSize:e=13,fontWeight:t=`600`}={})=>`
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

  font-size: ${e}px !important;
  font-weight: ${t} !important;
`,w=(e,t)=>{e.style.background=t?c:`rgba(255, 255, 255, 0.1)`,e.style.borderColor=t?c:`rgba(255, 255, 255, 0.05)`,e.style.transform=t?`scale(1.05)`:`scale(1)`},T=(e,t)=>{e.style.opacity=t?`1`:`0`,e.style.visibility=t?`visible`:`hidden`},E=(e,t)=>{e.style.setProperty(`background`,v(t),`important`),e.style.setProperty(`backdrop-filter`,y(t),`important`),e.style.setProperty(`width`,t?`fit-content`:`auto`,`important`),e.style.setProperty(`display`,`inline-block`,`important`)},D=(e,t)=>{e.style.setProperty(`background`,v(t),`important`),e.style.setProperty(`backdrop-filter`,y(t),`important`),e.style.setProperty(`border-radius`,t?`6px`:`0`,`important`),e.style.setProperty(`padding`,t?`8px 12px`:`0`,`important`),e.style.setProperty(`width`,t?`fit-content`:`auto`,`important`),e.style.setProperty(`display`,t?`inline-flex`:`flex`,`important`)},se=e=>{e.style.setProperty(`background`,`transparent`,`important`),e.style.setProperty(`backdrop-filter`,`none`,`important`),e.style.border=`none`,e.style.boxShadow=`none`,e.style.width=`auto`,e.style.minWidth=`auto`};function O({isElectron:a,playerStore:o,playerIframe:s,props:c,enableBlur:l,disableBlur:u}){let d=null,f=new Set,v=new Set,y=new Set,O=[],k=!1,A=null,j=!1,M=(e,t)=>{let n=setTimeout(()=>{f.delete(n),k||e()},t);return f.add(n),n},N=e=>{clearTimeout(e),f.delete(e)},P=(e,t)=>{let n=setInterval(()=>{k||e()},t);return v.add(n),n},F=e=>{clearInterval(e),v.delete(e)},I=(e,t,n)=>{e.addEventListener(t,n),y.add(()=>e.removeEventListener(t,n))},L=t({get:()=>o.videoOverlayEnabled2,set:e=>o.updateVideoOverlay(e)}),R=t({get:()=>o.overlaySettings,set:e=>o.updateOverlaySettings(e)}),z=n(0),ce=n(0),B=n([]),V=n(!1),H=n(!1),U=null,W=n(null),G=n(null),K=n(!1),q=()=>L.value&&(!H.value||V.value),J=e=>e?.fullscreenElement||e?.webkitFullscreenElement||e?.mozFullScreenElement||e?.msFullscreenElement||null,Y=(e,t)=>J(e)===t||t?.webkitDisplayingFullscreen||t?.offsetWidth===window.screen.width&&t?.offsetHeight===window.screen.height,X=()=>{let e=W.value;if(!e||!H.value||V.value)return!1;let t=e.children[0],n=e.children[1],r=e.children[2];return t&&(t.style.opacity=`0`),n&&T(n,!1),r&&T(r,!1),N(U),U=null,N(G.value),G.value=null,!0},le=(e=!1)=>{if(k||!a.value)return;clearInterval(d);let t=[];function n(){if(t=[],R.value.autoBlurTimings===!1)return;let e=new Set([...Array.isArray(window.selectedNudityTimings)?window.selectedNudityTimings:[],...Array.isArray(window.overlayNudityTimings)?window.overlayNudityTimings:[]].map(e=>String(e)));if(e.size>0&&c.movieInfo?.nudity_timings){for(let n of c.movieInfo.nudity_timings)if(e.has(String(n.id))){let e=r(n.timing_text);e&&e.length>0&&t.push(...e)}}}n(),d=setInterval(()=>{if(!(k||!s.value)){n();try{let n=s.value,o=n.contentDocument||n.contentWindow.document;if(!o)return;let d=o.querySelectorAll(`video`);if(d.length>0){let n=d[0];if(z.value=n.currentTime||0,ce.value=n.duration||0,$(),a.value&&c.movieInfo?.nudity_timings){let e=n.currentTime,t=[],a=[];if(window.overlayNudityTimings&&Array.isArray(window.overlayNudityTimings)&&window.overlayNudityTimings.length>0){for(let n of c.movieInfo.nudity_timings)if(window.overlayNudityTimings.includes(n.id)){let o=r(n.timing_text);if(o&&o.length>0){let r=[];for(let[t,s]of o){let o=`normal`;e>=t&&e<=s?(o=`active`,a.push(n.id)):t>e&&t-e<=5&&(o=`upcoming`),r.push({text:`[${i(t)}-${i(s)}]`,status:o})}t.push({id:n.id,intervals:r})}}}B.value=t,V.value=a.length>0||t.some(e=>e.intervals.some(e=>e.status===`upcoming`))}if(a.value&&W.value&&H.value&&!V.value&&X(),V.value&&$(),a.value&&W.value&&q()&&Z(),!n.paused){let r=n.currentTime,o=n.duration,s=o>0?r/o*100:0;e&&(`${r.toFixed(2)}${o.toFixed(2)}${s.toFixed(1)}`,t.length>0&&`${t.map(([e,t])=>`${i(e)} - ${i(t)}`).join(`, `)}`);let c=!1;for(let[e,n]of t)if(r>=e&&r<=n){c=!0;break}c&&!j&&a.value?(l(),j=!0,r.toFixed(2)):!c&&j&&(u(),j=!1,r.toFixed(2))}}}catch{}}},100)},ue=()=>{try{document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen?document.webkitExitFullscreen():document.mozCancelFullScreen?document.mozCancelFullScreen():document.msExitFullscreen&&document.msExitFullscreen();let e=s.value;if(e){let t=e.contentDocument||e.contentWindow.document;if(t){t.exitFullscreen?t.exitFullscreen():t.webkitExitFullscreen?t.webkitExitFullscreen():t.mozCancelFullScreen?t.mozCancelFullScreen():t.msExitFullscreen&&t.msExitFullscreen();let e=t.querySelector(`video`);e&&(e.webkitExitFullscreen?e.webkitExitFullscreen():e.exitFullscreen&&e.exitFullscreen())}}}catch{}},de=()=>{if(!a.value)return;let e=s.value,t=e.contentDocument||e.contentWindow.document;if(!t||t.getElementById(`overlay-settings-modal`))return;let n=R.value,r=t.createElement(`div`);r.id=`overlay-settings-modal`,A=r,r.style.cssText=h();let i=t.createElement(`div`);i.style.cssText=g(),i.innerHTML=p(n),[`click`,`mousedown`,`mouseup`,`mousemove`,`wheel`,`contextmenu`].forEach(e=>{i.addEventListener(e,e=>{e.stopPropagation(),e.stopImmediatePropagation()})}),r.appendChild(i),r.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation(),e.target===r&&r.remove()}),[`mousedown`,`mouseup`,`mousemove`,`wheel`,`contextmenu`].forEach(e=>{r.addEventListener(e,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation()})}),i.querySelector(`#saveSettings`).addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation(),R.value={showTitle:i.querySelector(`#showTitle`).checked,showDuration2:i.querySelector(`#showDuration`).checked,showBackground:i.querySelector(`#showBackground`).checked,showTimingsOnMouseMove:i.querySelector(`#showTimingsOnMouseMove`).checked,highlightTimings:i.querySelector(`#highlightTimings`).checked,autoBlurTimings:i.querySelector(`#autoBlurTimings`).checked},window.electronAPI?.showToast(`Настройки оверлея сохранены`),r.remove()}),i.querySelector(`#cancelSettings`).addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation(),r.remove()}),i.querySelectorAll(`button`).forEach(e=>{e.addEventListener(`mouseenter`,t=>{t.preventDefault(),t.stopPropagation(),t.stopImmediatePropagation(),_(e,!0)}),e.addEventListener(`mouseleave`,t=>{t.preventDefault(),t.stopPropagation(),t.stopImmediatePropagation(),_(e,!1)}),[`mousedown`,`mouseup`,`mousemove`,`wheel`,`contextmenu`].forEach(t=>{e.addEventListener(t,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation()})})});let o=i.querySelectorAll(`input[type="checkbox"]`),c=i.querySelectorAll(`label`);o.forEach(e=>{[`click`,`mousedown`,`mouseup`,`mousemove`,`wheel`,`contextmenu`].forEach(t=>{e.addEventListener(t,e=>{t===`click`?e.stopPropagation():(e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation())})})}),c.forEach(e=>{[`mousedown`,`mouseup`,`mousemove`,`wheel`,`contextmenu`].forEach(t=>{e.addEventListener(t,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation()})})}),t.body.appendChild(r)},fe=(e,t)=>{if(!q()||W.value||K.value)return;K.value=!0;let n=e.createElement(`div`);n.id=`reyohoho-video-overlay`,W.value=n;let r=()=>{n.style.cssText=ee()},i=e.createElement(`div`);i.style.cssText=te();let a=e.createElement(`div`),o=R.value.fontSize||18;a.style.cssText=ne({fontSize:o,showBackground:R.value.showBackground});let s=e.createElement(`div`);s.style.cssText=re({fontSize:o,showBackground:R.value.showBackground});let c=e.createElement(`div`);c.style.cssText=ie({showBackground:R.value.showBackground});let l=e.createElement(`div`);l.style.cssText=ae({fontSize:o});let u=e.createElement(`div`);u.style.cssText=oe();let d=e.createElement(`button`);d.style.cssText=C(),d.innerHTML=`⚙️`,d.title=`Настройки оверлея`;let f=e.createElement(`button`);f.style.cssText=C({fontSize:15,fontWeight:`700`}),f.innerHTML=`A-`,f.title=`Уменьшить шрифт`;let p=e.createElement(`button`);p.style.cssText=C({fontSize:15,fontWeight:`700`}),p.innerHTML=`A+`,p.title=`Увеличить шрифт`;let m=e.createElement(`button`);m.style.cssText=C(),m.innerHTML=`👁️`,m.title=`Отключить оверлей`,m.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation(),H.value=!0,X()}),d.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation(),ue(),M(()=>{de()},100)}),f.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation();let t=R.value.fontSize||18;t>10&&(R.value={...R.value,fontSize:t-2})}),p.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation();let t=R.value.fontSize||18;t<36&&(R.value={...R.value,fontSize:t+2})}),[d,m,f,p].forEach(e=>{e.addEventListener(`mouseenter`,t=>{t.preventDefault(),t.stopPropagation(),t.stopImmediatePropagation(),w(e,!0)}),e.addEventListener(`mouseleave`,t=>{t.preventDefault(),t.stopPropagation(),t.stopImmediatePropagation(),w(e,!1)}),[`mousedown`,`mouseup`,`mousemove`,`wheel`,`contextmenu`].forEach(t=>{e.addEventListener(t,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation()})})}),[`click`,`mousedown`,`mouseup`,`mousemove`,`wheel`,`contextmenu`].forEach(e=>{u.addEventListener(e,e=>{e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation()})}),u.appendChild(f),u.appendChild(p),u.appendChild(d),u.appendChild(m),c.appendChild(l),i.appendChild(a),i.appendChild(s),n.appendChild(i),n.appendChild(c),n.appendChild(u),u.style.transition=`opacity 0.3s ease, visibility 0.3s ease`,T(u,!1),i.style.transition=`opacity 0.3s ease`;let h=null,g=()=>{X()||(T(u,!0),i.style.opacity=`0`,R.value.showTimingsOnMouseMove&&B.value.length>0&&(T(c,!0),N(U),U=null,V.value||(U=M(()=>{T(c,!1),U=null},3e3))),N(G.value),N(h),G.value=M(()=>{T(u,!1)},3e3),h=M(()=>{i.style.opacity=`1`},2e3))};I(e,`mousemove`,g),n.addEventListener(`mouseenter`,()=>{X()||(T(u,!0),i.style.opacity=`0`,N(h))}),n.addEventListener(`mouseleave`,()=>{N(G.value),N(h),T(u,!1),i.style.opacity=`1`}),n._mouseHandler=g;let _=t=>{let n=J(e);if(Y(e,t))return e.body||e.documentElement;if(n&&n!==t)return n;let r=t.parentNode,i=0;for(;r?.nodeType===1&&i<5;){let t=e.defaultView.getComputedStyle(r),n=r.getBoundingClientRect();if(n.width>0&&n.height>0&&(t.position===`relative`||t.position===`absolute`||t.position===`fixed`||r.tagName===`BODY`))return r;r=r.parentNode,i++}return t.parentElement||e.body},v=_(t);n._targetContainer=v,n._videoElement=t,r=()=>{let t=n._videoElement,r=n._targetContainer,i=J(e);if(Y(e,t))n.style.cssText=b({fullscreen:!0});else if(i)n.style.cssText=b({fullscreen:!1,top:0,left:0,width:i.clientWidth||i.offsetWidth||window.innerWidth,height:i.clientHeight||i.offsetHeight||window.innerHeight});else{let i=e.defaultView.getComputedStyle(t),a=r.getBoundingClientRect(),o=t.offsetWidth||t.clientWidth||parseFloat(i.width)||0,s=t.offsetHeight||t.clientHeight||parseFloat(i.height)||0,c=t.getBoundingClientRect(),l=c.top-a.top+r.scrollTop,u=c.left-a.left+r.scrollLeft;n.style.cssText=b({fullscreen:!1,top:l,left:u,width:o,height:s})}},t.style.position=`relative`,(v.style.position===``||v.style.position===`static`)&&(v.style.position=`relative`),v.appendChild(n),r(),W.value=n,K.value=!1;let y=P(()=>{if(!W.value||!L.value){F(y);return}if(!e.body.contains(n))try{let t=e.querySelectorAll(`video`);if(t.length>0){let i=t[0];n._videoElement=i;let a=_(i);n._targetContainer=a,a.appendChild(n),r(),n._mouseHandler&&(e.removeEventListener(`mousemove`,n._mouseHandler),e.addEventListener(`mousemove`,n._mouseHandler))}}catch{}let t=e.defaultView.getComputedStyle(n);if((t.visibility===`hidden`||t.display===`none`||t.opacity===`0`)&&r(),(parseInt(t.zIndex)||0)<999999999&&r(),n._videoElement&&n._targetContainer){let i=n._videoElement,a=e.defaultView.getComputedStyle(i),o=J(e),s=Y(e,i),c,l;s?(c=window.innerWidth,l=window.innerHeight):o?(c=o.clientWidth||o.offsetWidth||window.innerWidth,l=o.clientHeight||o.offsetHeight||window.innerHeight):(c=i.offsetWidth||i.clientWidth||parseFloat(a.width)||0,l=i.offsetHeight||i.clientHeight||parseFloat(a.height)||0);let u=parseInt(t.width)||0,d=parseInt(t.height)||0;(Math.abs(u-c)>5||Math.abs(d-l)>5)&&r()}},1e3),x=new window.MutationObserver(e=>{e.forEach(e=>{e.type===`attributes`&&e.target===n&&e.attributeName===`style`&&M(()=>{W.value&&L.value&&r()},100)})});n._mutationObserver=x,x.observe(n,{attributes:!0,attributeFilter:[`style`,`class`]});let S=()=>{W.value&&L.value&&r()},E=()=>{W.value&&L.value&&M(()=>{r()},100)};I(e.defaultView,`resize`,S),I(e,`fullscreenchange`,E),I(e,`webkitfullscreenchange`,E),I(t,`webkitbeginfullscreen`,E),I(t,`webkitendfullscreen`,E),n._monitorInterval=y,n._mutationObserver=x,n._resizeHandler=S,n._fullscreenHandler=E,n._iframeDoc=e;let D=P(()=>{if(!W.value||!L.value){F(D);return}r()},500);M(()=>{F(D)},1e4)},Z=()=>{if(!W.value||!L.value)return;let e=s.value;if(!e)return;let t=e.contentDocument||e.contentWindow.document;if(!t)return;let n=W.value,r=n.children[0],a=n.children[1],o=t.defaultView.getComputedStyle(n);(o.display===`none`||o.visibility===`hidden`)&&(n.style.setProperty(`display`,`flex`,`important`),n.style.setProperty(`visibility`,`visible`,`important`));let l=R.value.fontSize||18,u=r.children[0];u.style.fontSize=`${l+2}px`,R.value.showTitle?(u.style.display=`block`,u.textContent=(c.movieInfo?.title||c.movieInfo?.name_ru||c.movieInfo?.name_en||c.movieInfo?.name_original||`Загрузка...`)+(c.movieInfo?.year?` (${c.movieInfo.year})`:``),E(u,R.value.showBackground)):u.style.display=`none`;let d=r.children[1];d.style.fontSize=`${l}px`;let f=``;if(R.value.showDuration2&&(f=m({currentTimeFormatted:i(z.value),totalTimeFormatted:i(ce.value)})),f?(d.style.display=`flex`,d.innerHTML=f,D(d,R.value.showBackground)):d.style.display=`none`,B.value.length>0){let e=a.children[0];e.style.cssText=ae({fontSize:l}),e.innerHTML=``;let n=t.createElement(`div`);n.style.cssText=x(),B.value.forEach(e=>{e.intervals.forEach(e=>{let r=t.createElement(`div`);r.textContent=e.text,r.style.cssText=S({status:e.status,highlight:R.value.highlightTimings}),n.appendChild(r)})}),e.appendChild(n),a.style.display=`block`,(!R.value.showTimingsOnMouseMove||V.value)&&T(a,!0),se(a,R.value.showBackground)}else a.style.display=`none`;R.value.showTimingsOnMouseMove&&V.value&&B.value.length>0?(T(a,!0),N(U)):R.value.showTimingsOnMouseMove&&!V.value&&B.value.length>0&&a.style.opacity===`1`&&!U&&(U=M(()=>{T(a,!1),U=null},3e3))},Q=()=>{for(let e of f)clearTimeout(e);f.clear();for(let e of v)clearInterval(e);v.clear();for(let e of y)e();y.clear(),A?.remove(),A=null;let e=W.value;W.value=null,e?._mutationObserver?.disconnect(),e?.remove(),K.value=!1,G.value=null,U=null},$=()=>{if(!(k||!q()||W.value)&&!(Date.now()-(window.iframeLoadTime||0)<100))try{let e=s.value,t=e?.contentDocument||e?.contentWindow?.document,n=t?.querySelector(`video`);if(!n)return;fe(t,n),Z()}catch{Q()}};return O.push(e(L,e=>{H.value=!1,e?$():Q()}),e(R,(e,t)=>{q()&&(e.showBackground===t?.showBackground?W.value&&Z():(Q(),$()))},{deep:!0})),{start(){k||($(),le())},dispose:()=>{if(!k){k=!0;for(let e of O)e();clearInterval(d),d=null,Q(),j&&=(u(),!1)}}}}export{O as createPlayerVideoOverlayRuntime};