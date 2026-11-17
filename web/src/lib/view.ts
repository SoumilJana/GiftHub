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
