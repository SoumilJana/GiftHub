import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from './auth'
import { COLS, rows } from './items'
import { supabase } from './supabase'

export type ClaimStatus = 'reserved' | 'bought'

/** A claim as a giver sees it: the state, and whether it's yours. Never who else claimed it. */
export type Claim = { status: ClaimStatus; mine: boolean }
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
      for (const r of data as { item_id: string; status: ClaimStatus; mine: boolean }[]) map[r.item_id] = { status: r.status, mine: r.mine }
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
        if (status) next[itemId] = { status, mine: true }
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
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
