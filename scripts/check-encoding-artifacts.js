import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const TARGET_DIRS = ['src']
const TARGET_EXTENSIONS = new Set(['.js', '.vue', '.scss', '.css', '.html', '.md', '.json'])
const MOJIBAKE_PATTERN =
  /(Рџ|Рљ|Рќ|Рћ|РЎ|Р’|Р|Р—|РЈ|СЃ|С‚|СЊ|С‹|С‡|С€|С‰|рџ)/

const getExtension = (filePath) => {
  const match = filePath.match(/\.[^.]+$/)
  return match ? match[0] : ''
}

const walk = (dir) => {
  const entries = readdirSync(dir)
  const files = []

  for (const entry of entries) {
    const path = join(dir, entry)
    const stats = statSync(path)

    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
      files.push(...walk(path))
      continue
    }

    if (TARGET_EXTENSIONS.has(getExtension(path))) {
      files.push(path)
    }
  }

  return files
}

const findings = []

for (const dir of TARGET_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)

    lines.forEach((line, index) => {
      if (MOJIBAKE_PATTERN.test(line)) {
        findings.push(`${relative(ROOT, file)}:${index + 1}: ${line.trim()}`)
      }
    })
  }
}

if (findings.length) {
  console.error('Possible mojibake/encoding artifacts found:')
  console.error(findings.join('\n'))
  process.exit(1)
}
