export interface GitHubRepositoryTarget {
  owner: string
  repo: string
  path: string
}

export interface GitHubRepositoryInfo {
  private: boolean
  full_name: string
  permissions?: { pull?: boolean; push?: boolean }
}

export interface GitHubRemoteFile {
  sha: string
  content: string
}

export class GitHubConflictError extends Error {
  constructor(message = 'GitHub reported a write conflict.') {
    super(message)
    this.name = 'GitHubConflictError'
  }
}

export class GitHubApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GitHubApiError'
  }
}

export interface GitHubApiFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

const encodePath = (path: string): string => path.split('/').filter(Boolean).map(encodeURIComponent).join('/')

const decodeBase64Utf8 = (value: string): string => {
  const binary = atob(value.replaceAll('\n', ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const encodeBase64Utf8 = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const apiMessage = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') return body.message
  } catch {
    // GitHub sometimes returns an empty body; the status still identifies the failure.
  }
  return `GitHub request failed with status ${response.status}.`
}

export class GitHubContentsClient {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly token: string,
    private readonly fetchImplementation: GitHubApiFetch = fetch,
  ) {}

  private request(url: string, init: RequestInit = {}): Promise<Response> {
    return this.fetchImplementation(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...init.headers,
      },
    })
  }

  async requirePrivateRepository(target: GitHubRepositoryTarget): Promise<GitHubRepositoryInfo> {
    const response = await this.request(`https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`)
    if (!response.ok) throw new GitHubApiError(await apiMessage(response), response.status)
    const repository = await response.json() as GitHubRepositoryInfo
    if (!repository.private) throw new Error('GitHub Sync requires a private repository. This repository is public.')
    if (repository.permissions?.push === false) throw new Error('The token does not have Contents read/write access to this repository.')
    return repository
  }

  async getFile(target: GitHubRepositoryTarget): Promise<GitHubRemoteFile | null> {
    const response = await this.request(`https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${encodePath(target.path)}`)
    if (response.status === 404) return null
    if (!response.ok) throw new GitHubApiError(await apiMessage(response), response.status)
    const body = await response.json() as { type?: string; sha?: string; content?: string; encoding?: string }
    if (body.type !== 'file' || typeof body.sha !== 'string' || typeof body.content !== 'string' || body.encoding !== 'base64') {
      throw new Error('The configured GitHub path is not a readable file.')
    }
    return { sha: body.sha, content: decodeBase64Utf8(body.content) }
  }

  putFile(target: GitHubRepositoryTarget, content: string, sha?: string): Promise<string> {
    return this.serializeWrite(async () => {
      const body: { message: string; content: string; sha?: string } = {
        message: 'Update encrypted MyHub snapshot',
        content: encodeBase64Utf8(content),
        ...(sha ? { sha } : {}),
      }
      const response = await this.request(`https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${encodePath(target.path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.status === 409 || response.status === 422) throw new GitHubConflictError()
      if (!response.ok) throw new GitHubApiError(await apiMessage(response), response.status)
      const result = await response.json() as { content?: { sha?: string } }
      const nextSha = result.content?.sha
      if (!nextSha) throw new Error('GitHub did not return the updated file SHA.')
      return nextSha
    })
  }

  deleteFile(target: GitHubRepositoryTarget, sha: string): Promise<void> {
    return this.serializeWrite(async () => {
      const response = await this.request(`https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${encodePath(target.path)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Delete encrypted MyHub snapshot', sha }),
      })
      if (response.status === 409 || response.status === 422) throw new GitHubConflictError()
      if (!response.ok) throw new GitHubApiError(await apiMessage(response), response.status)
    })
  }

  private serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.writeQueue.then(operation, operation)
    this.writeQueue = pending.then(() => undefined, () => undefined)
    return pending
  }
}
