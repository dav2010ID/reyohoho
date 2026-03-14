import fs from 'node:fs/promises'
import path from 'node:path'

const DIST_PATH = path.resolve(process.cwd(), 'dist')
const INDEX_PATH = path.join(DIST_PATH, 'index.html')
const FALLBACK_404_PATH = path.join(DIST_PATH, '404.html')

async function main() {
  const indexHtml = await fs.readFile(INDEX_PATH, 'utf8')
  await fs.writeFile(FALLBACK_404_PATH, indexHtml, 'utf8')
  console.log(`Copied ${INDEX_PATH} -> ${FALLBACK_404_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
