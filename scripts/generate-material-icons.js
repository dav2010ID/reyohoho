import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const MATERIAL_ICON_NAMES = Object.freeze([
  'arrow_back_ios',
  'arrow_forward_ios',
  'aspect_ratio',
  'blur_on',
  'bookmark_add',
  'bookmark_added',
  'bookmark_border',
  'cancel',
  'center_focus_strong',
  'check',
  'check_circle',
  'check_circle_outline',
  'close',
  'content_copy',
  'dark_mode',
  'delete_sweep',
  'download',
  'expand_more',
  'favorite',
  'favorite_border',
  'flip',
  'folder',
  'fullscreen_exit',
  'graphic_eq',
  'hourglass_top',
  'layers',
  'layers_clear',
  'light_mode',
  'movie',
  'not_interested',
  'open_in_new',
  'palette',
  'picture_in_picture_alt',
  'schedule',
  'settings',
  'share',
  'upload',
  'visibility',
  'visibility_off',
  'warning',
  'watch_later'
])

const GOOGLE_FONTS_CSS_URL = 'https://fonts.googleapis.com/css2'
const FONT_FAMILY = 'Material Symbols Outlined:opsz,wght,FILL,GRAD@24,400,0,0'
const OUTPUT_PATH = path.resolve('src/assets/fonts/material-symbols-subset.ttf')

export const buildMaterialIconsCssUrl = () => {
  const params = new URLSearchParams({
    family: FONT_FAMILY,
    icon_names: MATERIAL_ICON_NAMES.join(','),
    display: 'block'
  })
  return `${GOOGLE_FONTS_CSS_URL}?${params}`
}

export const generateMaterialIcons = async ({ fetchImpl = fetch, outputPath = OUTPUT_PATH } = {}) => {
  const cssResponse = await fetchImpl(buildMaterialIconsCssUrl(), {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  if (!cssResponse.ok) throw new Error(`Material icons CSS request failed: ${cssResponse.status}`)

  const css = await cssResponse.text()
  const fontUrl = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1]
  if (!fontUrl) throw new Error('Material icons font URL was not found')

  const fontResponse = await fetchImpl(fontUrl)
  if (!fontResponse.ok) throw new Error(`Material icons font request failed: ${fontResponse.status}`)

  const font = Buffer.from(await fontResponse.arrayBuffer())
  if (font.length < 1000) throw new Error('Material icons subset is unexpectedly small')

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, font)
  return { outputPath, bytes: font.length, icons: MATERIAL_ICON_NAMES.length }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const result = await generateMaterialIcons()
  process.stdout.write(`Generated ${result.outputPath} (${result.bytes} bytes, ${result.icons} icons)\n`)
}
