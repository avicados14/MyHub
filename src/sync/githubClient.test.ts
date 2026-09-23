import { describe, expect, it, vi } from 'vitest'
import { GitHubContentsClient } from './githubClient'

const target = { owner: 'avicados14', repo: 'MyHub-Data', path: 'myhub-data/v1/snapshot.enc' }

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('GitHub Contents client', () => {
  it('rejects a public repository', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ private: false, full_name: 'avicados14/MyHub-Data', permissions: { push: true } }))
    const client = new GitHubContentsClient('token', request)
    await expect(client.requirePrivateRepository(target)).rejects.toThrow(/private repository/)
  })

  it('creates without SHA and updates with SHA', async () => {
    const bodies: Array<Record<string, unknown>> = []
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return jsonResponse({ content: { sha: `sha-${bodies.length}` } })
    })
    const client = new GitHubContentsClient('token', request)
    await expect(client.putFile(target, 'encrypted-create')).resolves.toBe('sha-1')
    await expect(client.putFile(target, 'encrypted-update', 'existing-sha')).resolves.toBe('sha-2')
    expect(bodies[0]).not.toHaveProperty('sha')
    expect(bodies[1]).toHaveProperty('sha', 'existing-sha')
    expect(bodies.every((body) => typeof body.content === 'string')).toBe(true)
  })
})
