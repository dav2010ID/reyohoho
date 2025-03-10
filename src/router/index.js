import { createRouter, createWebHistory } from 'vue-router';
const MovieSearch = () => import(/* webpackChunkName: "movie-search" */ '../components/MovieSearch.vue');
const TopMovies = () => import(/* webpackChunkName: "top-movies" */ '../components/TopMovies.vue');
const MovieInfo = () => import(/* webpackChunkName: "movie-info" */ '../components/MovieInfo.vue');
const NotFound = () => import(/* webpackChunkName: "not-found" */ '../components/NotFound.vue');
const ContactsPage = () => import(/* webpackChunkName: "contacts-page" */ '../components/ContactsPage.vue');

const routes = [
  {
    path: '/',
    component: MovieSearch,
    name: 'home',
    meta: {
      title: 'Поиск фильмов',
    },
  },
  {
    path: '/top',
    component: TopMovies,
    name: 'top-movies',
    meta: {
      title: 'Топ фильмов',
    },
  },
  {
    path: '/movie/:kp_id',
    component: MovieInfo,
    name: 'movie-info',
    props: true,
    meta: {
      title: 'Просмотр фильма',
    },
  },
  {
    path: '/contact',
    name: 'ContactsPage',
    component: ContactsPage,
    meta: {
      title: 'Контакты',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    component: NotFound,
    name: 'NotFound',
    meta: {
      title: '404 - Страница не найдена',
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const title = to.meta.title || 'Vue App';
  document.title = title;
  next();
});

export default router;
