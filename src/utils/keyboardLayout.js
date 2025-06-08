const RUSSIAN_CHARS = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
const ENGLISH_CHARS = 'f,dult`;pbqrkvyjghcnea[wxio]sm\'.zF<DULT~:PBQRKVYJGHCNEA{WXIO}SM">Z'

const LAYOUT_MAP = {}

for (let i = 0; i < RUSSIAN_CHARS.length; i++) {
  LAYOUT_MAP[RUSSIAN_CHARS[i]] = ENGLISH_CHARS[i]
  LAYOUT_MAP[ENGLISH_CHARS[i]] = RUSSIAN_CHARS[i]
}

const isConsonant = (char) => {
  const RUSSIAN_CONSONANTS = 'бвгджзйклмнпрстфхцчшщБВГДЖЗЙКЛМНПРСТФХЦЧШЩ'
  const ENGLISH_CONSONANTS = 'bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ'
  return RUSSIAN_CONSONANTS.includes(char) || ENGLISH_CONSONANTS.includes(char)
}

export const hasConsecutiveConsonants = (text, count = 3) => {
  if (!text || text.length < count) return false

  let consecutiveCount = 0
  for (let i = 0; i < text.length; i++) {
    if (isConsonant(text[i])) {
      consecutiveCount++
      if (consecutiveCount >= count) return true
    } else {
      consecutiveCount = 0
    }
  }
  return false
}

export const suggestLayout = (text) => {
  const russianCount = text.split('').filter((char) => RUSSIAN_CHARS.includes(char)).length
  const englishCount = text.split('').filter((char) => ENGLISH_CHARS.includes(char)).length

  return russianCount > englishCount ? 'английскую' : 'русскую'
}

export const convertLayout = (text) => {
  if (!text) return ''

  return text
    .split('')
    .map((char) => LAYOUT_MAP[char] || char)
    .join('')
}
