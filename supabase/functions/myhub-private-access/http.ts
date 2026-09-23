const PRODUCTION_ORIGIN = 'https://avicados14.github.io'

const corsOrigin = (request: Request): string => {
  const origin = request.headers.get('origin') ?? ''
  if (
    origin === PRODUCTION_ORIGIN ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://localhost:')
  ) {
    return origin
  }
  return PRODUCTION_ORIGIN
}

export const brokerResponse = (request: Request, body: unknown, status = 200): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin(request),
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      'Referrer-Policy': 'no-referrer',
      Vary: 'Origin',
    },
  })
