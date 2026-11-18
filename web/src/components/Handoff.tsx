import { useState, type FormEvent } from 'react'
import { dayLabel, localDate, useDismissPrompt, useDueGifts, useMarkGiven, useMarkReceived, useReceivedPrompts, useSetGiveDate, type DueGift, type ReceivedPrompt } from '../lib/claims'
import { friendlyError } from '../lib/errors'
import { flyHome, useListMotion } from '../lib/motion'
import { useToast } from '../lib/toast'
import { Sheet } from './ItemSheet'
import { Button, Notice, TextField } from './ui'

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

/** "When will you give it?" Asked after marking a gift bought, and from the claim slot. */
export function GiveDateSheet({
  itemId,
  title,
  ownerName,
  current,
  circleId,
  onClose,
}: {
  itemId: string
  title: string
  ownerName: string
  current: string | null
  circleId: string
  onClose: () => void
}) {
  const [date, setDate] = useState(current ?? '')
  const [error, setError] = useState<string | null>(null)
  const save = useSetGiveDate(circleId)
  const toast = useToast()
  const today = localDate()

  async function submit(giveOn: string | null) {
    setError(null)
    if (giveOn && giveOn < today) return setError('Choose today or a later day.')
    try {
      await save.mutateAsync({ itemId, giveOn })
      toast(giveOn ? `We’ll check in after ${dayLabel(giveOn)}.` : 'No date set.')
      onClose()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <Sheet title="When will you give it?" onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (!date) return setError('Choose a day, or press Not sure yet.')
          submit(date)
        }}
      >
        <p className="text-plum-soft">
          The day after, GiftHub asks whether you gave {firstName(ownerName)} the {title}. Once you say yes, they’re asked to mark it received.{' '}
          {firstName(ownerName)} never sees this date.
        </p>
        <TextField label="Giving it on" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} data-autofocus />
        {error && <Notice tone="alert">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" busy={save.isPending}>
            Save date
          </Button>
          <Button variant="text" onClick={() => (current ? submit(null) : onClose())}>
            {current ? 'Remove the date' : 'Not sure yet'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

/** Hand-off questions at the top of Your list: "Did you give it?" and "Did you get it?". */
export function HandoffPrompts() {
  const due = useDueGifts()
  const prompts = useReceivedPrompts()
  const cards = [...(prompts.data ?? []).map((p) => ({ kind: 'got' as const, p })), ...(due.data ?? []).map((g) => ({ kind: 'gave' as const, g }))]
  const keyOf = (c: (typeof cards)[number]) => (c.kind === 'got' ? `got-${c.p.id}` : `gave-${c.g.itemId}`)
  // Answered cards fold away instead of vanishing.
  const list = useListMotion<HTMLElement>(cards.map(keyOf), 'fold')
  return (
    <section ref={list} aria-label={cards.length ? 'Gifts to check on' : undefined} className={`flex max-w-[720px] flex-col gap-2.5 ${cards.length ? 'mt-5' : ''}`}>
      {cards.map((c) => (
        <div key={keyOf(c)} data-id={keyOf(c)}>
          {c.kind === 'got' ? <GotCard prompt={c.p} /> : <GaveCard gift={c.g} />}
        </div>
      ))}
    </section>
  )
}

const card = 'flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-panel bg-print px-4 py-3.5'

function GotCard({ prompt }: { prompt: ReceivedPrompt }) {
  const received = useMarkReceived()
  const dismiss = useDismissPrompt()
  const toast = useToast()
  const who = firstName(prompt.giverName)
  return (
    <div className={card}>
      <p className="min-w-0 flex-[1_1_260px]">
        <strong className="font-extrabold">Did you get the {prompt.title}?</strong>{' '}
        <span className="text-plum-soft">{who} marked it as given.</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="h-[34px]! px-3.5! text-small"
          busy={received.isPending}
          onClick={async () => {
            try {
              flyHome(prompt.itemId)
              await received.mutateAsync(prompt.itemId)
              toast(`Moved to Received. ${who} gave you this.`)
            } catch (err) {
              toast(friendlyError(err))
            }
          }}
        >
          Yes, mark received
        </Button>
        <Button variant="text" disabled={dismiss.isPending} onClick={() => dismiss.mutate(prompt.id)}>
          Not yet
        </Button>
      </div>
    </div>
  )
}

function GaveCard({ gift }: { gift: DueGift }) {
  const given = useMarkGiven()
  const later = useSetGiveDate()
  const toast = useToast()
  const [picking, setPicking] = useState(false)
  const [date, setDate] = useState('')
  const who = firstName(gift.ownerName)
  const today = localDate()

  if (picking) {
    return (
      <form
        className={card}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!date || date < today) return toast('Choose today or a later day.')
          try {
            await later.mutateAsync({ itemId: gift.itemId, giveOn: date })
            toast(`We’ll check in after ${dayLabel(date)}.`)
          } catch (err) {
            toast(friendlyError(err))
          }
        }}
      >
        <label className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <span className="font-extrabold">When will you give {who} the {gift.title}?</span>
          <input
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            autoFocus
            className="h-10 w-full max-w-[220px] rounded-full bg-print px-4 text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" className="h-[34px]! px-3.5! text-small" busy={later.isPending}>
            Save date
          </Button>
          <Button variant="text" onClick={() => setPicking(false)}>
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className={card}>
      <p className="min-w-0 flex-[1_1_260px]">
        <strong className="font-extrabold">
          Did you give {who} the {gift.title}?
        </strong>{' '}
        <span className="text-plum-soft">You planned {dayLabel(gift.giveOn)}.</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="h-[34px]! px-3.5! text-small"
          busy={given.isPending}
          onClick={async () => {
            try {
              await given.mutateAsync(gift.itemId)
              toast(`Thanks. We’ll ask ${who} to mark it received.`)
            } catch (err) {
              toast(friendlyError(err))
            }
          }}
        >
          Yes, I gave it
        </Button>
        <Button variant="text" onClick={() => setPicking(true)}>
          Not yet
        </Button>
      </div>
    </div>
  )
}
