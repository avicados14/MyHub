const DEFAULT_TIMEOUT_MS = 15_000

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMessage = 'The request timed out. Check your connection and try again.',
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(init.signal?.reason)
  if (init.signal?.aborted) controller.abort(init.signal.reason)
  else init.signal?.addEventListener('abort', forwardAbort, { once: true })

  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted) throw new Error(timeoutMessage)
    throw error
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', forwardAbort)
  }
}
