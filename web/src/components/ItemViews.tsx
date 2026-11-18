import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Claim } from '../lib/claims'
import type { ViewMode } from '../lib/view'
import { formatPrice, priorityBand, type PriorityBand } from '../lib/format'
import { dateStamp, heartCount, occasionLabel, OCCASIONS, SORTS, storeOf, tintFor, usedOccasions, type Item, type ListFilter, type SortKey } from '../lib/wishlist'

export function Hearts({ priority, className = '' }: { priority: number; className?: string }) {
  const on = heartCount(priority)
  const band = priorityBand(priority)
  return (
    <span role="img" aria-label={`${band}, priority ${priority} of 10`} title={band} className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 16 16" aria-hidden="true" className={`size-[13px] ${i <= on ? 'text-ribbon-deep' : 'text-heart-off'}`}>
          <path d="M8 14S1.5 10 1.5 5.6A3.4 3.4 0 0 1 8 4a3.4 3.4 0 0 1 6.5 1.6C14.5 10 8 14 8 14z" fill="currentColor" />
        </svg>
      ))}
    </span>
  )
}

/** Line drawing for wishes without a photo. */
function GiftArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
      <rect x="34" y="32" width="52" height="38" rx="5" />
      <path d="M30 24h60v10H30zM60 24v46" />
      <path d="M60 24c-6-12-20-12-20-4s14 4 20 4c6 0 20 4 20-4s-14-8-20 4z" />
    </svg>
  )
}

const BOW = 'M22 15C15 3 3 2 4 10s10 7 18 5c8 2 17 3 18-5S29 3 22 15z'

/**
 * The claim as drawn, set straight on the frame so CSS transitions run. A frame
 * always starts unwrapped and animates into its state; it is never drawn already
 * wrapped. The booth flash plays only when a claim lands while the frame is shown.
 */
function useWrap(claim: Claim | null | undefined, frame: RefObject<HTMLDivElement | null>, flash: RefObject<HTMLSpanElement | null>) {
  const wrap = !claim ? null : claim.status === 'bought' || !claim.mine ? 'bought' : 'reserved'
  const settled = useRef(false)
  const wasWrapped = useRef(false)
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    if (!settled.current) {
      void el.offsetWidth // settle the unwrapped style so the change below transitions
      settled.current = true
    } else if (!wasWrapped.current && wrap && flash.current) {
      flash.current.classList.remove('go')
      void flash.current.offsetWidth
      flash.current.classList.add('go')
    }
    wasWrapped.current = !!wrap
    if (wrap) el.setAttribute('data-wrap', wrap)
    else el.removeAttribute('data-wrap')
  }, [wrap, frame, flash])
}

export function Photo({ item, size = 'frame', claim }: { item: Item; size?: 'frame' | 'thumb' | 'sheet'; claim?: Claim | null }) {
  const [broken, setBroken] = useState(false)
  const showImg = item.image_url && !broken
  const thumb = size === 'thumb'
  const frame = useRef<HTMLDivElement>(null)
  const flash = useRef<HTMLSpanElement>(null)
  useWrap(claim, frame, flash)
  return (
    <div
      ref={frame}
      className={`relative grid aspect-square place-items-center overflow-hidden ${thumb ? 'thumb w-12 rounded-print' : 'rounded-photo'}`}
      style={{ background: tintFor(item.id) }}
    >
      {showImg ? (
        <img
          src={item.image_url!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="photo-art size-[86%] object-contain mix-blend-multiply"
        />
      ) : (
        <GiftArt className={`photo-art ${thumb ? 'w-[74%]' : 'w-[60%]'} text-plum`} />
      )}
      {item.original_price !== null && item.price !== null && item.price < item.original_price && !thumb && (
        <span className="absolute top-[7px] left-[7px] rounded-full bg-sky-wash px-[9px] py-0.5 text-small font-extrabold text-sky-ink">Sale</span>
      )}
      {claim !== undefined && (
        <span className="ribbon" aria-hidden="true">
          <svg className="bow" viewBox="0 0 44 30">
            <path d={BOW} fill="currentColor" />
            <path d="M22 15l-7 13M22 15l7 13" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <circle cx="22" cy="15" r="4.5" fill="#fff" opacity=".3" />
          </svg>
        </span>
      )}
      {size === 'frame' && (
        <span
          className="absolute right-1.5 bottom-1.5 z-[1] rounded-photo bg-white/88 px-[5px] text-small font-extrabold tracking-[0.02em] text-stamp tabular-nums"
          aria-label={`Added ${new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        >
          {dateStamp(item.created_at)}
        </span>
      )}
      {claim !== undefined && <span ref={flash} className="booth-flash" aria-hidden="true" />}
    </div>
  )
}

export function Price({ item, className = '' }: { item: Item; className?: string }) {
  if (item.price === null) return <span className={`text-small text-plum-soft ${className}`}>No price</span>
  const was = item.original_price !== null && item.original_price > item.price
  return (
    <span className={`flex min-w-0 flex-col leading-tight font-extrabold tabular-nums ${className}`}>
      <span>
        {was && <span className="sr-only">now </span>}
        {formatPrice(item.price, item.currency)}
      </span>
      {was && (
        <s className="text-small font-normal text-plum-soft">
          <span className="sr-only">was </span>
          {formatPrice(item.original_price!, item.currency)}
        </s>
      )}
    </span>
  )
}

function Title({ item, className = '' }: { item: Item; className?: string }) {
  const text = <span className="line-clamp-3">{item.title}</span>
  return (
    <h3 className={`leading-tight font-semibold ${className}`}>
      {item.url ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:decoration-[1.5px] hover:underline-offset-3">
          {text}
          <span className="sr-only"> (opens the store)</span>
        </a>
      ) : (
        text
      )}
    </h3>
  )
}

const store = (item: Item) => item.domain ?? storeOf(item.url) ?? 'No link'
const occasionsText = (item: Item) => item.occasions.map(occasionLabel).join(', ')

type ViewProps = {
  items: Item[]
  slot: (item: Item) => ReactNode
  /** Givers' view only: claims on these wishes. Leave out on an owner's own list. */
  claims?: Record<string, Claim>
  /** Makes the photo open the wish's details. */
  onOpen?: (item: Item) => void
}

function OpenPhoto({ item, size, claims, onOpen }: { item: Item; size: 'frame' | 'thumb' } & Pick<ViewProps, 'claims' | 'onOpen'>) {
  const photo = <Photo item={item} size={size} claim={claims ? (claims[item.id] ?? null) : undefined} />
  if (!onOpen) return photo
  return (
    <button type="button" onClick={() => onOpen(item)} className="block w-full cursor-pointer rounded-photo text-left" aria-label={`Details: ${item.title}`}>
      {photo}
    </button>
  )
}

/** Strip view: one white print per wish. `slot` fills the fixed-height action area. */
export function ItemStrip({ items, slot, claims, onOpen }: ViewProps) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-3.5 sm:grid-cols-[repeat(auto-fill,minmax(204px,1fr))] sm:gap-x-[18px] sm:gap-y-[22px]">
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 flex-col rounded-print bg-print px-[7px] pt-[7px] shadow-[0_1px_2px_rgba(59,29,63,.08)] sm:px-2 sm:pt-2">
          <OpenPhoto item={item} size="frame" claims={claims} onOpen={onOpen} />
          <div className="flex flex-1 flex-col gap-1 px-[3px] pt-2.5 pb-3">
            <span className="truncate text-small text-plum-soft">{store(item)}</span>
            <Title item={item} />
            <div className="mt-0.5 flex items-start justify-between gap-2">
              <Price item={item} />
              <Hearts priority={item.priority} className="h-[1.25em] shrink-0" />
            </div>
            {item.occasions.length > 0 && <span className="text-small text-plum-soft">{occasionsText(item)}</span>}
            <div className="mt-auto flex min-h-12 flex-wrap items-center gap-1.5 pt-2">{slot(item)}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** List view: dense rows in one white panel. */
export function ItemList({ items, slot, claims, onOpen }: ViewProps) {
  return (
    <ul className="rounded-panel bg-print px-3 py-0.5 sm:px-3.5 sm:py-1">
      {items.map((item) => (
        <li
          key={item.id}
          className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-b border-blush py-2 last:border-b-0 md:grid-cols-[48px_minmax(0,1fr)_110px_70px_268px]"
        >
          <OpenPhoto item={item} size="thumb" claims={claims} onOpen={onOpen} />
          <div className="min-w-0">
            <span className="block truncate text-small text-plum-soft">{store(item)}</span>
            <Title item={item} className="text-small [&_.line-clamp-3]:line-clamp-2" />
          </div>
          <Price item={item} className="text-small" />
          <Hearts priority={item.priority} className="hidden md:flex" />
          <div className="col-start-2 col-end-[-1] flex min-h-[34px] flex-wrap items-center gap-1.5 md:col-auto md:justify-end">{slot(item)}</div>
        </li>
      ))}
    </ul>
  )
}

const chip =
  'h-[34px] shrink-0 rounded-full px-[13px] text-small font-semibold text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)] aria-pressed:bg-print aria-pressed:shadow-[inset_0_0_0_1.5px_var(--color-plum)]'
const pill =
  'h-[34px] rounded-full bg-print pl-3.5 text-small font-semibold text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)]'

/** Occasion chips, priority and price filters, sort, and the Strip/List control. */
export function ListTools({
  items,
  filter,
  onFilter,
  view,
  onView,
}: {
  items: Item[]
  filter: ListFilter
  onFilter: (f: ListFilter) => void
  view: ViewMode
  onView: (v: ViewMode) => void
}) {
  const occasions = usedOccasions(items)
  const set = (patch: Partial<ListFilter>) => onFilter({ ...filter, ...patch })
  return (
    <div className="mt-4 mb-[22px] flex flex-wrap items-center gap-x-5 gap-y-3">
      {occasions.length > 0 && (
        <div role="group" aria-label="Occasion" className="-mx-4 flex w-[calc(100%+32px)] gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
          <button type="button" className={chip} aria-pressed={filter.occasion === null} onClick={() => set({ occasion: null })}>
            All
          </button>
          {OCCASIONS.filter((o) => occasions.includes(o.value)).map((o) => (
            <button key={o.value} type="button" className={chip} aria-pressed={filter.occasion === o.value} onClick={() => set({ occasion: o.value })}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid w-full grid-cols-2 gap-2.5 sm:ml-auto sm:flex sm:w-auto sm:items-center">
        <label className="sr-only" htmlFor="band">
          Priority
        </label>
        <select id="band" className={`${pill} select-pill min-w-0`} value={filter.band ?? ''} onChange={(e) => set({ band: (e.target.value || null) as PriorityBand | null })}>
          <option value="">Any priority</option>
          <option>Must have</option>
          <option>Would love</option>
          <option>Nice to have</option>
        </select>
        <label className="sr-only" htmlFor="sort">
          Sort
        </label>
        <select id="sort" className={`${pill} select-pill min-w-0`} value={filter.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="maxprice">
          Highest price
        </label>
        <input
          id="maxprice"
          inputMode="decimal"
          placeholder="Up to price"
          className={`${pill} min-w-0 px-3.5 placeholder:font-semibold placeholder:text-placeholder hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)] sm:w-[118px]`}
          value={filter.maxPrice ?? ''}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.]/g, '')
            set({ maxPrice: v === '' || Number.isNaN(Number(v)) ? null : Number(v) })
          }}
        />
        <div role="group" aria-label="View" className="grid grid-cols-2 rounded-full bg-print p-[3px] shadow-[inset_0_0_0_1.5px_var(--color-edge)] sm:inline-grid">
          {(['strip', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => onView(v)}
              className="h-7 rounded-full px-3 text-small font-semibold text-plum-soft hover:text-plum aria-pressed:bg-plum aria-pressed:text-white"
            >
              {v === 'strip' ? 'Strip' : 'List'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ItemsView({ view, ...props }: ViewProps & { view: ViewMode }) {
  return view === 'list' ? <ItemList {...props} /> : <ItemStrip {...props} />
}
