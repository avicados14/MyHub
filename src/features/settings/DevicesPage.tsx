import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, PageHeader } from '../../components/ui'
import { useGitHubSync } from '../../sync/GitHubSyncContext'
import { redeemDevicePairing } from '../../sync/devicePairing'

export default function DevicesPage() {
  const sync = useGitHubSync()
  const navigate = useNavigate()
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null)
  const [code, setCode] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!pairing) return
    const timer = window.setTimeout(() => setPairing(null), Math.max(0, Date.parse(pairing.expiresAt) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [pairing])
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Device sign-in could not finish.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="private-access-page">
      <PageHeader
        title="MyHub on your phone"
        description="Install free, then connect using a temporary code from your signed-in device."
      />
      <Card>
        <h2>1. Add MyHub to your Home Screen</h2>
        <p>
          On iPhone or iPad, open this site in Safari, tap Share, then Add to Home Screen. Keep Open as Web App enabled
          if shown, and tap Add. Open the new MyHub icon before signing in.
        </p>
        <p>On Android, open this site in Chrome and choose Install app or Add to Home screen from the menu.</p>
        <p>
          No Apple developer membership or Apple hosting payment is required. Your browser and Home Screen app may have
          separate sign-ins.
        </p>
      </Card>
      <Card>
        <h2>2. Get a code on your connected device</h2>
        <p>
          Open Settings → Install MyHub / connect a device on your signed-in computer or phone. Codes last 10 minutes,
          work once, and give access to your MyHub data. Share a code only with your own device.
        </p>
        {!sync.privateAccessActive && (
          <p>
            First connect using your existing private access link. If you use manual GitHub setup, create a private
            access link in <Link to="/settings">Settings</Link> first.
          </p>
        )}
        <button
          className="button button--primary"
          disabled={busy || !sync.privateAccessActive || sync.status !== 'current' || sync.paused}
          onClick={() => void run(async () => setPairing(await sync.createPairing()))}
        >
          Generate sign-in code
        </button>
        {pairing && (
          <div role="status">
            <p>
              Single-use sign-in code: <strong style={{ overflowWrap: 'anywhere' }}>{pairing.code}</strong>
            </p>
            <p>
              Expires at {new Date(pairing.expiresAt).toLocaleTimeString()}. Generating another code cancels this one.
            </p>
            <button
              className="button button--secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await sync.cancelPairing()
                  setPairing(null)
                })
              }
            >
              Cancel code
            </button>
          </div>
        )}
      </Card>
      <Card>
        <h2>3. Enter the code on your new device</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!consent || busy) return
            void run(async () => {
              const access = await redeemDevicePairing(code)
              setCode('')
              await sync.connectPrivateAccess(access)
              navigate('/', { replace: true })
            })
          }}
        >
          <label>
            Sign-in code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              required
            />
          </label>
          <p>
            Connecting loads the synced MyHub copy and replaces this device’s local data. Export a backup in Settings
            first if you have local work to keep.
          </p>
          <label>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I want to
            load my synced data on this device.
          </label>
          <button className="button button--primary" disabled={busy || !consent} type="submit">
            {busy ? 'Working…' : 'Connect this device'}
          </button>
        </form>
        <p>
          Your connection stays saved on this device. If a consumed code fails to finish connecting, generate another
          code.
        </p>
      </Card>
      {error && <p role="alert">{error}</p>}
      <Link to="/settings">Back to Settings</Link>
    </div>
  )
}
