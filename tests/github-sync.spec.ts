import { expect, test, type Page, type Request, type Route } from '@playwright/test'
import {
  appDataDigest,
  createCrosscutFixtureData,
  createNamedFixtureData,
  createTestKeyMaterial,
  encryptAppDataInBrowser,
  readSyncCredential,
  seedAppData,
} from './crosscut-helpers'

const target = {
  owner: 'test-owner',
  repo: 'test-private-data',
  path: 'myhub-data/v1/snapshot.enc',
}
const contentsUrl = `https://api.github.com/repos/${target.owner}/${target.repo}/contents/myhub-data/v1/snapshot.enc`
const repositoryUrl = `https://api.github.com/repos/${target.owner}/${target.repo}`
const privateAccessBrokerUrl = 'https://vlsxvwqmzcriarcctubr.supabase.co/functions/v1/myhub-private-access'
const privateAccessId = '11111111-1111-4111-8111-111111111111'

interface RemoteState {
  content: string | null
  sha: string | null
  repositoryPrivate: boolean
  blockContentReads: boolean
  pendingContentReads: Array<() => void>
  writes: Array<Record<string, unknown>>
  deletes: Array<Record<string, unknown>>
  repositoryChecks: number
}

interface PrivateAccessState {
  encryptedPayload: string
  encryptedData: string
  version: number
  writes: number
  resolveDelayMs: number
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const installGitHubMock = async (page: Page, state: RemoteState) => {
  await page.route('https://api.github.com/**', async (route: Route, request: Request) => {
    if (request.url() === repositoryUrl && request.method() === 'GET') {
      state.repositoryChecks += 1
      await json(route, {
        private: state.repositoryPrivate,
        full_name: `${target.owner}/${target.repo}`,
        permissions: { pull: true, push: true },
      })
      return
    }
    if (request.url() !== contentsUrl) {
      await json(route, { message: 'Unexpected synthetic test route.' }, 404)
      return
    }
    if (request.method() === 'GET') {
      if (state.blockContentReads) {
        await new Promise<void>((resolve) => state.pendingContentReads.push(resolve))
      }
      if (!state.content || !state.sha) {
        await json(route, { message: 'Not Found' }, 404)
        return
      }
      await json(route, {
        type: 'file',
        sha: state.sha,
        encoding: 'base64',
        content: Buffer.from(state.content, 'utf8').toString('base64'),
      })
      return
    }
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    if (request.method() === 'PUT') {
      state.writes.push(body)
      state.content = Buffer.from(String(body.content), 'base64').toString('utf8')
      state.sha = `sha-${state.writes.length}`
      await json(route, { content: { sha: state.sha } })
      return
    }
    if (request.method() === 'DELETE') {
      state.deletes.push(body)
      state.content = null
      state.sha = null
      await route.fulfill({ status: 204, body: '' })
      return
    }
    await json(route, { message: 'Unexpected synthetic test method.' }, 405)
  })
}

const installPrivateAccessMock = async (page: Page, state: PrivateAccessState) => {
  await page.route(privateAccessBrokerUrl, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
    if (body.action === 'create') {
      state.encryptedPayload = String(body.encryptedPayload)
      state.encryptedData = String(body.encryptedData)
      state.version = 1
      await json(route, { id: privateAccessId, version: state.version, updatedAt: '2026-09-23T18:00:00.000Z' }, 201)
      return
    }
    if (body.action === 'resolve' && body.id === privateAccessId) {
      if (state.resolveDelayMs > 0) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, state.resolveDelayMs))
      }
      await json(route, {
        encryptedPayload: state.encryptedPayload,
        encryptedData: state.encryptedData,
        version: state.version,
        updatedAt: '2026-09-23T18:00:00.000Z',
      })
      return
    }
    if (body.action === 'push' && body.id === privateAccessId) {
      if (body.expectedVersion !== state.version) {
        await json(route, { error: 'A newer Supabase copy exists.', currentVersion: state.version }, 409)
        return
      }
      state.encryptedData = String(body.encryptedData)
      state.version += 1
      state.writes += 1
      await json(route, { version: state.version, updatedAt: '2026-09-23T18:05:00.000Z' })
      return
    }
    await json(route, { error: 'Unexpected private access request.' }, 400)
  })
}

const connect = async (page: Page, passphrase: string) => {
  const token = `test-token-${createTestKeyMaterial()}`
  await page.goto('/#/settings')
  await page.getByLabel('Repository owner').fill(target.owner)
  await page.getByLabel('Repository name').fill(target.repo)
  await page.getByLabel('Snapshot path').fill(target.path)
  await page.getByLabel('Fine-grained token').fill(token)
  await page.getByLabel('Encryption passphrase').fill(passphrase)
  await page.getByRole('button', { name: 'Connect and sync' }).click()
  return { token }
}

const freshRemoteState = (): RemoteState => ({
  content: null,
  sha: null,
  repositoryPrivate: true,
  blockContentReads: false,
  pendingContentReads: [],
  writes: [],
  deletes: [],
  repositoryChecks: 0,
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await seedAppData(page, createCrosscutFixtureData())
})

test('connect verifies a private repository and pushes only an encrypted snapshot payload', async ({ page }) => {
  const state = freshRemoteState()
  await installGitHubMock(page, state)
  const passphrase = createTestKeyMaterial()
  await connect(page, passphrase)

  await expect(page.getByText(`${target.owner}/${target.repo}`)).toBeVisible()
  await expect(page.getByText(target.path)).toBeVisible()
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()
  expect(state.repositoryChecks).toBe(1)
  expect(state.writes).toHaveLength(1)

  const payload = JSON.stringify(state.writes[0])
  expect(payload).not.toContain('Teriyaki Steak Bowls')
  expect(payload).not.toContain('Crosscut User')
  const envelope = JSON.parse(Buffer.from(String(state.writes[0]?.content), 'base64').toString('utf8')) as {
    format: string
    kdf: { name: string; hash: string; iterations: number }
    cipher: { name: string; keyLength: number }
    ciphertext: string
  }
  expect(envelope).toEqual(
    expect.objectContaining({
      format: 'myhub-encrypted',
      kdf: expect.objectContaining({ name: 'PBKDF2', hash: 'SHA-256', iterations: 310_000 }),
      cipher: expect.objectContaining({ name: 'AES-GCM', keyLength: 256 }),
      ciphertext: expect.any(String),
    }),
  )
  expect(JSON.stringify(envelope)).not.toContain('Teriyaki Steak Bowls')
  expect(JSON.stringify(envelope)).not.toContain('Crosscut User')
})

test('a private access link opens a fresh phone and syncs encrypted Supabase data with GitHub backup', async ({
  browser,
  page,
}) => {
  const state = freshRemoteState()
  const privateAccess = { encryptedPayload: '', encryptedData: '', version: 0, writes: 0, resolveDelayMs: 0 }
  await installGitHubMock(page, state)
  await installPrivateAccessMock(page, privateAccess)
  const passphrase = createTestKeyMaterial()
  const { token } = await connect(page, passphrase)
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()

  await page.getByRole('button', { name: 'Create private access link' }).click()
  const dialog = page.getByRole('dialog', { name: 'Private MyHub access link' })
  const accessLink = await dialog.getByRole('textbox', { name: 'Private MyHub access link', exact: true }).inputValue()

  expect(accessLink).not.toContain(token)
  expect(accessLink).not.toContain(passphrase)
  expect(accessLink).toContain(`#/access?id=${privateAccessId}&key=`)
  expect(privateAccess.encryptedPayload).not.toContain(token)
  expect(privateAccess.encryptedPayload).not.toContain(passphrase)
  expect(privateAccess.encryptedData).not.toContain('Crosscut User')
  await dialog.getByRole('button', { name: 'Done' }).click()

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const phonePage = await phone.newPage()
  await installGitHubMock(phonePage, state)
  await installPrivateAccessMock(phonePage, privateAccess)
  state.blockContentReads = true
  await phonePage.goto(accessLink)

  await expect(
    phonePage.getByRole('heading', { name: /Good (morning|afternoon|evening), Crosscut User\./u }),
  ).toBeVisible()
  await expect.poll(() => state.pendingContentReads.length).toBe(1)
  state.blockContentReads = false
  for (const release of state.pendingContentReads.splice(0)) release()
  await expect.poll(() => phonePage.url()).not.toContain('id=')
  await expect.poll(() => phonePage.url()).not.toContain('key=')
  expect(state.writes).toHaveLength(1)
  const savedCredential = (await readSyncCredential(phonePage)) as { tokenEnvelope?: string } | null
  expect(savedCredential?.tokenEnvelope).toBeTruthy()
  expect(savedCredential?.tokenEnvelope).not.toContain(token)

  privateAccess.resolveDelayMs = 750
  await phonePage.goto('/#/settings')
  await phonePage.reload()
  await expect(phonePage.getByText('Loading your encrypted MyHub data…')).toBeVisible()
  await expect(phonePage.getByLabel('Your name')).toHaveCount(0)
  const phoneName = phonePage.getByLabel('Your name')
  await expect(phoneName).toHaveValue('Crosscut User')
  privateAccess.resolveDelayMs = 0
  await phoneName.fill('Updated on phone')
  await expect.poll(() => privateAccess.writes, { timeout: 30_000 }).toBe(1)
  await expect.poll(() => privateAccess.version, { timeout: 30_000 }).toBe(2)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByLabel('Your name')).toHaveValue('Updated on phone')
  await expect.poll(() => state.writes.length).toBeGreaterThanOrEqual(2)

  await phonePage.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('myhub-local')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction('application', 'readwrite')
    transaction.objectStore('application').delete('state')
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await phonePage.goto('/')
  await phonePage.goto('/#/settings')
  await expect(phonePage.getByLabel('Your name')).toHaveValue('Updated on phone')
  expect(phonePage.url()).not.toContain('access=')
  await phone.close()
})

test('connect rejects a public repository before reading or writing snapshot data', async ({ page }) => {
  const state = freshRemoteState()
  state.repositoryPrivate = false
  await installGitHubMock(page, state)
  await connect(page, createTestKeyMaterial())

  await expect(page.getByText('Cross-device sync needs attention.')).toBeVisible()
  await expect(page.getByText(/requires a private repository/)).toBeVisible()
  expect(state.repositoryChecks).toBe(1)
  expect(state.writes).toHaveLength(0)
})

test('saved connection unlocks after reload and pulls changed encrypted remote data into durable local state', async ({
  page,
}) => {
  const state = freshRemoteState()
  await installGitHubMock(page, state)
  const passphrase = createTestKeyMaterial()
  await connect(page, passphrase)
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()

  const remoteData = createNamedFixtureData('Remote Reload User', 'Remote Reload Recipe')
  state.content = await encryptAppDataInBrowser(page, remoteData, passphrase)
  state.sha = 'remote-sha-after-connect'

  await page.reload()
  await expect(page.locator('#github-sync').getByText('locked')).toBeVisible()
  await page.getByLabel('Encryption passphrase').fill(passphrase)
  await page.getByRole('button', { name: 'Unlock sync' }).click()
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()
  await expect(page.getByLabel('Your name')).toHaveValue('Remote Reload User')

  await expect
    .poll(async () => {
      const credential = (await readSyncCredential(page)) as { lastSyncedDigest?: string } | null
      return credential?.lastSyncedDigest
    })
    .toBe(appDataDigest(remoteData))
  await page.reload()
  await expect(page.getByLabel('Your name')).toHaveValue('Remote Reload User')
})

test('pause and resume persist their state and resume synchronization', async ({ page }) => {
  const state = freshRemoteState()
  await installGitHubMock(page, state)
  await connect(page, createTestKeyMaterial())
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.locator('#github-sync').getByText('paused')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sync now' })).toBeDisabled()
  await expect.poll(async () => ((await readSyncCredential(page)) as { paused?: boolean } | null)?.paused).toBe(true)

  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sync now' })).toBeEnabled()
  await expect.poll(async () => ((await readSyncCredential(page)) as { paused?: boolean } | null)?.paused).toBe(false)
})

test('a deterministic two-sided conflict waits for an explicit device or GitHub choice', async ({ page }) => {
  const state = freshRemoteState()
  await installGitHubMock(page, state)
  const passphrase = createTestKeyMaterial()
  await connect(page, passphrase)
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()

  const remoteData = createNamedFixtureData('GitHub Choice User', 'GitHub Choice Recipe')
  state.content = await encryptAppDataInBrowser(page, remoteData, passphrase)
  state.sha = 'two-sided-sha'
  await page.getByLabel('Your name').fill('Device Choice User')
  await page.getByRole('button', { name: 'Sync now' }).click()

  const conflict = page.locator('.conflict-actions')
  await expect(conflict.getByText('Choose the copy to keep')).toBeVisible()
  await expect(conflict.getByText('Neither copy will be discarded until you choose.')).toBeVisible()
  await expect(page.getByLabel('Your name')).toHaveValue('Device Choice User')
  const writesBeforeChoice = state.writes.length

  await conflict.getByRole('button', { name: 'Use GitHub' }).click()
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()
  await expect(page.getByLabel('Your name')).toHaveValue('GitHub Choice User')
  expect(state.writes).toHaveLength(writesBeforeChoice)
})

test('a deterministic conflict can explicitly keep this device using an encrypted conditional write', async ({
  page,
}) => {
  const state = freshRemoteState()
  await installGitHubMock(page, state)
  const passphrase = createTestKeyMaterial()
  await connect(page, passphrase)
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()

  const remoteData = createNamedFixtureData('Remote Other User', 'Remote Other Recipe')
  state.content = await encryptAppDataInBrowser(page, remoteData, passphrase)
  state.sha = 'remote-conflict-sha'
  await page.getByLabel('Your name').fill('Device Keeper')
  await page.getByRole('button', { name: 'Sync now' }).click()
  await expect(page.getByText('Choose the copy to keep')).toBeVisible()

  await page.getByRole('button', { name: 'Use this device' }).click()
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()
  await expect(page.getByLabel('Your name')).toHaveValue('Device Keeper')
  expect(state.writes.at(-1)?.sha).toBe('remote-conflict-sha')
  const payload = JSON.stringify(state.writes.at(-1))
  expect(payload).not.toContain('Device Keeper')
  expect(payload).not.toContain('Teriyaki Steak Bowls')
})

test('unlink requires confirmation, removes only the local credential, and leaves remote content intact', async ({
  page,
}) => {
  const state = freshRemoteState()
  await installGitHubMock(page, state)
  await connect(page, createTestKeyMaterial())
  await expect.poll(() => state.sha).toBe('sha-1')
  const contentBeforeUnlink = state.content

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Unlink' }).click()
  await expect(page.getByRole('button', { name: 'Connect and sync' })).toBeVisible()
  await expect.poll(() => readSyncCredential(page)).toBeUndefined()
  expect(state.content).toBe(contentBeforeUnlink)
  expect(state.deletes).toHaveLength(0)
})

test('delete remote snapshot sends the current SHA and pauses sync without unlinking', async ({ page }) => {
  const state = freshRemoteState()
  await installGitHubMock(page, state)
  await connect(page, createTestKeyMaterial())
  await expect.poll(() => state.sha).toBe('sha-1')
  const shaBeforeDelete = state.sha

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete remote snapshot' }).click()
  await expect(page.locator('#github-sync').getByText('paused')).toBeVisible()
  expect(state.deletes).toEqual([{ message: 'Delete encrypted MyHub snapshot', sha: shaBeforeDelete }])
  expect(state.content).toBeNull()
  await expect
    .poll(async () => {
      const credential = (await readSyncCredential(page)) as { paused?: boolean; currentSha?: string } | null
      return { paused: credential?.paused, currentSha: credential?.currentSha }
    })
    .toEqual({ paused: true, currentSha: undefined })
})
