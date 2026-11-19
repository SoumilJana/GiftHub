import { useState } from 'react'

export type ViewMode = 'strip' | 'list'
const VIEW_KEY = 'gifthub.view'

/** Strip or List, remembered on this device. */
export function useStoredView(): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'strip'
    } catch {
      return 'strip'
    }
  })
  return [
    view,
    (v) => {
      setView(v)
      try {
        localStorage.setItem(VIEW_KEY, v)
      } catch {
        /* private mode: keep it for this visit only */
      }
    },
  ]
}

/** A one-time note the viewer has dismissed, remembered on this device. */
export function useDismissed(key: string): [boolean, () => void] {
  const storageKey = `gifthub.dismissed.${key}`
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })
  return [
    dismissed,
    () => {
      setDismissed(true)
      try {
        localStorage.setItem(storageKey, '1')
      } catch {
        /* private mode: hidden for this visit only */
      }
    },
  ]
}

/** Mark a one-time hint or card as seen without showing it (e.g. new people already learned it in the intro). */
export function markDismissed(key: string) {
  try {
    localStorage.setItem(`gifthub.dismissed.${key}`, '1')
  } catch {
    /* private mode */
  }
}
