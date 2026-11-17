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

    const request = fetchWithTimeout('/slow', {}, (response) => response.text(), 'The service took too long.', 50)
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

    const request = fetchWithTimeout('/cancelled', { signal: caller.signal }, (response) => response.text())
    caller.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('keeps the deadline active while the response body is downloading', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_input, init) =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{'))
                init.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
              },
            }),
          ),
      ),
    )
    const request = fetchWithTimeout('/slow-body', {}, (response) => response.json(), 'Download timed out.', 50)
    const rejection = expect(request).rejects.toThrow('Download timed out.')
    await vi.advanceTimersByTimeAsync(50)
    await rejection
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns the complete body and clears its timer after success', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"ok":true}')),
    )
    await expect(fetchWithTimeout('/ready', {}, (response) => response.json())).resolves.toEqual({ ok: true })
    expect(vi.getTimerCount()).toBe(0)
  })
})
