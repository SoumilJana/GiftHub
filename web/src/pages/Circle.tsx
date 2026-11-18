import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { GiveDateSheet } from '../components/Handoff'
import { EditItemSheet, ViewItemSheet } from '../components/ItemSheet'
import { ItemsView, ListTools } from '../components/ItemViews'
import { useStoredView } from '../lib/view'
import { EmptyState, Page } from '../components/Page'
import { Avatar, Button, Notice, Panel, Spinner } from '../components/ui'
import { useUserId } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { inviteLink } from '../lib/invite'
import { dayLabel, useCircleClaims, useClaimSignals, useSetClaim, type Claim, type ClaimStatus } from '../lib/claims'
import { useCircleItems, useMyItems, useShareMyItems } from '../lib/items'
import { isCodeExpired, roleLabel, useCircle, useMyCircles, useProfile, type Circle } from '../lib/queries'
import { useToast } from '../lib/toast'
import { applyFilter, defaultFilter, type Item, type ListFilter } from '../lib/wishlist'

const firstName = (name: string) => name.split(/\s+/)[0] || name

export function CirclePage() {
  const { circleId } = useParams({ strict: false }) as { circleId?: string }
  const uid = useUserId()
  const q = useCircle(circleId)
  const circleItems = useCircleItems(circleId)
  const mine = useMyItems()
  const circles = useMyCircles()
  const profile = useProfile()
  const share = useShareMyItems()
  const claims = useCircleClaims(circleId)
  const setClaim = useSetClaim(circleId ?? 'none')
  useClaimSignals(circleId)
  const toast = useToast()
  const [who, setWho] = useState<string | null>(null)
  const [filter, setFilter] = useState<ListFilter>(defaultFilter)
  const [view, setView] = useStoredView()
  const [viewing, setViewing] = useState<Item | null>(null)
  const [editing, setEditing] = useState<{ item: Item | null } | null>(null)
  const [dating, setDating] = useState<Item | null>(null)

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
  const tabs = [...others, ...(me ? [me] : [])]
  const selected = tabs.find((m) => m.user_id === who) ?? tabs[0]
  const isMe = selected?.user_id === uid

  const myAll = mine.data ?? []
  const myHere = myAll.filter((i) => i.circle_ids.includes(circle.id))
  const notHere = myAll.length - myHere.length
  const listFor = (id: string) => (id === uid ? myHere : (circleItems.data ?? []).filter((i) => i.owner_id === id))
  const all = selected ? listFor(selected.user_id) : []
  const shown = applyFilter(all, filter)
  const loading = isMe ? mine.isPending : circleItems.isPending
  const loadError = isMe ? mine.error : circleItems.error
  const clearFilters = () => setFilter((f) => ({ ...defaultFilter, sort: f.sort }))

  async function claim(item: Item, status: ClaimStatus | null) {
    const owner = firstName(members.find((m) => m.user_id === item.owner_id)?.display_name ?? '') || 'They'
    const wasBought = claims.data?.[item.id]?.status === 'bought'
    try {
      await setClaim.mutateAsync({ itemId: item.id, status })
      toast(status === 'reserved' ? `Reserved. ${owner} won’t see this.` : status === 'bought' ? `Marked bought. ${owner} won’t see this.` : 'Claim removed.')
      // Just bought: ask when it'll be given, so GiftHub can check in afterwards.
      if (status === 'bought' && !wasBought) setDating(item)
    } catch (err) {
      toast(friendlyError(err))
    }
  }

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

      {selected && (
        <section aria-label="Lists" className="mt-6">
          <div role="tablist" aria-label="Whose list" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {tabs.map((m) => (
              <button
                key={m.user_id}
                role="tab"
                type="button"
                aria-selected={m.user_id === selected.user_id}
                onClick={() => {
                  setWho(m.user_id)
                  clearFilters()
                }}
                className="h-[38px] shrink-0 rounded-full px-4 font-semibold text-plum-soft hover:bg-blush-deep aria-selected:bg-plum aria-selected:text-white"
              >
                {m.user_id === uid ? 'Your list' : firstName(m.display_name)}
                <span className="ml-1.5 opacity-75">{listFor(m.user_id).length}</span>
              </button>
            ))}
          </div>

          <div role="tabpanel" aria-label={isMe ? 'Your list' : `${selected.display_name}’s list`}>
            {isMe && notHere > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-panel bg-print px-4 py-3">
                <p className="text-small text-plum-soft">
                  {notHere === 1 ? '1 of your wishes isn’t' : `${notHere} of your wishes aren’t`} shared with {circle.name}.
                </p>
                <Button
                  variant="ghost"
                  className="h-[34px]! text-small"
                  busy={share.isPending}
                  onClick={async () => {
                    try {
                      const n = await share.mutateAsync(circle.id)
                      toast(n === 1 ? '1 wish shared.' : `${n} wishes shared.`)
                    } catch (err) {
                      toast(friendlyError(err))
                    }
                  }}
                >
                  Share {notHere === 1 ? 'it' : 'them all'}
                </Button>
              </div>
            )}

            {loading ? (
              <Spinner />
            ) : loadError ? (
              <div className="mt-4">
                <Notice tone="alert">{friendlyError(loadError)}</Notice>
              </div>
            ) : all.length === 0 ? (
              <EmptyState
                title={isMe ? `You haven’t shared any wishes with ${circle.name} yet.` : `${firstName(selected.display_name)} hasn’t shared any wishes here yet.`}
              >
                {isMe ? (
                  <>
                    <button type="button" className="font-semibold text-plum underline underline-offset-3" onClick={() => setEditing({ item: null })}>
                      Add a wish
                    </button>{' '}
                    and it will show up here.
                  </>
                ) : (
                  'When they add some and share them with this Circle, they’ll show up here.'
                )}
              </EmptyState>
            ) : (
              <>
                <ListTools items={all} filter={filter} onFilter={setFilter} view={view} onView={setView} />
                {shown.length ? (
                  <ItemsView
                    items={shown}
                    view={view}
                    claims={isMe ? undefined : (claims.data ?? {})}
                    onOpen={isMe ? undefined : setViewing}
                    slot={(item) =>
                      isMe ? (
                        <Button variant="ghost" className="h-[34px]! px-3.5! text-small" onClick={() => setEditing({ item })}>
                          Edit
                        </Button>
                      ) : (
                        <ClaimSlot
                          claim={claims.data?.[item.id] ?? null}
                          loading={claims.isPending}
                          onClaim={(status) => claim(item, status)}
                          onDate={() => setDating(item)}
                        />
                      )
                    }
                  />
                ) : (
                  <EmptyState title="Nothing matches these filters.">
                    <button type="button" className="font-semibold text-plum underline underline-offset-3" onClick={clearFilters}>
                      Clear filters
                    </button>{' '}
                    to see the whole list.
                  </EmptyState>
                )}
              </>
            )}
          </div>
        </section>
      )}

      <div className="mt-10 grid max-w-[900px] gap-4 md:grid-cols-[1fr_1fr]">
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

      {viewing && (
        <ViewItemSheet
          item={viewing}
          ownerName={firstName(members.find((m) => m.user_id === viewing.owner_id)?.display_name ?? 'Their')}
          onClose={() => setViewing(null)}
        />
      )}
      {dating && (
        <GiveDateSheet
          itemId={dating.id}
          title={dating.title}
          ownerName={members.find((m) => m.user_id === dating.owner_id)?.display_name ?? 'them'}
          current={claims.data?.[dating.id]?.giveOn ?? null}
          circleId={circle.id}
          onClose={() => setDating(null)}
        />
      )}
      {editing && (
        <EditItemSheet item={editing.item} circles={circles.data ?? []} userCurrency={profile.data?.currency?.trim() || 'USD'} onClose={() => setEditing(null)} />
      )}
    </Page>
  )
}

/** The fixed-height claim slot on someone else's wish. */
function ClaimSlot({
  claim,
  loading,
  onClaim,
  onDate,
}: {
  claim: Claim | null
  loading: boolean
  onClaim: (status: ClaimStatus | null) => void
  onDate: () => void
}) {
  if (loading) return null
  if (claim && !claim.mine) return <span className="text-small font-semibold text-plum-soft">Already claimed</span>
  if (!claim)
    return (
      <>
        <Button className="h-[34px]! px-3.5! text-small" onClick={() => onClaim('reserved')}>
          Reserve
        </Button>
        <Button variant="text" onClick={() => onClaim('bought')}>
          I bought it
        </Button>
      </>
    )
  return (
    <>
      <span className="text-small font-extrabold text-ribbon-deep">{claim.status === 'reserved' ? 'Reserved by you' : 'Bought by you'}</span>
      {claim.status === 'reserved' ? (
        <Button variant="text" onClick={() => onClaim('bought')}>
          Mark bought
        </Button>
      ) : (
        <Button variant="text" onClick={onDate}>
          {claim.giveOn ? `Giving ${dayLabel(claim.giveOn, 'short')}` : 'Add date'}
        </Button>
      )}
      <Button variant="text" onClick={() => onClaim(null)}>
        Undo
      </Button>
    </>
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
