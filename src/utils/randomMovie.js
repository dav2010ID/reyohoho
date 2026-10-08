// Adapt both legacy /chance responses and normalized public movie cards for the modal.
const toMinutes = (value) => {
  if (typeof value === 'string' && /^\d{1,3}:[0-5]\d:[0-5]\d$/.test(value)) {
    const [hours, minutes, seconds] = value.split(':').map(Number)
    return Math.round(hours * 60 + minutes + seconds / 60)
  }
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null
}

const ageLabel = (value) => {
  const age = String(value ?? '').match(/^(?:age)?(\d{1,2})\+?$/i)
  return age ? age[1] + '+' : value || ''
}

export const normalizeRandomMovie = (movie, info = {}) => {
  const joinNames = (values, key) =>
    Array.isArray(values)
      ? values
          .map((value) => value?.[key] || value?.name || '')
          .filter(Boolean)
          .join(', ')
      : values || ''
  return {
    ...movie,
    title: info.title || movie.title,
    name_original: info.name_original || movie.name_original,
    cover: info.poster_url || movie.cover || movie.poster_url || movie.poster,
    year: info.year || movie.year,
    type: info.type || movie.type,
    description: info.description || movie.description,
    duration:
      toMinutes(info.duration || info.film_length) ||
      toMinutes(movie.duration || movie.film_length),
    age_rating: ageLabel(
      info.age_rating || info.rating_age_limits || movie.age_rating || movie.rating_age_limits
    ),
    countries: joinNames(info.countries?.length ? info.countries : movie.countries, 'country'),
    genres: joinNames(info.genres?.length ? info.genres : movie.genres, 'genre'),
    rating_kp: info.rating_kp ?? info.rating_kinopoisk ?? movie.rating_kp ?? movie.rating_kinopoisk,
    rating_imdb: info.rating_imdb ?? movie.rating_imdb,
    url_kp: info.web_url || movie.url_kp || movie.web_url,
    total_rating:
      info.total_rating ||
      info.rating_kinopoisk_vote_count ||
      movie.total_rating ||
      movie.rating_kinopoisk_vote_count,
    budget: info.budget || movie.budget,
    fees_world: info.fees_world || movie.fees_world,
    fees_russia: info.fees_russia || movie.fees_russia,
    premiere_ru: info.premiere_ru || movie.premiere_ru,
    premiere_world: info.premiere_world || movie.premiere_world
  }
}
