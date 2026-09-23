import { KeyRound, Link2, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { Card, PageHeader, StatusBadge } from '../../components/ui'
import {
  PRIVATE_ACCESS_ID_PARAMETER,
  PRIVATE_ACCESS_KEY_PARAMETER,
  resolvePrivateAccess,
} from '../../sync/privateAccess'
import { useGitHubSync } from '../../sync/GitHubSyncContext'
import '../../styles/crosscut-v2.css'

export default function PrivateAccessPage() {
  const { announce } = useApp()
  const github = useGitHubSync()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [link] = useState(() => ({
    id: searchParams.get(PRIVATE_ACCESS_ID_PARAMETER) ?? '',
    key: searchParams.get(PRIVATE_ACCESS_KEY_PARAMETER) ?? '',
  }))
  const [errorMessage, setErrorMessage] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (!link.id && !link.key) return
    setSearchParams(new URLSearchParams(), { replace: true })
    // Remove the private broker ID and decryption key from browser history after capturing them in memory.
  }, [link.id, link.key, setSearchParams])

  useEffect(() => {
    if (started.current) return
    started.current = true

    const connectFromLink = async () => {
      try {
        const access = await resolvePrivateAccess(link.id, link.key)
        await github.connectPrivateAccess(access)
        announce('This device is connected. Your encrypted Supabase data is ready, with GitHub backup active.')
        navigate('/', { replace: true })
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'This private access link could not connect MyHub.')
      }
    }

    void connectFromLink()
  }, [announce, github, link.id, link.key, navigate])

  return (
    <div className="private-access-page">
      <PageHeader
        title="Opening your private MyHub"
        description="Connecting this browser and loading your encrypted data."
      />
      <Card className="private-access-card" aria-live="polite">
        <div className="private-access-card__heading">
          <span className="section-icon section-icon--blue">
            {errorMessage ? <KeyRound aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          </span>
          <div>
            <h2>{errorMessage ? 'This private link did not connect' : 'Loading your data'}</h2>
            <p>
              {errorMessage
                ? 'Use a newly generated private access link or connect manually in GitHub Sync settings.'
                : 'MyHub is loading the current encrypted Supabase document and enabling the GitHub backup before Home opens.'}
            </p>
          </div>
          <StatusBadge tone={errorMessage ? 'danger' : 'info'}>
            {errorMessage ? 'Unavailable' : 'Connecting'}
          </StatusBadge>
        </div>

        {errorMessage ? (
          <div className="inline-alert" role="alert">
            <KeyRound aria-hidden="true" />
            <span>
              <strong>Private access failed.</strong>
              {errorMessage}
            </span>
          </div>
        ) : (
          <div className="private-access-security">
            <ShieldCheck aria-hidden="true" />
            <p>
              The access package has been removed from the address bar and will not be included in later navigation.
            </p>
          </div>
        )}

        {errorMessage ? (
          <Link className="button button--quiet" to="/settings?section=github-sync">
            Open GitHub Sync settings
          </Link>
        ) : null}
      </Card>
    </div>
  )
}
