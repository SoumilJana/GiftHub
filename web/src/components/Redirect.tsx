import { useNavigate, type NavigateOptions } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

/**
 * Navigates once, after render. Replaces <Navigate>, which re-navigated on every
 * render when given a fresh `search` object and locked the page in a loop.
 */
export function Redirect(props: NavigateOptions) {
  const navigate = useNavigate()
  const done = useRef(false)
  const options = useRef(props)

  useEffect(() => {
    if (done.current) return
    done.current = true
    navigate({ ...options.current, replace: true })
  }, [navigate])

  return null
}
