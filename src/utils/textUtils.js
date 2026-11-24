export const getMovieName = (rawData) => {
  if (!rawData) return ''
  return rawData.nameRu ?? rawData.name_ru ?? rawData.nameEn ?? rawData.name_en ?? ''
}
