import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCE_ROOT = path.resolve('src')
const FONT_AWESOME_ROOT = path.resolve('node_modules/@fortawesome/fontawesome-free')
const OUTPUT_ROOT = path.resolve('src/assets/fonts')
const SOURCE_EXTENSIONS = new Set(['.js', '.scss', '.vue'])
const NON_ICON_CLASSES = new Set([
  'brands',
  'classic',
  'fw',
  'regular',
  'regular-subset',
  'solid',
  'solid-subset',
  'spin',
  'stack',
  'stack-1x',
  'stack-2x',
  'style'
])

export const collectIconNamesFromSource = (source) => {
  const icons = new Set()
  for (const match of source.matchAll(/\bfa-([a-z0-9-]+)/g)) {
    if (!NON_ICON_CLASSES.has(match[1])) icons.add(match[1])
  }
  return icons
}

export const extractIconCodepoints = (css, iconNames) => {
  const mappings = new Map()
  for (const match of css.matchAll(/([^{}]+)\{--fa:"\\([0-9a-f]+|.)"\}/gi)) {
    const codepoint = /^[0-9a-f]+$/i.test(match[2])
      ? match[2].toLowerCase()
      : match[2].codePointAt(0).toString(16).padStart(4, '0')
    for (const selector of match[1].split(',')) {
      const iconName = selector.match(/\.fa-([a-z0-9-]+)/)?.[1]
      if (iconName) mappings.set(iconName, codepoint)
    }
  }

  const missing = [...iconNames].filter((iconName) => !mappings.has(iconName))
  if (missing.length) throw new Error(`Font Awesome mappings not found: ${missing.join(', ')}`)

  return new Set([...iconNames].map((iconName) => mappings.get(iconName)))
}

const listSourceFiles = async (directory) => {
  const files = []
  for (const entry of await readdir(directory)) {
    const entryPath = path.join(directory, entry)
    const entryStat = await stat(entryPath)
    if (entryStat.isDirectory()) files.push(...(await listSourceFiles(entryPath)))
    else if (SOURCE_EXTENSIONS.has(path.extname(entry))) files.push(entryPath)
  }
  return files
}

const subsetFont = ({ input, output, codepoints }) => {
  const command = process.platform === 'win32' ? 'pyftsubset.exe' : 'pyftsubset'
  const result = spawnSync(
    command,
    [
      input,
      `--output-file=${output}`,
      `--unicodes=${codepoints.map((codepoint) => `U+${codepoint}`).join(',')}`,
      '--flavor=woff2',
      '--layout-features=*',
      '--no-hinting'
    ],
    { stdio: 'inherit' }
  )

  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`pyftsubset failed for ${path.basename(input)}`)
}

export const generateFontAwesomeSubset = async () => {
  const iconNames = new Set()
  for (const file of await listSourceFiles(SOURCE_ROOT)) {
    for (const iconName of collectIconNamesFromSource(await readFile(file, 'utf8'))) {
      iconNames.add(iconName)
    }
  }

  const css = await readFile(path.join(FONT_AWESOME_ROOT, 'css/fontawesome.min.css'), 'utf8')
  const codepoints = [...extractIconCodepoints(css, iconNames)].sort()
  await mkdir(OUTPUT_ROOT, { recursive: true })

  subsetFont({
    input: path.join(FONT_AWESOME_ROOT, 'webfonts/fa-solid-900.woff2'),
    output: path.join(OUTPUT_ROOT, 'fa-solid-subset.woff2'),
    codepoints
  })
  subsetFont({
    input: path.join(FONT_AWESOME_ROOT, 'webfonts/fa-regular-400.woff2'),
    output: path.join(OUTPUT_ROOT, 'fa-regular-subset.woff2'),
    codepoints
  })

  return { icons: iconNames.size, codepoints: codepoints.length }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const result = await generateFontAwesomeSubset()
  process.stdout.write(
    `Generated Font Awesome subsets (${result.icons} icons, ${result.codepoints} codepoints)\n`
  )
}
