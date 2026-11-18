import { useLayoutEffect, useRef } from 'react'

/**
 * A plum pill that slides behind whichever item in its parent matches `active`
 * (a tab, nav item or segment). Place it first inside that parent, which must be
 * `position: relative`; the items sit above it with `relative`. The look lives in index.css.
 */
export function SlidingPill({
  active,
  watch,
  target,
  className = '',
}: {
  /** CSS selector for the current item, e.g. '[data-status="active"]'. */
  active: string
  /** Anything that changes which item is current (a path, a selected id). */
  watch: unknown
  /** Optional selector inside the current item to wrap instead of the whole item (e.g. its icon). */
  target?: string
  className?: string
}) {
  const pill = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = pill.current
    const box = el?.parentElement
    if (!el || !box) return
    const place = () => {
      const item = box.querySelector<HTMLElement>(active)
      const shape = (target && item?.querySelector<HTMLElement>(target)) || item
      if (!shape) {
        el.style.opacity = '0'
        return
      }
      const b = box.getBoundingClientRect()
      const r = shape.getBoundingClientRect()
      el.style.setProperty('--pill-x', `${r.left - b.left + box.scrollLeft}px`)
      el.style.setProperty('--pill-y', `${r.top - b.top + box.scrollTop}px`)
      el.style.setProperty('--pill-w', `${r.width}px`)
      el.style.setProperty('--pill-h', `${r.height}px`)
      el.style.opacity = '1'
    }
    place()
    // Slide only after the first placement, so it doesn't fly in from the corner on load.
    const ready = requestAnimationFrame(() => el.setAttribute('data-ready', ''))
    const observer = new ResizeObserver(place)
    observer.observe(box)
    for (const child of box.children) observer.observe(child)
    document.fonts?.ready.then(place)
    return () => {
      cancelAnimationFrame(ready)
      observer.disconnect()
    }
  }, [active, target, watch])

  return <span ref={pill} aria-hidden="true" className={`sliding-pill ${className}`} style={{ opacity: 0 }} />
}
