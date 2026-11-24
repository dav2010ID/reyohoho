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
/* Same page pattern as Settings, Top-250 and 404: left-aligned 28/800 title, text on the page. */
.contact-page {
  box-sizing: border-box;
  max-width: 760px;
  padding: var(--page-top) 24px 64px;
  color: #fff;
}

.contact-page h1 {
  margin: 0 0 24px;
  color: #fff;
  font-size: var(--fs-2xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  text-wrap: balance;
}

.contact-text {
  max-width: 62ch;
  color: rgba(255, 255, 255, 0.87);
  font-size: var(--fs-m);
  line-height: 1.6;
}

.contact-text p {
  margin: 0 0 16px;
}

.contact-text p:last-child {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 4px;
  margin: 24px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--hairline);
}

.contact-text a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--accent-light, var(--accent-color));
  font-weight: 600;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.contact-text a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.contact-text a:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
  border-radius: var(--radius-s);
}

.contact-separator {
  margin: 0 8px;
  color: var(--text-faint);
}

@media (max-width: 600px) {
  .contact-page {
    padding: var(--page-top) 16px 40px;
  }

  .contact-text p:last-child {
    flex-direction: column;
    align-items: flex-start;
  }

  .contact-separator {
    display: none;
  }
}
</style>
