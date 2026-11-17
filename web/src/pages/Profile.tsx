import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { CurrencySelect } from '../components/CurrencySelect'
import { Page } from '../components/Page'
import { Button, ConfirmButton, Notice, Panel, Spinner, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { useDeleteAccount, useProfile, useUpdateProfile, type Profile } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

export function ProfilePage() {
  const profile = useProfile()
  if (profile.isPending) return <Spinner />
  if (profile.error) return <Notice tone="alert">{friendlyError(profile.error)}</Notice>
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
            <TextField label="Your name" hint="This is how you appear in your Circles." autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            <CurrencySelect value={currency} onChange={setCurrency} hint="Used when a store doesn’t show its own currency." />
            {error && <Notice tone="alert">{error}</Notice>}
            <Button type="submit" busy={update.isPending} className="self-start">
              Save profile
            </Button>
          </form>
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
    </Page>
  )
}
