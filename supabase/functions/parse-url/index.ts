// parse-url: reads a store page from Supabase's servers.
// The Cloudflare Worker (/api/parse) calls this only when a store refuses Cloudflare,
// since some stores (FirstCry, Croma) let Supabase's addresses through.
// Signed-in users only; the caller's own session and the publishable key are passed through.

import { readPage } from '../_shared/parse.ts'

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })
  const auth = req.headers.get('authorization') ?? ''
  const apikey = req.headers.get('apikey') ?? ''
  if (!/^Bearer\s+\S+$/i.test(auth) || !apikey) return reply(401, { error: 'Sign in first.' })
  const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { authorization: auth, apikey } })
  if (!who.ok) return reply(401, { error: 'Sign in first.' })

  let url: unknown
  try {
    url = (await req.json()).url
  } catch {
    url = null
  }
  if (typeof url !== 'string' || url.length > 2000) return reply(400, { error: 'Send a link.' })
  return reply(200, await readPage(url, 'supabase'))
})
