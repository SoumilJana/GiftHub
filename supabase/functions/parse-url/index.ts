// parse-url: reads a store page from Supabase's servers.
// The Cloudflare Worker (/api/parse) calls this only when a store refuses Cloudflare,
// since some stores (FirstCry, Croma) let Supabase's addresses through.
// Only the Worker may call it: it sends the PARSE_URL_SECRET it shares with this function, after
// checking the session and the 30-a-minute limit. A direct call, even signed in, is refused,
// so nobody can skip that limit. No secret set here: refused too (the Worker then skips this step).
// The caller's own session is still checked as well.

import { readPage } from '../_shared/parse.ts'

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Same length and same bytes, compared without stopping early, so timing gives nothing away. */
function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })
  const secret = Deno.env.get('PARSE_URL_SECRET') ?? ''
  if (secret.length < 32 || !sameSecret(req.headers.get('x-gifthub-key') ?? '', secret)) return reply(403, { error: 'Not allowed.' })
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
