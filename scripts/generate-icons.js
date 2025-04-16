import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sourceImage = path.join(__dirname, '../public/icons/icon-512x512.png')
const tempDir = path.join(__dirname, '../temp_icons')
const outputDir = path.join(__dirname, '../public/icons')

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true })
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Обновленные размеры иконок для PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function generatePNGIcons() {
  for (const size of sizes) {
    const tempFile = path.join(tempDir, `icon-${size}x${size}.png`)
    const circleMask = await generateCircleMask(size)
    await sharp(sourceImage)
      .resize(size, size)
      .composite([
        {
          input: circleMask,
          blend: 'dest-in'
        }
      ])
      .toFile(tempFile)
    fs.copyFileSync(tempFile, path.join(outputDir, `icon-${size}x${size}.png`))
    console.log(`Generated ${size}x${size} PNG icon`)
  }
}

async function generateCircleMask(size) {
  const circle = Buffer.from(
    `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" /></svg>`
  )
  return circle
}

async function generateICO() {
  const icoSizes = [32]
  const size = icoSizes[0]

  const circleMask = await generateCircleMask(size)

  const icoBuffers = await Promise.all(
    icoSizes.map(async (size) => {
      const image = await sharp(sourceImage)
        .resize(Math.round(size * 1.2), Math.round(size * 1.2))
        .extract({
          left: Math.round(size * 0.1),
          top: Math.round(size * 0.1),
          width: size,
          height: size
        })
        .composite([
          {
            input: circleMask,
            blend: 'dest-in'
          }
        ])
        .toBuffer()
      return image
    })
  )

  const icoPath = path.join(__dirname, '../public/favicon.ico')
  await sharp(icoBuffers[0])
    .resize(32, 32, {
      fit: 'fill',
      kernel: 'lanczos3'
    })
    .toFile(icoPath)
  console.log('Generated favicon.ico (32x32, slightly zoomed, circular)')
}

async function cleanup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true })
  }
}

async function generateAll() {
  try {
    await generatePNGIcons()
    await generateICO()
    await cleanup()
    console.log('All icons generated successfully!')
  } catch (error) {
    console.error('Error generating icons:', error)
    await cleanup()
  }
}

generateAll()
