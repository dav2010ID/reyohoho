<template>
  <footer :class="{ 'footer-fixed': !isAtBottom, 'footer-static': isAtBottom }">
    <div class="donaters-wrapper">
      <span class="donaters-text">Спасибо топ донатерам</span>

      <div class="top-donators-carousel">
        <transition name="fade" mode="out-in">
          <a
            v-if="currentFeaturedDonor"
            :key="currentFeaturedDonorIndex"
            :href="
              currentFeaturedDonor.twitchUsername
                ? `https://twitch.tv/${currentFeaturedDonor.twitchUsername}`
                : undefined
            "
            :target="currentFeaturedDonor.twitchUsername ? '_blank' : undefined"
            :rel="currentFeaturedDonor.twitchUsername ? 'noopener noreferrer' : undefined"
            class="donor-card"
            :class="{
              'is-live': currentFeaturedDonor.isLive,
              'no-link': !currentFeaturedDonor.twitchUsername
            }"
          >
            <div class="donor-card-preview">
              <div
                class="donor-avatar"
                :style="{
                  backgroundImage: currentFeaturedDonor.avatar
                    ? `url(${currentFeaturedDonor.avatar})`
                    : 'linear-gradient(135deg, #9147ff 0%, #5a1f99 100%)'
                }"
              >
                <div v-if="!currentFeaturedDonor.avatar" class="avatar-placeholder">
                  {{ currentFeaturedDonor.name.charAt(0).toUpperCase() }}
                </div>
                <div v-if="currentFeaturedDonor.isLive" class="live-badge">
                  <span class="live-indicator"></span>
                  LIVE
                </div>
              </div>
            </div>
            <div class="donor-card-info">
              <div class="donor-name">{{ currentFeaturedDonor.name }}</div>
              <div
                v-if="currentFeaturedDonor.isLive && currentFeaturedDonor.category"
                class="donor-category"
              >
                {{ currentFeaturedDonor.category }}
              </div>
              <div v-else-if="currentFeaturedDonor.isLive" class="donor-status">В эфире</div>
              <div v-else class="donor-status offline">Не в сети</div>
            </div>
            <div v-if="currentFeaturedDonor.twitchUsername" class="donor-link-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path
                  d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"
                />
              </svg>
            </div>
          </a>
        </transition>
        <div class="carousel-indicators">
          <button
            v-for="(donor, index) in featuredDonors"
            :key="index"
            :class="{ active: index === currentFeaturedDonorIndex }"
            @click="goToFeaturedDonor(index)"
          ></button>
        </div>
      </div>

      <span class="donaters-text">а так же</span>

      <transition name="fade" mode="out-in">
        <span v-if="currentDonater" :key="currentIndex" class="donater">
          {{ currentDonater }}
        </span>
      </transition>

      <a
        class="visitor-badge-link"
        href="https://visitor-badge.laobi.icu/badge?page_id=dav2010id.reyohoho&left_text=Site%20views&left_color=111827&right_color=14b8a6"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Site visitors badge"
      >
        <img
          class="visitor-badge-image"
          src="https://visitor-badge.laobi.icu/badge?page_id=dav2010id.reyohoho&left_text=Site%20views&left_color=111827&right_color=14b8a6"
          alt="Site visitors"
        />
      </a>
    </div>
  </footer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getDons, getTwitchStream } from '@/api/movies'

const donaters = ref([])
const currentIndex = ref(-1)
const currentFeaturedDonorIndex = ref(0)
const isAtBottom = ref(false)
const CACHE_KEY_DONATERS = 'donatersCache'
const CACHE_KEY_TWITCH = 'twitchDataCache'
const TWITCH_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
let intervalId = null
let carouselIntervalId = null
let twitchCheckInterval = null

let memoryCache = {
  donaters: null,
  twitch: null
}

let isFetchingTwitch = false

const featuredDonors = ref([
  {
    name: 'XaksFlaX',
    twitchUsername: 'xaksflax',
    avatar: null,
    isLive: false,
    category: null,
    originalIndex: 0
  },
  {
    name: 'TanyaBelkova',
    twitchUsername: 'tanyabelkova',
    avatar: null,
    isLive: false,
    category: null,
    originalIndex: 1
  },
  {
    name: 'F1ashko',
    twitchUsername: 'f1ashko',
    avatar: null,
    isLive: false,
    category: null,
    originalIndex: 2
  },
  {
    name: 'Krabick',
    twitchUsername: 'krabick',
    avatar: null,
    isLive: false,
    category: null,
    originalIndex: 3
  },
  {
    name: 'Kati',
    twitchUsername: 'Kati',
    avatar: null,
    isLive: false,
    category: null,
    originalIndex: 4
  },
  {
    name: 'Timofey',
    twitchUsername: 'Timofey',
    avatar: null,
    isLive: false,
    category: null,
    originalIndex: 5
  },
  { 
    name: 'RomanovaLera',
    twitchUsername: 'RomanovaLera',
    avatar: null,
    isLive: false,
    category: null,
    originalIndex: 6
  }

])

const currentDonater = computed(() => {
  if (currentIndex.value === -1 || !donaters.value.length) return ''
  return donaters.value[currentIndex.value]
})

const currentFeaturedDonor = computed(() => {
  if (!featuredDonors.value.length) return null
  return featuredDonors.value[currentFeaturedDonorIndex.value]
})

let scrollTimeout = null
const handleScroll = () => {
  if (scrollTimeout) return
  scrollTimeout = window.requestAnimationFrame(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight

    isAtBottom.value = scrollTop + windowHeight >= documentHeight - 10
    scrollTimeout = null
  })
}

const safeGetFromStorage = (key, cacheType) => {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    console.warn(`localStorage error: ${e.message}`)
    return memoryCache[cacheType] ? JSON.stringify(memoryCache[cacheType]) : null
  }
}

const safeSaveToStorage = (key, value, cacheType) => {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.warn(`localStorage error: ${e.message}`)
    try {
      memoryCache[cacheType] = JSON.parse(value)
    } catch (parseError) {
      console.error('safeSaveToStorage:', parseError)
    }
  }
}

const fetchTwitchData = async () => {
  if (isFetchingTwitch) {
    return
  }

  const cached = safeGetFromStorage(CACHE_KEY_TWITCH, 'twitch')
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached)
      if (Date.now() - timestamp < TWITCH_CACHE_DURATION) {
        updateDonorsWithTwitchData(data)
        return
      }
    } catch (e) {
      console.error('fetchTwitchData:', e)
    }
  }

  const usernamesWithTwitch = featuredDonors.value
    .filter((d) => d.twitchUsername)
    .map((d) => d.twitchUsername)

  if (usernamesWithTwitch.length === 0) return

  isFetchingTwitch = true

  try {
    const promises = usernamesWithTwitch.map(async (username) => {
      try {
        const response = await getTwitchStream(username)

        if (!response || !response.user_info) {
          return {
            username: username,
            isLive: false,
            category: null,
            avatar: null
          }
        }

        const userInfo = response.user_info
        const avatar = userInfo.avatar_url || null

        const isLive = response.stream_data && response.stream_data.length > 0

        if (isLive) {
          const streamData = response.stream_data[0]

          return {
            username: username,
            isLive: true,
            category: streamData.game_name || null,
            avatar: avatar
          }
        } else {
          return {
            username: username,
            isLive: false,
            category: null,
            avatar: avatar
          }
        }
      } catch (error) {
        console.error(`Twitch error for ${username}:`, error)
        return {
          username: username,
          isLive: false,
          category: null,
          avatar: null
        }
      }
    })

    const twitchData = await Promise.all(promises)

    const cacheData = JSON.stringify({
      timestamp: Date.now(),
      data: twitchData
    })
    safeSaveToStorage(CACHE_KEY_TWITCH, cacheData, 'twitch')

    updateDonorsWithTwitchData(twitchData)
  } catch (error) {
    console.error('fetchTwitchData:', error)
  } finally {
    isFetchingTwitch = false
  }
}

const updateDonorsWithTwitchData = (twitchData) => {
  const twitchMap = new Map(
    twitchData.map((d) => [d.username.toLowerCase(), d])
  )
  
  let hasChanges = false
  const updatedDonors = featuredDonors.value.map((donor) => {
    if (!donor.twitchUsername) return donor

    const streamData = twitchMap.get(donor.twitchUsername.toLowerCase())
    if (streamData) {
      const newIsLive = streamData.isLive || false
      const newCategory = streamData.category || null
      const newAvatar = streamData.avatar || donor.avatar
      
      if (
        donor.isLive !== newIsLive ||
        donor.category !== newCategory ||
        donor.avatar !== newAvatar
      ) {
        hasChanges = true
        return {
          ...donor,
          isLive: newIsLive,
          category: newCategory,
          avatar: newAvatar
        }
      }
    }
    return donor
  })
  
  if (hasChanges) {
    updatedDonors.sort((a, b) => {
      if (a.isLive !== b.isLive) {
        return a.isLive ? -1 : 1
      }
      return a.originalIndex - b.originalIndex
    })
    featuredDonors.value = updatedDonors
    currentFeaturedDonorIndex.value = 0
  }
}

const fetchDonaters = async () => {
  const today = new Date().toISOString().split('T')[0]
  const cached = safeGetFromStorage(CACHE_KEY_DONATERS, 'donaters')

  if (cached) {
    try {
      const { date, data } = JSON.parse(cached)
      if (date === today) {
        donaters.value = data
        return
      }
    } catch (e) {
      console.error('fetchDonaters:', e)
    }
  }

  try {
    const dons = await getDons()
    donaters.value = dons
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line)

    const cacheData = JSON.stringify({
      date: today,
      data: donaters.value
    })
    safeSaveToStorage(CACHE_KEY_DONATERS, cacheData, 'donaters')
  } catch (error) {
    console.error('Ошибка загрузки донатеров:', error)
  }
}

function updateCurrentDonater() {
  if (!donaters.value.length) return
  const newIndex = Math.floor(Math.random() * donaters.value.length)
  currentIndex.value = newIndex
}

function startShowingDonaters() {
  if (donaters.value.length === 0) return
  updateCurrentDonater()
  intervalId = setInterval(updateCurrentDonater, 4000)
}

function updateFeaturedDonorCarousel() {
  if (!featuredDonors.value.length) return
  currentFeaturedDonorIndex.value =
    (currentFeaturedDonorIndex.value + 1) % featuredDonors.value.length
}

function goToFeaturedDonor(index) {
  currentFeaturedDonorIndex.value = index
  if (carouselIntervalId) {
    clearInterval(carouselIntervalId)
    carouselIntervalId = setInterval(updateFeaturedDonorCarousel, 5000)
  }
}

function startCarousel() {
  if (featuredDonors.value.length === 0) return
  carouselIntervalId = setInterval(updateFeaturedDonorCarousel, 5000)
}

onMounted(async () => {
  await fetchDonaters()
  startShowingDonaters()
  startCarousel()
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()

  await fetchTwitchData()

  twitchCheckInterval = setInterval(fetchTwitchData, TWITCH_CACHE_DURATION)
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
  if (carouselIntervalId) clearInterval(carouselIntervalId)
  if (twitchCheckInterval) clearInterval(twitchCheckInterval)
  if (scrollTimeout) window.cancelAnimationFrame(scrollTimeout)
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
footer {
  width: 100%;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
  transition: all 0.3s ease;
}

.footer-fixed {
  position: fixed;
  bottom: 0;
  left: 0;
}

.footer-static {
  position: absolute;
  bottom: 0;
  left: 0;
}

.donaters-wrapper {
  min-height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 20px;
  gap: 15px;
  background: rgba(0, 0, 0, 0.9);
}

.donaters-text {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-color);
  text-shadow: 0 0 10px rgba(145, 70, 255, 0.5);
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.top-donators-carousel {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.donor-card {
  width: 220px;
  height: 50px;
  background: #18181b;
  border-radius: 6px;
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease;
  cursor: pointer;
  position: relative;
  border: 2px solid transparent;
  text-decoration: none;
  display: flex;
  flex-direction: row;
  align-items: center;
  will-change: transform;
}

.donor-card.no-link {
  cursor: default;
}

.donor-card:not(.no-link):hover {
  transform: translateY(-3px);
  border-color: #9147ff;
  box-shadow: 0 6px 20px rgba(145, 71, 255, 0.3);
}

.donor-card.is-live {
  border-color: var(--accent-color);
  box-shadow: 0 0 15px rgba(145, 71, 255, 0.4);
}

.donor-card.is-live:not(.no-link):hover {
  box-shadow: 0 6px 24px rgba(145, 71, 255, 0.5);
}

.donor-card-preview {
  width: 50px;
  height: 50px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #1f1f23 0%, #0e0e10 100%);
}

.donor-avatar {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: brightness(0.9);
  transition: filter 0.3s ease, transform 0.3s ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: filter, transform;
}

.donor-card:hover .donor-avatar {
  filter: brightness(1.1);
  transform: scale(1.05);
}

.avatar-placeholder {
  font-size: 22px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  user-select: none;
}

.live-badge {
  position: absolute;
  top: 3px;
  left: 3px;
  background: #eb0400;
  color: #fff;
  padding: 2px 5px;
  border-radius: 2px;
  font-size: 7px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 2px;
  letter-spacing: 0.3px;
  animation: pulse 2s ease-in-out infinite;
  z-index: 2;
  will-change: box-shadow;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 10px rgba(235, 4, 0, 0.6);
  }
  50% {
    box-shadow: 0 0 20px rgba(235, 4, 0, 0.9);
  }
}

.live-indicator {
  width: 4px;
  height: 4px;
  background: #fff;
  border-radius: 50%;
  animation: blink 1.5s ease-in-out infinite;
  will-change: opacity;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.donor-card-info {
  padding: 5px 8px;
  background: #18181b;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.donor-name {
  font-size: 12px;
  font-weight: 700;
  color: #efeff1;
  margin-bottom: 3px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.donor-category {
  font-size: 9px;
  color: #bf94ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.donor-status {
  font-size: 9px;
  color: #adadb8;
}

.donor-status.offline {
  color: #53535f;
}

.donor-link-icon {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9147ff;
  transition: all 0.3s ease;
  z-index: 2;
  backdrop-filter: blur(5px);
  pointer-events: none;
}

.donor-card:not(.no-link):hover .donor-link-icon {
  background: #9147ff;
  color: #fff;
  transform: scale(1.1);
}

.donor-link-icon svg {
  transition: transform 0.3s ease;
}

.donor-card:not(.no-link):hover .donor-link-icon svg {
  transform: scale(1.1);
}

.carousel-indicators {
  display: flex;
  gap: 5px;
  justify-content: center;
  align-items: center;
}

.carousel-indicators button {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-color) 50%, transparent);
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
}

.carousel-indicators button:hover {
  background: var(--accent-color);
  transform: scale(1.2);
}

.carousel-indicators button.active {
  background: var(--accent-color);
  width: 20px;
  border-radius: 3px;
}

.donater {
  font-family: Neucha, sans-serif;
  font-weight: bold;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.945);
  text-align: left;
  white-space: nowrap;
  min-width: 150px;
}

.visitor-badge-link {
  display: inline-flex;
  align-items: center;
  line-height: 0;
  opacity: 0.92;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.visitor-badge-link:hover {
  opacity: 1;
  transform: translateY(-1px);
}

.visitor-badge-image {
  height: 20px;
  width: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .donaters-wrapper {
    padding: 10px 15px;
    min-height: 65px;
    gap: 12px;
  }

  .donaters-text {
    font-size: 13px;
  }

  .donor-card {
    width: 190px;
    height: 50px;
  }

  .donor-card-preview {
    width: 50px;
    height: 50px;
  }

  .donor-name {
    font-size: 11px;
  }

  .donor-category,
  .donor-status {
    font-size: 8px;
  }

  .donater {
    font-size: 14px;
    min-width: 120px;
  }

  .visitor-badge-image {
    height: 18px;
  }
}

@media (max-width: 480px) {
  .donaters-wrapper {
    flex-direction: column;
    padding: 10px 12px;
    min-height: auto;
    gap: 10px;
  }

  .donaters-text {
    font-size: 12px;
  }

  .top-donators-carousel {
    width: 100%;
    justify-content: center;
  }

  .donor-card {
    width: calc(100vw - 60px);
    max-width: 200px;
    height: 45px;
  }

  .donor-card-preview {
    width: 45px;
    height: 45px;
  }

  .donor-name {
    font-size: 10px;
  }

  .donor-category,
  .donor-status {
    font-size: 7px;
  }

  .carousel-indicators button {
    width: 5px;
    height: 5px;
  }

  .carousel-indicators button.active {
    width: 16px;
  }

  .donater {
    font-size: 13px;
    min-width: 100px;
    text-align: center;
  }

  .visitor-badge-image {
    height: 16px;
  }
}
</style>
