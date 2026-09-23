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

interface RemoteState {
  content: string | null
  sha: string | null
  repositoryPrivate: boolean
  writes: Array<Record<string, unknown>>
  deletes: Array<Record<string, unknown>>
  repositoryChecks: number
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

test('an unlocked device pairs a fresh phone that pulls encrypted GitHub data without exposing credentials', async ({
  browser,
  page,
}) => {
  const state = freshRemoteState()
  await installGitHubMock(page, state)
  const passphrase = createTestKeyMaterial()
  const { token } = await connect(page, passphrase)
  await expect(page.locator('#github-sync').getByText('current')).toBeVisible()

  await page.getByRole('button', { name: 'Pair another device' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pair another device' })
  await expect(dialog.getByAltText('Encrypted MyHub setup QR code')).toBeVisible()
  const pairingCode = await dialog.getByText(/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/u).innerText()
  await dialog.getByText('Use an encrypted setup link instead').click()
  const setupLink = await dialog.getByLabel('Encrypted phone setup link').inputValue()

  expect(setupLink).not.toContain(token)
  expect(setupLink).not.toContain(passphrase)
  expect(setupLink).not.toContain(pairingCode)

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const phonePage = await phone.newPage()
  await installGitHubMock(phonePage, state)
  await phonePage.goto(setupLink)
  await expect(phonePage.getByRole('heading', { name: 'Set up this device' })).toBeVisible()
  await expect.poll(() => phonePage.url()).not.toContain('pair=')
  await phonePage.getByLabel('16-character pairing code').fill(pairingCode)
  await phonePage.getByRole('button', { name: 'Connect this device' }).click()

  await expect(
    phonePage.getByRole('heading', { name: /Good (morning|afternoon|evening), Crosscut User\./u }),
  ).toBeVisible()
  expect(state.writes).toHaveLength(1)
  const savedCredential = (await readSyncCredential(phonePage)) as { tokenEnvelope?: string } | null
  expect(savedCredential?.tokenEnvelope).toBeTruthy()
  expect(savedCredential?.tokenEnvelope).not.toContain(token)
  await phone.close()
})

test('connect rejects a public repository before reading or writing snapshot data', async ({ page }) => {
  const state = freshRemoteState()
  state.repositoryPrivate = false
  await installGitHubMock(page, state)
  await connect(page, createTestKeyMaterial())

  await expect(page.getByText('GitHub Sync needs attention.')).toBeVisible()
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
