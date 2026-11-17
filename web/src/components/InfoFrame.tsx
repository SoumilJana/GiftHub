import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { GiftMark } from './GiftMark'

export const CONTACT_EMAIL = 'janasoumil1005@gmail.com'
export const OPERATOR = 'Soumil Jana'

export type InfoSection = { id: string; title: string; body: ReactNode }

/** Layout for public reading pages (Help, Privacy, Terms, Cookies): top bar, heading, contents, sections, footer links. */
export function InfoFrame({
  title,
  lead,
  updated,
  sections,
  children,
}: {
  title: string
  lead?: ReactNode
  updated?: string
  sections?: InfoSection[]
  children?: ReactNode
}) {
  const { session } = useAuth()
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between rounded-b-sheet bg-print px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 shadow-[0_1px_3px_rgba(59,29,63,0.06)] sm:px-8">
        <Link to="/" className="flex items-center gap-2 text-[22px] leading-none font-extrabold tracking-[-0.03em]">
          <GiftMark size={28} />
          GiftHub
        </Link>
        <Link to={session ? '/' : '/sign-in'} className="text-small font-semibold text-plum-soft underline underline-offset-3 hover:text-plum">
          {session ? 'Back to your list' : 'Sign in'}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-16 sm:px-8">
        <h1 className="text-display leading-none font-extrabold tracking-[-0.035em]">{title}</h1>
        {lead && <p className="mt-2 max-w-[68ch] text-plum-soft">{lead}</p>}
        {updated && <p className="mt-2 text-small text-plum-soft">Last updated {updated}</p>}

        {sections && sections.length > 3 && (
          <nav aria-labelledby="contents" className="mt-6 rounded-panel bg-print px-5 py-4">
            <h2 id="contents" className="text-small font-semibold text-plum-soft">
              On this page
            </h2>
            <ol className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-small font-semibold underline-offset-3 hover:underline">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {children}

        {sections && (
          <div className="mt-6 rounded-panel bg-print px-5 py-2 sm:px-7">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-6 border-b border-blush py-5 last:border-b-0">
                <h2 id={`${s.id}-h`} className="font-extrabold">
                  {s.title}
                </h2>
                <div className="prose-info mt-2">{s.body}</div>
              </section>
            ))}
          </div>
        )}

        <InfoLinks className="mt-10" />
      </main>
    </div>
  )
}

/** Help · Privacy · Terms · Cookies, used under sign-in, on Profile and on every reading page. */
export function InfoLinks({ className = '' }: { className?: string }) {
  const link = 'text-small text-plum-soft underline underline-offset-3 hover:text-plum'
  return (
    <nav aria-label="Help and legal" className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      <Link to="/help" className={link}>
        Help
      </Link>
      <Link to="/privacy" className={link}>
        Privacy
      </Link>
      <Link to="/terms" className={link}>
        Terms
      </Link>
      <Link to="/cookies" className={link}>
        Cookies
      </Link>
    </nav>
  )
}

export function Mail({ subject }: { subject?: string }) {
  const href = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
  return (
    <a href={href} className="font-semibold underline underline-offset-3">
      {CONTACT_EMAIL}
    </a>
  )
}
