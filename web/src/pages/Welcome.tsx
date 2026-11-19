import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent, type ReactNode } from 'react'
import { CodeInput } from '../components/CodeInput'
import { CurrencySelect } from '../components/CurrencySelect'
import { EditItemSheet } from '../components/ItemSheet'
import { Page } from '../components/Page'
import { Button, LoadError, Notice, Panel, Spinner, TextField } from '../components/ui'
import { detectUserCurrency, FALLBACK_CURRENCY } from '../lib/currency'
import { friendlyError } from '../lib/errors'
import { normalizeInviteCode, readPendingJoin } from '../lib/invite'
import { useCreateCircle, useJoinCircle, useMyCircles, useProfile, useUpdateProfile, type CircleKind, type Profile } from '../lib/queries'
import { useMyItems } from '../lib/items'
import { useToast } from '../lib/toast'
import { AddBar } from './MyList'

export function WelcomePage() {
  const profile = useProfile()
  if (profile.isPending) return <Spinner />
  if (profile.error) return <LoadError error={profile.error} onRetry={() => profile.refetch()} />
  return <Welcome profile={profile.data} />
}

function Welcome({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [step, setStep] = useState<'profile' | 'circle' | 'wish'>('profile')
  const [circleId, setCircleId] = useState<string | null>(null)
  // Someone arriving from an invite goes straight to that Circle after step 1.
  const joining = !!readPendingJoin()
  const [name, setName] = useState(profile.display_name)
  // Google sign-ups arrive without a detected currency; offer the detected one instead of USD.
  const [currency, setCurrency] = useState(profile.currency === FALLBACK_CURRENCY ? detectUserCurrency() : profile.currency)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Add the name your Circle will see.')
    try {
      await update.mutateAsync({ display_name: name.trim(), currency })
      const pending = readPendingJoin()
      if (pending) navigate({ to: '/join/$code', params: { code: pending }, replace: true })
      else setStep('circle')
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  if (step === 'profile') {
    return (
      <Page title="Welcome to GiftHub" lead={joining ? 'One quick thing, then you’re in.' : 'Three quick steps and you’re set up.'}>
        {!joining && <Steps at={1} />}
        <Panel className="mt-6 max-w-[480px]">
          <form onSubmit={saveProfile} className="flex flex-col gap-4" noValidate>
            <TextField label="Your name" hint="This is how you appear in your Circles." autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            <CurrencySelect value={currency} onChange={setCurrency} hint="Used when a store doesn’t show its own currency. You can change it later." />
            {error && <Notice tone="alert">{error}</Notice>}
            <Button type="submit" busy={update.isPending} className="self-start">
              Continue
            </Button>
          </form>
        </Panel>
      </Page>
    )
  }

  const finish = () => (circleId ? navigate({ to: '/circles/$circleId', params: { circleId }, replace: true }) : navigate({ to: '/', replace: true }))

  if (step === 'circle')
    return (
      <StartCircle
        progress={<Steps at={2} />}
        onDone={(id) => {
          setCircleId(id)
          setStep('wish')
        }}
        onSkip={() => setStep('wish')}
      />
    )

  return <FirstWish userCurrency={currency} onDone={finish} />
}

/** "Step 2 of 3" with three short bars, under the page's lead. */
function Steps({ at }: { at: 1 | 2 | 3 }) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <span className="text-small font-semibold text-plum-soft">Step {at} of 3</span>
      <span className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 w-8 rounded-full ${n <= at ? 'bg-plum' : 'bg-plum-soft/30'}`} />
        ))}
      </span>
    </div>
  )
}

/** Step 3: the first wish, by link or by hand. Then on to the new Circle or the list. */
function FirstWish({ userCurrency, onDone }: { userCurrency: string; onDone: () => void }) {
  const items = useMyItems()
  const circles = useMyCircles()
  const [adding, setAdding] = useState<{ url: string | null; title?: string | null } | null>(null)
  const added = (items.data?.length ?? 0) > 0

  return (
    <Page title={added ? 'You’re all set' : 'Add your first wish'} lead={added ? 'Your wish is on your list. Add more any time from My list.' : 'Paste a link to something you’d like. GiftHub fills in the details.'}>
      <Steps at={3} />
      <Panel className="mt-6 max-w-[540px]">
        {added ? (
          <Button onClick={onDone}>Continue</Button>
        ) : (
          <>
            <AddBar onAdd={(url, title) => setAdding({ url, title })} />
            <p className="mt-3 text-small text-plum-soft">
              No link?{' '}
              <button type="button" className="font-semibold text-plum underline underline-offset-3" onClick={() => setAdding({ url: null })}>
                Add a wish by hand
              </button>
            </p>
          </>
        )}
      </Panel>
      {!added && (
        <Button variant="text" className="mt-4" onClick={onDone}>
          Skip for now
        </Button>
      )}
      {adding && <EditItemSheet item={null} initialUrl={adding.url} initialTitle={adding.title} circles={circles.data ?? []} userCurrency={userCurrency} onClose={() => setAdding(null)} />}
    </Page>
  )
}

const kindChoices: { value: CircleKind; label: string }[] = [
  { value: 'couple', label: 'Just the two of us' },
  { value: 'group', label: 'A group' },
]
const kindChip =
  'tap h-[34px] rounded-full px-[13px] text-small font-semibold text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)] aria-pressed:bg-plum aria-pressed:text-white aria-pressed:shadow-none disabled:opacity-50 disabled:hover:shadow-[inset_0_0_0_1.5px_var(--color-edge)]'

/** Create a Circle or join one with a code. Used on Welcome and the Circles page. */
export function StartCircle({
  onDone,
  onSkip,
  compact = false,
  only,
  progress,
}: {
  onDone: (circleId: string) => void
  /** Shown under the lead (Welcome's step counter). */
  progress?: ReactNode
  onSkip?: () => void
  compact?: boolean
  /** Show just one of the two forms. */
  only?: 'create' | 'join'
}) {
  const create = useCreateCircle()
  const join = useJoinCircle()
  const toast = useToast()
  const mine = useMyCircles()
  const hasCouple = !!mine.data?.some((c) => c.kind === 'couple')
  const [kind, setKind] = useState<CircleKind>('group')
  const [circleName, setCircleName] = useState('')
  const [code, setCode] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  async function doCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
    const couple = kind === 'couple' && !hasCouple
    if (!couple && !circleName.trim()) return setCreateError('Give your Circle a name.')
    try {
      const circle = await create.mutateAsync({ name: circleName.trim() || null, kind: couple ? 'couple' : 'group' })
      toast(couple ? 'Your couple Circle is ready. Share its code with your partner.' : `${circle.name} is ready. Share its code to invite people.`)
      onDone(circle.id)
    } catch (err) {
      setCreateError(friendlyError(err))
    }
  }

  async function doJoin(e?: FormEvent, typed: string = code) {
    e?.preventDefault()
    if (join.isPending) return
    setJoinError(null)
    const normalized = normalizeInviteCode(typed)
    if (!normalized) return setJoinError('Codes are 6 letters and numbers, like K7QX3M.')
    try {
      const circle = await join.mutateAsync(normalized)
      if (!circle) return setJoinError('That code doesn’t match an open Circle. Check it with the person who sent it.')
      toast(circle.name ? `You joined ${circle.name}.` : 'You joined their couple Circle.')
      onDone(circle.id)
    } catch (err) {
      setJoinError(friendlyError(err))
    }
  }

  const body = (
    <div className={`mt-6 grid gap-4 ${only ? 'max-w-[440px]' : 'max-w-[900px] md:grid-cols-2'}`}>
      {only !== 'join' && (
      <Panel>
        <h2 className="font-extrabold">Start a Circle</h2>
        <p className="mt-1 text-small text-plum-soft">For you and a partner, or a group of friends or family.</p>
        <form onSubmit={doCreate} className="mt-4 flex flex-col gap-3" noValidate>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-small font-semibold">Who is it for?</legend>
            <div className="flex flex-wrap gap-2">
              {kindChoices.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className={kindChip}
                  aria-pressed={(hasCouple ? 'group' : kind) === k.value}
                  disabled={k.value === 'couple' && hasCouple}
                  onClick={() => {
                    setKind(k.value)
                    setCreateError(null)
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <p className="text-small text-plum-soft">
              {hasCouple ? 'You already have a couple Circle. You can be in one at a time.' : kind === 'couple' ? 'Just the two of you. It closes once your partner joins.' : 'Friends or family. Up to 20 people.'}
            </p>
          </fieldset>
          {kind === 'couple' && !hasCouple ? (
            <TextField label="Name (optional)" hint="Leave it empty and you’ll each see “You and” your partner’s name." value={circleName} onChange={(e) => setCircleName(e.target.value)} error={createError} maxLength={60} />
          ) : (
            <TextField label="Circle name" placeholder="The Rivera family" value={circleName} onChange={(e) => setCircleName(e.target.value)} error={createError} maxLength={60} autoFocus={only === 'create'} />
          )}
          <Button type="submit" busy={create.isPending} className="self-start">
            Create Circle
          </Button>
        </form>
      </Panel>
      )}
      {only !== 'create' && (
      <Panel>
        <h2 className="font-extrabold">Join with a code</h2>
        <p className="mt-1 text-small text-plum-soft">Paste the code or link someone sent you.</p>
        <form onSubmit={doJoin} className="mt-4 flex flex-col gap-3" noValidate>
          <CodeInput
            value={code}
            onChange={(c) => {
              setCode(c)
              setJoinError(null)
            }}
            onComplete={(c) => doJoin(undefined, c)}
            error={joinError}
            hint="Six letters and numbers. You can paste the whole link."
            autoFocus={only === 'join'}
          />
          <Button type="submit" busy={join.isPending} className="self-start">
            Join Circle
          </Button>
        </form>
      </Panel>
      )}
    </div>
  )

  if (compact) return body

  return (
    <Page title="Start or join a Circle" lead="A Circle is a private group where you see each other’s lists.">
      {progress}
      {body}
      {onSkip && (
        <Button variant="text" className="mt-4" onClick={onSkip}>
          Skip for now
        </Button>
      )}
    </Page>
  )
}
