import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false })
      // Never show one person's cached data to the next person on this device.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
