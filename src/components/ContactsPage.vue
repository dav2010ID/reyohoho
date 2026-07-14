<template>
  <div class="contact-text">
    <h1>Контакты и информация для правообладателей</h1>
    <p>
      Если Вы владелец авторских прав, просим Вас учесть, что все плееры на сайте из сторонних API
      источников. Напишите на почту или в Телеграм с подтверждением авторских прав для удаления
      контента с сайта.
    </p>
    <p>
      If you are a copyright owner, please note that all players on the site are from third-party
      API sources. Please write to email or Telegram with confirmation of copyright for the removal
      of content from the site.
    </p>
    <p>
      <a href="mailto:reyohoho@proton.me">reyohoho@proton.me</a> |
      <a href="https://t.me/reyohoho_sup" target="_blank" rel="noopener noreferrer"
        >https://t.me/reyohoho_sup</a
      >
    </p>
  </div>
</template>

<script setup>
import { useHead } from '@unhead/vue'
import { buildStaticPageHead } from '@/utils/staticSeo'

useHead(
  buildStaticPageHead({
    routePath: '/contact',
    title: 'Контакты и информация для правообладателей - ReYohoho',
    description:
      'Контактные данные ReYohoho и порядок обращения правообладателей по вопросам сторонних видеоплееров.'
  })
)
</script>

<style scoped>
.contact-text {
  color: #ffffff;
  background-color: #333333;
  padding: 20px;
  border-radius: 5px;
  margin: 0 auto;
  max-width: 800px;
  margin-top: 20px;
  line-height: 1.6;
}

.contact-text a {
  color: #5bb8cc;
  text-decoration: none;
}

.contact-text a:hover {
  text-decoration: underline;
}

.contact-text h1 {
  margin-top: 0;
  font-size: clamp(1.35rem, 4vw, 2rem);
}
</style>
