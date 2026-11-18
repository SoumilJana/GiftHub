import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from '../lib/toast'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((m: string) => {
    setMessage(m)
    setVisible(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(false), 3200)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        data-motion-move
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-[88px] left-1/2 z-30 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-plum px-[18px] py-3 text-small font-semibold text-white transition-[opacity,transform] duration-200 ease-out shell:bottom-6 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        {message}
      </div>
    </ToastContext.Provider>
  )
}
