import { useSyncExternalStore } from 'react'

/**
 * Calm mode: no sliding, flying or printing; fades and colour changes stay.
 * On when the device asks for reduced motion, or when "Fewer animations" is on in Profile.
 * It sets <html data-motion="calm">, which index.css reads.
 */
const KEY = 'gifthub.motion'
const reduce = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const listeners = new Set<() => void>()

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === 'calm'
  } catch {
    return false
  }
}

export const systemAsksCalm = () => !!reduce?.matches
export const isCalm = () => systemAsksCalm() || stored()

function apply() {
  document.documentElement.dataset.motion = isCalm() ? 'calm' : 'full'
  listeners.forEach((l) => l())
}

/** Call once before the first render. */
export function startMotion() {
  apply()
  reduce?.addEventListener('change', apply)
}

export function setFewerAnimations(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, 'calm')
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: this visit only */
  }
  apply()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** [calm now, whether the device forces it]. */
export function useCalmMotion(): [boolean, boolean] {
  const calm = useSyncExternalStore(subscribe, () => document.documentElement.dataset.motion === 'calm')
  return [calm, systemAsksCalm()]
}

/**
 * Plays a sheet's exit after React has removed it: a static copy slides down (phones)
 * or fades and settles (wider screens), and the backdrop fades. Keeps every caller's
 * plain onClose, however the sheet was closed.
 */
export function sheetExit(dialog: HTMLDialogElement) {
  if (!dialog.open) return
  const rect = dialog.getBoundingClientRect()
  if (!rect.height) return
  const ghost = document.createElement('div')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.className = dialog.className
  ghost.style.cssText = `position:fixed;margin:0;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:60;pointer-events:none;overflow:hidden`
  ghost.innerHTML = dialog.innerHTML
  // Typed values live on the elements, not in the markup.
  const from = dialog.querySelectorAll<HTMLInputElement>('input, textarea, select')
  ghost.querySelectorAll<HTMLInputElement>('input, textarea, select').forEach((el, i) => {
    el.value = from[i]?.value ?? ''
  })
  const scroller = dialog.firstElementChild
  const backdrop = document.createElement('div')
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:59;pointer-events:none;background:rgb(59 29 63 / .4)'
  document.body.append(backdrop, ghost)
  if (scroller && ghost.firstElementChild) ghost.firstElementChild.scrollTop = scroller.scrollTop

  const calm = isCalm()
  const wide = window.matchMedia('(min-width: 640px)').matches
  const frames: Keyframe[] = calm
    ? [{ opacity: 1 }, { opacity: 0 }]
    : wide
      ? [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px) scale(.98)' }]
      : [{ transform: 'none' }, { transform: 'translateY(100%)' }]
  const timing: KeyframeAnimationOptions = { duration: 200, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' }
  const done = ghost.animate(frames, timing).finished
  backdrop.animate([{ opacity: 1 }, { opacity: 0 }], timing)
  const remove = () => {
    ghost.remove()
    backdrop.remove()
  }
  done.then(remove, remove)
}
