export default {
  namespaced: true,
  state: () => ({
    backgroundType: 'stars', // 'none', 'stars', 'dynamic'
    isBlurEnabled: false,
    starsBackground: new URL('/src/assets/image-back-stars.png', import.meta.url).href,
    currentMovieBackground: null,
  }),
  mutations: {
    SET_MOVIE_BACKGROUND(state, url) {
      state.currentMovieBackground = url;
    },
    TOGGLE_BLUR(state) {
      state.isBlurEnabled = !state.isBlurEnabled;
    },
    SET_BACKGROUND_TYPE(state, type) {
      state.backgroundType = type;
    },
    CYCLE_BACKGROUND_TYPE(state) {
      const types = ['none', 'stars', 'dynamic'];
      const currentIndex = types.indexOf(state.backgroundType);
      state.backgroundType = types[(currentIndex + 1) % types.length];
    },
    SET_BLUR(state, value) {
      state.isBlurEnabled = value;
    },
  },
  actions: {
    async updateMovieBackground({ commit }, url) {
      commit('SET_MOVIE_BACKGROUND', url);
    },
    resetBackground({ commit }) {
      commit('SET_MOVIE_BACKGROUND', null);
      commit('SET_BACKGROUND_TYPE', 'stars');
      commit('SET_BLUR', false);
    },
    toggleBlur({ commit }) {
      commit('TOGGLE_BLUR');
    },
    setBlur({ commit }, value) {
      commit('SET_BLUR', value);
    },
    setBackgroundType({ commit }, type) {
      commit('SET_BACKGROUND_TYPE', type);
    },
    cycleBackgroundType({ commit }) {
      commit('CYCLE_BACKGROUND_TYPE');
    },
  },
  getters: {
    currentBackground: (state) => {
      if (state.backgroundType === 'none') return null;
      return state.backgroundType === 'stars'
        ? state.starsBackground
        : state.currentMovieBackground;
    },
    backgroundStyle: (_, getters) => {
      const bg = getters.currentBackground;
      return bg ? {
        backgroundImage: `url(${bg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : {};
    },
  },
};
