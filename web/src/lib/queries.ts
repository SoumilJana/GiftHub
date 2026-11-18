import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import { supabase } from './supabase'

export type Role = 'owner' | 'admin' | 'member'

export type Profile = { id: string; display_name: string; avatar_url: string | null; currency: string }

export type CircleKind = 'couple' | 'group'

export type Circle = {
  id: string
  /** Null for a couple Circle that uses the automatic name ("You and Maya"). */
  name: string | null
  kind: CircleKind
  /** False until an older Circle of two or fewer has answered "Is this just the two of you?". */
  kind_confirmed: boolean
  invite_code: string
  invite_expires_at: string | null
  created_at: string
}

export type CirclePeek = { user_id: string; display_name: string }
export type MyCircle = Circle & { role: Role; memberCount: number; members: CirclePeek[] }

export type Member = { user_id: string; role: Role; joined_at: string; display_name: string; avatar_url: string | null }

const keys = {
  profile: (uid: string) => ['profile', uid] as const,
  circles: (uid: string) => ['circles', uid] as const,
  circle: (id: string) => ['circle', id] as const,
}

// The client is untyped (no generated DB types yet), so callers state the row shape.
function must<T>(result: { data: unknown; error: unknown }): T {
  if (result.error) throw result.error
  return result.data as T
}

// ---------------------------------------------------------------- profile

export function useProfile() {
  const { session } = useAuth()
  const uid = session?.user.id
  return useQuery({
    queryKey: keys.profile(uid ?? 'none'),
    enabled: !!uid,
    queryFn: async () =>
      must<Profile>(
        await supabase.from('profiles').select('id, display_name, avatar_url, currency').eq('id', uid!).single(),
      ),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, 'display_name' | 'currency'>>) => {
      must(await supabase.from('profiles').update(patch).eq('id', session!.user.id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      must(await supabase.rpc('delete_account'))
      await supabase.auth.signOut()
    },
  })
}

// ---------------------------------------------------------------- circles

type CircleRow = Circle & { circle_members: { user_id: string; joined_at: string; profiles: { display_name: string } | null }[] }

export function useMyCircles() {
  const { session } = useAuth()
  const uid = session?.user.id
  return useQuery({
    queryKey: keys.circles(uid ?? 'none'),
    enabled: !!uid,
    queryFn: async (): Promise<MyCircle[]> => {
      const rows = must<{ role: Role; circles: CircleRow | null }[]>(
        await supabase
          .from('circle_members')
          .select('role, circles(id, name, kind, kind_confirmed, invite_code, invite_expires_at, created_at, circle_members(user_id, joined_at, profiles(display_name)))')
          .eq('user_id', uid!)
          .order('joined_at'),
      )
      return rows
        .filter((r) => r.circles)
        .map(({ role, circles }) => {
          const { circle_members, ...circle } = circles!
          const members = [...circle_members]
            .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
            .map((m) => ({ user_id: m.user_id, display_name: m.profiles?.display_name ?? 'Someone' }))
          return { ...circle, role, memberCount: members.length || 1, members }
        })
    },
  })
}

export function useCircle(circleId: string | undefined) {
  return useQuery({
    queryKey: keys.circle(circleId ?? 'none'),
    enabled: !!circleId,
    queryFn: async (): Promise<{ circle: Circle; members: Member[] } | null> => {
      const [c, m] = await Promise.all([
        supabase.from('circles').select('id, name, kind, kind_confirmed, invite_code, invite_expires_at, created_at').eq('id', circleId!).maybeSingle(),
        supabase
          .from('circle_members')
          .select('user_id, role, joined_at, profiles(display_name, avatar_url)')
          .eq('circle_id', circleId!)
          .order('joined_at'),
      ])
      const circle = must<Circle | null>(c)
      if (!circle) return null // not a member (or it was deleted)
      const members = must<{ user_id: string; role: Role; joined_at: string; profiles: { display_name: string; avatar_url: string | null } | null }[]>(m)
      return {
        circle,
        members: members.map((x) => ({
          user_id: x.user_id,
          role: x.role,
          joined_at: x.joined_at,
          display_name: x.profiles?.display_name || 'New member',
          avatar_url: x.profiles?.avatar_url ?? null,
        })),
      }
    },
  })
}

function useCircleMutation<TVars, TResult = void>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['circles'] })
      qc.invalidateQueries({ queryKey: ['circle'] })
    },
  })
}

export const useCreateCircle = () =>
  useCircleMutation(async ({ name, kind }: { name: string | null; kind: CircleKind }) =>
    must<Circle>(await supabase.rpc('create_circle', { p_name: name, p_kind: kind })),
  )

/** Answer "Is this just the two of you?", or switch a Circle between couple and group. */
export const useSetCircleKind = () =>
  useCircleMutation(async ({ id, kind }: { id: string; kind: CircleKind }) =>
    must<Circle>(await supabase.rpc('set_circle_kind', { p_circle_id: id, p_kind: kind })),
  )

/** Resolves to the joined Circle, or null when the code doesn't match an open Circle. */
export const useJoinCircle = () =>
  useCircleMutation(async (code: string) => {
    const circle = must<Circle | null>(await supabase.rpc('join_circle', { p_code: code }))
    return circle && circle.id ? circle : null
  })

export const useRenameCircle = () =>
  useCircleMutation(async ({ id, name }: { id: string; name: string | null }) => {
    must(await supabase.from('circles').update({ name }).eq('id', id))
  })

export const useRegenerateCode = () =>
  useCircleMutation(async (id: string) => must<string>(await supabase.rpc('regenerate_invite_code', { p_circle_id: id })))

export const useSetCodeExpiry = () =>
  useCircleMutation(async ({ id, expiresAt }: { id: string; expiresAt: string | null }) => {
    must(await supabase.from('circles').update({ invite_expires_at: expiresAt }).eq('id', id))
  })

export const useRemoveMember = () =>
  useCircleMutation(async ({ circleId, userId }: { circleId: string; userId: string }) => {
    must(await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', userId))
  })

export const useSetRole = () =>
  useCircleMutation(async ({ circleId, userId, role }: { circleId: string; userId: string; role: 'admin' | 'member' }) => {
    must(await supabase.rpc('set_member_role', { p_circle_id: circleId, p_user_id: userId, p_role: role }))
  })

export const useTransferOwnership = () =>
  useCircleMutation(async ({ circleId, userId }: { circleId: string; userId: string }) => {
    must(await supabase.rpc('transfer_ownership', { p_circle_id: circleId, p_new_owner: userId }))
  })

export const useDeleteCircle = () =>
  useCircleMutation(async (id: string) => {
    must(await supabase.from('circles').delete().eq('id', id))
  })

export const roleLabel: Record<Role, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

/** True when an invite code has an expiry date in the past. */
export function isCodeExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt !== null && new Date(expiresAt) < now
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

/**
 * What to call a Circle. A couple Circle without its own name is "You and Maya",
 * from each partner's side; before the partner joins it's "Your couple Circle".
 */
export function circleTitle(
  circle: Pick<Circle, 'name' | 'kind'>,
  people: { user_id: string; display_name: string }[] = [],
  myId?: string,
): string {
  if (circle.name) return circle.name
  const partner = people.find((p) => p.user_id !== myId && p.display_name.trim())
  return partner ? `You and ${firstName(partner.display_name)}` : 'Your couple Circle'
}

/** A Circle inside a sentence: its name, or the partner's first name for an unnamed couple Circle. */
export function circleRef(
  circle: Pick<Circle, 'name' | 'kind'>,
  people: { user_id: string; display_name: string }[] = [],
  myId?: string,
): string {
  if (circle.name) return circle.name
  const partner = people.find((p) => p.user_id !== myId && p.display_name.trim())
  return partner ? firstName(partner.display_name) : 'your partner'
}

/** The other person in a couple Circle, if they've joined. */
export const partnerOf = <T extends { user_id: string }>(people: T[], myId?: string) => people.find((p) => p.user_id !== myId)
