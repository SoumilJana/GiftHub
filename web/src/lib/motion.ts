import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

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
let sheetGoneAt = 0

/** Resolves once no sheet is open or leaving, so a list change isn't hidden behind one. Gives up after 4s. */
function afterSheets(): Promise<void> {
  const started = performance.now()
  return new Promise((resolve) => {
    const check = () => {
      const now = performance.now()
      if ((!document.querySelector('dialog[open]') && now >= sheetGoneAt) || now - started > 4000) resolve()
      else window.setTimeout(check, 50)
    }
    check()
  })
}

export function sheetExit(dialog: HTMLDialogElement) {
  if (!dialog.open) return
  sheetGoneAt = performance.now() + 220
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
  // Backstop: a hidden tab pauses animations, so the copy must not wait on them.
  window.setTimeout(remove, 400)
}

type Box = { left: number; top: number; width: number; height: number }
/** Where an element sits on the page (not the screen), so scrolling between two moments doesn't count as movement. */
function pageBox(el: HTMLElement): Box {
  const r = el.getBoundingClientRect()
  return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height }
}

/**
 * Wishes moving in a list (Strip or List view). Items need `data-id`.
 * - A few wishes added: each new one prints, revealed top to bottom like a booth print.
 * - A few removed: each fades and shrinks where it was.
 * - The rest glide to their new places (FLIP).
 * - Many changed at once (another person's list, a filter): the list just fades in.
 * Calm mode keeps the fades and drops the movement.
 */
export function useListMotion(ids: string[]) {
  const ref = useRef<HTMLUListElement>(null)
  const before = useRef(new Map<string, { el: HTMLElement; box: Box }>())
  const key = ids.join(',')

  useLayoutEffect(() => {
    const list = ref.current
    if (!list) return
    const prev = before.current
    const now = new Map<string, { el: HTMLElement; box: Box }>()
    for (const el of list.querySelectorAll<HTMLElement>(':scope > [data-id]')) now.set(el.dataset.id!, { el, box: pageBox(el) })
    before.current = now
    if (!prev.size) return

    const added = [...now.keys()].filter((id) => !prev.has(id))
    const removed = [...prev.keys()].filter((id) => !now.has(id))
    if (!added.length && !removed.length) return
    const calm = isCalm()

    // A whole new list: fade it in, nothing more.
    if (added.length + removed.length > 3 && (added.length + removed.length) * 2 > Math.max(prev.size, now.size)) {
      list.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' })
      return
    }

    for (const id of removed) {
      const { el, box } = prev.get(id)!
      const ghost = el.cloneNode(true) as HTMLElement
      ghost.setAttribute('aria-hidden', 'true')
      ghost.style.cssText += `;position:absolute;margin:0;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;pointer-events:none;z-index:5`
      document.body.append(ghost)
      ghost
        .animate(calm ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.9)' }], {
          duration: 220,
          easing: 'cubic-bezier(.5, 0, .75, 0)',
          fill: 'forwards',
        })
        .finished.finally(() => ghost.remove())
      window.setTimeout(() => ghost.remove(), 400)
    }

    for (const [id, { el, box }] of now) {
      const old = prev.get(id)
      if (!old) {
        // Hold the new wish out of sight until the form that added it has gone, then print it.
        const hidden = calm ? { opacity: '0' } : { clipPath: 'inset(0 0 100% 0 round 6px)' }
        Object.assign(el.style, hidden)
        afterSheets().then(async () => {
          // Bring it into view first if it landed off screen.
          const r = el.getBoundingClientRect()
          if (r.bottom < 60 || r.top > window.innerHeight - 80) {
            el.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
            await new Promise((done) => window.setTimeout(done, calm ? 0 : 350))
          }
          el.animate(
            calm
              ? [{ opacity: 0 }, { opacity: 1 }]
              : [
                  { clipPath: 'inset(0 0 100% 0 round 6px)', transform: 'translateY(-14px)' },
                  { clipPath: 'inset(0 0 0 0 round 6px)', transform: 'none' },
                ],
            { duration: calm ? 300 : 750, delay: 120, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' },
          )
          el.style.opacity = ''
          el.style.clipPath = ''
        })
      } else if (!calm) {
        const dx = old.box.left - box.left
        const dy = old.box.top - box.top
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the set or order of wishes changes
  }, [key])

  return ref
}
