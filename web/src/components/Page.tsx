import type { ReactNode } from 'react'

export function Page({ title, lead, kicker, children }: { title: string; lead?: ReactNode; kicker?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {kicker}
      <h1 className="text-display leading-none font-extrabold tracking-[-0.035em]">{title}</h1>
      {lead && <p className="mt-2 max-w-[72ch] text-plum-soft">{lead}</p>}
      {children}
    </>
  )
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-8 max-w-[52ch] rounded-panel bg-print px-5 py-6 text-plum-soft">
      <strong className="mb-1 block font-extrabold text-plum">{title}</strong>
      {children}
    </div>
  )
}
