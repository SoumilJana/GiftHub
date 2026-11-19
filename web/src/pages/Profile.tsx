import { useNavigate } from '@tanstack/react-router'
import { useId, useState, type FormEvent } from 'react'
import { BugReportSheet } from '../components/BugReport'
import { CurrencySelect } from '../components/CurrencySelect'
import { InfoLinks } from '../components/InfoFrame'
import { Page } from '../components/Page'
import { Button, ConfirmButton, LoadError, Notice, Panel, Spinner, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { setFewerAnimations, useCalmMotion } from '../lib/motion'
import { useDeleteAccount, useProfile, useUpdateProfile, type Profile } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

export function ProfilePage() {
  const profile = useProfile()
  if (profile.isPending) return <Spinner />
  if (profile.error) return <LoadError error={profile.error} onRetry={() => profile.refetch()} />
  return <ProfileForm profile={profile.data} />
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { session } = useAuth()
  const update = useUpdateProfile()
  const del = useDeleteAccount()
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState(profile.display_name)
  const [currency, setCurrency] = useState(profile.currency)
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Add the name your Circles will see.')
    try {
      await update.mutateAsync({ display_name: name.trim(), currency })
      toast('Profile saved.')
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate({ to: '/sign-in', replace: true })
  }

  return (
    <Page title="Profile" lead={session?.user.email}>
      <div className="mt-6 flex max-w-[560px] flex-col gap-4">
        <Panel>
          <form onSubmit={save} className="flex flex-col gap-4" noValidate>
            <TextField label="Your name" hint="This is how you appear in your Circles." autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            <CurrencySelect value={currency} onChange={setCurrency} hint="Used when a store doesn’t show its own currency." />
            {error && <Notice tone="alert">{error}</Notice>}
            <Button type="submit" busy={update.isPending} className="self-start">
              Save profile
            </Button>
          </form>
        </Panel>

        <MotionPanel />

        <Panel>
          <h2 className="font-extrabold">Help and legal</h2>
          <p className="mt-1 mb-4 text-small text-plum-soft">Answers to common questions, or tell us when something goes wrong.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Button variant="ghost" onClick={() => setReporting(true)}>
              Report a bug
            </Button>
            <InfoLinks />
          </div>
        </Panel>

        <Panel>
          <h2 className="font-extrabold">Sign out</h2>
          <p className="mt-1 mb-4 text-small text-plum-soft">Your lists stay saved in your account.</p>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </Panel>

        <Panel>
          <h2 className="font-extrabold">Delete account</h2>
          <p className="mt-1 mb-4 text-small text-plum-soft">
            Removes your profile, lists and claims. Circles you own pass to another member; Circles with only you are deleted.
          </p>
          <ConfirmButton
            label="Delete account"
            question="This can’t be undone."
            confirmLabel="Delete my account"
            variant="danger"
            busy={del.isPending}
            onConfirm={async () => {
              try {
                await del.mutateAsync()
                navigate({ to: '/sign-in', replace: true })
              } catch (err) {
                setError(friendlyError(err))
              }
            }}
          />
        </Panel>
      </div>
      {reporting && <BugReportSheet onClose={() => setReporting(false)} />}
    </Page>
  )
}

/** "Fewer animations": the calm version, also used when the device asks for reduced motion. */
function MotionPanel() {
  const [calm, forced] = useCalmMotion()
  const id = useId()
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={id} className="font-extrabold">
            Fewer animations
          </h2>
          <p className="mt-1 text-small text-plum-soft">
            {forced
              ? 'On, because your device asks for less motion. Change it in your device settings.'
              : 'Turns off sliding and flying. Fades stay, so you can still see what changed.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={calm}
          aria-labelledby={id}
          disabled={forced}
          onClick={() => setFewerAnimations(!calm)}
          className="relative mt-0.5 h-[26px] w-[44px] shrink-0 rounded-full bg-print shadow-[inset_0_0_0_1.5px_var(--color-edge)] transition-colors duration-150 aria-checked:bg-plum aria-checked:shadow-none disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            data-motion-move
            className={`absolute top-[3px] left-[3px] size-5 rounded-full shadow-[0_1px_2px_rgba(59,29,63,0.2)] transition-[transform,background-color] duration-200 ease-[var(--ease-out)] ${calm ? 'translate-x-[18px] bg-print' : 'bg-plum-soft'}`}
          />
        </button>
      </div>
    </Panel>
  )
}
