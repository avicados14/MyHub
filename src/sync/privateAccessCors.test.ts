import { describe, expect, it } from 'vitest'
import { brokerResponse } from '../../supabase/functions/myhub-private-access/http'

describe('private access broker CORS responses', () => {
  it('returns a valid bodyless 204 response for a production preflight', async () => {
    const request = new Request('https://example.supabase.co/functions/v1/myhub-private-access', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://avicados14.github.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })

    const response = brokerResponse(request, {}, 204)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://avicados14.github.io')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
    expect(await response.text()).toBe('')
  })
})
