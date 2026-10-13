import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCookingWakeLock } from './useCookingWakeLock'

afterEach(() => vi.unstubAllGlobals())

describe('cooking screen wake lock', () => {
  it('releases the lock when cooking ends', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ released: false, release, addEventListener: vi.fn() })
    vi.stubGlobal('navigator', { wakeLock: { request } })
    const { result, unmount } = renderHook(() => useCookingWakeLock(true))
    await waitFor(() => expect(result.current).toContain('Screen will stay awake'))
    unmount()
    expect(release).toHaveBeenCalledOnce()
  })

  it('releases a pending lock acquired after exit', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    let resolve!: (lock: unknown) => void
    vi.stubGlobal('navigator', {
      wakeLock: {
        request: () =>
          new Promise((done) => {
            resolve = done
          }),
      },
    })
    const { unmount } = renderHook(() => useCookingWakeLock(true))
    unmount()
    await act(async () => resolve({ released: false, release }))
    expect(release).toHaveBeenCalledOnce()
  })

  it('reports unsupported and denied requests without blocking cooking', async () => {
    vi.stubGlobal('navigator', {})
    const unsupported = renderHook(() => useCookingWakeLock(true))
    await waitFor(() => expect(unsupported.result.current).toContain('unavailable'))
    unsupported.unmount()
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn().mockRejectedValue(new Error('denied')) } })
    const denied = renderHook(() => useCookingWakeLock(true))
    await waitFor(() => expect(denied.result.current).toContain('Could not'))
  })
})
