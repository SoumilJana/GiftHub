import { useState, type FormEvent } from 'react'
import { HandoffPrompts } from '../components/Handoff'
import { EditItemSheet } from '../components/ItemSheet'
import { ItemsView, ListTools } from '../components/ItemViews'
import { useDismissed, useStoredView } from '../lib/view'
import { EmptyState } from '../components/Page'
import { Button, LoadError, LockIcon, Notice, Spinner } from '../components/ui'
import { useMyItems } from '../lib/items'
import { useUserId } from '../lib/auth'
import { circleRef, useMyCircles, useProfile } from '../lib/queries'
import { useToast } from '../lib/toast'
import { applyFilter, defaultFilter, linkFromText, type Item, type ListFilter } from '../lib/wishlist'

type Editing = { item: Item | null; url: string | null; title?: string | null } | null

export function MyListPage() {
  const items = useMyItems()
  const circles = useMyCircles()
  const uid = useUserId()
  const profile = useProfile()
  const [filter, setFilter] = useState<ListFilter>(defaultFilter)
  const [view, setView] = useStoredView()
  const [editing, setEditing] = useState<Editing>(null)
  const [privacySeen, dismissPrivacy] = useDismissed('owner-privacy')

  const myCircles = circles.data ?? []
  const all = items.data ?? []
  const shown = applyFilter(all, filter)
  const circleNames = myCircles.map((c) => circleRef(c, c.members, uid))

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-display leading-none font-extrabold tracking-[-0.035em]">Your list</h1>
          <p className="mt-2 max-w-[72ch] text-plum-soft">
            {circleNames.length ? `Shared with ${listJoin(circleNames)}, item by item.` : 'Only you can see it until you start or join a Circle.'}
          </p>
        </div>
        <AddBar onAdd={(url, title) => setEditing({ item: null, url, title })} />
      </div>

      <HandoffPrompts />

      {all.length > 0 && !privacySeen && (
        <div className="mt-5">
          <Notice>
            <LockIcon />
            <strong className="font-extrabold">You won’t see who is buying what.</strong> Claims on your wishes stay hidden until you mark one received.{' '}
            <button type="button" onClick={dismissPrivacy} className="font-semibold underline underline-offset-3 hover:text-plum">
              Got it
            </button>
          </Notice>
        </div>
      )}

      {items.isPending ? (
        <Spinner />
      ) : items.error ? (
        <LoadError error={items.error} onRetry={() => items.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState title="Your list is empty.">
          Paste a link to something you’d like, or{' '}
          <button type="button" className="font-semibold text-plum underline underline-offset-3" onClick={() => setEditing({ item: null, url: null })}>
            add a wish without a link
          </button>
          . You choose which Circles see each one.
        </EmptyState>
      ) : (
        <>
          <ListTools items={all} filter={filter} onFilter={setFilter} view={view} onView={setView} />
          {shown.length ? (
            <ItemsView
              items={shown}
              view={view}
              slot={(item) => (
                <>
                  <Button variant="ghost" className="h-[34px]! px-3.5! text-small" onClick={() => setEditing({ item, url: null })}>
                    Edit
                  </Button>
                  <span className="min-w-[4.75rem] text-small text-plum-soft">{sharedWith(item, myCircles.length)}</span>
                </>
              )}
            />
          ) : (
            <EmptyState title="Nothing matches these filters.">
              <button type="button" className="font-semibold text-plum underline underline-offset-3" onClick={() => setFilter({ ...defaultFilter, sort: filter.sort })}>
                Clear filters
              </button>{' '}
              to see your whole list.
            </EmptyState>
          )}
        </>
      )}

      {editing && (
        <EditItemSheet
          item={editing.item}
          initialUrl={editing.url}
          initialTitle={editing.title}
          circles={myCircles}
          userCurrency={profile.data?.currency?.trim() || 'USD'}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function sharedWith(item: Item, circleCount: number) {
  if (!item.circle_ids.length) return 'Only you'
  if (item.circle_ids.length === circleCount && circleCount > 1) return 'All Circles'
  return item.circle_ids.length === 1 ? '1 Circle' : `${item.circle_ids.length} Circles`
}

function listJoin(names: string[]) {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Paste-a-link pill. Opens the add sheet with the link filled in. */
export function AddBar({ onAdd }: { onAdd: (url: string | null, title?: string | null) => void }) {
  const [value, setValue] = useState('')
  const toast = useToast()
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return onAdd(null)
    // Store apps often copy the product name along with the link: keep both.
    const found = linkFromText(value)
    if (!found) return toast('No link in that. Paste the address from the store.')
    setValue('')
    onAdd(found.url, found.title)
  }
  return (
    <form onSubmit={submit} noValidate className="flex w-full max-w-[500px] flex-[1_1_360px] gap-2">
      <label htmlFor="add-link" className="sr-only">
        Link to a wish
      </label>
      <input
        id="add-link"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="Paste a link to add a wish"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-[46px] min-w-0 flex-1 rounded-full bg-print px-[18px] text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] placeholder:text-placeholder"
      />
      <Button type="submit" className="h-[46px]! px-[22px]!">
        Add
      </Button>
    </form>
  )
}
