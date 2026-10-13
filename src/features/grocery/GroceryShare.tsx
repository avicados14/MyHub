import { useState } from 'react'
import { Field, Modal } from '../../components/ui'
import { groceryShareText } from '../../domain/grocerySharing'
import type { GroceryList } from '../../domain/types'

export default function GroceryShare({ list }: { list: GroceryList }) {
  const [open, setOpen] = useState(false)
  const [includePurchased, setIncludePurchased] = useState(false)
  const [message, setMessage] = useState('')
  const text = groceryShareText(list, includePurchased)
  const encoded = encodeURIComponent(text)
  const share = async () => {
    setMessage('')
    try {
      await navigator.share({ title: list.name, text })
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError'))
        setMessage('Sharing is unavailable. Try email, text, or copy instead.')
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Grocery list copied.')
    } catch {
      setMessage('Copy is unavailable. Select the preview text and copy it manually.')
    }
  }
  return (
    <>
      <button
        className="button button--secondary"
        type="button"
        onClick={() => {
          setMessage('')
          setOpen(true)
        }}
      >
        Share grocery list
      </button>
      <Modal
        open={open}
        title="Share grocery list"
        description="Send yourself a shopping checklist. Email and text open a draft in your app; review it and press Send there."
        onClose={() => setOpen(false)}
      >
        <label>
          <input
            type="checkbox"
            checked={includePurchased}
            onChange={(event) => {
              setIncludePurchased(event.target.checked)
              setMessage('')
            }}
          />{' '}
          Include purchased items
        </label>
        <Field label="Grocery list preview">
          <textarea rows={12} readOnly value={text} onFocus={(event) => event.target.select()} />
        </Field>
        <div className="modal__actions">
          <a
            className="button button--secondary"
            href={`mailto:?subject=${encodeURIComponent(list.name)}&body=${encoded}`}
          >
            Email list
          </a>
          <a
            className="button button--secondary"
            href={`sms:${/iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encoded}`}
          >
            Text list
          </a>
          {typeof navigator.share === 'function' ? (
            <button className="button button--secondary" type="button" onClick={() => void share()}>
              More sharing options
            </button>
          ) : null}
          <button className="button button--primary" type="button" onClick={() => void copy()}>
            Copy list
          </button>
        </div>
        <p>For long lists or if no mail/text app opens, use Copy list and paste into your preferred app.</p>
        <p role="status">{message}</p>
      </Modal>
    </>
  )
}
