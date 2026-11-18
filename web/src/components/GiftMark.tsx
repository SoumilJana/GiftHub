import { useRef } from 'react'
import { useCelebrate } from '../lib/motion'

export function GiftMark({ size = 24 }: { size?: number }) {
  const bow = useRef<SVGGElement>(null)
  // A wish went in: the bow hops and settles.
  useCelebrate('wish-saved', () => {
    bow.current?.animate(
      [
        { transform: 'none' },
        { transform: 'translateY(-4px) rotate(-14deg)', offset: 0.35 },
        { transform: 'translateY(.5px) rotate(5deg)', offset: 0.7 },
        { transform: 'none' },
      ],
      { duration: 560, delay: 250, easing: 'cubic-bezier(.34, 1.3, .64, 1)' },
    )
  })
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" overflow="visible">
      <rect x="2" y="7" width="22" height="17" rx="5" fill="#3B1D3F" />
      <rect x="11" y="7" width="4" height="17" fill="#FF5247" />
      <g ref={bow} style={{ transformBox: 'view-box', transformOrigin: '13px 7px' }}>
        <path d="M13 7c-2-5-7-5-7-2s4 2 7 2c3 0 7 1 7-2s-5-3-7 2z" fill="none" stroke="#FF5247" strokeWidth="2" />
      </g>
    </svg>
  )
}
