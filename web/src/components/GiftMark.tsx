export function GiftMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <rect x="2" y="7" width="22" height="17" rx="3" fill="#20233F" />
      <rect x="11" y="7" width="4" height="17" fill="#B0174F" />
      <path d="M13 7c-2-5-7-5-7-2s4 2 7 2c3 0 7 1 7-2s-5-3-7 2z" fill="none" stroke="#B0174F" strokeWidth="2" />
    </svg>
  )
}
