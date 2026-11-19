import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useUserId } from '../lib/auth'
import { currencyForNewItem, currencyOptions } from '../lib/currency'
import { friendlyError } from '../lib/errors'
import { celebrate, flyHome, sheetExit } from '../lib/motion'
import { priorityBand } from '../lib/format'
import { useMarkReceived } from '../lib/claims'
import { fillWishLater, useDeleteItem, useSaveItem, type ItemDraft } from '../lib/items'
import { readLink, type LinkRead } from '../lib/linkReader'
import { isUploadedPhoto, removePhoto, uploadPhoto } from '../lib/photo'
import { circleTitle, type MyCircle } from '../lib/queries'
import { useToast } from '../lib/toast'
import { linkFromText, normalizeUrl, occasionLabel, OCCASIONS, storeOf, titleFromUrl, type Item, type Occasion } from '../lib/wishlist'
import { Hearts, Photo, Price } from './ItemViews'
import { Button, ConfirmButton, Notice, SelectField, TextArea, TextField } from './ui'

/** Bottom sheet on phones, centred panel on wider screens. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) {
      d.showModal()
      // showModal moves focus to the first control; send it to the field marked for it instead.
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
  }, [])
  // Leaving: play the exit on a copy, since React removes the real one straight away.
  // (Skipped in the first moments, so development's double mount doesn't flash a copy.)
  useLayoutEffect(() => {
    const d = ref.current
    const opened = performance.now()
    return () => {
      if (d && performance.now() - opened > 120) sheetExit(d)
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto w-full max-w-none rounded-t-sheet bg-print p-0 text-plum backdrop:bg-plum/40 sm:m-auto sm:max-w-[560px] sm:rounded-sheet"
    >
      <div className="max-h-[92dvh] overflow-y-auto px-4 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-body font-extrabold">
            {title}
          </h2>
          <Button variant="text" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

const chip =
  'h-[34px] rounded-full px-[13px] text-small font-semibold text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)] aria-pressed:bg-plum aria-pressed:text-white aria-pressed:shadow-none'

/** Add or edit one of your own wishes. */
export function EditItemSheet({
  item,
  initialUrl,
  initialTitle,
  circles,
  userCurrency,
  onClose,
}: {
  item: Item | null
  initialUrl?: string | null
  /** A first guess at the name, from text shared along with the link. */
  initialTitle?: string | null
  circles: MyCircle[]
  userCurrency: string
  onClose: () => void
}) {
  const uid = useUserId()
  const toast = useToast()
  const qc = useQueryClient()
  const save = useSaveItem()
  const del = useDeleteItem()
  const received = useMarkReceived()
  const currencies = useMemo(() => currencyOptions(), [])
  const fileInput = useRef<HTMLInputElement>(null)

  const startUrl = item?.url ?? initialUrl ?? ''
  const [url, setUrl] = useState(startUrl)
  const [title, setTitle] = useState(item?.title ?? initialTitle ?? (initialUrl ? titleFromUrl(initialUrl) : ''))
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '')
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '')
  const [currency, setCurrency] = useState(item?.currency ?? currencyForNewItem(initialUrl ?? null, userCurrency))
  const [priority, setPriority] = useState(item?.priority ?? 6)
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [occasions, setOccasions] = useState<Occasion[]>(item?.occasions ?? [])
  const [circleIds, setCircleIds] = useState<string[]>(item?.circle_ids ?? circles.map((c) => c.id))
  const [openedAt] = useState(() => new Date().toISOString())
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string[]>([])
  const [errors, setErrors] = useState<{ title?: string; url?: string; price?: string; image?: string; form?: string }>({})
  const [reading, setReading] = useState<{ state: 'idle' | 'reading' | 'done' | 'failed'; store?: string | null; reason?: string }>({ state: 'idle' })
  // Fields you've typed in yourself are never overwritten by what the link says.
  const edited = useRef({ title: false, price: false, image: false })
  const lastRead = useRef<string | null>(null)
  const reader = useRef<AbortController | null>(null)
  // The read still running, so Save doesn't have to wait for it.
  const pending = useRef<Promise<LinkRead> | null>(null)
  const handedOff = useRef(false)

  /** Read the store page and fill in what's still empty (or everything you haven't changed, when `all`). */
  async function fillFromLink(link: string, all = false) {
    if (!all && lastRead.current === link) return
    lastRead.current = link
    reader.current?.abort()
    const c = new AbortController()
    reader.current = c
    setReading({ state: 'reading', store: storeOf(link) })
    const promise = readLink(link, c.signal)
    pending.current = promise
    let r: LinkRead
    try {
      r = await promise
    } catch {
      return
    } finally {
      if (pending.current === promise) pending.current = null
    }
    if (c.signal.aborted) return
    if (!r.ok) {
      setReading({ state: 'failed', store: r.store, reason: r.reason })
      return
    }
    const d = r.data
    if (d.title && (all || !edited.current.title)) setTitle(d.title)
    if (d.price != null && (all || !edited.current.price)) {
      setPrice(String(d.price))
      if (d.currency) setCurrency(d.currency)
    }
    if (d.image && (all || !edited.current.image)) setImageUrl((cur) => (!cur.trim() || (all && !isUploadedPhoto(cur)) ? d.image! : cur))
    setUrl((cur) => (normalizeUrl(cur) === link ? d.url : cur))
    lastRead.current = d.url
    setReading({ state: 'done', store: d.store })
  }

  // A new wish that arrives with a link (from the paste bar) is read straight away.
  useEffect(() => {
    const link = !item && initialUrl ? normalizeUrl(initialUrl) : null
    // Started on the next tick, so development's double mount sends only one request.
    const start = link ? setTimeout(() => fillFromLink(link)) : undefined
    return () => {
      clearTimeout(start)
      // A read handed over at Save keeps going after the sheet closes.
      if (!handedOff.current) reader.current?.abort()
      lastRead.current = null
    }
  }, [item, initialUrl])

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  function close() {
    // Photos uploaded in this sheet but not saved are deleted again.
    uploaded.forEach((u) => removePhoto(u))
    onClose()
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    setErrors((e) => ({ ...e, image: undefined }))
    setUploading(true)
    try {
      const publicUrl = await uploadPhoto(uid, file)
      setUploaded((u) => [...u, publicUrl])
      edited.current.image = true
      setImageUrl(publicUrl)
    } catch (err) {
      setErrors((e) => ({ ...e, image: friendlyError(err) }))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    const link = url.trim() ? (linkFromText(url)?.url ?? null) : null
    if (url.trim() && !link) next.url = 'That doesn’t look like a web link. Check it, or leave it empty.'
    if (!title.trim()) next.title = 'Give your wish a name.'
    const img = imageUrl.trim() ? normalizeUrl(imageUrl) : null
    if (imageUrl.trim() && !img) next.image = 'That image link doesn’t work. Paste a full link starting with https://.'
    const priceText = price.replace(/[\s,]/g, '')
    const priceNum = priceText === '' ? null : Number(priceText)
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0 || priceNum >= 1e10)) next.price = 'Enter a price like 1499 or 39.90.'
    setErrors(next)
    if (Object.keys(next).length) return

    const draft: ItemDraft = {
      id: item?.id ?? null,
      title: title.trim().slice(0, 300),
      url: link,
      image_url: img,
      price: priceNum === null ? null : Math.round(priceNum * 100) / 100,
      currency,
      priority,
      notes: notes.trim() || null,
      occasions,
      circle_ids: circleIds,
    }
    try {
      const id = await save.mutateAsync(draft)
      // Still reading the page: finish in the background and fill the wish in afterwards.
      const read = pending.current
      if (!item && read && link) {
        handedOff.current = true
        const keep = { title: edited.current.title, price: edited.current.price || draft.price != null, image: edited.current.image || !!draft.image_url }
        fillWishLater(read, { ...draft, id }, keep).then((store) => {
          if (!store) return
          qc.invalidateQueries({ queryKey: ['items'] })
          toast(`Details added from ${store}.`)
        })
      }
      // Clean up uploads that ended up unused, and the old upload if it was replaced.
      uploaded.filter((u) => u !== img).forEach((u) => removePhoto(u))
      if (item?.image_url && item.image_url !== img && isUploadedPhoto(item.image_url)) removePhoto(item.image_url)
      if (!item) celebrate('wish-saved')
      toast(item ? 'Saved.' : circleIds.length ? 'Added to your list.' : 'Added. Only you can see it.')
      onClose()
    } catch (err) {
      setErrors({ form: friendlyError(err) })
    }
  }

  const preview: Item = {
    id: item?.id ?? 'new',
    owner_id: uid,
    title,
    url: null,
    image_url: imageUrl.trim() || null,
    domain: null,
    price: null,
    currency,
    original_price: null,
    priority,
    notes: null,
    created_at: item?.created_at ?? openedAt,
    occasions: [],
    circle_ids: [],
  }

  return (
    <Sheet title={item ? 'Edit wish' : 'Add a wish'} onClose={close}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Link"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          error={errors.url}
          hint={linkHint(reading, !item)}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={(e) => {
            // Store apps share "Product name https://...": keep the link, and use the words as the name.
            const text = e.clipboardData.getData('text')
            const found = linkFromText(text)
            if (found && text.trim() !== found.url) {
              e.preventDefault()
              setUrl(found.url)
              if (found.title && !edited.current.title) setTitle(found.title)
              if (!item) fillFromLink(found.url)
              return
            }
            if (item) return
            const el = e.currentTarget
            setTimeout(() => {
              const link = normalizeUrl(el.value)
              if (link) fillFromLink(link)
            })
          }}
          onBlur={() => {
            const found = url.trim() ? linkFromText(url) : null
            const link = found?.url ?? null
            if (link && link !== url.trim()) setUrl(link)
            if (link && !title.trim()) setTitle(found?.title ?? titleFromUrl(link))
            if (link && !item) fillFromLink(link)
          }}
        />
        {item && normalizeUrl(url) && reading.state !== 'reading' && (
          <div className="-mt-2 px-1">
            <Button variant="text" onClick={() => fillFromLink(normalizeUrl(url)!, true)}>
              Update from the store
            </Button>
          </div>
        )}
        <TextField
          label="Name"
          value={title}
          maxLength={300}
          error={errors.title}
          placeholder={reading.state === 'reading' ? 'Reading the page…' : undefined}
          onChange={(e) => {
            edited.current.title = true
            setTitle(e.target.value)
          }}
          required
        />

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
          <TextField label="Price" inputMode="decimal" placeholder="Optional" value={price} error={errors.price} onChange={(e) => {
              edited.current.price = true
              setPrice(e.target.value)
            }}
          />
          <SelectField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="priority" className="flex items-center justify-between gap-3 px-1 text-small font-semibold">
            <span>How much do you want it?</span>
            <span className="flex items-center gap-2 text-plum-soft">
              {priorityBand(priority)}
              <Hearts priority={priority} pop />
            </span>
          </label>
          <input
            id="priority"
            type="range"
            min={1}
            max={10}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            aria-valuetext={`${priority} of 10, ${priorityBand(priority)}`}
            className="h-6 w-full accent-plum"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 px-1 text-small font-semibold">Occasions</legend>
          <div className="flex flex-wrap gap-1.5">
            {OCCASIONS.map((o) => (
              <button key={o.value} type="button" className={chip} aria-pressed={occasions.includes(o.value)} onClick={() => setOccasions((x) => toggle(x, o.value))}>
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 px-1 text-small font-semibold">Photo</legend>
          <div className="flex items-start gap-3">
            <div className="w-20 shrink-0">
              <Photo item={preview} size="sheet" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => pickPhoto(e.target.files?.[0])} />
              <Button variant="ghost" busy={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? 'Uploading' : 'Upload a photo'}
              </Button>
              {imageUrl && (
                <Button
                  variant="text"
                  onClick={() => {
                    edited.current.image = true
                    setImageUrl('')
                  }}
                >
                  Remove photo
                </Button>
              )}
            </div>
          </div>
          <TextField
            label="Or paste an image link"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={isUploadedPhoto(imageUrl) ? '' : imageUrl}
            error={errors.image}
            hint={isUploadedPhoto(imageUrl) ? 'Using your uploaded photo.' : 'Right-click the product photo in the store and copy its image address.'}
            onChange={(e) => {
              edited.current.image = true
              setImageUrl(e.target.value)
            }}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 px-1 text-small font-semibold">Who can see it</legend>
          {circles.length ? (
            <div className="flex flex-wrap gap-1.5">
              {circles.map((c) => (
                <button key={c.id} type="button" className={chip} aria-pressed={circleIds.includes(c.id)} onClick={() => setCircleIds((x) => toggle(x, c.id))}>
                  {circleTitle(c, c.members, uid)}
                </button>
              ))}
            </div>
          ) : null}
          <p className="px-1 text-small text-plum-soft">
            {!circles.length
              ? 'Only you, for now. Start or join a Circle to share your list.'
              : circleIds.length
                ? 'People in the Circles you pick. Your other Circles won’t know it exists.'
                : 'Only you. Pick a Circle to share it.'}
          </p>
        </fieldset>

        <TextArea label="Notes" placeholder="Size, colour, anything that helps" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />

        {errors.form && <Notice tone="alert">{errors.form}</Notice>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" busy={save.isPending} disabled={uploading}>
            {item ? 'Save' : 'Add to my list'}
          </Button>
          <Button variant="text" onClick={close}>
            Cancel
          </Button>
        </div>

        {item && (
          <div className="mt-2 border-t border-blush pt-4">
            <ConfirmButton
              label="Mark received"
              question="Only once you have it: this shows you who gave it."
              confirmLabel="Mark received"
              busy={received.isPending}
              onConfirm={async () => {
                try {
                  flyHome(item.id)
                  const giver = await received.mutateAsync(item.id)
                  const who = giver?.name.split(/\s+/)[0]
                  toast(
                    !giver
                      ? 'Moved to Received.'
                      : giver.status === 'bought'
                        ? `Moved to Received. ${who} bought this for you.`
                        : `Moved to Received. ${who} had reserved this for you.`,
                  )
                  onClose()
                } catch (err) {
                  setErrors({ form: friendlyError(err) })
                }
              }}
            />
          </div>
        )}

        {item && (
          <div className="border-t border-blush pt-4">
            <ConfirmButton
              label="Delete wish"
              question="Delete it from your list and every Circle?"
              confirmLabel="Delete"
              variant="danger"
              busy={del.isPending}
              onConfirm={async () => {
                try {
                  await del.mutateAsync(item)
                  uploaded.forEach((u) => removePhoto(u))
                  toast('Deleted.')
                  onClose()
                } catch (err) {
                  setErrors({ form: friendlyError(err) })
                }
              }}
            />
          </div>
        )}
      </form>
    </Sheet>
  )
}

/** The line under the Link field while and after the page is read. */
function linkHint(r: { state: string; store?: string | null; reason?: string }, isNew: boolean) {
  const store = r.store ?? 'the store'
  if (r.state === 'reading') return isNew ? `Getting details from ${store}. You can save now.` : `Reading the page on ${store}…`
  if (r.state === 'done') return `Filled in from ${store}. Check it looks right.`
  if (r.state !== 'failed') return undefined
  if (r.reason === 'blocked') return `${store} doesn’t let us read its pages yet. Fill in the rest yourself.`
  if (r.reason === 'busy') return 'That’s a lot of links in a minute. Fill this one in, or try again shortly.'
  if (r.reason === 'offline') return 'You’re offline, so fill in the rest yourself.'
  return 'Couldn’t read that page. Fill in the rest yourself.'
}

/** Someone else's wish, read-only. */
export function ViewItemSheet({ item, ownerName, onClose }: { item: Item; ownerName: string; onClose: () => void }) {
  return (
    <Sheet title={`${ownerName}’s wish`} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[240px]">
          <Photo item={item} size="sheet" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-small text-plum-soft">{item.domain ?? storeOf(item.url) ?? 'No link'}</span>
          <p className="leading-tight font-semibold">{item.title}</p>
          <div className="flex items-center gap-3">
            <Price item={item} />
            <span className="flex items-center gap-1.5 text-small text-plum-soft">
              <Hearts priority={item.priority} />
              {priorityBand(item.priority)}
            </span>
          </div>
          {item.occasions.length > 0 && <span className="text-small text-plum-soft">{item.occasions.map(occasionLabel).join(', ')}</span>}
          {item.notes && <p className="mt-2 rounded-panel bg-blush px-4 py-3 text-small whitespace-pre-line">{item.notes}</p>}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-10 items-center self-start rounded-full bg-plum px-[18px] font-semibold text-white hover:bg-plum-hover"
            >
              Open in store
            </a>
          )}
        </div>
      </div>
    </Sheet>
  )
}
