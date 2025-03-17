import starsBackground from '@/assets/image-back-stars.png';

const state = {
  backgroundUrl: starsBackground,
  topMoviePoster: '',
  moviePoster: '',
  isBlurActive: false,
  backgroundType: 'stars',
  defaultBackground: starsBackground,
  isCardBorder: false,
};

const mutations = {
  SET_TOP_MOVIE_POSTER(state, url) {
    if (
      state.backgroundType !== 'stars' &&
      state.backgroundType !== 'disabled'
    ) {
      state.topMoviePoster = url;
      if (state.backgroundUrl !== url) {
        state.backgroundUrl = url;
      }
    }
  },

  SET_MOVIE_POSTER(state, url) {
    if (
      state.backgroundType !== 'stars' &&
      state.backgroundType !== 'disabled'
    ) {
      state.moviePoster = url;
      if (state.backgroundUrl !== url) {
        state.backgroundUrl = url;
      }
    }
  },

  SET_BLUR(state, isActive) {
    if (state.backgroundType !== 'stars' && state.backgroundType !== 'disabled') {
      state.isBlurActive = isActive;
    } else {
      state.isBlurActive = false;
    }
  },

  SET_BACKGROUND_TYPE(state, type) {
    state.backgroundType = type;
    if (type === 'dynamic') {
      // Автовключение блюра для динамического фона
      state.isBlurActive = true;
      state.backgroundUrl = state.topMoviePoster;
    } else if (type === 'disabled' || type === 'stars') {
      state.isBlurActive = false;
      if (type === 'disabled') {
        state.backgroundUrl = '';
      } else if (type === 'stars') {
        state.backgroundUrl = starsBackground;
      }
    }
  },

  SET_CARD_BORDER(state, isBorder) {
    state.isCardBorder = isBorder;
  }
};

const actions = {
  updateMoviePoster({ commit, state }, poster) {
    if (state.backgroundType !== 'disabled') {
      commit('SET_MOVIE_POSTER', poster || state.defaultBackground);
    }
  },

  updateTopMoviePoster({ commit, state }, poster) {
    if (state.backgroundType !== 'disabled') {
      commit('SET_TOP_MOVIE_POSTER', poster || state.defaultBackground);
    }
  },

  toggleBlur({ commit, state }, isActive) {
    if (state.backgroundType !== 'stars' && state.backgroundType !== 'disabled') {
      commit('SET_BLUR', isActive);
    }
  },

  updateBackgroundType({ commit }, type) {
    commit('SET_BACKGROUND_TYPE', type);
  },

  toggleCardBorder({ commit }, isBorder) {
    commit('SET_CARD_BORDER', isBorder);
  },
  resetBackground({ commit }){
    commit('SET_BLUR', false);
    commit('SET_BACKGROUND_TYPE', 'stars');
  }
};

const getters = {
  getBackgroundUrl: (state) => state.backgroundUrl,
  getTopMoviePoster: (state) => state.topMoviePoster,
  getMoviePoster: (state) => state.moviePoster,
  isBlurActive: (state) => state.isBlurActive,
  getBackgroundType: (state) => state.backgroundType,
  getCardBorder: (state) => state.isCardBorder,
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};
