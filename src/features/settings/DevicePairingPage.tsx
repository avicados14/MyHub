import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, Field, PageHeader, StatusBadge } from '../../components/ui'
import { inspectDevicePairingParameter, unlockDevicePairingParameter } from '../../sync/devicePairing'
import { useGitHubSync } from '../../sync/GitHubSyncContext'
import '../../styles/crosscut-v2.css'

interface PairingMetadata {
  expiresAt?: number
  error?: string
}

const inspectPairing = (parameter: string): PairingMetadata => {
  if (!parameter) return { error: 'This phone setup link is incomplete. Scan a new QR code from a connected device.' }
  try {
    return inspectDevicePairingParameter(parameter)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'This phone setup link is invalid.' }
  }
}

export default function DevicePairingPage() {
  const { announce } = useApp()
  const github = useGitHubSync()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pairingParameter] = useState(() => searchParams.get('pair') ?? '')
  const [metadata] = useState(() => inspectPairing(pairingParameter))
  const [pairingCode, setPairingCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!pairingParameter) return
    setSearchParams(new URLSearchParams(), { replace: true })
    // Remove the encrypted setup package from browser history after this page captures it in memory.
  }, [pairingParameter, setSearchParams])

  const connectPhone = async () => {
    if (metadata.error) return
    setBusy(true)
    setErrorMessage('')
    try {
      const material = await unlockDevicePairingParameter(pairingParameter, pairingCode)
      await github.connect({ ...material.repository, token: material.token, passphrase: material.passphrase })
      announce('This device is connected. Your encrypted GitHub data is ready.')
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'This device could not be connected.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pair-device-page">
      <PageHeader
        title="Set up this device"
        description="Bring your encrypted MyHub data onto this phone without re-entering repository settings."
      />
      <Card className="pair-device-card">
        <div className="pair-device-card__heading">
          <span className="section-icon section-icon--blue">
            <Smartphone aria-hidden="true" />
          </span>
          <div>
            <h2>Finish the private connection</h2>
            <p>The QR package and the separate code are both required. Neither one works by itself.</p>
          </div>
          <StatusBadge tone={metadata.error ? 'danger' : 'success'}>
            {metadata.error ? 'Unavailable' : 'Ready'}
          </StatusBadge>
        </div>

        {metadata.error ? (
          <div className="inline-alert" role="alert">
            <KeyRound aria-hidden="true" />
            <span>
              <strong>Phone setup needs a new code.</strong>
              {metadata.error}
            </span>
          </div>
        ) : (
          <>
            <div className="pair-device-security">
              <ShieldCheck aria-hidden="true" />
              <p>
                This setup package expires at{' '}
                <strong>
                  {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(
                    new Date(metadata.expiresAt ?? Date.now()),
                  )}
                </strong>
                . MyHub removes it from the address bar before asking for the code.
              </p>
            </div>
            <Field
              label="16-character pairing code"
              hint="Enter the code shown next to the QR on your connected device."
            >
              <input
                name="devicePairingCode"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="ABCD-EFGH-JKLM-NPQR"
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
              />
            </Field>
            {errorMessage ? (
              <div className="inline-alert" role="alert">
                <KeyRound aria-hidden="true" />
                <span>
                  <strong>This device was not connected.</strong>
                  {errorMessage}
                </span>
              </div>
            ) : null}
            <button
              className="button button--primary"
              type="button"
              disabled={busy || pairingCode.replace(/[^A-Z2-9]/giu, '').length !== 16}
              onClick={() => void connectPhone()}
            >
              <Smartphone aria-hidden="true" /> {busy ? 'Connecting this device…' : 'Connect this device'}
            </button>
          </>
        )}

        <Link className="button button--quiet" to="/settings?section=github-sync">
          Open GitHub Sync settings
        </Link>
      </Card>
    </div>
  )
}
