import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { CurrencySelect } from '../components/CurrencySelect'
import { Page } from '../components/Page'
import { Button, LoadError, Notice, Panel, Spinner, TextField } from '../components/ui'
import { detectUserCurrency, FALLBACK_CURRENCY } from '../lib/currency'
import { friendlyError } from '../lib/errors'
import { normalizeInviteCode, readPendingJoin } from '../lib/invite'
import { useCreateCircle, useJoinCircle, useMyCircles, useProfile, useUpdateProfile, type CircleKind, type Profile } from '../lib/queries'
import { useToast } from '../lib/toast'

export function WelcomePage() {
  const profile = useProfile()
  if (profile.isPending) return <Spinner />
  if (profile.error) return <LoadError error={profile.error} onRetry={() => profile.refetch()} />
  return <Welcome profile={profile.data} />
}

function Welcome({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [step, setStep] = useState<'profile' | 'circle'>('profile')
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
      <Page title="Welcome to GiftHub" lead="Two quick things, then you can start a Circle.">
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

  return <StartCircle onDone={(id) => navigate({ to: '/circles/$circleId', params: { circleId: id }, replace: true })} onSkip={() => navigate({ to: '/', replace: true })} />
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
}: {
  onDone: (circleId: string) => void
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

  async function doJoin(e: FormEvent) {
    e.preventDefault()
    setJoinError(null)
    const normalized = normalizeInviteCode(code)
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
          <TextField label="Invite code" placeholder="K7QX3M" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} error={joinError} autoFocus={only === 'join'} />
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
      {body}
      {onSkip && (
        <Button variant="text" className="mt-4" onClick={onSkip}>
          Skip for now
        </Button>
      )}
    </Page>
  )
}
