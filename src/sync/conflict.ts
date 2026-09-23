export type SyncDecision = 'push-local' | 'pull-remote' | 'current' | 'conflict'

export interface SyncDecisionInput {
  localDigest: string
  remoteDigest: string | null
  lastSyncedDigest?: string
  localIsEmpty: boolean
}

export const decideSyncAction = ({
  localDigest,
  remoteDigest,
  lastSyncedDigest,
  localIsEmpty,
}: SyncDecisionInput): SyncDecision => {
  if (remoteDigest === null) return 'push-local'
  if (localDigest === remoteDigest) return 'current'
  if (localIsEmpty) return 'pull-remote'
  if (lastSyncedDigest === localDigest) return 'pull-remote'
  if (lastSyncedDigest === remoteDigest) return 'push-local'
  return 'conflict'
}
