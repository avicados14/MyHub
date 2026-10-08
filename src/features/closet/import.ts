import { Unzip, UnzipInflate } from 'fflate'
import type { Category } from './types'
export const MAX_IMAGE = 8 * 1024 * 1024
export const MAX_TOTAL = 100 * 1024 * 1024
export const MAX_FILES = 250
export interface Incoming {
  id: string
  file: File
  hash: string
  dhash: string | null
  name: string
  category: Category
  color: string
  choice: 'keep' | 'skip' | 'replace'
  duplicate?: string
  replaceId?: string
  error?: string
  done?: boolean
}
export const supportedPath = (path: string): boolean =>
  !path.split(/[\\/]/).some((part) => part.startsWith('.') || part === '__MACOSX' || part === '..') &&
  /\.(jpe?g|png|webp|gif)$/i.test(path)
export function imageMime(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') return 'image/png'
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}
export function hashDistance(a: string, b: string): number {
  if (!/^[01]{64}$/.test(a) || !/^[01]{64}$/.test(b)) return 64
  return [...a].reduce((n, bit, i) => n + Number(bit !== b[i]), 0)
}
export const isDuplicate = (a: { hash: string; dhash: string | null }, b: { hash: string; dhash: string | null }) =>
  a.hash === b.hash
    ? 'Exact duplicate'
    : a.dhash && b.dhash && hashDistance(a.dhash, b.dhash) <= 5
      ? 'Possible visual duplicate'
      : null
export function defaults(filename: string): { name: string; category: Category; color: string } {
  const name =
    filename
      .split(/[\\/]/)
      .pop()!
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .slice(0, 120) || 'New garment'
  const text = name.toLowerCase()
  const category: Category = /jacket|coat|hoodie|sweater/.test(text)
    ? 'outerwear'
    : /pant|jean|short|skirt/.test(text)
      ? 'bottoms'
      : /shoe|sneaker|boot|loafer/.test(text)
        ? 'shoes'
        : /dress|jumpsuit/.test(text)
          ? 'one-piece'
          : /hat|cap|belt|scarf|beanie/.test(text)
            ? 'accessories'
            : /shirt|tee|blouse|top/.test(text)
              ? 'tops'
              : 'other'
  const color =
    text.match(/\b(black|white|blue|red|green|grey|gray|pink|purple|brown|beige|navy|cream|olive|yellow)\b/)?.[1] ??
    'Unknown'
  return { name, category, color }
}
export async function inspectImage(file: File): Promise<Incoming> {
  if (!supportedPath(file.name) || !file.size || file.size > MAX_IMAGE)
    throw new Error('Choose a supported image between 1 byte and 8 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer()),
    mime = imageMime(bytes)
  if (!mime) throw new Error('Image signature is invalid or unsupported.')
  const blob = new Blob([bytes], { type: mime }),
    url = URL.createObjectURL(blob)
  let dhash: string | null = null
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40_000_000)
      throw new Error('Image exceeds 40 megapixels or is unreadable.')
    const canvas = document.createElement('canvas')
    canvas.width = 9
    canvas.height = 8
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0, 9, 8)
      const p = ctx.getImageData(0, 0, 9, 8).data
      dhash = ''
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const i = (y * 9 + x) * 4,
            j = i + 4
          dhash += Number(p[i]! + p[i + 1]! + p[i + 2]! > p[j]! + p[j + 1]! + p[j + 2]!)
        }
    }
  } finally {
    URL.revokeObjectURL(url)
  }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
  return {
    id: crypto.randomUUID(),
    file: new File([blob], file.name, { type: mime }),
    hash,
    dhash,
    ...defaults(file.name),
    choice: 'keep',
  }
}
// Streaming decompression enforces limits against actual output, not trusted ZIP headers.
export async function extractZip(
  file: File,
  progress: (message: string) => void,
): Promise<{ files: File[]; errors: string[] }> {
  if (!/\.zip$/i.test(file.name) || file.size > MAX_TOTAL) throw new Error('Choose a ZIP no larger than 100 MB.')
  const files: File[] = [],
    errors: string[] = []
  let total = 0,
    entries = 0,
    fatal: Error | null = null
  const unzip = new Unzip((entry) => {
    if (++entries > 2000) {
      fatal = new Error('ZIP has too many entries.')
      return
    }
    if (!supportedPath(entry.name)) return
    if (files.length >= MAX_FILES) {
      fatal = new Error('Import up to 250 images at a time.')
      return
    }
    let size = 0
    const chunks: Uint8Array<ArrayBuffer>[] = []
    entry.ondata = (error, chunk, final) => {
      if (fatal) return
      if (error) {
        errors.push(`${entry.name}: unreadable ZIP entry`)
        return
      }
      size += chunk.length
      total += chunk.length
      if (total > MAX_TOTAL) {
        fatal = new Error('Expanded import exceeds 100 MB.')
        entry.terminate()
        return
      }
      if (size > MAX_IMAGE) {
        if (size - chunk.length <= MAX_IMAGE) errors.push(`${entry.name}: exceeds 8 MB`)
        entry.terminate()
        return
      }
      chunks.push(new Uint8Array(chunk))
      if (final) {
        files.push(new File(chunks, entry.name))
        progress(`Extracted ${files.length} images`)
      }
    }
    if (entry.originalSize && entry.originalSize > MAX_IMAGE) {
      errors.push(`${entry.name}: exceeds 8 MB`)
      return
    }
    entry.start()
  })
  unzip.register(UnzipInflate)
  const reader = file.stream().getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        unzip.push(new Uint8Array(), true)
        break
      }
      for (let offset = 0; offset < value.length; offset += 1024) {
        unzip.push(value.subarray(offset, offset + 1024))
        if (fatal) throw fatal
      }
      if (fatal) throw fatal
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    if (fatal) throw fatal
  } catch (error) {
    await reader.cancel()
    throw error
  } finally {
    reader.releaseLock()
  }
  return { files, errors }
}
export async function importBatch(
  rows: Incoming[],
  save: (row: Incoming) => Promise<void>,
  progress: (done: number, total: number) => void,
): Promise<Incoming[]> {
  const result = rows.map((row) => ({ ...row }))
  let done = 0
  for (const row of result) {
    if (!row.done && row.choice !== 'skip') {
      try {
        await save(row)
        row.done = true
        row.error = undefined
      } catch (error) {
        row.error = error instanceof Error ? error.message : 'Upload failed'
      }
    }
    progress(++done, result.length)
  }
  return result
}
