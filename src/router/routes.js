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
    path: '/settings',
    name: 'SettingsModal',
    component: () => import('@/components/SettingsModal.vue'),
    meta: {
      title: 'ReYohoho - Настройки'
    }
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('@/components/NotificationsPage.vue'),
    meta: {
      title: 'ReYohoho - Уведомления',
      requiresAuth: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/components/NotFound.vue'),
    name: 'NotFound',
    meta: {
      title: '404 - Страница не найдена'
    }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/components/Login.vue'),
    meta: {
      title: 'ReYohoho - Логин'
    }
  },
  {
    path: '/user',
    name: 'user',
    component: () => import('@/components/User.vue'),
    meta: {
      title: 'ReYohoho - Профиль'
    }
  },
  {
    path: '/lists/:user_id?',
    name: 'lists',
    component: () => import('@/components/UserLists.vue'),
    meta: {
      title: 'ReYohoho - Списки'
    }
  },
  {
    path: '/auth-success',
    name: 'auth-success',
    component: () => import('@/components/AuthSuccess.vue'),
    meta: {
      title: 'ReYohoho - Логин'
    }
  },
  {
    path: '/links',
    name: 'links',
    component: () => import('@/components/Links.vue'),
    meta: {
      title: 'ReYohoho - Полезные ссылки'
    }
  }
]
