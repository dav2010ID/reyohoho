import { useMainStore } from '@/store/main'
import * as rhserv from '@/api/movies.rhserv'
import * as kinobd from '@/api/movies.kinobd'

const CONTENT_PROVIDERS = {
  RHSERV: 'rhserv',
  KINOBD: 'kinobd'
}

const KINOBD_SUPPORTED_METHODS = new Set([
  'apiSearch',
  'getKpInfo',
  'getPlayers',
  'getMovies',
  'getDiscussedMovies',
  'getKpIDfromIMDB',
  'getRandomMovie'
])

const getCurrentProvider = () => {
  try {
    const mainStore = useMainStore()
    return mainStore.contentApiProvider || CONTENT_PROVIDERS.RHSERV
  } catch {
    return CONTENT_PROVIDERS.RHSERV
  }
}

const searchKinoBDPlayerCandidates = async (...args) => kinobd.searchPlayerCandidates(...args)
const getKinoBDPlayerDataByInid = async (...args) => kinobd.getPlayerDataByInid(...args)

const callWithProvider = async (methodName, ...args) => {
  const provider = getCurrentProvider()

  if (provider === CONTENT_PROVIDERS.KINOBD && KINOBD_SUPPORTED_METHODS.has(methodName)) {
    try {
      return await kinobd[methodName](...args)
    } catch (error) {
      console.warn(`[movies] ${methodName} failed on KinoBD, fallback to RHServ`, error)
      return await rhserv[methodName](...args)
    }
  }

  return await rhserv[methodName](...args)
}

const apiSearch = async (...args) => callWithProvider('apiSearch', ...args)
const getShikiInfo = async (...args) => callWithProvider('getShikiInfo', ...args)
const getKpInfo = async (...args) => callWithProvider('getKpInfo', ...args)
const getPlayers = async (...args) => callWithProvider('getPlayers', ...args)
const getShikiPlayers = async (...args) => callWithProvider('getShikiPlayers', ...args)
// Top lists must always come from original RHServ API.
const getMovies = async (...args) => rhserv.getMovies(...args)
const getDiscussedMovies = async (...args) => rhserv.getDiscussedMovies(...args)
const getDons = async (...args) => callWithProvider('getDons', ...args)
const getKpIDfromIMDB = async (...args) => callWithProvider('getKpIDfromIMDB', ...args)
const getNudityInfoFromIMDB = async (...args) => callWithProvider('getNudityInfoFromIMDB', ...args)
const getKpIDfromSHIKI = async (...args) => callWithProvider('getKpIDfromSHIKI', ...args)
const getRating = async (...args) => callWithProvider('getRating', ...args)
const setRating = async (...args) => callWithProvider('setRating', ...args)
const getComments = async (...args) => callWithProvider('getComments', ...args)
const createComment = async (...args) => callWithProvider('createComment', ...args)
const updateComment = async (...args) => callWithProvider('updateComment', ...args)
const deleteComment = async (...args) => callWithProvider('deleteComment', ...args)
const rateComment = async (...args) => callWithProvider('rateComment', ...args)
const submitTiming = async (...args) => callWithProvider('submitTiming', ...args)
const updateTiming = async (...args) => callWithProvider('updateTiming', ...args)
const deleteTiming = async (...args) => callWithProvider('deleteTiming', ...args)
const reportTiming = async (...args) => callWithProvider('reportTiming', ...args)
const getTopTimingSubmitters = async (...args) => callWithProvider('getTopTimingSubmitters', ...args)
const getAllTimingSubmissions = async (...args) => callWithProvider('getAllTimingSubmissions', ...args)
const getRandomMovie = async (...args) => callWithProvider('getRandomMovie', ...args)
const approveTiming = async (...args) => callWithProvider('approveTiming', ...args)
const rejectTiming = async (...args) => callWithProvider('rejectTiming', ...args)
const markAsCleanText = async (...args) => callWithProvider('markAsCleanText', ...args)
const getTwitchStream = async (...args) => callWithProvider('getTwitchStream', ...args)
const voteOnTiming = async (...args) => callWithProvider('voteOnTiming', ...args)
const getTimingVote = async (...args) => callWithProvider('getTimingVote', ...args)
const getMovieNote = async (...args) => callWithProvider('getMovieNote', ...args)
const saveMovieNote = async (...args) => callWithProvider('saveMovieNote', ...args)
const deleteMovieNote = async (...args) => callWithProvider('deleteMovieNote', ...args)

export {
  searchKinoBDPlayerCandidates,
  getKinoBDPlayerDataByInid,
  apiSearch,
  getShikiInfo,
  getKpInfo,
  getPlayers,
  getShikiPlayers,
  getMovies,
  getDiscussedMovies,
  getDons,
  getKpIDfromIMDB,
  getKpIDfromSHIKI,
  getRating,
  setRating,
  getNudityInfoFromIMDB,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  rateComment,
  submitTiming,
  updateTiming,
  deleteTiming,
  reportTiming,
  getTopTimingSubmitters,
  getAllTimingSubmissions,
  getRandomMovie,
  approveTiming,
  rejectTiming,
  markAsCleanText,
  getTwitchStream,
  voteOnTiming,
  getTimingVote,
  getMovieNote,
  saveMovieNote,
  deleteMovieNote
}

export const toggleErrorSimulation = (enabled) => {
  if (typeof rhserv.toggleErrorSimulation === 'function') {
    rhserv.toggleErrorSimulation(enabled)
  }
  if (typeof kinobd.toggleErrorSimulation === 'function') {
    kinobd.toggleErrorSimulation(enabled)
  }
}

