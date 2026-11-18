import { ItemsView } from '../components/ItemViews'
import { EmptyState, Page } from '../components/Page'
import { Button, Notice, Spinner } from '../components/ui'
import { useReceived, useReturnToList, type Giver } from '../lib/claims'
import { friendlyError } from '../lib/errors'
import { useToast } from '../lib/toast'
import { useStoredView } from '../lib/view'

const lead = 'Gifts you’ve marked as received, and who gave them.'

export function ReceivedPage() {
  const q = useReceived()
  const back = useReturnToList()
  const toast = useToast()
  const [view, setView] = useStoredView()

  if (q.isPending) return <Spinner />
  if (q.error) return <Notice tone="alert">{friendlyError(q.error)}</Notice>

  const { items, givers } = q.data
  if (!items.length) {
    return (
      <Page title="Received" lead={lead}>
        <EmptyState title="No gifts received yet.">
          When you get something from your list, open it, choose Mark received, and you’ll see who gave it.
        </EmptyState>
      </Page>
    )
  }

  return (
    <Page title="Received" lead={lead}>
      <div className="mt-4 mb-[22px] flex justify-end">
        <div role="group" aria-label="View" className="grid grid-cols-2 rounded-full bg-print p-[3px] shadow-[inset_0_0_0_1.5px_var(--color-edge)]">
          {(['strip', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className="h-7 rounded-full px-3 text-small font-semibold text-plum-soft hover:text-plum aria-pressed:bg-plum aria-pressed:text-white"
            >
              {v === 'strip' ? 'Strip' : 'List'}
            </button>
          ))}
        </div>
      </div>
      <ItemsView
        items={items}
        view={view}
        slot={(item) => (
          <>
            <span className="text-small text-plum-soft">{fromLine(givers[item.id])}</span>
            <Button
              variant="text"
              onClick={async () => {
                try {
                  await back.mutateAsync(item.id)
                  toast('Back on your list.')
                } catch (err) {
                  toast(friendlyError(err))
                }
              }}
            >
              Put back on my list
            </Button>
          </>
        )}
      />
    </Page>
  )
}

function fromLine(giver: Giver | undefined) {
  if (!giver) return 'Not claimed in GiftHub'
  return (
    <>
      {giver.status === 'bought' ? 'Bought by ' : 'Reserved by '}
      <strong className="font-semibold text-plum">{giver.name}</strong>
    </>
  )
}
