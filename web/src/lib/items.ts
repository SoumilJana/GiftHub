import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import { removePhoto } from './photo'
import { supabase } from './supabase'
import type { Item, Occasion } from './wishlist'

const COLS = 'id, owner_id, title, url, image_url, domain, price, currency, original_price, priority, notes, created_at, item_occasions(occasion)'

type Row = Omit<Item, 'occasions' | 'circle_ids' | 'price' | 'original_price'> & {
  price: number | string | null
  original_price: number | string | null
  item_occasions: { occasion: Occasion }[]
  item_circles: { circle_id: string }[]
}

const num = (v: number | string | null) => (v === null ? null : Number(v))

function toItem({ item_occasions, item_circles, ...r }: Row): Item {
  return {
    ...r,
    currency: r.currency.trim(),
    price: num(r.price),
    original_price: num(r.original_price),
    occasions: item_occasions.map((o) => o.occasion),
    circle_ids: item_circles.map((c) => c.circle_id),
  }
}

function rows(result: { data: unknown; error: unknown }): Item[] {
  if (result.error) throw result.error
  return (result.data as Row[]).map(toItem)
}

/** Your own active wishes, with every Circle each one is shared with. */
export function useMyItems() {
  const { session } = useAuth()
  const uid = session?.user.id
  return useQuery({
    queryKey: ['items', 'mine', uid ?? 'none'],
    enabled: !!uid,
    queryFn: async () =>
      rows(
        await supabase
          .from('items')
          .select(`${COLS}, item_circles(circle_id)`)
          .eq('owner_id', uid!)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ),
  })
}

/** Everyone's active wishes shared with one Circle (only that Circle's sharing is visible). */
export function useCircleItems(circleId: string | undefined) {
  return useQuery({
    queryKey: ['items', 'circle', circleId ?? 'none'],
    enabled: !!circleId,
    queryFn: async () =>
      rows(
        await supabase
          .from('items')
          .select(`${COLS}, item_circles!inner(circle_id)`)
          .eq('item_circles.circle_id', circleId!)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ),
  })
}

export type ItemDraft = {
  id: string | null
  title: string
  url: string | null
  image_url: string | null
  price: number | null
  currency: string
  priority: number
  notes: string | null
  occasions: Occasion[]
  circle_ids: string[]
}

function useItemMutation<TVars, TResult = void>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }) })
}

export const useSaveItem = () =>
  useItemMutation(async (d: ItemDraft) => {
    const { data, error } = await supabase.rpc('save_item', {
      p_id: d.id,
      p_title: d.title,
      p_url: d.url,
      p_image_url: d.image_url,
      p_price: d.price,
      p_currency: d.currency,
      p_priority: d.priority,
      p_notes: d.notes,
      p_occasions: d.occasions,
      p_circle_ids: d.circle_ids,
    })
    if (error) throw error
    return data as string
  })

export const useDeleteItem = () =>
  useItemMutation(async (item: Pick<Item, 'id' | 'image_url'>) => {
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) throw error
    if (item.image_url) await removePhoto(item.image_url)
  })

export const useShareMyItems = () =>
  useItemMutation(async (circleId: string) => {
    const { data, error } = await supabase.rpc('share_my_items', { p_circle_id: circleId })
    if (error) throw error
    return data as number
  })
