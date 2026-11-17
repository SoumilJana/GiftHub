import { Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { BugReportSheet } from '../components/BugReport'
import { InfoFrame, Mail } from '../components/InfoFrame'
import { Button } from '../components/ui'
import { useAuth } from '../lib/auth'

type QA = { q: string; a: ReactNode }

const groups: { id: string; title: string; items: QA[] }[] = [
  {
    id: 'how',
    title: 'How it works',
    items: [
      {
        q: 'What is GiftHub?',
        a: <p>A private wishlist you share with the people who buy you gifts. You keep one list, choose which Circles see each wish, and they can see what you’d really like.</p>,
      },
      {
        q: 'What is a Circle?',
        a: <p>A private group, such as you and a partner, or your family. Everyone in a Circle sees the wishes the others share with it. You can be in up to 10 Circles.</p>,
      },
      {
        q: 'How do I invite someone?',
        a: (
          <p>
            Open the Circle and share its invite code or link. Anyone with it joins straight away, so send it only to people you trust. The owner can
            make a new code in Circle settings at any time.
          </p>
        ),
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and the surprise',
    items: [
      {
        q: 'Will the person know I’m buying their gift?',
        a: (
          <p>
            No. Reserving a gift and marking it bought are coming soon. When they arrive, everyone else in the Circle will see that a gift is taken, so
            nobody buys it twice, but the person it’s for never will, until they mark it received.
          </p>
        ),
      },
      {
        q: 'Can people in one Circle see my other Circles?',
        a: <p>No. Each Circle is its own room. Members can’t see which other Circles you’re in, their names, or where else a wish is shared.</p>,
      },
      {
        q: 'Who can see each wish?',
        a: <p>Only the Circles you choose for it. A wish shared with no Circle is visible only to you, and shows “Only you” on your list.</p>,
      },
    ],
  },
  {
    id: 'wishes',
    title: 'Wishes',
    items: [
      {
        q: 'How do I add a wish?',
        a: <p>Paste a link to the product on Your list and press Add, then check the details. You can also add a wish without a link, for things that aren’t sold online.</p>,
      },
      {
        q: 'Why is the price in the wrong currency?',
        a: <p>GiftHub guesses the currency from the store’s address, such as .in for rupees. You can change it on each wish, and change your usual currency on your profile.</p>,
      },
      {
        q: 'Can I add my own photo?',
        a: <p>Yes. Upload one, which GiftHub shrinks to save space, or paste a link to an image.</p>,
      },
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    items: [
      {
        q: 'How do I leave a Circle?',
        a: <p>Open the Circle, go to Circle settings, and choose Leave. Your wishes stop being shared with it.</p>,
      },
      {
        q: 'How do I delete my account?',
        a: (
          <p>
            Go to Profile and choose Delete account. Your wishes, photos and memberships are deleted straight away, and Circles you own pass to another
            member. See the <Link to="/privacy">Privacy Policy</Link> for details.
          </p>
        ),
      },
      {
        q: 'Is GiftHub free?',
        a: <p>Yes. To stay free there are limits: 150 active wishes per person, 10 Circles per person and 20 people per Circle.</p>,
      },
    ],
  },
]

export function HelpPage() {
  const { session } = useAuth()
  const [reporting, setReporting] = useState(false)

  return (
    <InfoFrame title="Help" lead="Answers to common questions, and a way to tell us when something goes wrong.">
      <nav aria-label="Topics" className="mt-6 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            className="inline-flex h-[34px] items-center rounded-full px-[13px] text-small font-semibold shadow-[inset_0_0_0_1.5px_var(--color-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)]"
          >
            {g.title}
          </a>
        ))}
      </nav>

      {groups.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="mt-8 scroll-mt-6">
          <h2 id={`${g.id}-h`} className="font-extrabold">
            {g.title}
          </h2>
          <div className="mt-3 rounded-panel bg-print px-5 sm:px-6">
            {g.items.map((item) => (
              <details key={item.q} className="group border-b border-blush last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-plum-soft transition-transform group-open:rotate-180">
                    <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="prose-info pb-4 text-plum-soft">{item.a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="problem-h" className="mt-10 rounded-panel bg-print p-5 sm:p-6">
        <h2 id="problem-h" className="font-extrabold">
          Something not working?
        </h2>
        {session ? (
          <>
            <p className="mt-1 max-w-[60ch] text-plum-soft">Tell us what happened. We read every report.</p>
            <Button className="mt-4" onClick={() => setReporting(true)}>
              Report a bug
            </Button>
          </>
        ) : (
          <p className="mt-1 max-w-[60ch] text-plum-soft">
            If you can’t sign in, or something else is wrong, email <Mail subject="GiftHub problem" />.
          </p>
        )}
      </section>

      {reporting && <BugReportSheet onClose={() => setReporting(false)} />}
    </InfoFrame>
  )
}
