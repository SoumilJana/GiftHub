import { Link, useParams } from '@tanstack/react-router'
import { EmptyState, Page } from '../components/Page'
import { Avatar, Button, Notice, Panel, Spinner } from '../components/ui'
import { useUserId } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { inviteLink } from '../lib/invite'
import { isCodeExpired, roleLabel, useCircle, type Circle } from '../lib/queries'
import { useToast } from '../lib/toast'

export function CirclePage() {
  const { circleId } = useParams({ strict: false }) as { circleId?: string }
  const uid = useUserId()
  const q = useCircle(circleId)

  if (q.isPending) return <Spinner />
  if (q.error) return <Notice tone="alert">{friendlyError(q.error)}</Notice>
  if (!q.data) {
    return (
      <Page title="Circle not found">
        <EmptyState title="You’re not in this Circle.">
          It may have been deleted, or you were removed.{' '}
          <Link to="/circles" className="font-semibold text-plum underline underline-offset-3">
            See your Circles
          </Link>
          .
        </EmptyState>
      </Page>
    )
  }

  const { circle, members } = q.data
  const me = members.find((m) => m.user_id === uid)
  const others = members.filter((m) => m.user_id !== uid)

  return (
    <Page title={circle.name} lead={others.length ? `With ${others.map((m) => m.display_name).join(', ')}.` : 'Just you so far. Invite someone below.'}>
      <div className="mt-4">
        <Link
          to="/circles/$circleId/settings"
          params={{ circleId: circle.id }}
          className="text-small font-semibold text-plum-soft underline underline-offset-3 hover:text-plum"
        >
          Circle settings
        </Link>
      </div>

      <div className="mt-6 grid max-w-[900px] gap-4 md:grid-cols-[1fr_1fr]">
        <InvitePanel circle={circle} />
        <Panel>
          <h2 className="font-extrabold">Members</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3">
                <Avatar name={m.display_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {m.display_name}
                    {m.user_id === me?.user_id && <span className="font-normal text-plum-soft"> (you)</span>}
                  </span>
                  <span className="text-small text-plum-soft">{roleLabel[m.role]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <EmptyState title="Lists show up here soon.">
        Once adding wishes is ready, you’ll see each member’s list in this Circle and can reserve gifts without them knowing.
      </EmptyState>
    </Page>
  )
}

function InvitePanel({ circle }: { circle: Circle }) {
  const toast = useToast()
  const link = inviteLink(circle.invite_code)
  const expired = isCodeExpired(circle.invite_expires_at)

  async function share() {
    const text = `Join “${circle.name}” on GiftHub. Code: ${circle.invite_code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Circle on GiftHub', text, url: link })
        return
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(link)
      toast('Invite link copied.')
    } catch {
      toast('Copy the link below to share it.')
    }
  }

  return (
    <Panel>
      <h2 className="font-extrabold">Invite people</h2>
      <p className="mt-1 text-small text-plum-soft">Anyone with this code or link joins straight away.</p>
      <p className="mt-4 text-[32px] leading-none font-extrabold tracking-[0.12em] tabular-nums" aria-label={`Invite code ${circle.invite_code.split('').join(' ')}`}>
        {circle.invite_code}
      </p>
      <p className="mt-2 text-small text-plum-soft">
        {expired
          ? 'This code has expired. Get a new one in Circle settings.'
          : circle.invite_expires_at
            ? `Works until ${new Date(circle.invite_expires_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`
            : 'This code doesn’t expire.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={share} disabled={expired}>
          Share invite
        </Button>
      </div>
      <p className="mt-3 truncate text-small text-plum-soft select-all">{link}</p>
    </Panel>
  )
}
