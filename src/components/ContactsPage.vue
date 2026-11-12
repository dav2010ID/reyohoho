<template>
  <div class="contact-page">
    <h1>Контакты и информация для правообладателей</h1>
    <div class="contact-text">
      <p>
        Если Вы владелец авторских прав, просим Вас учесть, что все плееры на сайте из сторонних API
        источников. Напишите на почту или в Телеграм с подтверждением авторских прав для удаления
        контента с сайта.
      </p>
      <p>
        If you are a copyright owner, please note that all players on the site are from third-party
        API sources. Please write to email or Telegram with confirmation of copyright for the
        removal of content from the site.
      </p>
      <p>
        <a href="mailto:reyohoho@proton.me">reyohoho@proton.me</a>
        <span class="contact-separator" aria-hidden="true">|</span>
        <a href="https://t.me/reyohoho_sup" target="_blank" rel="noopener noreferrer"
          >https://t.me/reyohoho_sup</a
        >
      </p>
    </div>
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
/* Same page header pattern as Settings and Login: centred title above the card. */
.contact-page h1 {
  max-width: 800px;
  margin: 36px auto 2.5rem;
  padding: 0 8px;
  color: #fff;
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 500;
  line-height: 1.25;
  text-align: center;
  text-wrap: balance;
}

.contact-text {
  color: #ffffff;
  /* Same card surface as Settings and Login. */
  background-color: #2a2a2a;
  border: 1px solid var(--hairline);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
  padding: 20px;
  border-radius: var(--radius-l);
  margin: 0 auto;
  max-width: 800px;
  line-height: 1.6;
}

@media (max-width: 600px) {
  .contact-text {
    margin: 0 8px;
  }

  .contact-separator {
    display: none;
  }

  .contact-text a {
    display: block;
    padding: 4px 0;
    overflow-wrap: anywhere;
  }
}

.contact-text a {
  color: var(--accent-light, var(--accent-color));
  text-decoration: none;
}

.contact-separator {
  margin: 0 0.5em;
}

.contact-text a:hover {
  text-decoration: underline;
}

.contact-text p:first-child {
  margin-top: 0;
}

.contact-text p:last-child {
  margin-bottom: 0;
}
</style>
