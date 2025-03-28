export const routes = [
  {
    path: '/',
    component: () => import('@/components/MovieSearch.vue'),
    name: 'home',
    meta: {
      title: 'ReYohoho - Поиск фильмов'
    }
  },
  {
    path: '/top',
    component: () => import('@/components/TopMovies.vue'),
    name: 'top-movies',
    meta: {
      title: 'ReYohoho - Популярное'
    }
  },
  {
    path: '/movie/:kp_id',
    component: () => import('@/components/MovieInfo.vue'),
    name: 'movie-info',
    meta: {
      title: 'ReYohoho - Просмотр фильма'
    }
  },
  {
    path: '/contact',
    name: 'ContactsPage',
    component: () => import('@/components/ContactsPage.vue'),
    meta: {
      title: 'ReYohoho - Контакты'
    }
  },
  {
    path: '/setting',
    name: 'SettingsModal',
    component: () => import('@/components/SettingsModal.vue'),
    meta: {
      title: 'ReYohoho - Настройки'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/components/NotFound.vue'),
    name: 'NotFound',
    meta: {
      title: '404 - Страница не найдена'
    }
  }
]
