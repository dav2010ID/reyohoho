export default {
  namespaced: true,
  state: {
    aspectRatio: '16:9',
    isCentered: false,
    preferredPlayer: '' // Строка, например: 'ALLOHA' или 'TORRENTS'
  },
  mutations: {
    setAspectRatio(state, ratio) {
      state.aspectRatio = ratio
    },
    setCentering(state, isCentered) {
      state.isCentered = isCentered
    },
    setPreferredPlayer(state, player) {
      state.preferredPlayer = player
    },
    clearPreferredPlayer(state) {
      state.preferredPlayer = ''
    }
  },
  actions: {
    updateAspectRatio({ commit }, ratio) {
      commit('setAspectRatio', ratio)
    },
    updateCentering({ commit }, isCentered) {
      commit('setCentering', isCentered)
    },
    updatePreferredPlayer({ commit }, player) {
      commit('setPreferredPlayer', player)
    },
    clearPreferredPlayer({ commit }) {
      commit('clearPreferredPlayer')
    }
  },
  getters: {
    aspectRatio: (state) => state.aspectRatio,
    isCentered: (state) => state.isCentered,
    preferredPlayer: (state) => state.preferredPlayer
  }
}
