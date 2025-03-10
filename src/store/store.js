import { createStore } from 'vuex';

export const store = createStore({
  state() {
    return {
      history: [],  // История фильмов
    };
  },
  mutations: {
    // Мутация для установки истории
    setHistory(state, history) {
      state.history = history;
    },
    // Мутация для добавления фильма в историю
    addToHistory(state, movie) {
      if (state.history.some(m => m.kp_id === movie.kp_id)) return; // Если фильм уже есть, выходим
    
      const movieWithDate = {
        kp_id: movie.kp_id,
        title: movie.title || '',
        year: movie.year || '',
        poster: movie.poster || movie.cover || './src/assets/no-poster.gif',
        addedAt: new Date().toISOString()
      };
    
      state.history.push(movieWithDate);
    },
    
    // Мутация для удаления фильма из истории
    removeFromHistory(state, kp_id) {
      state.history = state.history.filter(movie => movie.kp_id !== kp_id);
    },
    // Мутация для очистки старых фильмов (старше 30 дней)
    cleanOldHistory(state) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      state.history = state.history.filter(movie => new Date(movie.addedAt) > thirtyDaysAgo);
    },
    // Мутация для очистки всей истории
    clearAllHistory(state) {
      state.history = [];  // Очищаем всю историю
    },
  },
  actions: {
    // Действие для загрузки истории из localStorage
    loadHistory({ commit }) {
      const savedHistory = localStorage.getItem('movie-history');
      if (savedHistory) {
        commit('setHistory', JSON.parse(savedHistory));
      }
    },
    // Действие для сохранения истории в localStorage
    saveHistory({ state }) {
      localStorage.setItem('movie-history', JSON.stringify(state.history));
    },
    // Действие для добавления фильма в историю
    addToHistory({ commit, state }, movie) {
      commit('addToHistory', movie);
      localStorage.setItem('movie-history', JSON.stringify(state.history)); // Сохраняем сразу
    },    
    removeFromHistory({ commit, dispatch }, kp_id) {
      commit('removeFromHistory', kp_id);
      dispatch('saveHistory');  // Сохраняем обновленную историю в localStorage
    },
    // Очистка истории фильмов старше 30 дней
    cleanOldHistory({ commit, dispatch }) {
      commit('cleanOldHistory');
      dispatch('saveHistory');  // Сохраняем обновленную историю в localStorage
    },
    // Очистка всей истории
    clearAllHistory({ commit, dispatch }) {
      commit('clearAllHistory');
      dispatch('saveHistory');  // Сохраняем обновленную историю в localStorage
    },
  },
});


