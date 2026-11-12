<template>
  <!-- No card: a large code, one sentence and two ways forward. -->
  <div class="error-page">
    <p class="error-code" aria-hidden="true">404</p>
    <h1>Страница не найдена</h1>
    <p class="error-text">
      Такой страницы нет или ссылка устарела. Найдите фильм или вернитесь на главную.
    </p>
    <form class="error-search" role="search" @submit.prevent="openSearch">
      <input
        v-model="query"
        type="search"
        class="error-search__input"
        placeholder="Название фильма или сериала"
        aria-label="Поиск фильмов и сериалов"
      />
      <button type="submit" class="error-search__button" aria-label="Найти">
        <i class="fas fa-search" aria-hidden="true"></i>
      </button>
    </form>
    <router-link to="/" class="home-link">На главную</router-link>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useNavbarStore } from '@/store/navbar'

const navbarStore = useNavbarStore()
const query = ref('')

const openSearch = () => navbarStore.openSearchModal(query.value)
</script>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  box-sizing: border-box;
  max-width: 640px;
  padding: var(--page-top) 24px 64px;
  color: #fff;
}

.error-code {
  margin: 0;
  color: rgba(255, 255, 255, 0.12);
  font-size: clamp(96px, 18vw, 160px);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
  line-height: 0.9;
}

h1 {
  margin: 0;
  font-size: var(--fs-2xl);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.error-text {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-m);
  line-height: 1.5;
}

.error-search {
  display: flex;
  width: 100%;
  max-width: 480px;
  margin-top: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-m);
  background: var(--surface-raised);
}

.error-search:focus-within {
  border-color: var(--accent-ui);
}

.error-search__input {
  flex: 1;
  min-width: 0;
  min-height: 46px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 16px;
}

.error-search__input:focus {
  outline: none;
}

.error-search__button {
  width: 46px;
  border: none;
  background: none;
  color: #fff;
  cursor: pointer;
}

.home-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--accent-light);
  font-size: var(--fs-m);
}
</style>
