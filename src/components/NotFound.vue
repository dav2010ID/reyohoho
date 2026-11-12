<template>
  <div class="error-page">
    <div class="error-content">
      <h1>404 — Страница не найдена</h1>
      <p>Такой страницы не существует или ссылка устарела.</p>
      <button class="home-button" @click="goToHome">На главную</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goToHome = () => {
  router.push('/')
}
</script>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #000;
  color: #fff;
  text-align: center;
}

.error-content {
  max-width: 600px;
  padding: 20px;
  /* Same card surface as Settings and Login. */
  background-color: #2a2a2a;
  border: 1px solid var(--accent-transparent);
  border-radius: 10px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.error-content h1 {
  text-wrap: balance;
  font-size: 3rem;
  margin-bottom: 20px;
  color: #fff;
}

.error-content p {
  font-size: 1.2rem;
  margin-bottom: 30px;
  color: #ccc;
}

@media (max-width: 600px) {
  .error-content {
    margin: 0 8px;
  }

  .error-content h1 {
    font-size: clamp(1.9rem, 9vw, 2.5rem);
  }
}

.home-button {
  background-color: var(--accent-solid);
  color: var(--accent-contrast);
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.home-button:hover {
  background-color: var(--accent-solid-hover);
}
</style>
