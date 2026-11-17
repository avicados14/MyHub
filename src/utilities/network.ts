const DEFAULT_TIMEOUT_MS = 15_000

export async function fetchWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  readResponse: (response: Response) => Promise<T>,
  timeoutMessage = 'The request timed out. Check your connection and try again.',
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(init.signal?.reason)
  if (init.signal?.aborted) controller.abort(init.signal.reason)
  else init.signal?.addEventListener('abort', forwardAbort, { once: true })

  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    return await readResponse(response)
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted) throw new Error(timeoutMessage)
    throw error
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', forwardAbort)
  }
}
