import { X } from 'lucide-react'
import { cloneElement, isValidElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react'

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </header>
  )
}

export function Card({ children, className = '', as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'article' | 'div' }) {
  return <Tag className={`card ${className}`}>{children}</Tag>
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'danger' | 'attention' | 'success' | 'study' | 'food' | 'lilac' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function ProgressBar({ value, max, label, tone = 'blue' }: { value: number; max: number; label: string; tone?: 'blue' | 'mint' | 'yellow' | 'pink' }) {
  const percentage = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="progress" aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <span className={`progress__bar progress__bar--${tone}`} style={{ width: `${percentage}%` }} />
    </div>
  )
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  )
}

export function Modal({ open, title, description, onClose, children }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const descriptionId = useId()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
    >
      <div className="modal__header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <button className="icon-button" type="button" aria-label={`Close ${title}`} onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="modal__body">{children}</div>
    </dialog>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const inputId = useId()
  const hintId = useId()
  const control = isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
      id: children.props.id ?? inputId,
      ...(hint ? { 'aria-describedby': [children.props['aria-describedby'], hintId].filter(Boolean).join(' ') } : {}),
    })
    : children
  const controlId = isValidElement<{ id?: string }>(children) ? children.props.id ?? inputId : inputId
  return (
    <div className="field">
      <label className="field__label" htmlFor={controlId}>{label}</label>
      {control}
      {hint ? <span className="field__hint" id={hintId}>{hint}</span> : null}
    </div>
  )
}

export function SegmentedControl({ label, options, value, onChange }: { label: string; options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="segmented-control">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className={value === option.value ? 'is-selected' : ''}>
          <input type="radio" name={label} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  )
}
