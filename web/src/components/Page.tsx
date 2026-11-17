import type { ReactNode } from 'react'

export function Page({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <h1 className="text-[clamp(28px,3.6vw,40px)] leading-[1.05] font-extrabold tracking-[-0.03em]">{title}</h1>
      {lead && <p className="mt-2 max-w-[72ch] text-muted">{lead}</p>}
      {children}
    </>
  )
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-[52ch] py-12 text-muted">
      <strong className="mb-1 block text-[17px] text-ink">{title}</strong>
      {children}
    </div>
  )
}
