/** Bottom bar and rail icons: 2px rounded line drawings, like the gift placeholders. */
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function ListIcon() {
  // A gift tag.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M3.5 4.8v6.1c0 .5.2 1 .6 1.4l8.2 8.2a2 2 0 0 0 2.8 0l5.4-5.4a2 2 0 0 0 0-2.8l-8.2-8.2a2 2 0 0 0-1.4-.6H4.8c-.7 0-1.3.6-1.3 1.3z" />
      <circle cx="8.2" cy="8.2" r="1.4" />
    </svg>
  )
}

export function CirclesIcon() {
  // Two overlapping rings.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <circle cx="9" cy="12" r="5.8" />
      <circle cx="15" cy="12" r="5.8" />
    </svg>
  )
}

export function ReceivedIcon() {
  // An open gift box, its lid tipped back.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M5 12.5v6.7c0 .7.6 1.3 1.3 1.3h11.4c.7 0 1.3-.6 1.3-1.3v-6.7" />
      <path d="M12 12.5v8" />
      <path d="M3.6 9.6l15.6-4.3a1 1 0 0 1 1.2.7l.5 1.8a1 1 0 0 1-.7 1.2L4.6 13.3a1 1 0 0 1-1.2-.7l-.5-1.8a1 1 0 0 1 .7-1.2z" />
      <path d="M11.3 7.6c-1.4-2.8-4.6-2.8-4.2-.8.3 1.3 2.5 1.4 4.2.8zM11.3 7.6c.2-3.1 3.2-4.2 3.6-2.2.3 1.3-1.9 2.1-3.6 2.2z" />
    </svg>
  )
}
