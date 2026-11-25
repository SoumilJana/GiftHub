import { circleRef, type MyCircle } from '../lib/queries'
import { LockIcon } from './ui'

/** Group Circles get one of these tints, picked from the Circle's id so it never changes. */
const TINTS = ['bg-sky-wash text-sky-ink', 'bg-plum text-white', 'bg-edge text-plum']

function tintFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}

const initials = (name: string, letters: number) =>
  name
    .trim()
    .split(/\s+/)
    .filter((w, i, all) => !(i === 0 && all.length > 1 && /^the$/i.test(w)))
    .slice(0, letters)
    .map((w) => [...w][0]?.toUpperCase() ?? '')
    .join('') || '?'

/** One small round icon: a couple Circle shows your partner's initials, a group its first letter. */
function CircleIcon({ circle, uid }: { circle: MyCircle; uid?: string }) {
  const partner = circle.kind === 'couple' ? circle.members.find((m) => m.user_id !== uid && m.display_name.trim()) : undefined
  const label = partner ? initials(partner.display_name, 2) : initials(circle.name ?? circleRef(circle, circle.members, uid), 1)
  const tint = partner ? 'bg-blush-deep text-plum' : tintFor(circle.id)
  return (
    <span className="flex rounded-full ring-2 ring-print">
      <span className={`grid size-[22px] place-items-center rounded-full text-[10px] leading-none font-extrabold ${tint}`}>{label}</span>
    </span>
  )
}

/**
 * Which Circles see a wish, on Your list: up to three icons and "+N", or "Only you".
 * Screen readers (and a hover tooltip) get the names.
 */
export function CircleIcons({ circleIds, circles, uid }: { circleIds: string[]; circles: MyCircle[]; uid?: string }) {
  const shared = circles.filter((c) => circleIds.includes(c.id))
  if (!shared.length)
    return (
      <span className="inline-flex items-center text-small text-plum-soft">
        <LockIcon />
        Only you
      </span>
    )
  const names = shared.map((c) => circleRef(c, c.members, uid))
  const label = `Shared with ${names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}`
  const shown = shared.slice(0, 3)
  const more = shared.length - shown.length
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex items-center">
      <span className="flex -space-x-1.5">
        {shown.map((c) => (
          <CircleIcon key={c.id} circle={c} uid={uid} />
        ))}
      </span>
      {more > 0 && <span className="ml-1 text-small font-semibold text-plum-soft">+{more}</span>}
    </span>
  )
}
