import { friendlyError } from '../lib/errors'
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'text' | 'danger'

const base =
  'tap inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-busy:disabled:cursor-wait aria-busy:disabled:opacity-80'

const variants: Record<Variant, string> = {
  primary: 'h-10 px-[18px] bg-plum text-white hover:bg-plum-hover',
  ghost:
    'h-10 px-4 bg-print text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)]',
  text: 'px-1 py-1.5 text-small text-plum-soft underline underline-offset-3 hover:text-plum',
  danger: 'h-10 px-[18px] bg-alert text-white hover:bg-alert-deep',
}

export function Button({
  variant = 'primary',
  busy = false,
  className = '',
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {busy && <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />}
      {children}
    </button>
  )
}

const inputClass =
  'h-[46px] w-full min-w-0 rounded-full bg-print px-[18px] text-body text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] placeholder:text-placeholder aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--color-alert)]'

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
  className = '',
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="px-1 text-small font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="px-1 text-small text-plum-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="px-1 text-small font-semibold text-alert">
          {error}
        </p>
      )}
    </div>
  )
}

const describedBy = (id: string, hint?: ReactNode, error?: string | null) =>
  [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined

export function TextField({
  label,
  hint,
  error,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
      />
    </FieldShell>
  )
}

export function TextArea({
  label,
  hint,
  error,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        rows={3}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className="w-full min-w-0 resize-y rounded-panel bg-print px-[18px] py-3 text-body text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] placeholder:text-placeholder"
      />
    </FieldShell>
  )
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <select
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputClass} select-pill pl-[18px] font-semibold`}
      >
        {children}
      </select>
    </FieldShell>
  )
}

/** White panel; the app's only container. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-panel bg-print p-5 ${className}`}>{children}</section>
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'alert' }) {
  const toneClass = tone === 'alert' ? 'bg-alert-wash text-alert-deep' : 'bg-sky-wash text-sky-ink'
  return (
    <p role={tone === 'alert' ? 'alert' : undefined} className={`max-w-[72ch] rounded-panel px-4 py-3 text-small ${toneClass}`}>
      {children}
    </p>
  )
}

/** A list or page that couldn't load, with a way to try again without reloading. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-3">
      <Notice tone="alert">{friendlyError(error)}</Notice>
      <Button variant="ghost" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="mr-1.5 inline-block -translate-y-px">
      <rect x="3" y="7" width="10" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="inline-grid shrink-0 place-items-center rounded-full bg-blush-deep text-small font-extrabold text-plum"
    >
      {initials}
    </span>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <p role="status" className="py-12 text-plum-soft">
      {label}…
    </p>
  )
}

/** Two-step inline confirmation instead of a modal. */
export function ConfirmButton({
  label,
  confirmLabel,
  question,
  onConfirm,
  busy,
  variant = 'ghost',
  danger = false,
}: {
  label: string
  confirmLabel: string
  question: string
  onConfirm: () => void
  busy?: boolean
  /** 'danger' is a ghost trigger with a red confirm; 'text' is a link-style trigger. */
  variant?: 'ghost' | 'danger' | 'text'
  /** Red confirm button for a 'text' trigger. */
  danger?: boolean
}) {
  const id = useId()
  return (
    <details className="group">
      <summary className={`${base} ${variants[variant === 'danger' ? 'ghost' : variant]} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        {label}
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-3" role="group" aria-labelledby={id}>
        <p id={id} className="text-small whitespace-normal text-plum-soft">
          {question}
        </p>
        <Button variant={variant === 'danger' || danger ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </details>
  )
}
