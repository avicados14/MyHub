import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout } from './network'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('ends a stalled request with the supplied retry message', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
    )

    const request = fetchWithTimeout('/slow', {}, 'The service took too long.', 50)
    const rejection = expect(request).rejects.toThrow('The service took too long.')
    await vi.advanceTimersByTimeAsync(50)
    await rejection
  })

  it('preserves a caller cancellation instead of reporting a timeout', async () => {
    const caller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
    )

    const request = fetchWithTimeout('/cancelled', { signal: caller.signal })
    caller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })
})
