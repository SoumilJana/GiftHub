import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Page } from '../components/Page'
import { Avatar, Button, ConfirmButton, Notice, Panel, SelectField, Spinner, TextField } from '../components/ui'
import { useUserId } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import {
  useCircle,
  useDeleteCircle,
  useRegenerateCode,
  useRemoveMember,
  useRenameCircle,
  useSetCodeExpiry,
  useSetRole,
  useTransferOwnership,
  roleLabel,
  type Member,
} from '../lib/queries'
import { useToast } from '../lib/toast'

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never expires' },
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
]

export function CircleSettingsPage() {
  const { circleId } = useParams({ strict: false }) as { circleId?: string }
  const uid = useUserId()
  const q = useCircle(circleId)
  const navigate = useNavigate()
  const toast = useToast()

  const rename = useRenameCircle()
  const regen = useRegenerateCode()
  const expiry = useSetCodeExpiry()
  const remove = useRemoveMember()
  const setRole = useSetRole()
  const transfer = useTransferOwnership()
  const del = useDeleteCircle()

  const [error, setError] = useState<string | null>(null)

  if (q.isPending) return <Spinner />
  if (q.error || !q.data) return <Notice tone="alert">{q.error ? friendlyError(q.error) : 'You’re not in this Circle.'}</Notice>

  const { circle, members } = q.data
  const myRole = members.find((m) => m.user_id === uid)?.role ?? 'member'
  const canManage = myRole === 'owner' || myRole === 'admin'
  const others = members.filter((m) => m.user_id !== uid)

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setError(null)
    try {
      await fn()
      toast(done)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function saveName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = String(new FormData(e.currentTarget).get('name') ?? '')
    if (!name.trim()) return setError('Give your Circle a name.')
    await run(() => rename.mutateAsync({ id: circle.id, name: name.trim() }), 'Circle renamed.')
  }

  function expiryChange(value: string) {
    const expiresAt = value === 'never' ? null : new Date(Date.now() + Number(value) * 86_400_000).toISOString()
    run(() => expiry.mutateAsync({ id: circle.id, expiresAt }), value === 'never' ? 'The code no longer expires.' : `The code now works for ${value === '1' ? '1 day' : `${value} days`}.`)
  }

  return (
    <Page title="Circle settings" lead={circle.name}>
      <Link
        to="/circles/$circleId"
        params={{ circleId: circle.id }}
        className="mt-3 inline-block text-small font-semibold text-plum-soft underline underline-offset-3 hover:text-plum"
      >
        Back to {circle.name}
      </Link>

      {error && (
        <div className="mt-4">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <div className="mt-6 flex max-w-[640px] flex-col gap-4">
        {canManage && (
          <Panel>
            <form onSubmit={saveName} className="flex flex-col gap-3" noValidate>
              <TextField key={circle.name} label="Circle name" name="name" defaultValue={circle.name} maxLength={60} />
              <Button type="submit" busy={rename.isPending} className="self-start">
                Save name
              </Button>
            </form>
          </Panel>
        )}

        {canManage && (
          <Panel>
            <h2 className="font-extrabold">Invite code</h2>
            <p className="mt-1 text-small text-plum-soft">
              Current code <strong className="font-extrabold tracking-[0.08em] text-plum">{circle.invite_code}</strong>
            </p>
            <div className="mt-4 flex flex-col gap-4">
              <SelectField
                label="Code works for"
                defaultValue="never"
                hint={
                  circle.invite_expires_at
                    ? `Right now it works until ${new Date(circle.invite_expires_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`
                    : 'Right now it never expires.'
                }
                onChange={(e) => expiryChange(e.target.value)}
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
              <ConfirmButton
                label="Get a new code"
                question="The current code and link will stop working."
                confirmLabel="Get a new code"
                busy={regen.isPending}
                onConfirm={() => run(() => regen.mutateAsync(circle.id), 'New code ready. The old one no longer works.')}
              />
            </div>
          </Panel>
        )}

        <Panel>
          <h2 className="font-extrabold">Members</h2>
          <ul className="mt-3 flex flex-col">
            {members.map((m) => (
              <MemberRow
                key={m.user_id}
                member={m}
                isMe={m.user_id === uid}
                myRole={myRole}
                onRemove={() => run(() => remove.mutateAsync({ circleId: circle.id, userId: m.user_id }), `${m.display_name} was removed.`)}
                onRole={(role) => run(() => setRole.mutateAsync({ circleId: circle.id, userId: m.user_id, role }), `${m.display_name} is now ${role === 'admin' ? 'an admin' : 'a member'}.`)}
                onOwner={() => run(() => transfer.mutateAsync({ circleId: circle.id, userId: m.user_id }), `${m.display_name} is now the owner.`)}
              />
            ))}
          </ul>
        </Panel>

        <Panel>
          {myRole === 'owner' ? (
            <>
              <h2 className="font-extrabold">Delete this Circle</h2>
              <p className="mt-1 mb-4 text-small text-plum-soft">
                {others.length
                  ? 'Everyone is removed from it. To leave but keep it going, make someone else the owner first.'
                  : 'It’s just you in this Circle.'}
              </p>
              <ConfirmButton
                label="Delete Circle"
                question="This can’t be undone."
                confirmLabel="Delete Circle"
                variant="danger"
                busy={del.isPending}
                onConfirm={async () => {
                  setError(null)
                  try {
                    await del.mutateAsync(circle.id)
                    toast(`${circle.name} was deleted.`)
                    navigate({ to: '/circles', replace: true })
                  } catch (err) {
                    setError(friendlyError(err))
                  }
                }}
              />
            </>
          ) : (
            <>
              <h2 className="font-extrabold">Leave this Circle</h2>
              <p className="mt-1 mb-4 text-small text-plum-soft">You’ll stop seeing its lists. You can rejoin with a new invite.</p>
              <ConfirmButton
                label="Leave Circle"
                question="Leave this Circle?"
                confirmLabel="Leave"
                variant="danger"
                busy={remove.isPending}
                onConfirm={async () => {
                  setError(null)
                  try {
                    await remove.mutateAsync({ circleId: circle.id, userId: uid })
                    toast(`You left ${circle.name}.`)
                    navigate({ to: '/circles', replace: true })
                  } catch (err) {
                    setError(friendlyError(err))
                  }
                }}
              />
            </>
          )}
        </Panel>
      </div>
    </Page>
  )
}

function MemberRow({
  member,
  isMe,
  myRole,
  onRemove,
  onRole,
  onOwner,
}: {
  member: Member
  isMe: boolean
  myRole: Member['role']
  onRemove: () => void
  onRole: (role: 'admin' | 'member') => void
  onOwner: () => void
}) {
  const canRemove = !isMe && member.role !== 'owner' && (myRole === 'owner' || (myRole === 'admin' && member.role === 'member'))
  const ownerControls = myRole === 'owner' && !isMe

  return (
    <li className="flex flex-col gap-3 border-b border-blush py-3 last:border-b-0 sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={member.display_name} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {member.display_name}
            {isMe && <span className="font-normal text-plum-soft"> (you)</span>}
          </span>
          <span className="text-small text-plum-soft">{roleLabel[member.role]}</span>
        </span>
      </span>
      {(ownerControls || canRemove) && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
          {ownerControls && member.role !== 'owner' && (
            <Button variant="text" onClick={() => onRole(member.role === 'admin' ? 'member' : 'admin')}>
              {member.role === 'admin' ? 'Make member' : 'Make admin'}
            </Button>
          )}
          {ownerControls && (
            <Button variant="text" onClick={onOwner}>
              Make owner
            </Button>
          )}
          {canRemove && (
            <Button variant="text" onClick={onRemove}>
              Remove
            </Button>
          )}
        </span>
      )}
    </li>
  )
}
