import { createStore } from 'vuex';
import createPersistedState from 'vuex-persistedstate'; // Плагин для автоматического сохранения
import background from './modules/background'; // Импортируем модуль фона
import player from './modules/player'; // Импортируем модуль плеера
import noPosterImage from '@/assets/image-no-poster.gif';

const store = createStore({
  modules: {
    background, // Модуль фона
    player, // Модуль плеера
  },
  state() {
    return {
      history: [], // История фильмов
    };
  },
  mutations: {
    setHistory(state, history) {
      state.history = history;
    },
    addToHistory(state, movie) {
      // Проверяем, есть ли у фильма kp_id
      if (!movie.kp_id) return;
  
      // Находим индекс фильма в истории
      const existingMovieIndex = state.history.findIndex(m => m.kp_id === movie.kp_id);
  
      if (existingMovieIndex !== -1) {
        // Если фильм уже есть, обновляем его дату и ставим первым
        state.history[existingMovieIndex].addedAt = new Date().toISOString();
  
        // Перемещаем фильм в начало списка
        const updatedMovie = state.history.splice(existingMovieIndex, 1)[0];
        state.history.unshift(updatedMovie);
      } else {
        // Если фильма нет, добавляем его в историю
        const movieWithDate = {
          kp_id: movie.kp_id,
          title: movie.title || '',
          year: movie.year || '',
          poster: movie.poster || movie.cover || noPosterImage,
          addedAt: new Date().toISOString()
        };
  
        state.history.unshift(movieWithDate);  // Добавляем новый фильм в начало
      }
    },
    removeFromHistory(state, kp_id) {
      state.history = state.history.filter(movie => movie.kp_id !== kp_id);
    },
    cleanOldHistory(state) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      state.history = state.history.filter(movie => new Date(movie.addedAt) > thirtyDaysAgo);
    },
    clearAllHistory(state) {
      state.history = [];
    },
  },
    
  actions: {
    addToHistory({ commit }, movie) {
      commit('addToHistory', movie);
    },
    removeFromHistory({ commit }, kp_id) {
      commit('removeFromHistory', kp_id);
    },
    cleanOldHistory({ commit }) {
      commit('cleanOldHistory');
    },
    clearAllHistory({ commit }) {
      commit('clearAllHistory');
    },
  },
  plugins: [createPersistedState({
    paths: ['history', 'background', 'player'], // Указываем, какие данные сохранять в localStorage
  })],
});

export default store;
