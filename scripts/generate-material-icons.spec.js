import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MATERIAL_ICON_NAMES,
  buildMaterialIconsCssUrl,
  generateMaterialIcons
} from './generate-material-icons'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  )
})

describe('material icons subset generator', () => {
  it('requests an alphabetized unique icon list', () => {
    const url = new URL(buildMaterialIconsCssUrl())
    const requestedIcons = url.searchParams.get('icon_names').split(',')

    expect(requestedIcons).toEqual([...requestedIcons].sort())
    expect(new Set(requestedIcons).size).toBe(requestedIcons.length)
    expect(requestedIcons).toEqual(MATERIAL_ICON_NAMES)
  })

  it('downloads the resolved font into the requested output path', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'reyohoho-material-icons-'))
    temporaryDirectories.push(directory)
    const outputPath = path.join(directory, 'subset.ttf')
    const font = new Uint8Array(2048).fill(7)
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("@font-face { src: url(https://fonts.example/subset.ttf); }")
      )
      .mockResolvedValueOnce(new Response(font))

    const result = await generateMaterialIcons({ fetchImpl, outputPath })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ bytes: font.length, icons: MATERIAL_ICON_NAMES.length })
    expect(await readFile(outputPath)).toEqual(Buffer.from(font))
  })
})
