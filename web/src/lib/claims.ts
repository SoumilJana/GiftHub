import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from './auth'
import { COLS, rows } from './items'
import { supabase } from './supabase'

export type ClaimStatus = 'reserved' | 'bought'

/**
 * A claim as a giver sees it: the state, and whether it's yours. Never who else
 * claimed it. `giveOn` (YYYY-MM-DD) is the day you plan to give it, set only on your own claims.
 */
export type Claim = { status: ClaimStatus; mine: boolean; giveOn?: string | null }
export type ClaimMap = Record<string, Claim>

const claimsKey = (circleId: string) => ['claims', circleId] as const

/**
 * Claims on other people's wishes in one Circle. The database never returns
 * claims on your own wishes, so this is safe to call from any Circle page.
 */
export function useCircleClaims(circleId: string | undefined) {
  return useQuery({
    queryKey: claimsKey(circleId ?? 'none'),
    enabled: !!circleId,
    queryFn: async (): Promise<ClaimMap> => {
      const { data, error } = await supabase.rpc('circle_claims', { p_circle_id: circleId })
      if (error) throw error
      const map: ClaimMap = {}
      for (const r of data as { item_id: string; status: ClaimStatus; mine: boolean; give_on: string | null }[]) {
        map[r.item_id] = { status: r.status, mine: r.mine, giveOn: r.give_on }
      }
      return map
    },
  })
}

/**
 * Live updates: refetch the Circle's claims when anyone claims or unclaims in it.
 * The signal carries only the Circle id, and the database never sends one to the
 * owner of the wish that changed.
 */
export function useClaimSignals(circleId: string | undefined) {
  const qc = useQueryClient()
  const { session } = useAuth()
  const uid = session?.user.id
  useEffect(() => {
    if (!circleId || !uid) return
    const channel = supabase
      .channel(`claims:${circleId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'claim_signals', filter: `circle_id=eq.${circleId}` }, () =>
        qc.invalidateQueries({ queryKey: claimsKey(circleId) }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [circleId, uid, qc])
}

/** Reserve, mark bought (status), or undo (null). Updates the frame straight away. */
export function useSetClaim(circleId: string) {
  const qc = useQueryClient()
  const key = claimsKey(circleId)
  return useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: ClaimStatus | null }) => {
      const { error } = status
        ? await supabase.rpc('claim_item', { p_item_id: itemId, p_status: status })
        : await supabase.rpc('unclaim_item', { p_item_id: itemId })
      if (error) throw error
    },
    onMutate: async ({ itemId, status }) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<ClaimMap>(key)
      qc.setQueryData<ClaimMap>(key, (old = {}) => {
        const next = { ...old }
        if (status) next[itemId] = { status, mine: true, giveOn: status === 'bought' ? (old[itemId]?.giveOn ?? null) : null }
        else delete next[itemId]
        return next
      })
      return { before }
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(key, ctx?.before),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

// ---------------------------------------------------------------- received

export type Giver = { name: string; status: ClaimStatus }

/** Moves one of your wishes to Received. Resolves to who gave it, or null. */
export function useMarkReceived() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string): Promise<Giver | null> => {
      const { data, error } = await supabase.rpc('mark_received', { p_item_id: itemId })
      if (error) throw error
      const row = (data as { giver_name: string | null; claim_status: ClaimStatus }[])[0]
      return row ? { name: row.giver_name || 'Someone', status: row.claim_status } : null
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['handoff'] })
    },
  })
}

/** Your received wishes and, for each, who gave it. */
export function useReceived() {
  const { session } = useAuth()
  const uid = session?.user.id
  return useQuery({
    queryKey: ['items', 'received', uid ?? 'none'],
    enabled: !!uid,
    queryFn: async () => {
      const [items, givers] = await Promise.all([
        supabase
          .from('items')
          .select(`${COLS}, item_circles(circle_id)`)
          .eq('owner_id', uid!)
          .eq('status', 'received')
          .order('updated_at', { ascending: false }),
        supabase.rpc('my_received'),
      ])
      if (givers.error) throw givers.error
      const byItem: Record<string, Giver> = {}
      for (const g of givers.data as { item_id: string; giver_name: string | null; claim_status: ClaimStatus }[]) {
        byItem[g.item_id] = { name: g.giver_name || 'Someone', status: g.claim_status }
      }
      return { items: rows(items), givers: byItem }
    },
  })
}

export function useReturnToList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('items').update({ status: 'active' }).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

// ---------------------------------------------------------------- hand-off

/** Today on this device, as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "24 November" (or "24 Nov") from YYYY-MM-DD, read as a local date. */
export function dayLabel(iso: string, month: 'long' | 'short' = 'long'): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month })
}

/** The giver picks (or clears) the day they'll give a gift. */
export function useSetGiveDate(circleId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, giveOn }: { itemId: string; giveOn: string | null }) => {
      const { error } = await supabase.rpc('set_give_date', { p_item_id: itemId, p_give_on: giveOn })
      if (error) throw error
    },
    onSuccess: () => {
      if (circleId) qc.invalidateQueries({ queryKey: claimsKey(circleId) })
      else qc.invalidateQueries({ queryKey: ['claims'] })
      qc.invalidateQueries({ queryKey: ['handoff'] })
    },
  })
}

export type DueGift = { itemId: string; title: string; ownerName: string; giveOn: string }

/** Gifts you bought whose give date has passed: "Did you give it?" */
export function useDueGifts() {
  const { session } = useAuth()
  const uid = session?.user.id
  const today = localDate()
  return useQuery({
    queryKey: ['handoff', 'due', uid ?? 'none', today],
    enabled: !!uid,
    queryFn: async (): Promise<DueGift[]> => {
      const { data, error } = await supabase.rpc('my_due_gifts', { p_today: today })
      if (error) throw error
      return (data as { item_id: string; title: string; owner_name: string | null; give_on: string }[]).map((r) => ({
        itemId: r.item_id,
        title: r.title,
        ownerName: r.owner_name || 'them',
        giveOn: r.give_on,
      }))
    },
  })
}

/** The giver confirms the hand-off; the receiver is then asked if they got it. */
export function useMarkGiven() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc('mark_given', { p_item_id: itemId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handoff'] })
      qc.invalidateQueries({ queryKey: ['claims'] })
    },
  })
}

export type ReceivedPrompt = { id: string; itemId: string; title: string; giverName: string }

/** "Did you get it?" questions about your own wishes, after a giver said they handed it over. */
export function useReceivedPrompts() {
  const { session } = useAuth()
  const uid = session?.user.id
  return useQuery({
    queryKey: ['handoff', 'prompts', uid ?? 'none'],
    enabled: !!uid,
    queryFn: async (): Promise<ReceivedPrompt[]> => {
      const { data, error } = await supabase.rpc('received_prompts')
      if (error) throw error
      return (data as { id: string; item_id: string; title: string; giver_name: string | null }[]).map((r) => ({
        id: r.id,
        itemId: r.item_id,
        title: r.title,
        giverName: r.giver_name || 'Someone',
      }))
    },
  })
}

export function useDismissPrompt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('dismiss_prompt', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handoff'] }),
  })
}
