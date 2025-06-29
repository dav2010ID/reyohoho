<template>
  <div class="links-page dark-theme">
    <h1>Полезные ссылки</h1>

    <div class="links-grid">
      <div v-for="(link, index) in externalLinks" :key="index" class="link-card">
        <a
          v-if="link.href"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          class="link-item"
        >
          <i :class="['link-icon', link.icon]" :style="link.style || {}" v-if="link.icon"></i>
          <span class="link-text">{{ link.text }}</span>
        </a>

        <router-link v-else-if="link.to" :to="link.to" class="link-item">
          <i :class="['link-icon', link.icon]" :style="link.style || {}" v-if="link.icon"></i>
          <span class="link-text">{{ link.text }}</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
const externalLinks = [
  {
    href: 'https://gitlab.com/-/snippets/4830428',
    icon: 'fas fa-heart',
    text: 'Спасибо Вам!',
    style: { color: '#ff3860' }
  },
  { href: 'https://t.me/ReYohoho', icon: 'fab fa-telegram', text: 'Telegram' },

  { href: 'https://t.me/ReYohoho/126', icon: 'fab fa-telegram', text: 'Приложение' },
  {
    href: 'https://gitlab.com/reyohoho/reyohoho-chrome-ff-ext',
    icon: 'fa-solid fa-puzzle-piece',
    text: 'Расширение'
  },

  { href: 'https://gitlab.com/reyohoho/reyohoho', icon: 'fab fa-gitlab', text: 'Gitlab' },
  {
    href: 'http://45.136.199.126:3001/status/reyohoho',
    icon: 'fas fa-tachometer-alt',
    text: 'Статус работы'
  },
  { to: '/contact', icon: 'fa-regular fa-copyright', text: 'Copyright' }
]
</script>

<style scoped>
.links-page.dark-theme {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  min-height: 100vh;
  color: #e0e0e0;
}

h1 {
  text-align: center;
  margin-bottom: 2.5rem;
  color: #ffffff;
  font-size: 2rem;
  font-weight: 500;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 0 1rem;
}

.link-card {
  background: #2d2d2d;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border: 1px solid #3d3d3d;
}

.link-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  background: #3a3a3a;
  border-color: #fff;
}

.link-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  padding-top: 0.5rem;
  padding-bottom: 3rem;
  color: inherit;
  height: 100%;
  text-align: center;
}

.link-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #fff;
  width: 100%;
  text-align: center;
}

.link-text {
  font-size: 1.1rem;
  line-height: 1.4;
  width: 100%;
  text-align: center;
  word-break: break-word;
}

.link-card:hover .link-icon {
  color: #fff;
  transform: scale(1.1);
  transition: all 0.3s ease;
}

@media (max-width: 768px) {
  .links-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .link-icon {
    font-size: 2rem;
  }

  .link-text {
    font-size: 1rem;
  }
}
</style>
