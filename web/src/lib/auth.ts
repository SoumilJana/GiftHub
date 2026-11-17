import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState = { session: Session | null; loading: boolean }

export const AuthContext = createContext<AuthState>({ session: null, loading: true })

export const useAuth = () => useContext(AuthContext)

/** The signed-in user's id. Only call inside screens that require sign-in. */
export function useUserId(): string {
  const { session } = useAuth()
  if (!session) throw new Error('useUserId called without a session')
  return session.user.id
}
