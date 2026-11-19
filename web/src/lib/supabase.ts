import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy web/.env.example to web/.env.local and fill them in.')
}

export const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // React Query already retries once; the client's own 3 retries on top made a dropped
  // connection sit on "Loading…" for ~18 s before saying so.
  db: { retry: false },
})
