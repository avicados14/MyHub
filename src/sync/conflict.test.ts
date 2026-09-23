import { describe, expect, it } from 'vitest'
import { decideSyncAction } from './conflict'

describe('sync conflict decisions', () => {
  it('pulls remote data when local data is empty', () => {
    expect(decideSyncAction({ localDigest: 'empty', remoteDigest: 'remote', localIsEmpty: true })).toBe('pull-remote')
  })

  it('pulls when only GitHub changed and pushes when only local changed', () => {
    expect(
      decideSyncAction({ localDigest: 'base', remoteDigest: 'remote', lastSyncedDigest: 'base', localIsEmpty: false }),
    ).toBe('pull-remote')
    expect(
      decideSyncAction({ localDigest: 'local', remoteDigest: 'base', lastSyncedDigest: 'base', localIsEmpty: false }),
    ).toBe('push-local')
  })

  it('requires an explicit choice when both copies changed', () => {
    expect(
      decideSyncAction({ localDigest: 'local', remoteDigest: 'remote', lastSyncedDigest: 'base', localIsEmpty: false }),
    ).toBe('conflict')
  })
})
