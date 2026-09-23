/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../app/AppContext'
import { isAppDataEmpty } from '../domain/defaults'
import { migrateAppData } from '../domain/migrations'
import type { AppData } from '../domain/types'
import {
  clearGitHubCredential,
  loadGitHubCredential,
  saveGitHubCredential,
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

export type GitHubSyncStatus =
  | 'disconnected'
  | 'locked'
  | 'connecting'
  | 'syncing'
  | 'current'
  | 'offline'
  | 'conflict'
  | 'error'

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
  setPaused: (paused: boolean) => Promise<void>
  unlink: () => Promise<void>
  clearRemoteSnapshot: () => Promise<void>
}

const GitHubSyncContext = createContext<GitHubSyncContextValue | null>(null)

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

  useEffect(() => { dataRef.current = data }, [data])
  useEffect(() => { credentialRef.current = credential }, [credential])

  useEffect(() => {
    let active = true
    void loadGitHubCredential().then((saved) => {
      if (!active) return
      setCredential(saved)
      setStatus(saved ? 'locked' : 'disconnected')
    }).catch(() => {
      if (active) {
        setStatus('error')
        setErrorMessage('The local GitHub Sync credential record could not be opened.')
      }
    })
    return () => { active = false }
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

  const markSynced = useCallback(async (sha: string | undefined, digest: string) => {
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
  }, [persistCredential])

  const readRemoteData = useCallback(async (remote: GitHubRemoteFile, passphrase: string): Promise<{ data: AppData; digest: string }> => {
    const decrypted: unknown = await decryptJson(remote.content, passphrase)
    const remoteData = migrateAppData(decrypted)
    return { data: remoteData, digest: await digestData(remoteData) }
  }, [])

  const performSync = useCallback(async (force: 'normal' | 'device' | 'github' = 'normal') => {
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
      const decision = force === 'github'
        ? 'pull-remote'
        : decideSyncAction({
            localDigest,
            remoteDigest: remoteResult.digest,
            lastSyncedDigest: saved.lastSyncedDigest,
            localIsEmpty: isAppDataEmpty(localData),
          })

      if (decision === 'conflict') {
        setStatus('conflict')
        setErrorMessage('Both this device and GitHub changed since the last successful sync. Choose which copy to keep.')
        return
      }
      if (decision === 'pull-remote') {
        applyingRemoteRef.current = true
        dataRef.current = remoteResult.data
        replaceData(remoteResult.data, 'Local data replaced with the encrypted GitHub snapshot.')
        await markSynced(remote.sha, remoteResult.digest)
        window.setTimeout(() => { applyingRemoteRef.current = false }, 0)
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
  }, [announce, markSynced, readRemoteData, replaceData])

  const connect = useCallback(async (input: ConnectInput) => withSerializedOperation(async () => {
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
  }), [performSync, persistCredential, withSerializedOperation])

  const unlock = useCallback(async (passphrase: string) => withSerializedOperation(async () => {
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
  }), [performSync, withSerializedOperation])

  const syncNow = useCallback(() => withSerializedOperation(() => performSync()), [performSync, withSerializedOperation])
  const resolveUseDevice = useCallback(() => withSerializedOperation(() => performSync('device')), [performSync, withSerializedOperation])
  const resolveUseGitHub = useCallback(() => withSerializedOperation(() => performSync('github')), [performSync, withSerializedOperation])

  const setPaused = useCallback(async (paused: boolean) => {
    const saved = credentialRef.current
    if (!saved) return
    const next = { ...saved, paused }
    await persistCredential(next)
    setStatus(paused ? 'disconnected' : tokenRef.current ? 'current' : 'locked')
    announce(paused ? 'GitHub Sync paused. Local changes continue to save.' : 'GitHub Sync resumed.')
    if (!paused && tokenRef.current) await syncNow()
  }, [announce, persistCredential, syncNow])

  const unlink = useCallback(async () => {
    await clearGitHubCredential()
    credentialRef.current = null
    setCredential(null)
    tokenRef.current = null
    passphraseRef.current = null
    setStatus('disconnected')
    setErrorMessage('')
    announce('GitHub Sync unlinked. The remote encrypted snapshot was not deleted.')
  }, [announce])

  const clearRemoteSnapshot = useCallback(() => withSerializedOperation(async () => {
    const saved = credentialRef.current
    const token = tokenRef.current
    if (!saved || !token) throw new Error('Unlock GitHub Sync before deleting the remote snapshot.')
    setStatus('syncing')
    try {
      const client = new GitHubContentsClient(token)
      const remote = await client.getFile(saved.repository)
      if (remote) await client.deleteFile(saved.repository, remote.sha)
      await persistCredential({ ...saved, paused: true, currentSha: undefined, lastSyncedDigest: undefined, lastSyncedAt: undefined })
      setStatus('disconnected')
      announce('The latest remote snapshot was deleted and sync was paused. GitHub history may still retain earlier versions.')
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
  }), [announce, persistCredential, withSerializedOperation])

  useEffect(() => {
    if (!ready || applyingRemoteRef.current || status !== 'current' || credential?.paused || !tokenRef.current) return
    const timeout = window.setTimeout(() => {
      void digestData(data).then((digest) => {
        if (digest !== credential?.lastSyncedDigest) void syncNow()
      })
    }, 1800)
    return () => window.clearTimeout(timeout)
  }, [credential?.lastSyncedDigest, credential?.paused, data, ready, status, syncNow])

  const value = useMemo<GitHubSyncContextValue>(() => ({
    status,
    target: credential?.repository ?? DEFAULT_GITHUB_TARGET,
    configured: credential !== null,
    paused: credential?.paused ?? false,
    errorMessage,
    lastSyncedAt: credential?.lastSyncedAt,
    connect,
    unlock,
    syncNow,
    resolveUseDevice,
    resolveUseGitHub,
    setPaused,
    unlink,
    clearRemoteSnapshot,
  }), [clearRemoteSnapshot, connect, credential, errorMessage, resolveUseDevice, resolveUseGitHub, setPaused, status, syncNow, unlink, unlock])

  return <GitHubSyncContext.Provider value={value}>{children}</GitHubSyncContext.Provider>
}

export const useGitHubSync = (): GitHubSyncContextValue => {
  const context = useContext(GitHubSyncContext)
  if (!context) throw new Error('useGitHubSync must be used inside GitHubSyncProvider.')
  return context
}
