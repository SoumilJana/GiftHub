import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { CurrencySelect } from '../components/CurrencySelect'
import { Page } from '../components/Page'
import { Button, Notice, Panel, Spinner, TextField } from '../components/ui'
import { detectUserCurrency, FALLBACK_CURRENCY } from '../lib/currency'
import { friendlyError } from '../lib/errors'
import { normalizeInviteCode, readPendingJoin } from '../lib/invite'
import { useCreateCircle, useJoinCircle, useProfile, useUpdateProfile, type Profile } from '../lib/queries'
import { useToast } from '../lib/toast'

export function WelcomePage() {
  const profile = useProfile()
  if (profile.isPending) return <Spinner />
  if (profile.error) return <Notice tone="alert">{friendlyError(profile.error)}</Notice>
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
            <TextField label="Your name" hint="This is how you appear in your Circles." autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
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

/** Create a Circle or join one with a code. Used on Welcome and the Circles page. */
export function StartCircle({ onDone, onSkip, compact = false }: { onDone: (circleId: string) => void; onSkip?: () => void; compact?: boolean }) {
  const create = useCreateCircle()
  const join = useJoinCircle()
  const toast = useToast()
  const [circleName, setCircleName] = useState('')
  const [code, setCode] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  async function doCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
    if (!circleName.trim()) return setCreateError('Give your Circle a name.')
    try {
      const circle = await create.mutateAsync(circleName.trim())
      toast(`${circle.name} is ready. Share its code to invite people.`)
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
      toast(`You joined ${circle.name}.`)
      onDone(circle.id)
    } catch (err) {
      setJoinError(friendlyError(err))
    }
  }

  const body = (
    <div className="mt-6 grid max-w-[900px] gap-4 md:grid-cols-2">
      <Panel>
        <h2 className="font-extrabold">Start a Circle</h2>
        <p className="mt-1 text-small text-plum-soft">For you and a partner, or a group of friends or family.</p>
        <form onSubmit={doCreate} className="mt-4 flex flex-col gap-3" noValidate>
          <TextField label="Circle name" placeholder="Maya & Sam" value={circleName} onChange={(e) => setCircleName(e.target.value)} error={createError} maxLength={60} />
          <Button type="submit" busy={create.isPending} className="self-start">
            Create Circle
          </Button>
        </form>
      </Panel>
      <Panel>
        <h2 className="font-extrabold">Join with a code</h2>
        <p className="mt-1 text-small text-plum-soft">Paste the code or link someone sent you.</p>
        <form onSubmit={doJoin} className="mt-4 flex flex-col gap-3" noValidate>
          <TextField label="Invite code" placeholder="K7QX3M" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} error={joinError} />
          <Button type="submit" busy={join.isPending} className="self-start">
            Join Circle
          </Button>
        </form>
      </Panel>
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
