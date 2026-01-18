<template>
  <div class="movie-info">
    <div class="content">
      <div v-if="(infoLoading || !movieInfo) && !errorMessage" class="content-card">
        <div class="movie-skeleton">
          <div class="movie-skeleton__header">
            <div class="movie-skeleton__title"></div>
          </div>

          <div class="movie-skeleton__ratings">
            <div class="movie-skeleton__rating-item"></div>
            <div class="movie-skeleton__rating-item"></div>
            <div class="movie-skeleton__rating-item"></div>
          </div>

          <div class="movie-skeleton__player">
            <SpinnerLoading />
          </div>

          <div class="movie-skeleton__additional-info">
            <div class="movie-skeleton__section-title"></div>
            <div class="movie-skeleton__info-list">
              <div class="movie-skeleton__info-item"></div>
              <div class="movie-skeleton__info-item"></div>
              <div class="movie-skeleton__info-item"></div>
              <div class="movie-skeleton__info-item"></div>
              <div class="movie-skeleton__info-item"></div>
            </div>
          </div>

          <div class="movie-skeleton__description">
            <div class="movie-skeleton__description-line"></div>
            <div class="movie-skeleton__description-line"></div>
            <div class="movie-skeleton__description-line"></div>
            <div class="movie-skeleton__description-line"></div>
          </div>
        </div>
      </div>

      <ErrorMessage v-if="errorMessage" :message="errorMessage" :code="errorCode" />

      <div v-if="errorMessage" class="content-card">
        <PlayerComponent
          :key="kp_id"
          :kp-id="kp_id"
          :movie-info="movieInfo"
          @update:movie-info="fetchMovieInfo"
        />
      </div>

      <div v-if="movieInfo && !infoLoading" class="content-card">
        <div class="content-header">
          <div
            v-if="movieInfo.logo_url"
            class="content-logo"
            @mousemove="moveTooltip"
            @mouseleave="titleCopyTooltip = false"
            @click="copyMovieMeta"
          >
            <img :src="movieInfo.logo_url" alt="Логотип фильма" class="content-logo" />
          </div>
          <div
            v-else
            @mousemove="moveTooltip"
            @mouseleave="titleCopyTooltip = false"
            @click="copyMovieMeta"
          >
            <h1 class="content-title">
              {{ movieInfo.title }}
            </h1>
          </div>

          <div v-show="titleCopyTooltip" class="title-copy-tooltip" :style="tooltipStyle">
            Скопировать
          </div>
        </div>

        <div
          v-if="
            movieInfo.kinopoisk_id ||
            movieInfo.title ||
            movieInfo.imdb_id ||
            movieInfo.rating_imdb ||
            movieInfo.shikimori_id
          "
          class="ratings-links"
        >
          <MovieRating
            v-if="movieInfo.kinopoisk_id"
            :key="movieInfo.kinopoisk_id"
            :kp-id="movieInfo.kinopoisk_id"
            :show-dash="true"
          />

          <!-- Кинопоиск -->
          <div v-if="movieInfo.kinopoisk_id">
            <a
              :href="`https://www.kinopoisk.ru/film/${movieInfo.kinopoisk_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
              :title="
                movieInfo.rating_kinopoisk_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_kinopoisk_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_kinopoisk)">
                {{ movieInfo.rating_kinopoisk ? movieInfo.rating_kinopoisk : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- Поиск на Кинопоиске, если нет ID -->
          <div v-if="!movieInfo.kinopoisk_id && movieInfo.title">
            <a
              :href="`https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(movieInfo.title + (movieInfo.year ? ' ' + movieInfo.year : ''))}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
              :title="
                movieInfo.rating_kinopoisk_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_kinopoisk_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-kp-logo.svg" alt="КП" class="rating-logo" />
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_kinopoisk)">
                {{ movieInfo.rating_kinopoisk ? movieInfo.rating_kinopoisk : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- IMDb -->
          <div v-if="movieInfo.imdb_id">
            <a
              :href="`https://www.imdb.com/title/${movieInfo.imdb_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
              :title="
                movieInfo.rating_imdb_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_imdb_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_imdb)">
                {{ movieInfo.rating_imdb ? movieInfo.rating_imdb : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- Поиск на IMDb, если нет ID -->
          <div v-if="!movieInfo.imdb_id && movieInfo.title">
            <a
              :href="`https://www.imdb.com/find/?q=${encodeURIComponent(movieInfo.title + (movieInfo.year ? ' ' + movieInfo.year : ''))}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
              :title="
                movieInfo.rating_imdb_vote_count
                  ? `Оценок: ${formatRatingNumber(movieInfo.rating_imdb_vote_count)}`
                  : 'Нет данных о количестве голосов'
              "
            >
              <img src="/src/assets/icon-imdb-logo.svg" alt="IMDb" class="rating-logo" />
              <span class="rating-value" :class="getRatingColor(movieInfo.rating_imdb)">
                {{ movieInfo.rating_imdb ? movieInfo.rating_imdb : '—' }}
              </span>
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <!-- Shikimori -->
          <div v-if="movieInfo.shikimori_id">
            <a
              :href="`https://shikimori.one/animes/${movieInfo.shikimori_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="rating-link"
            >
              <img src="/src/assets/icon-shikimori.svg" alt="Shiki" class="rating-logo" />
              <img
                src="/src/assets/icon-external-link.png"
                alt="Внешняя ссылка"
                class="external-link-icon"
              />
            </a>
          </div>

          <span class="action-buttons-group">
            <template v-if="movieInfo.imdb_id">
              <button
                class="nudity-info-btn parents-guide-btn"
                @click="showNudityInfo($event)"
                @mousedown="handleMiddleClick($event)"
                :title="
                  nudityInfo ? 'Скрыть информацию' : 'Показать Parents Guide и информацию о сценах'
                "
              >
                <span class="desktop-text">Parents Guide</span>
                <span class="mobile-text">PG</span>
                <i v-if="!nudityInfoLoading" class="fa-regular fa-face-grin-wink"></i>
                <i v-else class="fas fa-spinner fa-spin"></i>
              </button>
            </template>
            <button
              class="nudity-info-btn"
              @click="showNudityTimings($event)"
              :title="
                nudityTimings !== undefined
                  ? 'Скрыть тайминги'
                  : 'Показать тайминги сцен 18+(для твича, мигание отключается в настройках)'
              "
            >
              <i
                class="fa-regular fa-clock"
                :class="{ 'text-red': shouldShowRedTimings, 'text-red-blink': shouldBlinkRedTimings }"
              ></i>
              <span class="mobile-text">Тайминги</span>
            </button>
            <button
              v-if="authStore.token"
              class="nudity-info-btn note-btn"
              @click="toggleNoteEditor"
              :class="{ 'has-note': movieNote }"
              :title="movieNote ? 'Редактировать заметку' : 'Добавить заметку'"
            >
              <i class="fa-regular fa-note-sticky"></i>
              <span class="mobile-text">Заметка</span>
            </button>
          </span>
        </div>

        <!-- Интеграция компонента плеера -->
        <PlayerComponent
          :key="kp_id"
          :kp-id="kp_id"
          :movie-info="movieInfo"
          @update:movie-info="fetchMovieInfo"
        />

        <div v-if="mainStore.isMobile" class="mobile-list-dropdown">
          <button class="mobile-list-toggle" :class="{}" @click="isListExpanded = !isListExpanded">
            <span class="material-icons" :class="{ active: isInAnyList }">{{
              isInAnyList ? 'bookmark_added' : 'bookmark_border'
            }}</span>
            <span class="button-label">Добавить в список</span>
            <span class="material-icons dropdown-arrow" :class="{ expanded: isListExpanded }"
              >expand_more</span
            >
          </button>

          <div v-show="isListExpanded" class="mobile-list-content">
            <button
              class="mobile-list-btn"
              :class="{}"
              @click="toggleList(USER_LIST_TYPES_ENUM.FAVORITE)"
            >
              <span class="material-icons" :class="{ active: movieInfo?.lists?.isFavorite }">{{
                movieInfo?.lists?.isFavorite ? 'favorite' : 'favorite_border'
              }}</span>
              <span class="button-label">В избранное</span>
            </button>

            <button
              class="mobile-list-btn"
              :class="{}"
              @click="toggleList(USER_LIST_TYPES_ENUM.WATCHING)"
            >
              <span class="material-icons" :class="{ active: movieInfo?.lists?.isWatching }">{{
                movieInfo?.lists?.isWatching ? 'visibility' : 'visibility_off'
              }}</span>
              <span class="button-label">Смотрю</span>
            </button>

            <button
              class="mobile-list-btn"
              :class="{}"
              @click="toggleList(USER_LIST_TYPES_ENUM.LATER)"
            >
              <span class="material-icons" :class="{ active: movieInfo?.lists?.isLater }"
                >watch_later</span
              >
              <span class="button-label">Позже</span>
            </button>

            <button
              class="mobile-list-btn"
              :class="{}"
              @click="toggleList(USER_LIST_TYPES_ENUM.COMPLETED)"
            >
              <span class="material-icons" :class="{ active: movieInfo?.lists?.isCompleted }">{{
                movieInfo?.lists?.isCompleted ? 'check_circle' : 'check_circle_outline'
              }}</span>
              <span class="button-label">Просмотрено</span>
            </button>

            <button
              class="mobile-list-btn"
              :class="{}"
              @click="toggleList(USER_LIST_TYPES_ENUM.ABANDONED)"
            >
              <span class="material-icons" :class="{ active: movieInfo?.lists?.isAbandoned }"
                >not_interested</span
              >
              <span class="button-label">Брошено</span>
            </button>
          </div>
        </div>

        <meta
          name="title-and-year"
          :content="
            movieInfo.type === 'FILM' && movieInfo.year
              ? `${movieInfo.title} (${movieInfo.year})`
              : movieInfo.title
          "
        />

        <meta
          v-if="movieInfo.name_original"
          name="original-title"
          :content="movieInfo.name_original"
        />
        <div class="additional-info">
          <h2 class="additional-info-title">Подробнее</h2>
          <div class="info-content">
            <div v-if="movieInfo.poster_url" class="movie-poster-container desktop-only">
              <a :href="movieInfo.poster_url" target="_blank" rel="noopener noreferrer">
                <img :src="movieInfo.poster_url" alt="Постер фильма" class="movie-poster" />
              </a>
            </div>
            <div class="details-container">
              <ul class="info-list">
                <li v-if="movieInfo.type && TYPES_ENUM[movieInfo.type]">
                  <strong>Тип:</strong> {{ TYPES_ENUM[movieInfo.type] }}
                </li>
                <li v-if="movieInfo.year"><strong>Год выпуска:</strong> {{ movieInfo.year }}</li>
                <li v-if="movieInfo.title"><strong>Название:</strong> {{ movieInfo.title }}</li>
                <li v-if="movieInfo.name_original">
                  <strong>Оригинальное название:</strong> {{ movieInfo.name_original }}
                </li>
                <li v-if="movieInfo.slogan"><strong>Слоган:</strong> {{ movieInfo.slogan }}</li>
                <li v-if="movieInfo.production_companies">
                  <strong>Продакшн:</strong> {{ movieInfo.production_companies }}
                </li>
                <li v-if="movieInfo.countries?.length">
                  <strong>Страна производства:</strong>
                  {{ movieInfo.countries.map((item) => item.country).join(', ') }}
                </li>
                <li v-if="movieInfo.genres?.length">
                  <strong>Жанры:</strong>
                  {{ movieInfo.genres.map((item) => item.genre).join(', ') }}
                </li>
                <li v-if="movieInfo.film_length">
                  <strong>Продолжительность:</strong> {{ formatTime(movieInfo.film_length) }}
                </li>
                <li
                  v-if="movieInfo.rating_mpaa || movieInfo.rating_age_limits"
                  class="rating-boxes"
                >
                  <div v-if="movieInfo.rating_mpaa" class="rating-box mpaa">
                    <strong>MPAA</strong>
                    <span>{{ movieInfo.rating_mpaa.toUpperCase() }}</span>
                  </div>
                  <div v-if="movieInfo.rating_age_limits" class="rating-box age">
                    <strong>{{ movieInfo.rating_age_limits.replace('age', '') }}+</strong>
                  </div>
                </li>
              </ul>
              <div class="content-info">
                <p v-if="movieInfo.description" class="content-description-text">
                  {{ movieInfo.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="movieNote && authStore.token" class="movie-note-display">
          <div class="movie-note-header">
            <div class="movie-note-title">
              <i class="fa-solid fa-note-sticky"></i>
              <h3>Моя заметка</h3>
            </div>
            <div class="movie-note-actions">
              <button class="note-edit-btn" @click="toggleNoteEditor" title="Редактировать">
                <i class="fas fa-edit"></i>
              </button>
            </div>
          </div>
          <div class="movie-note-content">
            {{ movieNote.note_text }}
          </div>
          <div class="movie-note-footer">
            <span class="note-date">
              <i class="far fa-calendar"></i>
              Обновлено:
              {{
                new Date(movieNote.updated_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }}
            </span>
          </div>
        </div>

        <div v-if="isCommentsEnabled" class="comments-section">
          <Comments :movie-id="kp_id" :key="kp_id" />
        </div>

        <div v-if="movieInfo.staff" class="staff-section">
          <div class="staff-categories">
            <div v-if="getStaffByProfession('ACTOR').length" class="staff-category">
              <h3 class="additional-info-title">Актёры</h3>
              <div class="staff-list">
                <div
                  v-for="person in getStaffByProfession('ACTOR').slice(0, 12)"
                  :key="person.staff_id"
                  class="staff-item"
                >
                  <a
                    :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="staff-link"
                    :title="person.description || ''"
                  >
                    <img :src="person.poster_url" :alt="person.name_ru" class="staff-photo" />
                    <span class="staff-name">{{ person.name_ru || person.name_en }}</span>
                    <span v-if="person.description" class="staff-role">{{
                      person.description
                    }}</span>
                  </a>
                </div>
                <a
                  class="expand-actors-circle-button"
                  :href="`https://www.kinopoisk.ru/film/${kp_id}/cast/`"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="`Показать всех ${getStaffByProfession('ACTOR').length} актеров`"
                >
                  +{{ getStaffByProfession('ACTOR').length - 12 }}
                </a>
              </div>
            </div>

            <div v-if="getStaffByProfession('DIRECTOR').length" class="staff-category">
              <h3 class="additional-info-title">Режиссёры</h3>
              <div class="staff-names-container">
                <div class="staff-names-list">
                  <a
                    v-for="person in getStaffByProfession('DIRECTOR').slice(0, 5)"
                    :key="person.staff_id"
                    :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="staff-name-link"
                  >
                    {{ person.name_ru || person.name_en }}
                  </a>
                  <a
                    v-if="getStaffByProfession('DIRECTOR').length > 5"
                    class="expand-actors-circle-button"
                    :href="`https://www.kinopoisk.ru/film/${kp_id}/cast/`"
                    target="_blank"
                    rel="noopener noreferrer"
                    :title="`Показать всех ${getStaffByProfession('DIRECTOR').length} режиссёров`"
                  >
                    +{{ getStaffByProfession('DIRECTOR').length - 5 }}
                  </a>
                </div>
              </div>
            </div>

            <div v-if="getStaffByProfession('PRODUCER').length" class="staff-category">
              <h3 class="additional-info-title">Продюсеры</h3>
              <div class="staff-names-container">
                <div class="staff-names-list">
                  <a
                    v-for="person in getStaffByProfession('PRODUCER').slice(0, 5)"
                    :key="person.staff_id"
                    :href="`https://www.kinopoisk.ru/name/${person.staff_id}/`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="staff-name-link"
                  >
                    {{ person.name_ru || person.name_en }}
                  </a>
                  <a
                    v-if="getStaffByProfession('PRODUCER').length > 5"
                    class="expand-actors-circle-button"
                    :href="`https://www.kinopoisk.ru/film/${kp_id}/cast/`"
                    target="_blank"
                    rel="noopener noreferrer"
                    :title="`Показать всех ${getStaffByProfession('PRODUCER').length} продюсеров`"
                  >
                    +{{ getStaffByProfession('PRODUCER').length - 5 }}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="videos.length && areTrailersActive" class="yt-video-container">
          <TrailerCarousel
            :videos="videos"
            :active-video-index="activeTrailerIndex"
            @select="playTrailer"
          />
        </div>

        <!-- Секция с сиквелами и приквелами -->
        <div v-if="sequelsAndPrequels.length" class="related-movies">
          <h2>Сиквелы и приквелы</h2>
          <MovieList
            :movies-list="
              showAllSequels ? sequelsAndPrequels : sequelsAndPrequels.slice(0, itemsPerRow)
            "
            :loading="false"
            :is-history="false"
            class="related-movies-list"
          />
          <a
            v-if="sequelsAndPrequels.length > itemsPerRow"
            class="expand-circle-button"
            @click="showAllSequels = !showAllSequels"
            :title="`${showAllSequels ? 'Скрыть' : 'Показать все'} (${sequelsAndPrequels.length})`"
          >
            {{ showAllSequels ? '−' : `+${sequelsAndPrequels.length - itemsPerRow}` }}
          </a>
        </div>

        <!-- Секция с похожими фильмами -->
        <div v-if="similars.length" class="related-movies">
          <h2>Похожие</h2>
          <MovieList
            :movies-list="showAllSimilars ? similars : similars.slice(0, itemsPerRow)"
            :loading="false"
            :is-history="false"
            class="related-movies-list"
          />
          <a
            v-if="similars.length > itemsPerRow"
            class="expand-circle-button"
            @click="showAllSimilars = !showAllSimilars"
            :title="`${showAllSimilars ? 'Скрыть' : 'Показать все'} (${similars.length})`"
          >
            {{ showAllSimilars ? '−' : `+${similars.length - itemsPerRow}` }}
          </a>
        </div>
      </div>
    </div>
  </div>
  <Notification ref="notificationRef" />
  <div v-if="nudityInfo !== null" class="nudity-info-popup">
    <div class="nudity-info-content">
      <div v-if="nudityInfoLoading" class="nudity-info-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Загрузка информации...</span>
      </div>
      <div v-else>
        {{ nudityInfo }}
      </div>
    </div>
    <div class="nudity-info-actions">
      <a
        :href="`https://www.imdb.com/title/${movieInfo.imdb_id}/parentalguide`"
        target="_blank"
        rel="noopener noreferrer"
        class="nudity-info-button"
      >
        <i class="fas fa-external-link-alt"></i>
        <span>Parents Guide</span>
      </a>
      <button class="nudity-info-button" @click="copyNudityInfo">
        <i class="fas fa-copy"></i>
        <span>Copy</span>
      </button>
      <button class="nudity-info-button" @click="openInGoogleTranslate">
        <i class="fas fa-language"></i>
        <span>Translate</span>
      </button>
    </div>
  </div>
  <div v-if="nudityTimings !== undefined" class="nudity-info-popup">
    <div class="nudity-info-content">
      <div class="acknowledgment-table">
        <div class="acknowledgment-header">
          <i class="fa-solid fa-heart"></i>
          <span>Благодарности</span>
        </div>
        <div class="acknowledgment-content">
          <div class="acknowledgment-row">
            <a
              href="https://www.twitch.tv/tanyabelkova"
              target="_blank"
              rel="noopener noreferrer"
              class="twitch-link"
            >
              <i class="fa-brands fa-twitch"></i>
              <span>TanyaBelkova</span>
            </a>
            <span class="acknowledgment-text">— за основу базы таймингов</span>
          </div>
          <div class="acknowledgment-row clickable" @click="showTopSubmitters">
            <div class="community-link">
              <i class="fa-solid fa-users"></i>
              <span>Сообщество</span>
            </div>
            <span class="acknowledgment-text">— за добавление таймингов</span>
          </div>
        </div>
      </div>
      <div class="timings-content" :class="{ 'no-border': !nudityTimings }">
        <div class="timings-warning">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Тайминги не модерируются - проверьте перед просмотром</span>
        </div>
        <div class="timings-text">
          <div v-if="nudityTimings.length > 0" class="timing-entries">
            <div
              v-for="timing in sortedNudityTimings"
              :key="timing.id"
              class="timing-entry"
              :class="{
                pending: timing.status === 'pending',
                'clean-text': timing.status === 'clean_text',
                selected: selectedTimings.has(timing.id),
                'top-rated': (timing.voteScore || 0) >= 5,
                'highly-rated': (timing.voteScore || 0) >= 10
              }"
            >
              <div class="timing-content">
                <div class="timing-header-row" style="display: flex; align-items: center; gap: 8px">
                  <div v-if="timing.status === 'pending'" class="pending-badge">На модерации</div>
                  <div v-if="timing.status === 'clean_text'" class="clean-text-badge">
                    Тайминги такого типа не модерируются, для уверенности сверяйтесь с ParentsGuide
                  </div>
                  <div v-if="(timing.voteScore || 0) >= 10" class="highly-rated-badge">
                    <i class="fas fa-star"></i> Проверено сообществом
                  </div>
                  <div v-else-if="(timing.voteScore || 0) >= 5" class="top-rated-badge">
                    <i class="fas fa-thumbs-up"></i> Рекомендуется
                  </div>
                </div>
                <div
                  class="timing-actions-row"
                  style="display: flex; align-items: center; gap: 8px; margin-top: 8px"
                >
                  <button class="nudity-info-button" @click="handleShowParse(timing)">
                    {{ showParseResult[timing.id] ? 'Скрыть парсер' : 'Показать парсер' }}
                  </button>

                  <template v-if="overlayTimings.has(timing.id)">
                    <button
                      class="nudity-info-button overlay-button"
                      @click="onRemoveFromOverlay(timing.id)"
                      :title="'Удалить из оверлея'"
                    >
                      <i class="fas fa-eye-slash"></i>
                      <span>Удалить из оверлея</span>
                    </button>
                  </template>
                  <template v-else>
                    <button
                      class="nudity-info-button overlay-button"
                      @click="onAddToOverlay(timing.id)"
                      :title="'Добавить в оверлей'"
                    >
                      <i class="fas fa-eye"></i>
                      <span>Добавить в оверлей</span>
                    </button>
                  </template>

                  <template v-if="canEditTiming(timing)">
                    <button
                      class="nudity-info-button edit-button"
                      @click="editTiming(timing)"
                      :title="'Редактировать тайминг'"
                    >
                      <i class="fas fa-edit"></i>
                      <span>Редактировать</span>
                    </button>
                    <button
                      class="nudity-info-button delete-button"
                      @click="deleteTimingHandler(timing.id)"
                      :title="'Удалить тайминг'"
                    >
                      <i class="fas fa-trash"></i>
                      <span>Удалить</span>
                    </button>
                  </template>

                  <button
                    v-if="!canEditTiming(timing)"
                    class="nudity-info-button report-button"
                    @click="reportTimingHandler(timing.id)"
                    :title="'Пожаловаться на тайминг'"
                  >
                    <i class="fas fa-flag"></i>
                    <span>Пожаловаться</span>
                  </button>
                </div>
                <div
                  class="timing-hover-container"
                  :class="{ blurred: timing.status === 'pending' }"
                >
                  <span class="timing-text">{{ timing.timing_text }}</span>
                  <br />
                  <span class="timing-author">
                    by {{ timing.username }}
                    <span
                      v-if="timing.user_id && timing.user_id !== 0 && timing.user_timing_count > 0"
                      class="timing-count"
                      :title="`Авторизованный пользователь (${timing.user_timing_count} таймингов)`"
                    >
                      ({{ timing.user_timing_count }})
                    </span>
                  </span>
                </div>
                <div class="timing-vote-container">
                  <button
                    class="vote-button upvote-button"
                    :class="{ active: timing.userVote === 'upvote' }"
                    @click="handleVote(timing.id, 'upvote')"
                    :disabled="votingTimingId === timing.id"
                    :title="'Этот тайминг полезен и точен'"
                  >
                    <i class="fas fa-arrow-up"></i>
                    <span class="vote-count">{{ timing.upvotes || 0 }}</span>
                  </button>
                  <span class="vote-score" :class="getVoteScoreClass(timing.voteScore || 0)">
                    {{ timing.voteScore || 0 }}
                  </span>
                  <button
                    class="vote-button downvote-button"
                    :class="{ active: timing.userVote === 'downvote' }"
                    @click="handleVote(timing.id, 'downvote')"
                    :disabled="votingTimingId === timing.id"
                    :title="'Этот тайминг неточен или некорректен'"
                  >
                    <i class="fas fa-arrow-down"></i>
                    <span class="vote-count">{{ timing.downvotes || 0 }}</span>
                  </button>
                </div>
                <div
                  v-if="showParseResult[timing.id] && Array.isArray(showParseResult[timing.id])"
                  style="color: #fff; font-size: 13px; margin: 4px 0 0 0"
                >
                  <b>Парсер:</b>
                  <span v-if="showParseResult[timing.id].length === 0">Не удалось распарсить</span>
                  <span v-else>
                    <span v-for="(range, idx) in showParseResult[timing.id]" :key="idx">
                      [{{ formatSecondsToTime(range[0]) }}
                      -
                      {{ formatSecondsToTime(range[1]) }}]{{
                        idx < showParseResult[timing.id].length - 1 ? ', ' : ''
                      }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else>
            {{ 'Записей о таймингах не найдено' }}
          </div>
        </div>
        <div
          v-if="showGeneralParserResult && selectedTimings.size > 0"
          class="general-parser-result"
          style="
            margin-top: 15px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
          "
        >
          <h4 style="margin: 0 0 10px 0; color: #fff">
            Общий парсер ({{ selectedTimings.size }} таймингов):
          </h4>
          <div style="color: #fff; font-size: 13px">
            <span v-if="getGeneralParserResult().length === 0"
              >Не удалось распарсить выбранные тайминги</span
            >
            <span v-else>
              <span v-for="(range, idx) in getGeneralParserResult()" :key="idx">
                [{{ formatSecondsToTime(range[0]) }} - {{ formatSecondsToTime(range[1]) }}]{{
                  idx < getGeneralParserResult().length - 1 ? ', ' : ''
                }}
              </span>
            </span>
          </div>
        </div>
        <div
          v-if="showOverlayParserResult && overlayTimings.size > 0"
          class="overlay-parser-result"
          style="
            margin-top: 15px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
          "
        >
          <h4 style="margin: 0 0 10px 0; color: #fff">
            Парсер оверлея ({{ overlayTimings.size }} таймингов):
          </h4>
          <div style="color: #fff; font-size: 13px">
            <span v-if="getOverlayParserResult().length === 0"
              >Не удалось распарсить выбранные тайминги</span
            >
            <span v-else>
              <span v-for="(range, idx) in getOverlayParserResult()" :key="idx">
                [{{ formatSecondsToTime(range[0]) }} - {{ formatSecondsToTime(range[1]) }}]{{
                  idx < getOverlayParserResult().length - 1 ? ', ' : ''
                }}
              </span>
            </span>
          </div>
        </div>
        <div class="nudity-info-actions">
          <button
            v-if="nudityTimings.length > 0"
            class="nudity-info-button"
            @click="copyNudityTimings"
          >
            <i class="fas fa-copy"></i>
            <span>Скопировать</span>
          </button>
          <button
            v-if="selectedTimings.size > 0"
            class="nudity-info-button"
            @click="showGeneralParser"
          >
            <i class="fas fa-eye"></i>
            <span>Общий парсер ({{ selectedTimings.size }})</span>
          </button>
          <button
            v-if="overlayTimings.size > 0"
            class="nudity-info-button"
            @click="showOverlayParser"
          >
            <i class="fas fa-layer-group"></i>
            <span>Парсер оверлея ({{ overlayTimings.size }})</span>
          </button>
          <button class="nudity-info-button" @click="handleAddTiming">
            <i class="fas fa-plus"></i>
            <span>Добавить/дополнить тайминг</span>
          </button>
          <!-- <button
            v-if="isElectron"
            class="nudity-info-button obs-button"
            @click="showObsSettings = true"
          >
            <i class="fas fa-cog"></i>
            <span>Настройки OBS</span>
          </button> -->
        </div>
      </div>
    </div>
  </div>

  <div v-if="showTimingForm" class="timing-modal">
    <div class="timing-modal-content">
      <div class="timing-modal-header">
        <h3>{{ editingTiming ? 'Редактировать тайминг' : 'Добавить тайминг' }}</h3>
        <button class="close-modal-btn" @click="closeTimingForm">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="timing-submission-form">
        <textarea
          v-model="newTimingText"
          placeholder="Пожалуйста, указывайте длительность фильма(в [] скобках, например [01:36] или [01:36:55]), к которому вы прилагаете тайминг
Тк же для автоблюра прошу все тайминги указывать как диапозон, а не конкретное время, например 00:12:31-00:13:04 - текст, а не 00:12:31
Для сериалов указывайте сезон и номер эпизода
"
          class="timing-textarea"
        ></textarea>

        <div v-if="parsedTimingPreview && parsedTimingPreview.length > 0" class="timing-preview">
          <div class="timing-preview-header">
            <i class="fas fa-eye"></i>
            <span>Предпросмотр парсера</span>
          </div>
          <div class="timing-preview-content">
            <div
              v-for="(range, index) in parsedTimingPreview"
              :key="index"
              class="timing-preview-item"
            >
              <span class="timing-preview-range">
                {{ formatSecondsToTime(range[0]) }} - {{ formatSecondsToTime(range[1]) }}
              </span>
              <span class="timing-preview-duration">
                ({{ Math.round(range[1] - range[0]) }}с)
              </span>
            </div>
          </div>
        </div>

        <div class="timing-form-actions">
          <button
            class="submit-timing-btn"
            @click="editingTiming ? updateExistingTiming() : submitNewTiming()"
            :disabled="!canSubmitTiming || isSubmittingTiming"
          >
            <i v-if="isSubmittingTiming" class="fas fa-spinner fa-spin"></i>
            <span v-else>{{ editingTiming ? 'Обновить тайминг' : 'Добавить тайминг' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showReportForm" class="timing-modal">
    <div class="timing-modal-content">
      <div class="timing-modal-header">
        <h3>Пожаловаться на тайминг</h3>
        <button class="close-modal-btn" @click="closeReportForm">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="timing-submission-form">
        <textarea
          v-model="reportText"
          placeholder="Опишите причину жалобы..."
          class="timing-textarea"
          rows="4"
        ></textarea>

        <div class="timing-form-actions">
          <button
            class="submit-timing-btn"
            @click="submitReport"
            :disabled="!reportText.trim() || isSubmittingReport"
          >
            <i v-if="isSubmittingReport" class="fas fa-spinner fa-spin"></i>
            <span v-else>Отправить жалобу</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showNoteEditor" class="timing-modal note-modal">
    <div class="timing-modal-content">
      <div class="timing-modal-header">
        <h3>
          <i class="fa-regular fa-note-sticky"></i>
          {{ movieNote ? 'Редактировать заметку' : 'Новая заметка' }}
        </h3>
        <button class="close-modal-btn" @click="cancelNoteEdit">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="timing-submission-form">
        <div class="note-info">
          <i class="fas fa-info-circle"></i>
          <span>Личная заметка о фильме, видна только вам</span>
        </div>
        <textarea
          v-model="noteText"
          placeholder="Напишите свою заметку о фильме..."
          class="timing-textarea note-textarea"
          rows="10"
          maxlength="10000"
        ></textarea>
        <div class="char-counter">{{ noteText.length }} / 10000 символов</div>

        <div class="timing-form-actions note-form-actions">
          <button
            class="submit-timing-btn"
            @click="handleSaveNote"
            :disabled="!noteText.trim() || isSavingNote"
          >
            <i v-if="isSavingNote" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            <span>{{ movieNote ? 'Обновить' : 'Сохранить' }}</span>
          </button>
          <button
            v-if="movieNote"
            class="delete-note-btn"
            @click="handleDeleteNote"
            :disabled="isDeletingNote"
          >
            <i v-if="isDeletingNote" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-trash"></i>
            <span>Удалить</span>
          </button>
          <button class="cancel-note-btn" @click="cancelNoteEdit">
            <i class="fas fa-times"></i>
            <span>Отмена</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showTopSubmittersModal" class="modal-overlay" @click="showTopSubmittersModal = false">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>
          Топ авторов таймингов
          <span class="hint-text"
            >(Хотите добавить ссылку на свой стрим/соцсети? Напишите нам в
            <a href="https://t.me/reyohoho_sup" target="_blank" rel="noopener noreferrer"
              >телеграм</a
            >)</span
          >
        </h3>
        <div class="modal-header-controls">
          <button class="close-modal-btn" @click="showTopSubmittersModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="modal-body">
        <button
          class="show-all-timings-btn"
          @click="showAllTimingsModal"
          :disabled="isLoadingAllTimings"
        >
          <i v-if="isLoadingAllTimings" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-list"></i>
          <span>Все тайминги</span>
        </button>
        <div class="top-submitters-list">
          <div
            v-for="(submitter, index) in topSubmitters"
            :key="submitter.username"
            class="top-submitter-item"
          >
            <div
              class="submitter-rank"
              :class="{
                gold: index === 0,
                silver: index === 1,
                bronze: index === 2
              }"
            >
              {{ index + 1 }}
            </div>
            <div class="submitter-info">
              <div class="submitter-name">
                <template v-if="submitter.stream_link">
                  <a :href="submitter.stream_link" target="_blank" rel="noopener noreferrer">
                    {{ submitter.username }}
                    <i class="fa-brands fa-twitch"></i>
                  </a>
                </template>
                <template v-else>
                  {{ submitter.username }}
                </template>
              </div>
              <div class="submitter-count">
                {{ submitter.approved_submissions_count }}
                {{
                  getNounForm(submitter.approved_submissions_count, ['фильм', 'фильма', 'фильмов'])
                }}
              </div>
            </div>
            <div class="submitter-contribution">
              <div
                class="contribution-bar"
                :style="{ width: getContributionWidth(submitter.approved_submissions_count) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="showAllTimingsModalVisible"
    class="modal-overlay"
    @click="showAllTimingsModalVisible = false"
  >
    <div class="modal-content all-timings-modal" @click.stop>
      <div class="modal-header">
        <h3>Все тайминги</h3>
        <button class="close-modal-btn" @click="showAllTimingsModalVisible = false">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div v-if="isLoadingAllTimings" class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
          <span>Загрузка всех таймингов...</span>
        </div>
        <div v-else-if="allTimings.length === 0" class="no-timings">
          <p>Тайминги не найдены</p>
        </div>
        <div v-else-if="filteredTimings.length === 0" class="no-timings">
          <p>Тайминги по выбранному фильтру не найдены</p>
        </div>
        <div v-else class="all-timings-list">
          <div v-for="timing in filteredTimings" :key="timing.id" class="timing-item">
            <div class="timing-header">
              <div class="timing-meta">
                <span class="timing-author">{{ timing.username }}</span>
                <span class="timing-date">{{ formatDate(timing.submitted_at) }}</span>
              </div>
              <div class="timing-movie-info">
                <router-link
                  :to="`/movie/${timing.kp_id}`"
                  class="timing-kp-id clickable"
                  :title="`Перейти к фильму ${timing.kp_id}`"
                >
                  KP: {{ timing.kp_id }}
                </router-link>
                <div
                  v-if="authStore.user?.is_admin && timing.status === 'pending'"
                  class="admin-controls"
                >
                  <button
                    v-if="timing.status === 'pending'"
                    class="approve-btn"
                    @click="handleApproveTiming(timing.id)"
                    :disabled="isProcessingTiming"
                    :title="'Одобрить тайминг'"
                  >
                    <i
                      v-if="processingTimingId === timing.id && isApproving"
                      class="fas fa-spinner fa-spin"
                    ></i>
                    <i v-else class="fas fa-check"></i>
                  </button>
                  <button
                    v-if="timing.status === 'pending'"
                    class="reject-btn"
                    @click="handleRejectTiming(timing.id)"
                    :disabled="isProcessingTiming"
                    :title="'Отклонить тайминг'"
                  >
                    <i
                      v-if="processingTimingId === timing.id && !isApproving && !isMarkingCleanText"
                      class="fas fa-spinner fa-spin"
                    ></i>
                    <i v-else class="fas fa-times"></i>
                  </button>
                  <button
                    v-if="timing.status === 'pending'"
                    class="clean-text-btn"
                    @click="handleMarkAsCleanText(timing.id)"
                    :disabled="isProcessingTiming"
                    :title="'Отметить как clean_text'"
                  >
                    <i
                      v-if="processingTimingId === timing.id && isMarkingCleanText"
                      class="fas fa-spinner fa-spin"
                    ></i>
                    <i v-else class="fas fa-eye-slash"></i>
                  </button>
                </div>
              </div>
            </div>
            <div class="timing-content">
              <pre class="timing-text">{{ timing.timing_text }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showObsSettings" class="timing-modal obs-modal">
    <div class="timing-modal-content obs-modal-content">
      <div class="timing-modal-header">
        <h3>Настройки OBS WebSocket</h3>
        <button class="close-modal-btn" @click="showObsSettings = false">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="obs-settings-form">
        <div class="obs-setting-group">
          <label class="obs-checkbox-label">
            <input type="checkbox" v-model="obsEnabled" @change="handleObsEnabledChange" />
            <span>Использовать автоблюр в OBS</span>
          </label>
          <div class="obs-setting-description">
            Если включено, автоблюр будет применяться через OBS WebSocket вместо внутреннего блюра
          </div>
        </div>

        <div v-if="obsEnabled" class="obs-connection-settings">
          <div class="obs-setting-group">
            <label>Хост OBS WebSocket:</label>
            <input type="text" v-model="obsHost" placeholder="localhost" class="obs-input" />
          </div>

          <div class="obs-setting-group">
            <label>Порт OBS WebSocket:</label>
            <input type="number" v-model="obsPort" placeholder="4455" class="obs-input" />
          </div>

          <div class="obs-setting-group">
            <label>Пароль (если установлен):</label>
            <input
              type="password"
              v-model="obsPassword"
              placeholder="Оставьте пустым если пароль не установлен"
              class="obs-input"
            />
          </div>

          <div v-if="obsConnected" class="obs-setting-group">
            <label>Выбор фильтра для блюра:</label>
            <div v-if="obsFiltersFound.length === 0" class="obs-warning">
              ⚠️ Фильтры не найдены в OBS. Убедитесь, что в источниках есть фильтры.
            </div>
            <div v-else class="obs-filter-selection">
              <select
                v-model="selectedFilterId"
                @change="handleFilterSelect"
                class="obs-filter-select"
              >
                <option value="">Выберите фильтр</option>
                <option v-for="filter in obsFiltersFound" :key="filter.id" :value="filter.id">
                  {{ filter.sourceName }} - {{ filter.filterName }} ({{ filter.sceneName }})
                </option>
              </select>
              <div v-if="selectedFilter" class="selected-filter-info">
                <div class="filter-details">
                  <strong>{{ selectedFilter.filterName }}</strong> в источнике
                  <strong>{{ selectedFilter.sourceName }}</strong>
                </div>
                <span class="filter-status" :class="{ enabled: selectedFilter.enabled }">
                  Статус: {{ selectedFilter.enabled ? '✅ Включен' : '⭕ Отключен' }}
                </span>
              </div>
              <div class="obs-info">
                💡 Найдено {{ obsFiltersFound.length }} фильтров. Выберите фильтр блюра.
              </div>
            </div>
          </div>

          <div class="obs-setting-group">
            <label class="obs-checkbox-label">
              <input type="checkbox" v-model="showObsInOverlay" />
              <span>Показывать статус OBS в видео оверлее</span>
            </label>
          </div>

          <div class="obs-status" :class="{ connected: obsConnected }">
            {{ obsConnected ? 'Подключен к OBS' : 'Не подключен к OBS' }}
          </div>

          <div class="obs-actions">
            <button
              class="obs-action-btn connect-btn"
              @click="handleObsConnect"
              :disabled="obsConnecting"
            >
              <i v-if="obsConnecting" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-plug"></i>
              {{ obsConnected ? 'Переподключиться' : 'Подключиться' }}
            </button>

            <button
              class="obs-action-btn test-btn"
              @click="handleObsTestBlur"
              :disabled="!obsConnected || obsFiltersFound.length === 0"
            >
              <i class="fas fa-eye"></i>
              Тестировать блюр
            </button>

            <button
              class="obs-action-btn refresh-btn"
              @click="handleObsRefreshFilters"
              :disabled="!obsConnected"
            >
              <i class="fas fa-sync"></i>
              Обновить фильтры
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  getKpInfo,
  getShikiInfo,
  getNudityInfoFromIMDB,
  submitTiming,
  updateTiming,
  deleteTiming,
  reportTiming,
  getTopTimingSubmitters,
  getAllTimingSubmissions,
  approveTiming as apiApproveTiming,
  rejectTiming as apiRejectTiming,
  markAsCleanText as apiMarkAsCleanText,
  voteOnTiming,
  getTimingVote,
  getMovieNote,
  saveMovieNote,
  deleteMovieNote
} from '@/api/movies'
import { formatDate } from '@/utils/dateUtils'
import { parseTimingTextToSeconds, formatSecondsToTime } from '@/utils/dateUtils'
import { handleApiError } from '@/constants'
import { addToList, delFromList } from '@/api/user'
import { MovieList } from '@/components/MovieList/'
import PlayerComponent from '@/components/PlayerComponent.vue'
import ErrorMessage from '@/components/ErrorMessage.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import { TYPES_ENUM, USER_LIST_TYPES_ENUM } from '@/constants'
import { useBackgroundStore } from '@/store/background'
import { useMainStore } from '@/store/main'
import { useAuthStore } from '@/store/auth'
import { useNavbarStore } from '@/store/navbar'
import { usePlayerStore } from '@/store/player'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Notification from '@/components/notification/ToastMessage.vue'
import TrailerCarousel from '@/components/TrailerCarousel.vue'
import { useTrailerStore } from '@/store/trailer'
import MovieRating from '@/components/MovieRating.vue'
import Comments from '@/components/Comments.vue'
import { getRatingColor } from '@/utils/ratingUtils'

const infoLoading = ref(true)
const mainStore = useMainStore()
const authStore = useAuthStore()
const backgroundStore = useBackgroundStore()
const playerStore = usePlayerStore()
const route = useRoute()
const router = useRouter()
const kp_id = ref(route.params.kp_id)
const errorMessage = ref('')
const errorCode = ref(null)
const movieInfo = ref(null)
const navbarStore = useNavbarStore()
const trailerStore = useTrailerStore()
const notificationRef = ref(null)

const areTrailersActive = computed(() => trailerStore.areTrailersActive)
const activeTrailerIndex = ref(null)
const showAllSequels = ref(false)
const showAllSimilars = ref(false)

const itemsPerRow = ref(10)

const nudityInfo = ref(null)
const nudityInfoLoading = ref(false)
const nudityInfoTrigger = ref(null)
const isListExpanded = ref(false)

const nudityTimings = ref(undefined)
const nudityTimingsTrigger = ref(null)
const selectedTimings = ref(new Set())
const overlayTimings = ref(new Set())
const showGeneralParserResult = ref(false)
const timingIdToAdd = ref(null)
const showOverlayParserResult = ref(false)

const votingTimingId = ref(null)
const isLoadingVotes = ref(false)

const movieNote = ref(null)
const showNoteEditor = ref(false)
const noteText = ref('')
const isSavingNote = ref(false)
const isDeletingNote = ref(false)

const sortedNudityTimings = computed(() => {
  if (!nudityTimings.value || !Array.isArray(nudityTimings.value)) {
    return []
  }

  return [...nudityTimings.value].sort((a, b) => {
    const scoreA = a.voteScore || 0
    const scoreB = b.voteScore || 0

    if (scoreB !== scoreA) {
      return scoreB - scoreA
    }

    const upvotesA = a.upvotes || 0
    const upvotesB = b.upvotes || 0
    if (upvotesB !== upvotesA) {
      return upvotesB - upvotesA
    }

    return a.id - b.id
  })
})

const shouldShowRedTimings = computed(() => {
  return movieInfo.value?.nudity_timings.length > 0
})

const shouldBlinkRedTimings = computed(() => {
  return (
    movieInfo.value?.nudity_timings.length > 0 && mainStore.isStreamerMode && !mainStore.isMobile
  )
})

const isInAnyList = computed(() => {
  return (
    movieInfo.value?.lists?.isFavorite ||
    movieInfo.value?.lists?.isWatching ||
    movieInfo.value?.lists?.isLater ||
    movieInfo.value?.lists?.isCompleted ||
    movieInfo.value?.lists?.isAbandoned
  )
})

const isCommentsEnabled = computed(() => mainStore.isCommentsEnabled)

const setDocumentTitle = () => {
  if (movieInfo.value) {
    const title =
      movieInfo.value.name_ru ||
      movieInfo.value.name_en ||
      movieInfo.value.name_original ||
      'Информация о фильме'
    document.title = title
  }
}

const formatRatingNumber = (num) => {
  if (!num) return '0'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

const transformMoviesData = (movies) => {
  return (movies || []).map((movie) => ({
    kp_id: movie.film_id,
    poster: movie.poster_url_preview || movie.poster_url,
    title: movie.name_ru || movie.name_en || movie.name_original
  }))
}

const formatTime = (minutes) => {
  if (typeof minutes !== 'number') {
    return
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours} ч. ${mins} мин.`
}

const titleCopyTooltip = ref(false)
const tooltipStyle = ref({ top: '0px', left: '0px' })
const moveTooltip = (event) => {
  titleCopyTooltip.value = true
  tooltipStyle.value = {
    top: `${event.pageY + 10}px`,
    left: `${event.pageX - 70}px`
  }
}

const copyMovieMeta = async () => {
  try {
    const movieMeta = [
      movieInfo.value.name_ru || movieInfo.value.name_en || movieInfo.value.name_original,
      ...(movieInfo.value.year ? [movieInfo.value.year] : []),
      ...(movieInfo.value.film_length ? [formatTime(movieInfo.value.film_length)] : [])
    ]
    await navigator.clipboard.writeText(movieMeta.join(', '))
    notificationRef.value.showNotification('Скопировано')
  } catch (err) {
    console.error('Ошибка копирования:', err)
  }
}

const fetchMovieInfo = async (updateHistory = true) => {
  try {
    let response
    if (kp_id.value.startsWith('shiki')) {
      response = await getShikiInfo(kp_id.value)
    } else {
      response = await getKpInfo(kp_id.value, authStore.token)
    }

    if (Array.isArray(response) && response.length === 0) {
      throw new Error('Данные не найдены. Пожалуйста, повторите поиск.')
    }

    movieInfo.value = response

    if (kp_id.value.startsWith('shiki')) {
      movieInfo.value = {
        ...movieInfo.value,
        title: movieInfo.value.name_ru || movieInfo.value.name_en,
        name_original: movieInfo.value.name_en,
        short_description: movieInfo.value.slogan
      }
    } else {
      movieInfo.value = {
        ...movieInfo.value,
        title: movieInfo.value.name_ru || movieInfo.value.name_en || movieInfo.value.name_original,
        kinopoisk_id: kp_id.value
      }
    }

    if (authStore.token) {
      loadMovieNote()
    }

    navbarStore.setHeaderContent({
      text: movieInfo.value.title,
      imageUrl: movieInfo.value.logo_url
    })

    setDocumentTitle()

    const movieToSave = {
      kp_id: kp_id.value,
      title: movieInfo.value?.name_ru || movieInfo.value?.name_en || movieInfo.value?.name_original,
      poster:
        movieInfo.value?.poster_url ||
        movieInfo.value?.cover_url ||
        movieInfo.value?.screenshots[0],
      year: movieInfo.value?.year,
      type: movieInfo.value?.type
    }

    // Устанавливаем фон фильма через новый метод
    if (kp_id.value.startsWith('shiki')) {
      if (movieInfo.value.screenshots && movieInfo.value.screenshots.length > 0) {
        const randomIndex = Math.floor(Math.random() * movieInfo.value.screenshots.length)
        const randomScreenshot = movieInfo.value.screenshots[randomIndex]
        backgroundStore.updateMoviePoster(randomScreenshot)
      } else if (movieToSave.poster) {
        backgroundStore.updateMoviePoster(movieToSave.poster)
      }
    } else {
      if (movieToSave.poster) {
        backgroundStore.updateMoviePoster(movieToSave.poster)
      }
    }

    const isHistoryAllowed = computed(() => mainStore.isHistoryAllowed)

    if (isHistoryAllowed.value && movieToSave.kp_id && movieToSave.title && updateHistory) {
      if (authStore.token) {
        try {
          await addToList(movieToSave.kp_id, USER_LIST_TYPES_ENUM.HISTORY)
        } catch (error) {
          console.error('Ошибка при добавлении в историю:', error)
        }
      } else {
        mainStore.addToHistory({ ...movieToSave })
      }
    }
  } catch (error) {
    const { message, code } = handleApiError(error)
    errorMessage.value = message
    errorCode.value = code
    console.error('Ошибка при загрузке информации о фильмах:', error)
  }
}

const videos = computed(() => {
  return movieInfo.value?.videos
})

const sequelsAndPrequels = computed(() =>
  transformMoviesData(movieInfo.value?.sequels_and_prequels)
)

const similars = computed(() => transformMoviesData(movieInfo.value?.similars))

const updateItemsPerRow = () => {
  const containerWidth = document.querySelector('.related-movies')?.clientWidth || 0
  const itemWidth = 140 + 20
  const newItemsPerRow = Math.floor(containerWidth / itemWidth) || 10
  itemsPerRow.value = Math.max(1, newItemsPerRow)
}

const onResize = () => {
  updateItemsPerRow()
}

const onKeyDown = (event) => {
  if (event.altKey && event.keyCode === 84) {
    const playerComponent = document.querySelector('.player-container')
    if (playerComponent) {
      const theaterModeBtn = document.querySelector('.theater-mode-btn')
      if (theaterModeBtn) {
        theaterModeBtn.click()
      }
    }
  }
}

const handleMiddleClick = (event) => {
  if (event.button === 1) {
    event.preventDefault()
    showNudityInfo(event)
  }
}

const showNudityInfo = async (event) => {
  // if (!authStore.token) {
  //   notificationRef.value.showNotification(
  //     'Для просмотра информации необходимо <a class="auth-link">авторизоваться</a>',
  //     5000,
  //     { onClick: () => navbarStore.openLogin() }
  //   )
  //   return
  // }

  // if (!movieInfo.value?.imdb_id) return
  if (nudityInfo.value !== null) {
    nudityInfo.value = null
    nudityInfoLoading.value = false
    return
  }

  nudityTimings.value = undefined

  nudityInfoTrigger.value = event.currentTarget

  nudityInfo.value = ''
  nudityInfoLoading.value = true

  try {
    const response = await getNudityInfoFromIMDB(movieInfo.value.imdb_id)
    nudityInfo.value = response.nudity_info
  } catch (error) {
    console.error('Ошибка при загрузке информации о сценах:', error)
    nudityInfo.value =
      'Ошибка при загрузке информации о сценах. Попробуйте обратиться к Parents Guide на IMDb для получения подробной информации.'
  } finally {
    nudityInfoLoading.value = false
  }
}

const showNudityTimings = (event) => {
  nudityInfo.value = null

  if (nudityTimings.value !== undefined) {
    nudityTimings.value = undefined
    return
  }

  nudityTimingsTrigger.value = event.currentTarget

  nudityTimings.value =
    movieInfo.value?.nudity_timings === null ? '' : movieInfo.value?.nudity_timings || ''
}

const showTimingsPanel = () => {
  nudityInfo.value = null
  nudityTimings.value =
    movieInfo.value?.nudity_timings === null ? '' : movieInfo.value?.nudity_timings || ''
}

const getListStatus = (listType) => {
  const statusMap = {
    [USER_LIST_TYPES_ENUM.FAVORITE]: movieInfo.value?.lists?.isFavorite || false,
    [USER_LIST_TYPES_ENUM.HISTORY]: movieInfo.value?.lists?.isHistory || false,
    [USER_LIST_TYPES_ENUM.LATER]: movieInfo.value?.lists?.isLater || false,
    [USER_LIST_TYPES_ENUM.COMPLETED]: movieInfo.value?.lists?.isCompleted || false,
    [USER_LIST_TYPES_ENUM.ABANDONED]: movieInfo.value?.lists?.isAbandoned || false,
    [USER_LIST_TYPES_ENUM.WATCHING]: movieInfo.value?.lists?.isWatching || false
  }
  return statusMap[listType] ?? false
}

const toggleList = async (type) => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Необходимо <a class="auth-link">авторизоваться</a>',
      5000,
      { onClick: () => router.push('/login') }
    )
    return
  }

  try {
    const listNames = {
      [USER_LIST_TYPES_ENUM.FAVORITE]: 'избранное',
      [USER_LIST_TYPES_ENUM.HISTORY]: 'историю',
      [USER_LIST_TYPES_ENUM.LATER]: 'список "Смотреть позже"',
      [USER_LIST_TYPES_ENUM.COMPLETED]: 'список "Просмотрено"',
      [USER_LIST_TYPES_ENUM.ABANDONED]: 'список "Брошено"',
      [USER_LIST_TYPES_ENUM.WATCHING]: 'список "Смотрю"'
    }

    if (getListStatus(type)) {
      await delFromList(kp_id.value, type)
      notificationRef.value.showNotification(`Удалено из ${listNames[type]}`)
    } else {
      await addToList(kp_id.value, type)
      notificationRef.value.showNotification(`Добавлено в ${listNames[type]}`)
    }
    await fetchMovieInfo(false)
    isListExpanded.value = false
  } catch (error) {
    const { message, code } = handleApiError(error)
    notificationRef.value.showNotification(`${message} ${code}`)
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  const dropdown = document.querySelector('.mobile-list-dropdown')
  if (dropdown && !dropdown.contains(event.target)) {
    isListExpanded.value = false
  }
}

const handleNudityPopupOutsideClick = (event) => {
  const popup = document.querySelector('.nudity-info-popup')
  if (
    popup &&
    !popup.contains(event.target) &&
    nudityInfoTrigger.value &&
    !nudityInfoTrigger.value.contains(event.target)
  ) {
    nudityInfo.value = null
  }
}

const handleNudityTimingsPopupOutsideClick = (event) => {
  const popup = document.querySelector('.nudity-info-popup')
  if (
    popup &&
    !popup.contains(event.target) &&
    nudityTimingsTrigger.value &&
    !nudityTimingsTrigger.value.contains(event.target)
  ) {
    nudityTimings.value = undefined
  }
}

onMounted(async () => {
  await fetchMovieInfo()
  infoLoading.value = false
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize)
  setTimeout(updateItemsPerRow, 100)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('click', handleNudityPopupOutsideClick, true)
  document.addEventListener('click', handleNudityTimingsPopupOutsideClick, true)
  window.selectedNudityTimings = Array.from(selectedTimings.value)
  window.overlayNudityTimings = Array.from(overlayTimings.value)
})

onUnmounted(async () => {
  navbarStore.clearHeaderContent()
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleNudityPopupOutsideClick, true)
  document.removeEventListener('click', handleNudityTimingsPopupOutsideClick, true)
  delete window.selectedNudityTimings
  delete window.overlayNudityTimings
})

watch(
  () => route.params.kp_id,
  async (newKpId) => {
    if (newKpId && newKpId !== kp_id.value) {
      navbarStore.clearHeaderContent()
      kp_id.value = newKpId
      activeTrailerIndex.value = null
      await fetchMovieInfo()
      infoLoading.value = false
    }
  },
  { immediate: true }
)

watch(
  movieInfo,
  () => {
    setDocumentTitle()
  },
  { deep: true }
)

watch(
  nudityInfo,
  (newValue) => {
    if (newValue) {
      document.addEventListener('click', handleNudityPopupOutsideClick, true)
    } else {
      document.removeEventListener('click', handleNudityPopupOutsideClick, true)
    }
  },
  { deep: true }
)

watch(
  () => nudityTimings.value !== undefined,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('click', handleNudityTimingsPopupOutsideClick, true)
      loadTimingVotes()
    } else {
      document.removeEventListener('click', handleNudityTimingsPopupOutsideClick, true)
    }
  }
)

watch(
  selectedTimings,
  () => {
    window.selectedNudityTimings = Array.from(selectedTimings.value)
  },
  { deep: true }
)

watch(
  overlayTimings,
  () => {
    window.overlayNudityTimings = Array.from(overlayTimings.value)
  },
  { deep: true }
)

onMounted(() => {
  window.selectedNudityTimings = Array.from(selectedTimings.value)
  window.overlayNudityTimings = Array.from(overlayTimings.value)

  const checkObsSources = setInterval(() => {
    if (window.obsSources && Array.isArray(window.obsSources)) {
      obsSources.value = window.obsSources
    }

    if (window.getOBSFiltersInfo) {
      const filtersInfo = window.getOBSFiltersInfo()
      if (filtersInfo && Array.isArray(filtersInfo)) {
        playerStore.updateObsSettings({ filtersFound: filtersInfo })
      }
    }
  }, 1000)

  onUnmounted(() => {
    clearInterval(checkObsSources)
  })
})

onUnmounted(() => {
  delete window.selectedNudityTimings
  delete window.overlayNudityTimings
})

const getStaffByProfession = (profession) => {
  return movieInfo.value?.staff?.filter((person) => person.profession_key === profession) || []
}

const copyNudityInfo = async () => {
  try {
    await navigator.clipboard.writeText(nudityInfo.value)
    notificationRef.value.showNotification('Текст скопирован')
  } catch (err) {
    console.error('Ошибка копирования:', err)
    notificationRef.value.showNotification('Ошибка при копировании текста')
  } finally {
    nudityInfo.value = null
  }
}

const copyNudityTimings = async () => {
  if (nudityTimings.value.length === 0) return

  try {
    const formattedTimings = nudityTimings.value
      .map((timing) => `${timing.timing_text} (by @${timing.username})`)
      .join('\n')
      .concat('\nReYohoho\n')
    await navigator.clipboard.writeText(formattedTimings)
    notificationRef.value.showNotification('Текст скопирован')
  } catch (err) {
    console.error('Ошибка копирования:', err)
    notificationRef.value.showNotification('Ошибка при копировании текста')
  } finally {
    nudityTimings.value = undefined
  }
}

const openInGoogleTranslate = () => {
  const text = encodeURIComponent(nudityInfo.value)
  window.open(`https://translate.google.com/?sl=en&tl=ru&text=${text}`, '_blank')
  nudityInfo.value = null
}

const newTimingText = ref('')
const isSubmittingTiming = ref(false)

const parsedTimingPreview = computed(() => {
  if (!newTimingText.value.trim()) return []
  try {
    return parseTimingTextToSeconds(newTimingText.value, true) || []
  } catch (error) {
    console.error('Error parsing timing text:', error)
    return []
  }
})

const canSubmitTiming = computed(() => {
  return newTimingText.value.trim()
})

const canEditTiming = (timing) => {
  return authStore.user && timing.user_id && timing.user_id === authStore.user.id
}

const handleAddTiming = () => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Необходимо <a class="auth-link">авторизоваться</a> для добавления таймингов',
      5000,
      { onClick: () => router.push('/login') }
    )
    return
  }
  editingTiming.value = null
  newTimingText.value = ''
  showTimingForm.value = true
}

const editTiming = (timing) => {
  editingTiming.value = timing
  newTimingText.value = timing.timing_text
  showTimingForm.value = true
}

const closeTimingForm = () => {
  showTimingForm.value = false
  editingTiming.value = null
  newTimingText.value = ''
}

const submitNewTiming = async () => {
  if (!canSubmitTiming.value || isSubmittingTiming.value) return

  try {
    isSubmittingTiming.value = true
    await submitTiming(kp_id.value, newTimingText.value)
    notificationRef.value.showNotification('Тайминг добавлен успешно!')
    newTimingText.value = ''
    closeTimingForm()
    await fetchMovieInfo(false)
    showTimingsPanel()
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  } finally {
    isSubmittingTiming.value = false
  }
}

const updateExistingTiming = async () => {
  if (!canSubmitTiming.value || isSubmittingTiming.value || !editingTiming.value) return

  try {
    isSubmittingTiming.value = true
    await updateTiming(editingTiming.value.id, newTimingText.value)
    notificationRef.value.showNotification('Тайминг обновлен успешно!')
    closeTimingForm()
    await fetchMovieInfo(false)
    showTimingsPanel()
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  } finally {
    isSubmittingTiming.value = false
  }
}

const deleteTimingHandler = async (timingId) => {
  if (!confirm('Вы уверены, что хотите удалить этот тайминг?')) return

  try {
    await deleteTiming(timingId)
    notificationRef.value.showNotification('Тайминг удален успешно!')
    await fetchMovieInfo(false)
    showTimingsPanel()
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  }
}

const reportTimingHandler = (timingId) => {
  reportTimingId.value = timingId
  reportText.value = ''
  showReportForm.value = true
}

const closeReportForm = () => {
  showReportForm.value = false
  reportText.value = ''
  reportTimingId.value = null
}

const submitReport = async () => {
  if (!reportText.value.trim() || isSubmittingReport.value || !reportTimingId.value) return

  try {
    isSubmittingReport.value = true
    await reportTiming(reportTimingId.value, reportText.value)
    notificationRef.value.showNotification('Жалоба отправлена успешно!')
    closeReportForm()
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  } finally {
    isSubmittingReport.value = false
  }
}

const handleVote = async (timingId, voteType) => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Необходимо <a class="auth-link">авторизоваться</a> для голосования',
      5000,
      { onClick: () => router.push('/login') }
    )
    return
  }

  if (votingTimingId.value === timingId) {
    return
  }

  try {
    votingTimingId.value = timingId

    const response = await voteOnTiming(timingId, voteType)

    const timing = nudityTimings.value.find((t) => t.id === timingId)
    if (timing) {
      timing.upvotes = response.upvotes
      timing.downvotes = response.downvotes
      timing.voteScore = response.vote_score

      if (timing.userVote === voteType) {
        timing.userVote = null
      } else {
        timing.userVote = voteType
      }
    }
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  } finally {
    votingTimingId.value = null
  }
}

const getVoteScoreClass = (score) => {
  if (score > 0) return 'positive'
  if (score < 0) return 'negative'
  return 'neutral'
}

const loadTimingVotes = async () => {
  if (!nudityTimings.value || nudityTimings.value.length === 0) return
  if (isLoadingVotes.value) return

  isLoadingVotes.value = true

  try {
    const votePromises = nudityTimings.value.map(async (timing) => {
      try {
        const voteData = await getTimingVote(timing.id)
        return {
          id: timing.id,
          upvotes: voteData.upvotes || 0,
          downvotes: voteData.downvotes || 0,
          voteScore: voteData.vote_score || 0,
          userVote: voteData.user_vote || null
        }
      } catch {
        return {
          id: timing.id,
          upvotes: 0,
          downvotes: 0,
          voteScore: 0,
          userVote: null
        }
      }
    })

    const voteResults = await Promise.all(votePromises)

    const voteMap = new Map(voteResults.map((v) => [v.id, v]))

    nudityTimings.value = nudityTimings.value.map((timing) => {
      const voteData = voteMap.get(timing.id)
      if (voteData) {
        return {
          ...timing,
          upvotes: voteData.upvotes,
          downvotes: voteData.downvotes,
          voteScore: voteData.voteScore,
          userVote: voteData.userVote
        }
      }
      return timing
    })
  } catch (error) {
    console.error('Error loading timing votes:', error)
  } finally {
    isLoadingVotes.value = false
  }
}

const loadMovieNote = async () => {
  if (!authStore.isAuthenticated || !kp_id.value) return

  try {
    const response = await getMovieNote(kp_id.value)
    movieNote.value = response.note
    if (movieNote.value) {
      noteText.value = movieNote.value.note_text
    } else {
      noteText.value = ''
    }
  } catch {
    movieNote.value = null
    noteText.value = ''
  }
}

const toggleNoteEditor = () => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Необходимо <a class="auth-link">авторизоваться</a> для создания заметок',
      5000,
      { onClick: () => router.push('/login') }
    )
    return
  }
  showNoteEditor.value = !showNoteEditor.value
}

const handleSaveNote = async () => {
  if (!authStore.token) {
    notificationRef.value.showNotification(
      'Необходимо <a class="auth-link">авторизоваться</a>',
      5000,
      { onClick: () => router.push('/login') }
    )
    return
  }

  if (!noteText.value.trim()) {
    notificationRef.value.showNotification('Заметка не может быть пустой')
    return
  }

  if (noteText.value.length > 10000) {
    notificationRef.value.showNotification('Заметка слишком длинная (максимум 10000 символов)')
    return
  }

  try {
    isSavingNote.value = true
    const response = await saveMovieNote(kp_id.value, noteText.value)
    movieNote.value = response.note
    noteText.value = response.note.note_text
    notificationRef.value.showNotification('Заметка сохранена')
    showNoteEditor.value = false
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  } finally {
    isSavingNote.value = false
  }
}

const handleDeleteNote = async () => {
  if (!authStore.token) {
    return
  }

  if (!confirm('Вы уверены, что хотите удалить заметку?')) {
    return
  }

  try {
    isDeletingNote.value = true
    await deleteMovieNote(kp_id.value)
    movieNote.value = null
    noteText.value = ''
    showNoteEditor.value = false
    notificationRef.value.showNotification('Заметка удалена')
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message, 5000)
  } finally {
    isDeletingNote.value = false
  }
}

const cancelNoteEdit = () => {
  if (movieNote.value) {
    noteText.value = movieNote.value.note_text
  } else {
    noteText.value = ''
  }
  showNoteEditor.value = false
}

const showTopSubmitters = async () => {
  try {
    const { submissions } = await getTopTimingSubmitters()
    topSubmitters.value = submissions
    showTopSubmittersModal.value = true
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message)
  }
}

const showTimingForm = ref(false)
const editingTiming = ref(null)
const showReportForm = ref(false)
const reportText = ref('')
const reportTimingId = ref(null)
const isSubmittingReport = ref(false)

const topSubmitters = ref([])

const showTopSubmittersModal = ref(false)

const showAllTimingsModalVisible = ref(false)
const allTimings = ref([])
const isLoadingAllTimings = ref(false)
const isProcessingTiming = ref(false)
const processingTimingId = ref(null)
const isApproving = ref(false)
const isMarkingCleanText = ref(false)

// OBS Settings
const showObsSettings = ref(false)
const obsConnecting = ref(false)

const obsEnabled = computed({
  get: () => playerStore.obsSettings.enabled,
  set: (value) => playerStore.updateObsSettings({ enabled: value })
})

const obsHost = computed({
  get: () => playerStore.obsSettings.host,
  set: (value) => playerStore.updateObsSettings({ host: value })
})

const obsPort = computed({
  get: () => playerStore.obsSettings.port,
  set: (value) => playerStore.updateObsSettings({ port: value })
})

const obsPassword = computed({
  get: () => playerStore.obsSettings.password,
  set: (value) => playerStore.updateObsSettings({ password: value })
})

const obsConnected = computed(() => playerStore.obsSettings.connected)
const obsSources = ref([])
const obsFiltersFound = computed(() => playerStore.obsSettings.filtersFound)

const selectedFilterId = computed({
  get: () => playerStore.obsSettings.selectedFilterId,
  set: (value) => playerStore.setObsSelectedFilter(value)
})

const selectedFilter = computed(() => {
  if (!selectedFilterId.value) return null
  return obsFiltersFound.value.find((filter) => filter.id === selectedFilterId.value)
})

const showObsInOverlay = computed({
  get: () => playerStore.obsSettings.showObsInOverlay,
  set: (value) => playerStore.updateObsSettings({ showObsInOverlay: value })
})

const handleApproveTiming = async (timingId) => {
  if (isProcessingTiming.value) return

  try {
    isProcessingTiming.value = true
    processingTimingId.value = timingId
    isApproving.value = true
    isMarkingCleanText.value = false

    await apiApproveTiming(timingId)

    const timing = allTimings.value.find((t) => t.id === timingId)
    if (timing) {
      timing.status = 'approved'
    }

    notificationRef.value.showNotification('Тайминг одобрен')
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(`Ошибка: ${message}`)
  } finally {
    isProcessingTiming.value = false
    processingTimingId.value = null
    isApproving.value = false
    isMarkingCleanText.value = false
  }
}

const handleRejectTiming = async (timingId) => {
  if (isProcessingTiming.value) return

  try {
    isProcessingTiming.value = true
    processingTimingId.value = timingId
    isApproving.value = false
    isMarkingCleanText.value = false

    await apiRejectTiming(timingId)

    const timing = allTimings.value.find((t) => t.id === timingId)
    if (timing) {
      timing.status = 'rejected'
    }

    notificationRef.value.showNotification('Тайминг отклонен')
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(`Ошибка: ${message}`)
  } finally {
    isProcessingTiming.value = false
    processingTimingId.value = null
    isApproving.value = false
    isMarkingCleanText.value = false
  }
}

const handleMarkAsCleanText = async (timingId) => {
  if (isProcessingTiming.value) return

  try {
    isProcessingTiming.value = true
    processingTimingId.value = timingId
    isApproving.value = false
    isMarkingCleanText.value = true

    await apiMarkAsCleanText(timingId)

    const timing = allTimings.value.find((t) => t.id === timingId)
    if (timing) {
      timing.status = 'clean_text'
    }

    notificationRef.value.showNotification('Тайминг отмечен как clean_text')
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(`Ошибка: ${message}`)
  } finally {
    isProcessingTiming.value = false
    processingTimingId.value = null
    isApproving.value = false
    isMarkingCleanText.value = false
  }
}

const showAllTimingsModal = async () => {
  if (isLoadingAllTimings.value) return

  try {
    isLoadingAllTimings.value = true
    showAllTimingsModalVisible.value = true

    const { timings } = await getAllTimingSubmissions()
    allTimings.value = timings
  } catch (error) {
    const { message } = handleApiError(error)
    notificationRef.value.showNotification(message)
    showAllTimingsModalVisible.value = false
  } finally {
    isLoadingAllTimings.value = false
  }
}

const getNounForm = (number, forms) => {
  const cases = [2, 0, 1, 1, 1, 2]
  return forms[number % 100 > 4 && number % 100 < 20 ? 2 : cases[Math.min(number % 10, 5)]]
}

const getContributionWidth = (count) => {
  if (!topSubmitters.value.length) return 0
  const maxCount = Math.max(...topSubmitters.value.map((s) => s.approved_submissions_count))
  return (count / maxCount) * 100
}

const filteredTimings = computed(() => {
  return allTimings.value
})

const toggleTimingSelection = (timingId) => {
  if (selectedTimings.value.has(timingId)) {
    selectedTimings.value.delete(timingId)
  } else {
    selectedTimings.value.add(timingId)
  }
}

const showParseResult = ref({})

function handleShowParse(timing) {
  if (showParseResult.value[timing.id]) {
    showParseResult.value = { ...showParseResult.value, [timing.id]: false }
  } else {
    const parsed = parseTimingTextToSeconds(timing.timing_text, true)
    showParseResult.value = { ...showParseResult.value, [timing.id]: parsed }
  }
}

const isElectron = computed(() => !!window.electronAPI)

// eslint-disable-next-line no-unused-vars
function onAddToAutoblur(id) {
  if (!isElectron.value) {
    if (notificationRef.value) {
      notificationRef.value.showNotification('Доступно только в приложении')
    } else {
      alert('Доступно только в приложении')
    }
    return
  }

  timingIdToAdd.value = id
}

// eslint-disable-next-line no-unused-vars
function onRemoveFromAutoblur(id) {
  if (!isElectron.value) {
    if (notificationRef.value) {
      notificationRef.value.showNotification('Доступно только в приложении')
    } else {
      alert('Доступно только в приложении')
    }
    return
  }
  toggleTimingSelection(id)
}

function onAddToOverlay(id) {
  if (!isElectron.value) {
    if (notificationRef.value) {
      notificationRef.value.showNotification('Доступно только в приложении')
    } else {
      alert('Доступно только в приложении')
    }
    return
  }
  toggleOverlaySelection(id)
}

function onRemoveFromOverlay(id) {
  if (!isElectron.value) {
    if (notificationRef.value) {
      notificationRef.value.showNotification('Доступно только в приложении')
    } else {
      alert('Доступно только в приложении')
    }
    return
  }
  toggleOverlaySelection(id)
}

const toggleOverlaySelection = (timingId) => {
  if (overlayTimings.value.has(timingId)) {
    overlayTimings.value.delete(timingId)
  } else {
    overlayTimings.value.add(timingId)
  }
}

function showGeneralParser() {
  showGeneralParserResult.value = !showGeneralParserResult.value
}

function showOverlayParser() {
  showOverlayParserResult.value = !showOverlayParserResult.value
}

function getGeneralParserResult() {
  const allRanges = []
  if (nudityTimings.value && Array.isArray(nudityTimings.value)) {
    for (const timing of nudityTimings.value) {
      if (selectedTimings.value.has(timing.id)) {
        const parsedRanges = parseTimingTextToSeconds(timing.timing_text, true)
        if (parsedRanges && parsedRanges.length > 0) {
          allRanges.push(...parsedRanges)
        }
      }
    }
  }
  return allRanges
}

function getOverlayParserResult() {
  const allRanges = []
  if (nudityTimings.value && Array.isArray(nudityTimings.value) && nudityTimings.value.length > 0) {
    for (const timing of nudityTimings.value) {
      if (overlayTimings.value.has(timing.id)) {
        const parsedRanges = parseTimingTextToSeconds(timing.timing_text, true)
        if (parsedRanges && parsedRanges.length > 0) {
          allRanges.push(...parsedRanges)
        }
      }
    }
  }
  return allRanges
}

// OBS Functions
const handleObsEnabledChange = () => {
  if (obsEnabled.value) {
    handleObsConnect()
  }
}

const handleObsConnect = async () => {
  if (obsConnecting.value) return

  obsConnecting.value = true
  try {
    if (window.connectToOBS) {
      await window.connectToOBS()
      setTimeout(() => {
        if (window.obsSources) {
          obsSources.value = window.obsSources
        }
      }, 1000)
      notificationRef.value?.showNotification('Подключение к OBS...')
    } else {
      notificationRef.value?.showNotification('Плеер не загружен')
    }
  } catch (error) {
    console.error('Error connecting to OBS:', error)
    notificationRef.value?.showNotification('Ошибка подключения к OBS')
  } finally {
    obsConnecting.value = false
  }
}

const handleObsTestBlur = () => {
  if (!selectedFilterId.value) {
    notificationRef.value?.showNotification('Выберите фильтр для тестирования')
    return
  }

  if (window.testOBSBlur) {
    window.testOBSBlur(selectedFilterId.value)
  } else {
    notificationRef.value?.showNotification('OBS функции недоступны')
  }
}

const handleObsRefreshFilters = () => {
  if (window.refreshOBSFilters) {
    window.refreshOBSFilters()
    notificationRef.value?.showNotification('Поиск фильтров...')
  } else {
    notificationRef.value?.showNotification('OBS функции недоступны')
  }
}

const handleFilterSelect = () => {
  if (selectedFilterId.value) {
    notificationRef.value?.showNotification(`Выбран фильтр: ${selectedFilter.value?.sourceName}`)
  }
}
</script>

<style scoped>
.content {
  min-height: 100vh;
}
/* Стили для информации о фильме */
.content-card {
  overflow: hidden;
  padding: 20px;
  color: #e0e0e0;
}

.content-header {
  height: 80px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-wrap: wrap;
  height: auto;
  min-height: 80px;
}

.content-logo {
  max-height: 80px;
  height: 80px;
  width: auto;
  object-fit: contain;
  max-width: 100%;
  transition: all 0.3s ease;
  cursor: pointer;
  padding: 10px 0 30px;
}

.content-logo:hover {
  filter: drop-shadow(0 0 10px var(--accent-color));
}

.content-title-container {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
  justify-content: center;
}

.movie-poster-thumbnail {
  width: 60px;
  height: 90px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.movie-poster-thumbnail:hover {
  transform: scale(1.05);
}

.movie-poster-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.content-title {
  font-size: 55px;
  margin: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-align: center;
  white-space: normal;
  width: 100%;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  transition: all 0.3s ease;
  cursor: pointer;
}

.content-title:hover {
  text-shadow: 0 0 20px var(--accent-color);
  color: var(--accent-color);
}

.content-subtitle {
  font-size: 20px;
  color: #bbb;
}

.ratings-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin: 15px 0;
}

.action-buttons-group {
  display: inline-flex;
  align-items: center;
  gap: 15px;
}

.action-buttons-group .mobile-text {
  display: none;
}

.rating-link {
  display: inline-flex;
  align-items: center;
  color: #fff;
  text-decoration: none;
  font-weight: bold;
  background: rgba(0, 0, 0, 0.7);
  padding: 5px 10px;
  border-radius: 5px;
  gap: 5px;
  transition: all 0.2s ease;
  vertical-align: middle;
}

.rating-link:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
}

.rating-logo {
  width: 20px;
  height: 20px;
  margin-right: 5px;
}

.external-link-icon {
  width: 20px;
  height: auto;
  margin-left: 5px;
}

.additional-info {
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 16px;
}

.additional-info-title {
  margin: 15px 0 15px;
  text-align: left;
  color: #fff;
}

.info-content {
  display: flex;
  gap: 15px;
  align-items: flex-start;
}

.movie-poster-container {
  flex-shrink: 0;
  width: 200px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.movie-poster-container:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 20px var(--accent-semi-transparent);
}

.movie-poster {
  width: 100%;
  height: auto;
  display: block;
}

.details-container {
  flex: 1;
  min-width: 0;
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.info-list li {
  margin-bottom: 8px;
}

.content-info {
  font-size: 16px;
  line-height: 1.6;
  color: #ccc;
  margin-top: 20px;
}

.content-description-text {
  margin: 0;
  white-space: pre-wrap;
}

.error-message {
  color: var(--accent-color);
  text-align: center;
  padding: 20px;
  font-size: 1.2rem;
  border: 1px solid var(--accent-color);
  border-radius: 5px;
  margin: 20px auto;
  max-width: 500px;
  background: var(--accent-transparent);
}

/* Стили для секций с похожими фильмами */
.related-movies {
  margin-top: 30px;
  position: relative;
}

.related-movies h2 {
  color: #fff;
  margin-bottom: 15px;
}

/* Подсказка */
.title-copy-tooltip {
  position: absolute;
  background-color: #333;
  color: #fff;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
}

@media (max-width: 600px) {
  .content-card {
    padding: 0 2px;
  }

  .content-header,
  .content-logo,
  .content-title {
    display: none;
  }

  .content-subtitle {
    font-size: 16px;
  }

  .ratings-links {
    margin: 5px 0;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rating-link {
    padding: 3px 6px;
    font-size: 14px;
  }

  .rating-logo {
    width: 16px;
    height: 16px;
    margin-right: 3px;
  }

  .external-link-icon {
    width: 16px;
    margin-left: 3px;
  }

  .action-buttons-group {
    width: 100%;
    justify-content: center;
    gap: 10px;
    margin-top: 10px;
  }

  .action-buttons-group .nudity-info-btn {
    background: rgba(0, 0, 0, 0.7);
    padding: 12px 16px;
    border-radius: 8px;
    min-height: 44px;
    font-size: 14px;
  }

  .action-buttons-group .mobile-text {
    display: inline;
  }

  .action-buttons-group .desktop-text {
    display: none;
  }

  .action-buttons-group .nudity-info-btn i {
    font-size: 18px;
  }

  .additional-info-title {
    font-size: 20px;
  }

  .info-content {
    flex-direction: column;
    align-items: center;
  }

  .content-title-container {
    flex-direction: column;
    gap: 10px;
  }

  .movie-poster-thumbnail {
    width: 50px;
    height: 75px;
  }
}

.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 40px;
  border-radius: 10px;
}

.controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #444;
  color: #fff;
  border: none;
  padding: 12px;
  font-size: 18px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.3s ease;
  z-index: 4;
  width: 50px;
  height: 50px;
}

.controls button:hover {
  background-color: var(--accent-color);
  transform: translateY(-3px);
  box-shadow: 0 4px 10px var(--accent-semi-transparent);
}

.controls button:active {
  transform: translateY(0);
  box-shadow: none;
}

.controls button.active {
  background-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
}

.material-icons {
  font-size: 24px;
}

.tooltip-container {
  position: relative;
  display: inline-block;
}

.custom-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #333;
  color: #fff;
  padding: 5px;
  border-radius: 4px;
  font-size: 16px;
  white-space: nowrap;
  margin-top: 8px;
  pointer-events: none;
  text-align: center;
}

.advanced-tooltip {
  white-space: normal;
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  top: calc(100% + 5px);
  pointer-events: all;
  text-align: center;
}

.tooltip-title {
  font-size: 16px;
  text-align: center;
}

.movie-skeleton {
  padding: 0 20px 20px;
  color: #e0e0e0;
}

.movie-skeleton__header {
  height: 80px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.movie-skeleton__logo {
  width: 200px;
  height: 80px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
}

.movie-skeleton__title {
  width: 30%;
  height: 40px;
  background: linear-gradient(
    90deg,
    rgba(40, 40, 40, 0.8) 0%,
    rgba(60, 60, 60, 0.8) 50%,
    rgba(40, 40, 40, 0.8) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 12px;
  margin: 0 auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
}

.movie-skeleton__title::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 100%
  );
  animation: shine 1.5s infinite;
}

@keyframes shine {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.movie-skeleton__ratings {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin: 15px 0;
}

.movie-skeleton__rating-item {
  width: 120px;
  height: 30px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
}

.movie-skeleton__player {
  width: 60%;
  height: 500px;
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 12px;
  margin: 20px auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.movie-skeleton__player::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

.movie-skeleton__additional-info {
  margin: 20px 0;
}

.movie-skeleton__section-title {
  width: 150px;
  height: 24px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
  margin-bottom: 15px;
}

.movie-skeleton__info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.movie-skeleton__info-item {
  width: 100%;
  height: 20px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
}

.movie-skeleton__description {
  margin: 20px 0;
}

.movie-skeleton__description-line {
  width: 100%;
  height: 16px;
  background: linear-gradient(
    90deg,
    rgba(30, 30, 30, 0.9) 0%,
    rgba(50, 50, 50, 0.9) 50%,
    rgba(30, 30, 30, 0.9) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
  border-radius: 8px;
  margin-bottom: 10px;
}

.movie-skeleton__description-line:nth-child(2) {
  width: 90%;
}

.movie-skeleton__description-line:nth-child(3) {
  width: 95%;
}

.movie-skeleton__description-line:nth-child(4) {
  width: 85%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 600px) {
  .movie-skeleton {
    padding: 10px;
  }

  .movie-skeleton__header {
    height: 60px;
  }

  .movie-skeleton__logo {
    width: 150px;
    height: 60px;
  }

  .movie-skeleton__title {
    width: 70%;
    height: 30px;
  }

  .movie-skeleton__player {
    height: 250px;
  }

  .movie-skeleton__rating-item {
    width: 80px;
    height: 25px;
  }

  .movie-skeleton__control-btn {
    width: 40px;
    height: 40px;
  }
}

.staff-section {
  border-radius: 8px;
}

.staff-categories {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.staff-category h3 {
  color: #fff;
  margin-bottom: 10px;
  font-size: 18px;
}

.staff-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  align-items: start;
  margin-bottom: 10px;
}

.staff-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  height: 100%;
}

.staff-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s;
  height: 100%;
}

.staff-link:hover {
  transform: translateY(-3px);
  filter: drop-shadow(0 4px 8px var(--accent-semi-transparent));
}

.staff-photo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 8px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.staff-link:hover .staff-photo {
  border-color: var(--accent-color);
  box-shadow: 0 0 12px var(--accent-semi-transparent);
}

.staff-name {
  font-size: 14px;
  color: #fff;
  margin-bottom: 4px;
  min-height: 2.8em;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 4px;
}

.staff-role {
  font-size: 12px;
  color: #aaa;
  min-height: 1.8em;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 4px;
}

@media (max-width: 600px) {
  .staff-list {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  .staff-photo {
    width: 60px;
    height: 60px;
  }

  .staff-name {
    font-size: 12px;
    min-height: 2.4em;
  }

  .staff-role {
    font-size: 10px;
    min-height: 1.6em;
  }
}

.show-all-link {
  display: inline-block;
  color: #aaa;
  text-decoration: none;
  margin-top: 10px;
  cursor: pointer;
  transition: color 0.2s;
}

.show-all-link:hover {
  color: #fff;
  text-decoration: underline;
}
.expand-actors-circle-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  font-size: 24px;
  text-decoration: none;
  flex-shrink: 0;
}

.expand-circle-button {
  position: absolute;
  top: 0;
  right: 15px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  font-size: 20px;
  text-decoration: none;
}

.expand-circle-button:hover {
  background: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px var(--accent-semi-transparent);
}

@media (max-width: 600px) {
  .expand-circle-button {
    width: 35px;
    height: 35px;
    font-size: 16px;
  }
}

.show-more-btn {
  display: block;
  margin: 15px auto;
  padding: 8px 16px;
  background: #3a3a3a;
  color: #fff;
  border: 1px solid #505050;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.show-more-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 4px 8px var(--accent-semi-transparent);
}

.show-more-btn:active {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.nudity-info-btn {
  position: relative;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  display: flex;
  align-items: center;
  gap: 5px;
}

.nudity-info-btn:hover i {
  color: var(--accent-color);
}

.nudity-info-btn:hover,
.parents-guide-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: var(--accent-color) !important;
  box-shadow: 0 0 10px var(--accent-semi-transparent) !important;
}

.parents-guide-btn {
  background: rgba(0, 0, 0, 0.7);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.parents-guide-btn i {
  margin-left: 5px;
}

.nudity-info-btn i {
  font-size: 20px;
  color: #fff;
}

.nudity-info-btn .fa-spinner {
  color: #fff;
}

.nudity-info-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 20px;
  min-width: 900px;
  max-width: 1500px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.nudity-info-content {
  color: #fff;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  margin-bottom: 15px;
  max-height: 80vh;
  overflow-y: auto;
}

.nudity-info-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 20px;
  color: #fff;
}

.nudity-info-loading i {
  font-size: 20px;
  color: var(--accent-color);
}

.nudity-info-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-start;
  margin-top: 10px;
}

.nudity-info-button {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  pointer-events: all;
}

.nudity-info-button:hover {
  background: var(--accent-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px var(--accent-semi-transparent);
}

.nudity-info-button i {
  font-size: 16px;
}

@media (max-width: 600px) {
  .nudity-info-popup {
    min-width: 300px;
    max-width: 95vw;
    margin: 0 10px;
  }
}

.staff-names-container {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  margin-bottom: 15px;
  width: 100%;
}

.staff-names-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: 1;
  min-width: 0;
  align-items: center;
}

.staff-name-link {
  color: #fff;
  text-decoration: none;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.staff-name-link:hover {
  background: var(--accent-color);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px var(--accent-semi-transparent);
}

.staff-list .expand-actors-circle-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  font-size: 24px;
  text-decoration: none;
  flex-shrink: 0;
}

.staff-list .expand-actors-circle-button:hover {
  background: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px var(--accent-semi-transparent);
}

.staff-names-list .expand-actors-circle-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  font-size: 16px;
  text-decoration: none;
  flex-shrink: 0;
}

.staff-names-list .expand-actors-circle-button:hover {
  background: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px var(--accent-semi-transparent);
}

@media (max-width: 600px) {
  .staff-names-container {
    flex-direction: row;
    align-items: flex-start;
    gap: 10px;
  }

  .staff-names-list {
    width: auto;
    flex: 1;
  }

  .staff-name-link {
    font-size: 14px;
    padding: 4px 8px;
  }

  .staff-list .expand-actors-circle-button {
    width: 60px;
    height: 60px;
    font-size: 20px;
  }

  .staff-names-list .expand-actors-circle-button {
    width: 35px;
    height: 35px;
    font-size: 14px;
  }
}

.related-movies-list :deep(.grid) {
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.related-movies-list :deep(.grid.card-size-small) {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.related-movies-list :deep(.grid.card-size-medium) {
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.related-movies-list :deep(.grid.card-size-large) {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

@media (max-width: 620px) {
  .related-movies-list :deep(.grid) {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .info-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .desktop-only {
    display: none;
  }
}

.rating-value.low {
  color: #ff6b6b !important;
}

.rating-value.medium {
  color: #ffd93d !important;
}

.rating-value.high {
  color: #51cf66 !important;
}

.desktop-text {
  display: inline;
}

.mobile-text {
  display: none;
}

@media (max-width: 600px) {
  .desktop-text {
    display: none;
  }

  .mobile-text {
    display: inline;
  }
}

.mobile-list-dropdown {
  position: relative;
  margin: 15px 0;
}

.mobile-list-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  padding: 12px 15px;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
}

.mobile-list-toggle:active {
  transform: scale(0.98);
}

.mobile-list-toggle .material-icons {
  font-size: 24px;
}

.mobile-list-toggle.active {
  background: transparent;
  box-shadow: none;
}

.mobile-list-toggle:not(.active):hover {
  background: rgba(255, 255, 255, 0.2);
}

.mobile-list-toggle .button-label {
  flex: 1;
}

.mobile-list-toggle .material-icons.active {
  color: var(--accent-color);
  text-shadow: 0 0 8px var(--accent-semi-transparent);
}

.mobile-list-content {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  width: 100%;
  background: rgba(0, 0, 0, 0.95);
  border-radius: 8px;
  padding: 10px;
  z-index: 1000;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  transform-origin: top center;
  animation: dropdownSlide 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes dropdownSlide {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mobile-list-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  padding: 12px 15px;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
  margin-bottom: 5px;
}

.mobile-list-btn:last-child {
  margin-bottom: 0;
}

.mobile-list-btn:active {
  transform: scale(0.98);
}

.mobile-list-btn .material-icons {
  font-size: 24px;
}

.mobile-list-btn.active {
  background: transparent;
  box-shadow: none;
}

.mobile-list-btn .material-icons.active {
  color: var(--accent-color);
  text-shadow: 0 0 8px var(--accent-semi-transparent);
}

.dropdown-arrow {
  transition: transform 0.2s ease;
}

.dropdown-arrow.expanded {
  transform: rotate(180deg);
}

.rating-boxes {
  display: flex;
  gap: 10px;
  margin: 10px 0;
}

.rating-box {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  gap: 5px;
}

.rating-box.mpaa {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.rating-box.mpaa span {
  font-size: 0.9em;
}

.rating-box.age {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
}

.rating-box strong {
  font-size: 0.9em;
  opacity: 0.8;
}

.rating-box span {
  font-size: 1.1em;
}

@media (max-width: 600px) {
  .rating-boxes {
    flex-wrap: wrap;
  }

  .rating-box {
    font-size: 14px;
    padding: 3px 6px;
  }
}

.text-red {
  color: #ff4444 !important;
}

.text-red-blink {
  color: #ff4444 !important;
  animation: blink-red-streamer 0.8s ease-in-out infinite;
}

@keyframes blink-red-streamer {
  0%,
  100% {
    color: #ff4444;
    text-shadow:
      0 0 15px #ff4444,
      0 0 25px #ff4444;
    transform: scale(1);
  }
  50% {
    color: #ff8888;
    text-shadow:
      0 0 20px #ff4444,
      0 0 35px #ff4444,
      0 0 45px #ff4444;
    transform: scale(1.15);
  }
}

.text-green {
  color: #51cf66 !important;
}

.acknowledgment-table {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 15px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.acknowledgment-header {
  background: rgba(145, 70, 255, 0.15);
  padding: 10px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #fff;
  border-bottom: 1px solid rgba(145, 70, 255, 0.2);
}

.acknowledgment-header i {
  color: #ff66ab;
}

.acknowledgment-content {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.acknowledgment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.acknowledgment-row.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.acknowledgment-row.clickable:hover {
  transform: translateX(4px);
}

.community-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9146ff;
  font-weight: 500;
}

.community-link i {
  font-size: 20px;
}

.twitch-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #9146ff;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.twitch-link:hover {
  color: #a970ff;
  transform: translateX(4px);
}

.twitch-link i {
  font-size: 20px;
}

.acknowledgment-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

@media (max-width: 600px) {
  .acknowledgment-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 8px 0;
  }

  .acknowledgment-text {
    font-size: 12px;
  }

  .twitch-link,
  .community-link {
    font-size: 14px;
  }

  .twitch-link i,
  .community-link i {
    font-size: 16px;
  }
}

.timings-content {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.timings-warning {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffc107;
  font-weight: 500;
  margin-bottom: 10px;
}

.timings-warning i {
  font-size: 16px;
}

.verified-icon {
  color: #28a745;
  margin-left: 4px;
  font-size: 12px;
}

.edit-button {
  background: rgba(40, 167, 69, 0.1) !important;
  border: 1px solid rgba(40, 167, 69, 0.3) !important;
}

.edit-button:hover {
  background: rgba(40, 167, 69, 0.2) !important;
}

.delete-button {
  background: rgba(220, 53, 69, 0.1) !important;
  border: 1px solid rgba(220, 53, 69, 0.3) !important;
}

.delete-button:hover {
  background: rgba(220, 53, 69, 0.2) !important;
}

.report-button {
  background: rgba(255, 193, 7, 0.1) !important;
  border: 1px solid rgba(255, 193, 7, 0.3) !important;
}

.report-button:hover {
  background: rgba(255, 193, 7, 0.2) !important;
}

.timings-content.no-border {
  border-top: none;
  padding-top: 0;
}

.timings-text {
  white-space: pre-wrap;
  margin-bottom: 10px;
}

.nudity-info-actions,
.timing-form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-start;
}

.timing-form-actions {
  padding: 0;
}

.timing-submission-form,
.timing-login-prompt {
  margin-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 15px;
}

.timing-submission-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding-right: 20px;
}

.timing-login-prompt {
  text-align: center;
}

.timing-input,
.timing-textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  padding: 8px 12px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.timing-input:focus,
.timing-textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-semi-transparent);
}

.timing-textarea {
  min-height: 200px;
  max-height: 400px;
  padding: 10px 12px;
  resize: vertical;
  overflow-y: auto;
}

.submit-timing-btn,
.close-modal-btn {
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.submit-timing-btn {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.submit-timing-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px var(--accent-semi-transparent);
}

.submit-timing-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.close-modal-btn {
  background: none;
  font-size: 20px;
  padding: 5px;
}

.close-modal-btn:hover {
  color: var(--accent-color);
  transform: scale(1.1);
}

.login-link,
.twitch-link {
  color: var(--accent-color);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.login-link:hover {
  text-decoration: underline;
  text-shadow: 0 0 8px var(--accent-semi-transparent);
}

.twitch-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #9146ff;
  font-weight: 500;
}

.twitch-link:hover {
  color: #a970ff;
  transform: translateX(4px);
}

.twitch-link i {
  font-size: 20px;
}

.timing-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.timing-modal-content {
  background: #1a1a1a;
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  overflow-y: auto;
}

.timing-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.timing-modal-header h3 {
  margin: 0;
  color: #fff;
  font-size: 18px;
}

.text-green {
  color: #51cf66 !important;
}

.clickable-acknowledgment {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.clickable-acknowledgment:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.acknowledgment-table {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 15px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.acknowledgment-header {
  background: rgba(145, 70, 255, 0.15);
  padding: 10px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #fff;
  border-bottom: 1px solid rgba(145, 70, 255, 0.2);
}

.acknowledgment-header i {
  color: #ff66ab;
}

.acknowledgment-content {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.acknowledgment-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  margin-top: 4px;
}

@media (max-width: 600px) {
  .timing-modal-content {
    width: 95%;
    padding: 15px;
  }

  .timing-modal-header h3 {
    font-size: 16px;
  }

  .timing-input,
  .timing-textarea {
    font-size: 13px;
  }

  .timing-textarea {
    min-height: 60px;
  }

  .submit-timing-btn {
    padding: 6px 12px;
    font-size: 13px;
  }

  .timing-submission-form {
    padding-right: 15px;
    padding-left: 15px;
  }
}

.top-submitters {
  padding: 10px 0;
}

.top-submitters h3 {
  margin: 0 0 15px 0;
  color: #fff;
  font-size: 18px;
  text-align: center;
}

.top-submitters-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.top-submitter-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.top-submitter-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(5px);
}

.submitter-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-color);
  color: #fff;
  border-radius: 50%;
  font-weight: bold;
  font-size: 14px;
}

.submitter-info {
  flex: 1;
}

.submitter-name {
  color: #fff;
  font-weight: 500;
  font-size: 16px;
  margin-bottom: 4px;
}

.submitter-name a {
  color: #9146ff;
  text-decoration: none;
  transition: all 0.2s ease;
}

.submitter-name a:hover {
  color: #a970ff;
  text-decoration: underline;
}

.submitter-name a i {
  margin-left: 5px;
  font-size: 14px;
}

@media (max-width: 600px) {
  .submitter-name a i {
    font-size: 12px;
  }
}

.submitter-count {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  margin-top: 2px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.modal-content {
  background: #1a1a1a;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 24px;
  color: #fff;
}

.modal-body {
  padding: 20px;
}

.top-submitters-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.top-submitter-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.top-submitter-item:hover {
  transform: translateX(5px);
  background: rgba(255, 255, 255, 0.08);
}

.submitter-rank {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-color);
  color: #fff;
  border-radius: 50%;
  font-weight: bold;
  font-size: 16px;
  flex-shrink: 0;
}

.submitter-rank.gold {
  background: linear-gradient(45deg, #ffd700, #ffa500);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
}

.submitter-rank.silver {
  background: linear-gradient(45deg, #c0c0c0, #a9a9a9);
  box-shadow: 0 0 15px rgba(192, 192, 192, 0.5);
}

.submitter-rank.bronze {
  background: linear-gradient(45deg, #cd7f32, #8b4513);
  box-shadow: 0 0 15px rgba(205, 127, 50, 0.5);
}

.submitter-info {
  flex: 1;
  min-width: 0;
}

.submitter-name {
  color: #fff;
  font-weight: 500;
  font-size: 16px;
  margin-bottom: 4px;
}

.submitter-name a {
  color: #9146ff;
  text-decoration: none;
  transition: all 0.2s ease;
}

.submitter-name a:hover {
  color: #a970ff;
  text-decoration: underline;
}

.submitter-name a i {
  margin-left: 5px;
  font-size: 14px;
}

@media (max-width: 600px) {
  .submitter-name a i {
    font-size: 12px;
  }
}

.submitter-count {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.submitter-contribution {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
}

.contribution-bar {
  height: 100%;
  background: var(--accent-color);
  transition: width 1s ease;
}

@media (max-width: 600px) {
  .modal-content {
    width: 95%;
    margin: 10px;
  }

  .modal-header h3 {
    font-size: 20px;
  }

  .submitter-rank {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }

  .submitter-name {
    font-size: 14px;
  }

  .submitter-count {
    font-size: 12px;
  }
}

.timing-entries {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timing-entry {
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.timing-entry.top-rated {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.timing-entry.highly-rated {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.3);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.1);
}

.timing-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timing-text {
  font-family: monospace;
  color: #fff;
  font-size: 1.1em;
}

.timing-author {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85em;
  font-style: italic;
}

.timing-vote-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.vote-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85em;
}

.vote-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.vote-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vote-button.upvote-button.active {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
  color: #22c55e;
}

.vote-button.upvote-button.active:hover {
  background: rgba(34, 197, 94, 0.3);
}

.vote-button.downvote-button.active {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.vote-button.downvote-button.active:hover {
  background: rgba(239, 68, 68, 0.3);
}

.vote-count {
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

.vote-score {
  font-weight: 700;
  font-size: 0.9em;
  padding: 4px 8px;
  border-radius: 4px;
  min-width: 30px;
  text-align: center;
}

.vote-score.positive {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.vote-score.negative {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.vote-score.neutral {
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
}

.timing-entry.pending {
  background: rgba(255, 165, 0, 0.1);
  border: 1px solid rgba(255, 165, 0, 0.2);
}

.timing-entry.clean-text {
  background: rgba(255, 165, 0, 0.1);
  border: 1px solid rgba(255, 165, 0, 0.2);
}

.pending-badge {
  display: inline-block;
  background: rgba(255, 165, 0, 0.2);
  color: #ffa500;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-bottom: 4px;
}

.clean-text-badge {
  display: inline-block;
  background: rgba(255, 165, 0, 0.2);
  color: #ffa500;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-bottom: 4px;
}

.top-rated-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-bottom: 4px;
  font-weight: 600;
}

.highly-rated-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(34, 197, 94, 0.3);
  color: #22c55e;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-bottom: 4px;
  font-weight: 700;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.2);
}

.timing-hover-container.blurred {
  filter: blur(4px);
}

.timing-hover-container.blurred:hover {
  filter: blur(0);
  transition: filter 0.3s ease;
}

.hint-text {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.7);
  font-weight: normal;
}

.hint-text a {
  color: var(--accent-color);
  text-decoration: none;
  transition: all 0.2s ease;
}

.hint-text a:hover {
  text-decoration: underline;
  text-shadow: 0 0 8px var(--accent-semi-transparent);
}

.modal-header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.show-all-timings-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  margin-bottom: 20px;
  width: fit-content;
}

.show-all-timings-btn:hover:not(:disabled) {
  background: var(--accent-color-dark, #7a4cb8);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px var(--accent-semi-transparent);
}

.show-all-timings-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.all-timings-modal {
  max-width: 800px;
  width: 95%;
  max-height: 90vh;
}

.all-timings-modal .modal-body {
  max-height: 70vh;
  overflow-y: auto;
  padding: 20px;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 40px;
  color: #fff;
}

.loading-spinner i {
  font-size: 24px;
  color: var(--accent-color);
}

.no-timings {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.7);
}

.all-timings-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.timing-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  transition: all 0.2s ease;
}

.timing-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.all-timings-list .timing-item .timing-content {
  padding: 15px;
}

.timing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.timing-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.timing-date {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.timing-movie-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.timing-kp-id {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-family: monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.timing-kp-id.clickable:hover {
  color: var(--accent-color);
  background: rgba(var(--accent-color-rgb), 0.2);
  transform: translateY(-1px);
  text-decoration: none;
}

@media (max-width: 768px) {
  .modal-header-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .show-all-timings-btn {
    justify-content: center;
  }

  .all-timings-modal {
    width: 95%;
    margin: 10px;
  }

  .timing-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .timing-meta {
    justify-content: space-between;
  }

  .timing-movie-info {
    justify-content: flex-end;
  }
}

.admin-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.approve-btn,
.reject-btn,
.clean-text-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.approve-btn {
  background: rgba(81, 207, 102, 0.2);
  color: #51cf66;
  border: 1px solid rgba(81, 207, 102, 0.3);
}

.approve-btn:hover:not(:disabled) {
  background: rgba(81, 207, 102, 0.3);
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(81, 207, 102, 0.3);
}

.reject-btn {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.reject-btn:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.3);
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(255, 107, 107, 0.3);
}

.approve-btn:disabled,
.reject-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.clean-text-btn {
  background: rgba(255, 165, 0, 0.2);
  color: #ffa500;
  border: 1px solid rgba(255, 165, 0, 0.3);
}

.clean-text-btn:hover:not(:disabled) {
  background: rgba(255, 165, 0, 0.3);
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(255, 165, 0, 0.3);
}

.clean-text-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 600px) {
  .admin-controls {
    margin-left: 0;
    margin-top: 8px;
  }

  .approve-btn,
  .reject-btn,
  .clean-text-btn {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
}

.timing-preview {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-top: 10px;
}

.timing-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
}

.timing-preview-header i {
  color: var(--accent-color);
}

.timing-preview-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timing-preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 13px;
}

.timing-preview-range {
  color: #fff;
  font-weight: 500;
  font-family: 'Courier New', monospace;
}

.timing-preview-duration {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.overlay-button {
  background: var(--accent-color) !important;
}

.overlay-button:hover {
  background: var(--accent-color) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 8px var(--accent-semi-transparent) !important;
}

.obs-button {
  background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important;
  color: white !important;
}

.obs-button:hover {
  background: linear-gradient(135deg, #e55a2b 0%, #e68900 100%) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
}

.obs-modal {
  z-index: 10001;
}

.obs-modal-content {
  max-width: 600px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 15px;
  box-sizing: border-box;
}

.obs-settings-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 0;
}

.obs-setting-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.obs-setting-group:last-child {
  margin-bottom: 0;
}

.obs-checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  color: #fff;
}

.obs-checkbox-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: #ff6b35;
}

.obs-setting-description {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 6px;
  line-height: 1.3;
}

.obs-connection-settings {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.obs-setting-group label {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
}

.obs-input,
.obs-select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
  transition: all 0.3s ease;
  margin-bottom: 6px;
  box-sizing: border-box;
}

.obs-input:focus,
.obs-select:focus {
  outline: none;
  border-color: #ff6b35;
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.2);
}

.obs-range {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  accent-color: #ff6b35;
}

.obs-status {
  padding: 12px 16px;
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.obs-status.connected {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.obs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.obs-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  min-width: 140px;
  justify-content: center;
}

.obs-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.connect-btn {
  background: linear-gradient(135deg, #9c27b0, #7b1fa2);
  color: white;
}

.connect-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #8e24aa, #6a1b9a);
  transform: translateY(-1px);
}

.test-btn {
  background: linear-gradient(135deg, #2196f3, #0b7dda);
  color: white;
}

.test-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1976d2, #0b6cb7);
  transform: translateY(-1px);
}

.refresh-btn {
  background: linear-gradient(135deg, #ff9800, #e68900);
  color: white;
}

.refresh-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #f57c00, #bf6900);
  transform: translateY(-1px);
}

.obs-warning {
  padding: 12px;
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.4;
}

.obs-filters-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.obs-filter-selection {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.obs-filter-select {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;
}

.obs-filter-select:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 5px var(--accent-semi-transparent);
}

.obs-filter-select option {
  background: #2a2a2a;
  color: #fff;
}

.selected-filter-info {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-details {
  font-size: 14px;
  color: #fff;
  text-align: center;
}

.filter-status {
  font-size: 13px;
  color: #f44336;
  font-weight: 500;
  text-align: center;
}

.filter-status.enabled {
  color: #4caf50;
}

.obs-info {
  padding: 10px 12px;
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 6px;
  color: #4caf50;
  font-size: 13px;
  text-align: center;
}

@media (max-width: 600px) {
  .timing-actions-row {
    display: none !important;
  }

  .obs-button {
    display: none !important;
  }

  .obs-actions {
    flex-direction: column;
  }

  .obs-action-btn {
    min-width: unset;
  }
}

.timing-author {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85em;
  font-style: italic;
}

.timing-count {
  color: var(--accent-color);
  font-weight: 500;
  font-style: normal;
  margin-left: 4px;
}

.note-btn {
  transition: all 0.3s ease;
}

.note-btn.has-note {
  color: #ffd700;
  animation: pulse-note 2s infinite;
}

.note-btn.has-note i {
  color: #ffd700;
  filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.5));
}

@keyframes pulse-note {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.movie-note-display {
  margin: 30px 0;
  padding: 20px;
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.05) 0%, rgba(255, 107, 53, 0.02) 100%);
  border: 2px solid rgba(255, 107, 53, 0.2);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.movie-note-display:hover {
  box-shadow: 0 6px 16px rgba(255, 107, 53, 0.15);
  transform: translateY(-2px);
}

.movie-note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.movie-note-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.movie-note-title i {
  color: var(--accent-color);
  font-size: 1.5em;
}

.movie-note-title h3 {
  margin: 0;
  color: #fff;
  font-size: 1.3em;
}

.movie-note-actions {
  display: flex;
  gap: 8px;
}

.note-edit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.note-edit-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  transform: scale(1.05);
}

.movie-note-content {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.05em;
  line-height: 1.7;
  white-space: pre-wrap;
  word-wrap: break-word;
  padding: 15px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 10px;
}

.movie-note-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.note-date {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.note-modal .note-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 15px;
  font-size: 0.95em;
}

.note-info i {
  color: #2196f3;
  font-size: 1.2em;
}

.note-textarea {
  min-height: 200px;
  font-family: inherit;
  line-height: 1.6;
}

.char-counter {
  text-align: right;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85em;
  margin-top: -10px;
  margin-bottom: 10px;
}

.note-form-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.note-form-actions button {
  flex: 1;
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.delete-note-btn {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1em;
  font-weight: 600;
}

.delete-note-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
  transform: scale(1.02);
}

.delete-note-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-note-btn {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1em;
}

.cancel-note-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

@media (max-width: 600px) {
  .movie-note-display {
    margin: 20px -10px;
    padding: 15px;
  }

  .movie-note-title h3 {
    font-size: 1.1em;
  }

  .movie-note-content {
    font-size: 1em;
    padding: 12px;
  }

  .note-form-actions {
    flex-direction: column;
  }

  .note-form-actions button {
    width: 100%;
    min-width: unset;
  }
}
</style>
