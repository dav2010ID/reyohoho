import { createRouter, createWebHistory } from 'vue-router'
const MovieSearch = () =>
  import(/* webpackChunkName: "movie-search" */ '../components/MovieSearch.vue')
const TopMovies = () => import(/* webpackChunkName: "top-movies" */ '../components/TopMovies.vue')
const MovieInfo = () => import(/* webpackChunkName: "movie-info" */ '../components/MovieInfo.vue')
const NotFound = () => import(/* webpackChunkName: "not-found" */ '../components/NotFound.vue')
const ContactsPage = () =>
  import(/* webpackChunkName: "contacts-page" */ '../components/ContactsPage.vue')
const SettingsModal = () =>
  import(/* webpackChunkName: "settings-modal" */ '../components/SettingsModal.vue')

const routes = [
  {
    path: '/',
    component: MovieSearch,
    name: 'home',
    meta: {
      title: 'ReYohoho - Поиск фильмов'
    }
  },
  {
    path: '/top',
    component: TopMovies,
    name: 'top-movies',
    meta: {
      title: 'ReYohoho - Популярное'
    }
  },
  {
    path: '/movie/:kp_id',
    component: MovieInfo,
    name: 'movie-info',
    meta: {
      title: 'ReYohoho - Просмотр фильма'
    }
  },
  {
    path: '/contact',
    name: 'ContactsPage',
    component: ContactsPage,
    meta: {
      title: 'ReYohoho - Контакты'
    }
  },
  {
    path: '/setting',
    name: 'SettingsModal',
    component: SettingsModal,
    meta: {
      title: 'ReYohoho - Настройки'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    component: NotFound,
    name: 'NotFound',
    meta: {
      title: '404 - Страница не найдена'
    }
  }
]

const base = import.meta.env.VITE_BASE_URL || '/'

const router = createRouter({
  history: createWebHistory(base),
  routes
})

router.beforeEach((to, from, next) => {
  const title = to.meta.title || 'ReYohoho'
  document.title = title

  if (to.hash) {
    if (to.hash.startsWith('#search=')) {
      next()
    } else {
      const hash = to.hash.slice(1)
      next({ path: `/movie/${hash}` })
    }
  } else {
    next()
  }
})

export default router
