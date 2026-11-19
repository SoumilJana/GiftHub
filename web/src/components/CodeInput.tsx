import { useEffect, useId, useRef, useState } from 'react'
import { cleanCode } from '../lib/invite'

const LENGTH = 6

/**
 * Six boxes for an invite code, like photo-booth prints in a row. One real input sits on top,
 * so typing, deleting, pasting and the phone keyboard all behave normally. Each character pops
 * into its box; a wrong code gives the row a small shake. Calls onComplete when the sixth lands.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  error,
  label = 'Invite code',
  hint,
  autoFocus,
}: {
  value: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
  error?: string | null
  label?: string
  hint?: string
  autoFocus?: boolean
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)

  // Shake once each time a new error arrives.
  useEffect(() => {
    const el = row.current
    if (!error || !el) return
    el.classList.remove('code-shake')
    void el.offsetWidth
    el.classList.add('code-shake')
  }, [error])

  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="px-1 text-small font-semibold">
        {label}
      </label>
      <div ref={row} className="relative">
        <div className="grid grid-cols-[repeat(3,1fr)_10px_repeat(3,1fr)] gap-1.5 sm:gap-2" aria-hidden="true">
          {Array.from({ length: LENGTH }, (_, i) => {
            const ch = value[i]
            const current = focused && (i === value.length || (value.length === LENGTH && i === LENGTH - 1))
            return [
              i === 3 && <span key="gap" className="self-center justify-self-center text-plum-soft">·</span>,
              <span
                key={i}
                className={`relative grid h-14 place-items-center rounded-print bg-print text-[26px] leading-none font-extrabold text-plum tabular-nums transition-shadow duration-150 ${
                  error
                    ? 'shadow-[inset_0_0_0_1.5px_var(--color-alert)]'
                    : current
                      ? 'shadow-[inset_0_0_0_2px_var(--color-plum)]'
                      : ch
                        ? 'shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)]'
                        : 'shadow-[inset_0_0_0_1.5px_var(--color-edge)]'
                }`}
              >
                {ch ? (
                  <span key={`${i}${ch}`} className="code-pop">
                    {ch}
                  </span>
                ) : (
                  current && <span className="code-caret h-7 w-0.5 rounded-full bg-plum" />
                )}
              </span>,
            ]
          })}
        </div>
        <input
          ref={input}
          id={id}
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Keep the caret at the end, so typing always fills the next box.
          onSelect={(e) => {
            const el = e.currentTarget
            const end = el.value.length
            if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end)
          }}
          onChange={(e) => {
            const next = cleanCode(e.target.value)
            onChange(next)
            if (next.length === LENGTH && next !== value) onComplete?.(next)
          }}
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-[16px] text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
        />
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="px-1 text-small text-plum-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="px-1 text-small font-semibold text-alert">
          {error}
        </p>
      )}
    </div>
  )
}
