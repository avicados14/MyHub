import { describe, expect, it, vi } from 'vitest'
import { defaults, hashDistance, imageMime, importBatch, isDuplicate, supportedPath, type Incoming } from './import'
import { recommend, type Garment } from './types'
const item = (category: Garment['category'], status: Garment['laundry_status'] = 'clean') =>
  ({ id: category, name: category, category, laundry_status: status, garment_number: 1 }) as Garment
describe('closet recommendations', () => {
  it('requires a wearable base and excludes dirty garments', () => {
    expect(recommend([item('tops'), item('bottoms', 'dirty')], 70, 'School')).toEqual([])
    expect(recommend([item('one-piece'), item('shoes', 'dirty')], 70, 'School').map((i) => i.category)).toEqual([
      'one-piece',
    ])
  })
  it('uses Fahrenheit layers and handles unknown weather honestly', () => {
    const items = [item('tops'), item('bottoms'), item('outerwear')]
    expect(recommend(items, 40, 'Travel')).toHaveLength(3)
    expect(recommend(items, 80, 'Everyday')).toHaveLength(2)
    expect(recommend(items, null, 'School')).toHaveLength(2)
  })
})
describe('import validation and duplicates', () => {
  it('ignores hidden files, system folders, traversal and unsupported types', () => {
    for (const name of ['.photo.png', '__MACOSX/a.jpg', 'a/.hidden/x.gif', '../bad.png', 'note.txt', 'folder/'])
      expect(supportedPath(name)).toBe(false)
    expect(supportedPath('folder/Top.JPEG')).toBe(true)
  })
  it('checks signatures rather than trusting file extensions', () => {
    expect(imageMime(new Uint8Array([255, 216, 255, 0]))).toBe('image/jpeg')
    expect(imageMime(new TextEncoder().encode('<svg></svg>'))).toBeNull()
  })
  it('detects exact and likely visual duplicates without forcing deletion', () => {
    expect(isDuplicate({ hash: 'a', dhash: null }, { hash: 'a', dhash: null })).toBe('Exact duplicate')
    expect(hashDistance('0'.repeat(64), '1' + '0'.repeat(63))).toBe(1)
    expect(isDuplicate({ hash: 'a', dhash: '0'.repeat(64) }, { hash: 'b', dhash: '1' + '0'.repeat(63) })).toBe(
      'Possible visual duplicate',
    )
  })
  it('uses editable filename defaults', () => {
    expect(defaults('folder/black-tee.png')).toEqual({ name: 'black tee', category: 'tops', color: 'black' })
    expect(defaults('IMG-0001.jpg').category).toBe('other')
  })
  it('isolates failures and retries only failed accepted rows with stable IDs', async () => {
    const rows = [
      { id: 'one', choice: 'keep' },
      { id: 'two', choice: 'keep' },
      { id: 'skip', choice: 'skip' },
    ] as Incoming[]
    const save = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'))
    const first = await importBatch(rows, save, () => undefined)
    expect(first[0]!.done).toBe(true)
    expect(first[1]!.error).toBe('offline')
    expect(save).toHaveBeenCalledTimes(2)
    const retry = vi.fn().mockResolvedValue(undefined)
    const second = await importBatch(first, retry, () => undefined)
    expect(retry).toHaveBeenCalledTimes(1)
    expect(retry.mock.calls[0]![0].id).toBe('two')
    expect(second[1]!.done).toBe(true)
  })
})
