/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../app/AppContext'
import { isAppDataEmpty } from '../domain/defaults'
import { migrateAppData } from '../domain/migrations'
import type { AppData } from '../domain/types'
import {
  clearGitHubCredential,
  clearPrivateAccessCredential,
  loadGitHubCredential,
  loadPrivateAccessCredential,
  saveGitHubCredential,
  savePrivateAccessCredential,
  type StoredGitHubCredential,
} from '../storage/database'
import { decideSyncAction } from './conflict'
import { decryptJson, decryptText, encryptJson, encryptText, sha256Digest } from './crypto'
import {
  GitHubConflictError,
  GitHubContentsClient,
  type GitHubRemoteFile,
  type GitHubRepositoryTarget,
} from './githubClient'
import { PRIVATE_CALENDAR_SNAPSHOT_PATH, type PrivateCalendarAccessProvider } from './calendarSnapshot'
import {
  createPrivateAccessUrl,
  pushPrivateAppData,
  resolvePrivateAccess,
  type PrivateAccessLink,
  type PrivateAccessMaterial,
  type ResolvedPrivateAccess,
} from './privateAccess'

export type GitHubSyncStatus =
  'disconnected' | 'locked' | 'connecting' | 'syncing' | 'current' | 'offline' | 'conflict' | 'error'

export const DEFAULT_GITHUB_TARGET: GitHubRepositoryTarget = {
  owner: 'avicados14',
  repo: 'MyHub-Data',
  path: 'myhub-data/v1/snapshot.enc',
}

interface ConnectInput extends GitHubRepositoryTarget {
  token: string
  passphrase: string
}

interface GitHubSyncContextValue {
  status: GitHubSyncStatus
  target: GitHubRepositoryTarget
  configured: boolean
  paused: boolean
  errorMessage: string
  lastSyncedAt?: string
  connect: (input: ConnectInput) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  syncNow: () => Promise<void>
  resolveUseDevice: () => Promise<void>
  resolveUseGitHub: () => Promise<void>
  privateAccessActive: boolean
  lastSupabaseSyncedAt?: string
  createPrivateAccessLink: (baseUrl: string) => Promise<PrivateAccessLink>
  connectPrivateAccess: (access: ResolvedPrivateAccess) => Promise<void>
  setPaused: (paused: boolean) => Promise<void>
  unlink: () => Promise<void>
  clearRemoteSnapshot: () => Promise<void>
  calendarAccess: PrivateCalendarAccessProvider
}

const GitHubSyncContext = createContext<GitHubSyncContextValue | null>(null)

interface PrivateAccessSession {
  id: string
  key: string
  version: number
  updatedAt: string
  lastDigest: string
}

const digestData = (data: AppData): Promise<string> => sha256Digest(JSON.stringify(data))
const offline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false

export function GitHubSyncProvider({ children }: { children: ReactNode }) {
  const { data, ready, replaceData, announce } = useApp()
  const [credential, setCredential] = useState<StoredGitHubCredential | null>(null)
  const [status, setStatus] = useState<GitHubSyncStatus>('disconnected')
  const [errorMessage, setErrorMessage] = useState('')
  const credentialRef = useRef<StoredGitHubCredential | null>(null)
  const dataRef = useRef(data)
  const tokenRef = useRef<string | null>(null)
  const passphraseRef = useRef<string | null>(null)
  const operationRef = useRef<Promise<void>>(Promise.resolve())
  const applyingRemoteRef = useRef(false)
  const privateAccessRef = useRef<PrivateAccessSession | null>(null)
  const privateAccessPushRef = useRef<Promise<void>>(Promise.resolve())
  const privateAccessRestoreStartedRef = useRef(false)
  const [privateAccessActive, setPrivateAccessActive] = useState(false)
  const [lastSupabaseSyncedAt, setLastSupabaseSyncedAt] = useState<string>()

  useEffect(() => {
    dataRef.current = data
  }, [data])
  useEffect(() => {
    credentialRef.current = credential
  }, [credential])

  useEffect(() => {
    let active = true
    void loadGitHubCredential()
      .then((saved) => {
        if (!active) return
        setCredential(saved)
        if (!privateAccessRef.current) setStatus(saved ? 'locked' : 'disconnected')
      })
      .catch(() => {
        if (active) {
          setStatus('error')
          setErrorMessage('The local GitHub Sync credential record could not be opened.')
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleOffline = () => {
      if (credentialRef.current && tokenRef.current) setStatus('offline')
    }
    const handleOnline = () => {
      if (credentialRef.current && tokenRef.current && !credentialRef.current.paused) setStatus('current')
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const persistCredential = useCallback(async (next: StoredGitHubCredential) => {
    credentialRef.current = next
    setCredential(next)
    await saveGitHubCredential(next)
  }, [])

  const withSerializedOperation = useCallback((operation: () => Promise<void>): Promise<void> => {
    const next = operationRef.current.then(operation, operation)
    operationRef.current = next.catch(() => undefined)
    return next
  }, [])

  const markSynced = useCallback(
    async (sha: string | undefined, digest: string) => {
      const current = credentialRef.current
      if (!current) return
      const next: StoredGitHubCredential = {
        ...current,
        currentSha: sha,
        lastSyncedDigest: digest,
        lastSyncedAt: new Date().toISOString(),
      }
      await persistCredential(next)
      setErrorMessage('')
      setStatus(next.paused ? 'disconnected' : 'current')
    },
    [persistCredential],
  )

  const readRemoteData = useCallback(
    async (remote: GitHubRemoteFile, passphrase: string): Promise<{ data: AppData; digest: string }> => {
      const decrypted: unknown = await decryptJson(remote.content, passphrase)
      const remoteData = migrateAppData(decrypted)
      return { data: remoteData, digest: await digestData(remoteData) }
    },
    [],
  )

  const performSync = useCallback(
    async (force: 'normal' | 'device' | 'github' = 'normal') => {
      const saved = credentialRef.current
      const token = tokenRef.current
      const passphrase = passphraseRef.current
      if (!saved || !token || !passphrase || saved.paused) return
      if (offline()) {
        setStatus('offline')
        return
      }
      setStatus('syncing')
      setErrorMessage('')
      try {
        const client = new GitHubContentsClient(token)
        const remote = await client.getFile(saved.repository)
        const localData = dataRef.current
        const localDigest = await digestData(localData)

        if (force === 'device') {
          const encrypted = await encryptJson(localData, passphrase)
          const nextSha = await client.putFile(saved.repository, encrypted, remote?.sha)
          await markSynced(nextSha, localDigest)
          announce('GitHub now uses this device’s data.')
          return
        }

        if (!remote) {
          if (force === 'github') throw new Error('The encrypted GitHub snapshot no longer exists.')
          const encrypted = await encryptJson(localData, passphrase)
          const nextSha = await client.putFile(saved.repository, encrypted)
          await markSynced(nextSha, localDigest)
          return
        }

        const remoteResult = await readRemoteData(remote, passphrase)
        const decision =
          force === 'github'
            ? 'pull-remote'
            : decideSyncAction({
                localDigest,
                remoteDigest: remoteResult.digest,
                lastSyncedDigest: saved.lastSyncedDigest,
                localIsEmpty: isAppDataEmpty(localData),
              })

        if (decision === 'conflict') {
          setStatus('conflict')
          setErrorMessage(
            'Both this device and GitHub changed since the last successful sync. Choose which copy to keep.',
          )
          return
        }
        if (decision === 'pull-remote') {
          applyingRemoteRef.current = true
          dataRef.current = remoteResult.data
          replaceData(remoteResult.data, 'Local data replaced with the encrypted GitHub snapshot.')
          await markSynced(remote.sha, remoteResult.digest)
          window.setTimeout(() => {
            applyingRemoteRef.current = false
          }, 0)
          return
        }
        if (decision === 'push-local') {
          const encrypted = await encryptJson(localData, passphrase)
          const nextSha = await client.putFile(saved.repository, encrypted, remote.sha)
          await markSynced(nextSha, localDigest)
          return
        }
        await markSynced(remote.sha, localDigest)
      } catch (error) {
        if (error instanceof GitHubConflictError) {
          setStatus('conflict')
          setErrorMessage('GitHub changed during this sync. Choose which copy to keep; nothing was overwritten.')
          return
        }
        if (offline()) {
          setStatus('offline')
          return
        }
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'GitHub Sync failed.')
      }
    },
    [announce, markSynced, readRemoteData, replaceData],
  )

  const connect = useCallback(
    async (input: ConnectInput) =>
      withSerializedOperation(async () => {
        setStatus('connecting')
        setErrorMessage('')
        try {
          if (!input.token.trim()) throw new Error('Enter a fine-grained GitHub token.')
          if (input.passphrase.length < 12) throw new Error('Use an encryption passphrase with at least 12 characters.')
          const repository = { owner: input.owner.trim(), repo: input.repo.trim(), path: input.path.trim() }
          const client = new GitHubContentsClient(input.token.trim())
          await client.requirePrivateRepository(repository)
          const tokenEnvelope = await encryptText(input.token.trim(), input.passphrase)
          const next: StoredGitHubCredential = { version: 1, repository, tokenEnvelope, paused: false }
          tokenRef.current = input.token.trim()
          passphraseRef.current = input.passphrase
          await persistCredential(next)
          await performSync()
        } catch (error) {
          tokenRef.current = null
          passphraseRef.current = null
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : 'GitHub Sync could not connect.')
          throw error
        }
      }),
    [performSync, persistCredential, withSerializedOperation],
  )

  const unlock = useCallback(
    async (passphrase: string) =>
      withSerializedOperation(async () => {
        const saved = credentialRef.current
        if (!saved) throw new Error('No saved GitHub Sync connection was found.')
        setStatus('connecting')
        setErrorMessage('')
        try {
          const token = await decryptText(saved.tokenEnvelope, passphrase)
          tokenRef.current = token
          passphraseRef.current = passphrase
          if (saved.paused) {
            setStatus('disconnected')
            return
          }
          const client = new GitHubContentsClient(token)
          await client.requirePrivateRepository(saved.repository)
          await performSync()
        } catch (error) {
          tokenRef.current = null
          passphraseRef.current = null
          setStatus('locked')
          setErrorMessage(error instanceof Error ? error.message : 'The credential could not be unlocked.')
          throw error
        }
      }),
    [performSync, withSerializedOperation],
  )

  const syncNow = useCallback(
    () => withSerializedOperation(() => performSync()),
    [performSync, withSerializedOperation],
  )
  const resolveUseDevice = useCallback(
    () => withSerializedOperation(() => performSync('device')),
    [performSync, withSerializedOperation],
  )
  const resolveUseGitHub = useCallback(
    () => withSerializedOperation(() => performSync('github')),
    [performSync, withSerializedOperation],
  )

  const privateAccessMaterial = useCallback((): PrivateAccessMaterial => {
    const saved = credentialRef.current
    const token = tokenRef.current
    const passphrase = passphraseRef.current
    if (!saved || !token || !passphrase || saved.paused || status !== 'current') {
      throw new Error('Bring GitHub Sync to current before creating a private access link.')
    }
    return { repository: saved.repository, token, passphrase }
  }, [status])

  const createPrivateAccessLinkForCurrentData = useCallback(
    async (baseUrl: string): Promise<PrivateAccessLink> => {
      const link = await createPrivateAccessUrl(privateAccessMaterial(), dataRef.current, baseUrl)
      const lastDigest = await digestData(dataRef.current)
      privateAccessRef.current = {
        id: link.id,
        key: link.key,
        version: link.version,
        updatedAt: link.updatedAt,
        lastDigest,
      }
      await savePrivateAccessCredential({ version: 1, id: link.id, key: link.key })
      setPrivateAccessActive(true)
      setLastSupabaseSyncedAt(link.updatedAt)
      return link
    },
    [privateAccessMaterial],
  )

  const connectPrivateAccess = useCallback(
    async (access: ResolvedPrivateAccess) =>
      withSerializedOperation(async () => {
        setStatus('connecting')
        setErrorMessage('')
        const remoteData = migrateAppData(access.data)
        const repository = access.material.repository
        const client = new GitHubContentsClient(access.material.token)
        await client.requirePrivateRepository(repository)
        const tokenEnvelope = await encryptText(access.material.token, access.material.passphrase)
        const next: StoredGitHubCredential = { version: 1, repository, tokenEnvelope, paused: false }
        tokenRef.current = access.material.token
        passphraseRef.current = access.material.passphrase
        dataRef.current = remoteData
        applyingRemoteRef.current = true
        replaceData(remoteData, 'Supabase loaded the current encrypted MyHub data.')
        await persistCredential(next)
        const lastDigest = await digestData(remoteData)
        privateAccessRef.current = {
          id: access.id,
          key: access.key,
          version: access.version,
          updatedAt: access.updatedAt,
          lastDigest,
        }
        await savePrivateAccessCredential({ version: 1, id: access.id, key: access.key })
        setPrivateAccessActive(true)
        setLastSupabaseSyncedAt(access.updatedAt)
        window.setTimeout(() => {
          applyingRemoteRef.current = false
        }, 0)
        await performSync()
      }),
    [performSync, persistCredential, replaceData, withSerializedOperation],
  )

  useEffect(() => {
    if (!ready || privateAccessRestoreStartedRef.current) return
    privateAccessRestoreStartedRef.current = true
    void loadPrivateAccessCredential()
      .then(async (saved) => {
        if (!saved || privateAccessRef.current) return
        const access = await resolvePrivateAccess(saved.id, saved.key)
        await connectPrivateAccess(access)
      })
      .catch(async (error: unknown) => {
        await clearPrivateAccessCredential()
        setErrorMessage(
          error instanceof Error
            ? `The saved private access link could not reconnect: ${error.message}`
            : 'The saved private access link could not reconnect.',
        )
      })
  }, [connectPrivateAccess, ready])

  const setPaused = useCallback(
    async (paused: boolean) => {
      const saved = credentialRef.current
      if (!saved) return
      const next = { ...saved, paused }
      await persistCredential(next)
      setStatus(paused ? 'disconnected' : tokenRef.current ? 'current' : 'locked')
      announce(paused ? 'GitHub Sync paused. Local changes continue to save.' : 'GitHub Sync resumed.')
      if (!paused && tokenRef.current) await syncNow()
    },
    [announce, persistCredential, syncNow],
  )

  const unlink = useCallback(async () => {
    await Promise.all([clearGitHubCredential(), clearPrivateAccessCredential()])
    credentialRef.current = null
    setCredential(null)
    tokenRef.current = null
    passphraseRef.current = null
    privateAccessRef.current = null
    setPrivateAccessActive(false)
    setLastSupabaseSyncedAt(undefined)
    setStatus('disconnected')
    setErrorMessage('')
    announce('Cross-device sync was unlinked from this browser. Remote encrypted data and the private link remain.')
  }, [announce])

  const clearRemoteSnapshot = useCallback(
    () =>
      withSerializedOperation(async () => {
        const saved = credentialRef.current
        const token = tokenRef.current
        if (!saved || !token) throw new Error('Unlock GitHub Sync before deleting the remote snapshot.')
        setStatus('syncing')
        try {
          const client = new GitHubContentsClient(token)
          const remote = await client.getFile(saved.repository)
          if (remote) await client.deleteFile(saved.repository, remote.sha)
          await persistCredential({
            ...saved,
            paused: true,
            currentSha: undefined,
            lastSyncedDigest: undefined,
            lastSyncedAt: undefined,
          })
          setStatus('disconnected')
          announce(
            'The latest remote snapshot was deleted and sync was paused. GitHub history may still retain earlier versions.',
          )
        } catch (error) {
          if (error instanceof GitHubConflictError) {
            setStatus('conflict')
            setErrorMessage('GitHub changed during deletion. Sync was not silently overwritten.')
            return
          }
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : 'The remote snapshot could not be deleted.')
          throw error
        }
      }),
    [announce, persistCredential, withSerializedOperation],
  )

  const calendarAccessAvailable = Boolean(credential && tokenRef.current && passphraseRef.current && !credential.paused)
  const calendarAccessReason = !credential
    ? 'Connect GitHub Sync before importing the private calendar snapshot.'
    : credential.paused
      ? 'Resume GitHub Sync before importing the private calendar snapshot.'
      : !tokenRef.current || !passphraseRef.current
        ? 'Unlock GitHub Sync with the active passphrase before importing the private calendar snapshot.'
        : undefined
  const calendarAccess = useMemo<PrivateCalendarAccessProvider>(
    () => ({
      available: calendarAccessAvailable,
      reason: calendarAccessReason,
      fetchEncryptedCalendarSnapshot: async () => {
        const saved = credentialRef.current
        const token = tokenRef.current
        if (!saved || !token) throw new Error('Unlock GitHub Sync before importing the private calendar snapshot.')
        const client = new GitHubContentsClient(token)
        return client.getFile({ ...saved.repository, path: PRIVATE_CALENDAR_SNAPSHOT_PATH })
      },
      decryptCalendarSnapshot: async (encrypted: string) => {
        const passphrase = passphraseRef.current
        if (!passphrase) throw new Error('Unlock GitHub Sync before decrypting the private calendar snapshot.')
        return decryptText(encrypted, passphrase)
      },
    }),
    [calendarAccessAvailable, calendarAccessReason],
  )

  const refreshPrivateAccess = useCallback(async () => {
    const session = privateAccessRef.current
    if (!session || offline()) return
    try {
      const remote = await resolvePrivateAccess(session.id, session.key)
      if (remote.version === session.version) return
      const remoteData = migrateAppData(remote.data)
      const remoteDigest = await digestData(remoteData)
      const localDigest = await digestData(dataRef.current)
      if (localDigest !== session.lastDigest) {
        setErrorMessage(
          'Supabase has a newer copy while this device also has changes. Reopen your private link before editing further.',
        )
        return
      }
      dataRef.current = remoteData
      applyingRemoteRef.current = true
      replaceData(remoteData, 'Supabase loaded newer MyHub changes from another device.')
      privateAccessRef.current = {
        ...session,
        version: remote.version,
        updatedAt: remote.updatedAt,
        lastDigest: remoteDigest,
      }
      setLastSupabaseSyncedAt(remote.updatedAt)
      window.setTimeout(() => {
        applyingRemoteRef.current = false
      }, 0)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Supabase could not refresh MyHub data.')
    }
  }, [replaceData])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshPrivateAccess()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [refreshPrivateAccess])

  useEffect(() => {
    if (!ready || applyingRemoteRef.current || status !== 'current' || credential?.paused || !tokenRef.current) return
    const timeout = window.setTimeout(() => {
      void digestData(data).then((digest) => {
        if (digest !== credential?.lastSyncedDigest) void syncNow()
      })
    }, 1800)
    return () => window.clearTimeout(timeout)
  }, [credential?.lastSyncedDigest, credential?.paused, data, ready, status, syncNow])

  useEffect(() => {
    if (!ready || applyingRemoteRef.current || !privateAccessRef.current) return
    const timeout = window.setTimeout(() => {
      const snapshot = data
      privateAccessPushRef.current = privateAccessPushRef.current.then(async () => {
        const session = privateAccessRef.current
        if (!session) return
        const digest = await digestData(snapshot)
        if (digest === session.lastDigest) return
        try {
          const result = await pushPrivateAppData(session.id, session.key, snapshot, session.version)
          privateAccessRef.current = {
            ...session,
            version: result.version,
            updatedAt: result.updatedAt,
            lastDigest: digest,
          }
          setLastSupabaseSyncedAt(result.updatedAt)
          setErrorMessage('')
        } catch (error) {
          if (error instanceof Error && (error as Error & { status?: number }).status === 409) {
            await refreshPrivateAccess()
            return
          }
          setErrorMessage(error instanceof Error ? error.message : 'Supabase could not save MyHub data.')
        }
      })
    }, 650)
    return () => window.clearTimeout(timeout)
  }, [data, ready, refreshPrivateAccess])

  const value = useMemo<GitHubSyncContextValue>(
    () => ({
      status,
      target: credential?.repository ?? DEFAULT_GITHUB_TARGET,
      configured: credential !== null,
      paused: credential?.paused ?? false,
      errorMessage,
      lastSyncedAt: credential?.lastSyncedAt,
      privateAccessActive,
      lastSupabaseSyncedAt,
      connect,
      unlock,
      syncNow,
      resolveUseDevice,
      resolveUseGitHub,
      createPrivateAccessLink: createPrivateAccessLinkForCurrentData,
      connectPrivateAccess,
      setPaused,
      unlink,
      clearRemoteSnapshot,
      calendarAccess,
    }),
    [
      calendarAccess,
      clearRemoteSnapshot,
      connect,
      connectPrivateAccess,
      createPrivateAccessLinkForCurrentData,
      credential,
      errorMessage,
      lastSupabaseSyncedAt,
      privateAccessActive,
      resolveUseDevice,
      resolveUseGitHub,
      setPaused,
      status,
      syncNow,
      unlink,
      unlock,
    ],
  )

  return <GitHubSyncContext.Provider value={value}>{children}</GitHubSyncContext.Provider>
}

export const useGitHubSync = (): GitHubSyncContextValue => {
  const context = useContext(GitHubSyncContext)
  if (!context) throw new Error('useGitHubSync must be used inside GitHubSyncProvider.')
  return context
}
