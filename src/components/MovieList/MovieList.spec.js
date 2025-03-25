import { CardMovie, CardMovieSwipeWrapper } from '@/components/CardMovie'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createStore } from 'vuex'
import { MovieList } from '.'

const BASE_MOVIES_MOCK = Object.freeze([
  {
    kp_id: '1339266',
    title: 'Dan and the Dino meet John Wick',
    year: 2020,
    type: 'FILM',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
    addedAt: '2025-03-22T11:17:32.811Z'
  },
  {
    kp_id: '738318',
    title: 'Террор',
    year: 2018,
    type: 'TV_SERIES',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
    addedAt: '2025-03-22T11:17:32.370Z'
  },
  {
    kp_id: '1047492',
    title: 'Балерина',
    year: 2025,
    type: 'FILM',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
    addedAt: '2025-03-22T11:17:31.231Z'
  },
  {
    kp_id: '1267348',
    title: 'Джон Уик 4',
    year: 2023,
    type: 'FILM',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
    addedAt: '2025-03-22T11:17:30.818Z'
  },
  {
    kp_id: '762738',
    title: 'Джон Уик',
    year: 2014,
    type: 'FILM',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/762738.jpg',
    addedAt: '2025-03-22T11:17:30.142Z'
  }
])

const removeFromHistory = vi.fn()

function getRandomMovie(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return null
  }

  const randomIndex = Math.floor(Math.random() * arr.length)
  return arr[randomIndex] || null
}

describe('Тесты компонента MovieList', () => {
  let storeMock
  let routerMock
  let windowOpenMock

  function createDateStore(state) {
    return createStore({
      state,
      getters: { 'background/getCardBorder': () => true },
      actions: { removeFromHistory }
    })
  }

  beforeAll(() => {

    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn()
    }

    window.open = vi.fn()

    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(async () => {
    storeMock = createDateStore({
      isMobile: true
    })

    routerMock = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          // eslint-disable-next-line vue/one-component-per-file
          component: defineComponent({
            template: '<div></div>'
          }),
          name: 'home',
          meta: {
            title: 'Reyohoho - Поиск фильмов'
          }
        },
        {
          path: '/movie/:kp_id',
          // eslint-disable-next-line vue/one-component-per-file
          component: defineComponent({
            template: '<div></div>'
          }),
          name: 'movie-info',
          meta: {
            title: 'Reyohoho - Просмотр фильма'
          }
        }
      ]
    })

    windowOpenMock = vi.spyOn(window, 'open')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mountComponent = (
    loading = false,
    isHistory = false,
    customMockStore = null,
    movies = []
  ) => {
    const finalMockStore = customMockStore ? customMockStore : storeMock

    return mount(MovieList, {
      global: {
        plugins: [finalMockStore, routerMock],
        stubs: {
          SpinnerLoading
        }
      },
      props: { moviesList: movies.length ? movies : BASE_MOVIES_MOCK, isHistory, loading },
      attachTo: document.body
    })
  }

  it('Отрисовывает список карточек', () => {
    const wrapper = mountComponent()
    expect(wrapper.findAllComponents(CardMovie)).toHaveLength(BASE_MOVIES_MOCK.length)
    expect(wrapper.findComponent(SpinnerLoading).exists()).toBe(false)
  })

  it('Отображает спиннер при загрузке', () => {
    const wrapper = mountComponent(true)
    expect(wrapper.findComponent(SpinnerLoading).exists()).toBe(true)
  })

  it('Открывается страница фильма при нажатии  на карточку', async () => {
    const wrapper = mountComponent(true)
    const movieDeleteId = getRandomMovie(BASE_MOVIES_MOCK).kp_id
    const movieCardDataTestId = `movie-card-${movieDeleteId}`

    const push = vi.spyOn(routerMock, 'push')

    const card = wrapper.find(`[data-test-id="${movieCardDataTestId}"]`)

    expect(card.exists()).toBe(true)

    await card.trigger('click')

    expect(push).toHaveBeenCalledWith({
      name: 'movie-info',
      params: { kp_id: movieDeleteId }
    })
  })

  it('Удаляет карточку из списка, когда это список историй и декстоп', async () => {
    const wrapper = mountComponent(false, true, createDateStore({ isMobile: false }))
    const movieDeleteId = getRandomMovie(BASE_MOVIES_MOCK).kp_id
    const movieCardDataTestId = `movie-card-${movieDeleteId}`

    const card = wrapper.find(`[data-test-id="${movieCardDataTestId}"]`)
    const deleteBtn = card.find('[data-test-id="delete-button"]')

    expect(card.exists()).toBe(true)
    expect(deleteBtn.exists()).toBe(true)

    await deleteBtn.trigger('click')

    expect(removeFromHistory).toHaveBeenCalledWith(expect.anything(), movieDeleteId)
  })

  it('Не удаляет карточку из списка, когда это НЕ список историй и декстоп', async () => {
    const wrapper = mountComponent(false, false, createDateStore({ isMobile: false }))
    const movieDeleteId = getRandomMovie(BASE_MOVIES_MOCK).kp_id
    const movieCardDataTestId = `movie-card-${movieDeleteId}`

    const card = wrapper.find(`[data-test-id="${movieCardDataTestId}"]`)
    const deleteBtn = card.find('[data-test-id="delete-button"]')

    expect(card.exists()).toBe(true)
    expect(deleteBtn.exists()).toBe(false)
  })

  it('Удаляет карточку из списка свайпом, когда это список историй и мобилка', async () => {
    const wrapper = mountComponent(false, true, createDateStore({ isMobile: true }))
    const randomMovie = getRandomMovie(BASE_MOVIES_MOCK)
    const currentSwipe = wrapper.find(`[data-test-id="movie-card-swipe-wrapper-${randomMovie.kp_id}"]`)
    const currentSwipeWrapper = currentSwipe.find('[data-test-id="swipe-ref-element"]')


    expect(currentSwipeWrapper.exists()).toBe(true)

    // Мокаем offsetWidth
    Object.defineProperty(currentSwipeWrapper.element, 'offsetWidth', {
      value: 300,
      writable: true
    })


    await currentSwipe.trigger('touchstart', {
      touches: [{ clientX: 300 }]
    })
    await currentSwipe.trigger('touchmove', {
      touches: [{ clientX: 49 }]
    })
    await currentSwipe.trigger('touchend')
    vi.advanceTimersByTime(300)

    expect(removeFromHistory).toHaveBeenCalledWith(expect.anything(), randomMovie.kp_id)
  })

  
  it('Не Удаляет карточку из списка свайпом, когда это НЕ список историй и мобилка', async () => {
    const wrapper = mountComponent(false, false, createDateStore({ isMobile: true }))
    const swipeWrappers = wrapper.findAllComponents(CardMovieSwipeWrapper)

    expect(swipeWrappers).toHaveLength(0)

  })

  it('Не удаляет карточку, если свайп слишком короткий, это список историй и мобилка', async () => {
    const wrapper = mountComponent(false, true, createDateStore({ isMobile: true }))
    const randomMovie = getRandomMovie(BASE_MOVIES_MOCK)
    const currentSwipe = wrapper.find(`[data-test-id="movie-card-swipe-wrapper-${randomMovie.kp_id}"]`)
    const currentSwipeWrapper = currentSwipe.find('[data-test-id="swipe-ref-element"]')


    expect(currentSwipeWrapper.exists()).toBe(true)

    // Мокаем offsetWidth
    Object.defineProperty(currentSwipeWrapper.element, 'offsetWidth', {
      value: 300,
      writable: true
    })


    await currentSwipe.trigger('touchstart', {
      touches: [{ clientX: 100 }]
    })
    await currentSwipe.trigger('touchmove', {
      touches: [{ clientX: 30 }]
    })
    await currentSwipe.trigger('touchend')
    vi.advanceTimersByTime(300)

    expect(removeFromHistory).not.toHaveBeenCalled()
  })

  it('Фокус двигается последовательно вправо при нажатии ArrowRight', async () => {
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView')
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      }
    ]

    const wrapper = mountComponent(false, false, undefined, movies)
    const cards = wrapper.findAllComponents(CardMovie)

    // Фокусируем первую карточку
    cards[0].element.focus()
    await flushPromises()

    // Нажмём ArrowRight несколько раз подряд
    // На i-й итерации ожидаем, что фокус будет на cards[i]
    for (let i = 1; i < 4; i++) {
      document.dispatchEvent(arrowRightEvent)
      await flushPromises()

      // Проверяем, что scrollIntoView был вызван
      expect(scrollSpy).toHaveBeenCalled()

      // Проверяем, что теперь фокус на i-й карточке
      expect(document.activeElement).toBe(cards[i].element)
    }
  })

  it('Фокус двигается с последней карточки к первой по ArrowRight (wrap-around)', async () => {
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      }
    ]
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView')
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })

    const wrapper = mountComponent(false, false, undefined, movies)
    const cards = wrapper.findAllComponents(CardMovie)

    // 1. Ставим фокус на первую карточку (индекс 0)
    cards[0].element.focus()
    await flushPromises()
    expect(document.activeElement).toBe(cards[0].element)

    // 2. Прокликиваем ArrowRight (cards.length - 1) раз, чтобы «дойти» до последней карточки
    for (let i = 1; i < cards.length; i++) {
      document.dispatchEvent(arrowRightEvent)
      await flushPromises()
    }

    // Теперь ожидаем фокус на последней карточке (индекс cards.length - 1)
    expect(document.activeElement).toBe(cards[cards.length - 1].element)

    // 3. Ещё одно нажатие ArrowRight — по логике "wrap-around" вернёт нас к первой карточке
    document.dispatchEvent(arrowRightEvent)
    await flushPromises()

    // Проверяем, что фокус действительно снова на первой
    expect(document.activeElement).toBe(cards[0].element)
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('Фокус двигается к последней карточке по ArrowLeft и продолжает двигаться влево', async () => {
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      },

      {
        kp_id: '762738',
        title: 'Джон Уик',
        year: 2014,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/762738.jpg',
        addedAt: '2025-03-22T11:17:30.142Z'
      }
    ]
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView')
    const arrowLeftEvent = new window.KeyboardEvent('keydown', { key: 'ArrowLeft' })

    const wrapper = mountComponent(false, false, undefined, movies)
    const cards = wrapper.findAllComponents(CardMovie)

    // Шаг 1. Фокусируем первую карточку (индекс 0).
    cards[0].element.focus()
    await flushPromises()

    expect(document.activeElement).toBe(cards[0].element)

    // Шаг 2. Нажимаем ArrowLeft один раз → ожидаем перейти с 0 к последней карточке (индекс length - 1).
    document.dispatchEvent(arrowLeftEvent)
    await flushPromises()

    expect(scrollSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(cards[cards.length - 1].element)

    // Шаг 3. Ещё два раза ArrowLeft:
    //  - первое нажатие: индекс (length - 2)
    //  - второе нажатие: индекс (length - 3)
    document.dispatchEvent(arrowLeftEvent)
    document.dispatchEvent(arrowLeftEvent)
    await flushPromises()

    expect(scrollSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(cards[cards.length - 3].element)
  })

  it('Фокус двигается на 5 карточек вверх (или к первой) по ArrowUp', async () => {
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      },
      {
        kp_id: '762738',
        title: 'Джон Уик',
        year: 2014,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/762738.jpg',
        addedAt: '2025-03-22T11:17:30.142Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '79848',
        title: 'Сопрано',
        year: 1999,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/79848.jpg',
        addedAt: '2025-03-22T11:17:23.875Z'
      }
    ]
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView')
    const wrapper = mountComponent(false, false, undefined, movies)
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })
    const arrowUpEvent = new window.KeyboardEvent('keydown', { key: 'ArrowUp' })

    // Допустим, у нас минимум 7 карточек, чтобы был смысл проверять -5.
    const cards = wrapper.findAllComponents(CardMovie)
    expect(cards.length).toBeGreaterThanOrEqual(7)

    // Шаг 1: фокусим первую карточку
    cards[0].element.focus()
    await flushPromises()
    expect(document.activeElement).toBe(cards[0].element)

    // Шаг 2: переходим вправо 6 раз, чтобы оказаться на карточке с индексом 6
    for (let i = 0; i < 6; i++) {
      document.dispatchEvent(arrowRightEvent)
      await flushPromises()
    }
    expect(document.activeElement).toBe(cards[6].element)

    // Шаг 3: Нажимаем ArrowUp — должно перекинуть к карточке с индексом 1 (6 - 5 = 1)
    document.dispatchEvent(arrowUpEvent)
    await flushPromises()

    // Проверяем, что фокус теперь на карточке [1]
    expect(scrollSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(cards[1].element)

    // Шаг 4: Ещё раз ArrowUp — теперь (1 - 5) = -4, но берём max(-4, 0) => 0
    document.dispatchEvent(arrowUpEvent)
    await flushPromises()

    // Фокус должен вернуться к карточке [0]
    expect(scrollSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(cards[0].element)
  })

  it('Фокус двигается на 5 карточек вниз (или к последней) по ArrowDown', async () => {
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      },
      {
        kp_id: '762738',
        title: 'Джон Уик',
        year: 2014,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/762738.jpg',
        addedAt: '2025-03-22T11:17:30.142Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '79848',
        title: 'Сопрано',
        year: 1999,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/79848.jpg',
        addedAt: '2025-03-22T11:17:23.875Z'
      }
    ]
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView')
    const wrapper = mountComponent(false, false, undefined, movies)
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })
    const arrowDownEvent = new window.KeyboardEvent('keydown', { key: 'ArrowDown' })

    // Предполагаем, что у нас минимум 7 карточек
    const cards = wrapper.findAllComponents(CardMovie)
    expect(cards.length).toBeGreaterThanOrEqual(7)

    // 1. Фокусируем первую карточку (индекс 0)
    cards[0].element.focus()
    await flushPromises()
    expect(document.activeElement).toBe(cards[0].element)

    // 2. Для примера перейдём вправо 1 раз (необязательно, но пусть будет)
    document.dispatchEvent(arrowRightEvent)
    await flushPromises()
    // Теперь ожидаем фокус на карточке [1]
    expect(document.activeElement).toBe(cards[1].element)

    // 3. Нажимаем ArrowDown — должно перескочить к карточке [6] (1 + 5 = 6)
    document.dispatchEvent(arrowDownEvent)
    await flushPromises()

    expect(scrollSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(cards[6].element)

    // 4. Ещё раз ArrowDown — (6 + 5 = 11), но если у нас всего 7 карточек, maxIndex = 6
    // Значит сместится к последней карточке (индекс 6).
    document.dispatchEvent(arrowDownEvent)
    await flushPromises()
    expect(scrollSpy).toHaveBeenCalled()

    // Фокус остаётся (или переходит) на последнюю карточку
    expect(document.activeElement).toBe(cards[cards.length - 1].element)
  })

  it('Фокус двигается к первой карточке, при нажатии Home', async () => {
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView')
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })
    const homeEvent = new window.KeyboardEvent('keydown', { key: 'Home' })
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      }
    ]

    const wrapper = mountComponent(false, false, undefined, movies)
    const cards = wrapper.findAllComponents(CardMovie)

    cards[0].element.focus()
    await flushPromises()

    document.dispatchEvent(arrowRightEvent)
    document.dispatchEvent(arrowRightEvent)
    await flushPromises()


    document.dispatchEvent(homeEvent)
    await flushPromises()

    expect(scrollSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(cards[0].element)
  })

  it('Фокус двигается к последней карточке, при нажатии End', async () => {
    const scrollSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView')
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })
    const endEvent = new window.KeyboardEvent('keydown', { key: 'End' })
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      }
    ]

    const wrapper = mountComponent(false, false, undefined, movies)
    const cards = wrapper.findAllComponents(CardMovie)

    cards[0].element.focus()
    await flushPromises()

    document.dispatchEvent(arrowRightEvent)
    document.dispatchEvent(arrowRightEvent)
    await flushPromises()


    document.dispatchEvent(endEvent)
    await flushPromises()

    expect(scrollSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(cards[cards.length - 1].element)
  })

  it('Открывает карточку через router.push при нажатии Enter (без ctrl/meta)', async () => {
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      }
    ]
    const pushSpy = vi.spyOn(routerMock, 'push')
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })
    const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter' })
    const wrapper = mountComponent(false, false, undefined, movies)

    const cards = wrapper.findAllComponents(CardMovie)

    // 1. Фокус на первой карточке
    cards[0].element.focus()
    await flushPromises()

    // 2. Переходим ArrowRight к следующей, чтобы проверить не "нулевой" индекс
    document.dispatchEvent(arrowRightEvent)
    await flushPromises()

    // 3. Жмём Enter (без ctrlKey/metaKey)
    document.dispatchEvent(enterEvent)
    await flushPromises()

    // Проверяем, что открылся роут "movie-info" с нужным kp_id
    const expectedKpId = movies[1].kp_id
    expect(pushSpy).toHaveBeenCalledWith({
      name: 'movie-info',
      params: { kp_id: expectedKpId }
    })

    // Проверяем, что окно НЕ открылось
    expect(windowOpenMock).not.toHaveBeenCalled()
  })

  it('Открывает карточку в новом окне при нажатии Ctrl+Enter', async () => {
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      }
    ]
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })
    const ctrlEnterEvent = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      cancelable: true
    })
    const wrapper = mountComponent(false, false, undefined, movies)


    const cards = wrapper.findAllComponents(CardMovie)

    cards[0].element.focus()
    await flushPromises()

    // 2. Переходим на третью карточку (два ArrowRight), чтобы проверить ctrl+Enter не всегда на 0-м элементе
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(arrowRightEvent)
      await flushPromises()
    }

    // 3. Нажимаем Enter с ctrlKey = true (или metaKey = true, аналогично)
    document.dispatchEvent(ctrlEnterEvent)
    await flushPromises()

    // Проверяем, что окно открылось с URL карточки [2]
    const expectedKpId = movies[2].kp_id
    const expectedUrl = `/movie/${expectedKpId}`
    expect(windowOpenMock).toHaveBeenCalledWith(expectedUrl, '_blank')
    expect(ctrlEnterEvent.defaultPrevented).toBe(true) // защита от открытия ссылки без нового окна
  })

  it('Открывает карточку в новом окне при нажатии Ctrl+Enter (metaKey)', async () => {
    const movies = [
      {
        kp_id: '1339266',
        title: 'Dan and the Dino meet John Wick',
        year: 2020,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1339266.jpg',
        addedAt: '2025-03-22T11:17:32.811Z'
      },
      {
        kp_id: '738318',
        title: 'Террор',
        year: 2018,
        type: 'TV_SERIES',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/738318.jpg',
        addedAt: '2025-03-22T11:17:32.370Z'
      },
      {
        kp_id: '1047492',
        title: 'Балерина',
        year: 2025,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047492.jpg',
        addedAt: '2025-03-22T11:17:31.231Z'
      },
      {
        kp_id: '1267348',
        title: 'Джон Уик 4',
        year: 2023,
        type: 'FILM',
        poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1267348.jpg',
        addedAt: '2025-03-22T11:17:30.818Z'
      }
    ]
    const arrowRightEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' })
    const ctrlEnterEvent = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      cancelable: true
    })
    const wrapper = mountComponent(false, false, undefined, movies)


    const cards = wrapper.findAllComponents(CardMovie)

    cards[0].element.focus()
    await flushPromises()

    // 2. Переходим на третью карточку (два ArrowRight), чтобы проверить ctrl+Enter не всегда на 0-м элементе
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(arrowRightEvent)
      await flushPromises()
    }

    // 3. Нажимаем Enter с ctrlKey = true (или metaKey = true, аналогично)
    document.dispatchEvent(ctrlEnterEvent)
    await flushPromises()

    // Проверяем, что окно открылось с URL карточки [2]
    const expectedKpId = movies[2].kp_id
    const expectedUrl = `/movie/${expectedKpId}`
    expect(windowOpenMock).toHaveBeenCalledWith(expectedUrl, '_blank')
    expect(ctrlEnterEvent.defaultPrevented).toBe(true) // защита от открытия ссылки без нового окна
  })
})