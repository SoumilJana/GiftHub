// report-bug: saves a bug report from a signed-in user and emails it to the owner.
//
// Secrets (supabase secrets set ...):
//   RESEND_API_KEY   Resend API key. Without it, reports are saved but not emailed.
//   BUG_REPORT_TO    Where reports are emailed (defaults to the contact address).
// Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const DAILY_LIMIT = 5
const KEEP_DAYS = 365
const MAX_SCREENSHOT_BYTES = 400_000
const ALLOWED_ORIGINS = new Set(['https://gifthub.grave07.workers.dev', 'http://localhost:5173', 'http://localhost:5174'])

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://gifthub.grave07.workers.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const clip = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' }
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })

  // Who is sending it?
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply(401, { error: 'Sign in to report a problem.' })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user) return reply(401, { error: 'Sign in to report a problem.' })
  const user = auth.user

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'That report couldn’t be read.' })
  }
  const what = clip(body.what_happened, 4000)
  if (!what) return reply(400, { error: 'Say what happened.' })

  // Daily limit per person.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { count } = await admin.from('bug_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since)
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: 'You’ve sent 5 reports today. Thank you! Please try again tomorrow.' })

  // Optional screenshot, sent as base64 WebP/PNG/JPEG.
  let screenshotPath: string | null = null
  let screenshotB64: string | null = null
  const shot = typeof body.screenshot === 'string' ? body.screenshot : null
  const shotType = typeof body.screenshot_type === 'string' ? body.screenshot_type : 'image/webp'
  if (shot && ['image/webp', 'image/png', 'image/jpeg'].includes(shotType)) {
    const bytes = Uint8Array.from(atob(shot), (c) => c.charCodeAt(0))
    if (bytes.byteLength > MAX_SCREENSHOT_BYTES) return reply(413, { error: 'That screenshot is too large.' })
    const ext = shotType.split('/')[1]
    screenshotPath = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await admin.storage.from('bug-screenshots').upload(screenshotPath, bytes, { contentType: shotType })
    if (error) screenshotPath = null
    else screenshotB64 = shot
  }

  const report = {
    user_id: user.id,
    what_happened: what,
    expected: clip(body.expected, 2000),
    page: clip(body.page, 500),
    app_version: clip(body.app_version, 60),
    device: clip(body.device, 500),
    screenshot_path: screenshotPath,
  }
  const { data: saved, error: saveError } = await admin.from('bug_reports').insert(report).select('id, created_at').single()
  if (saveError || !saved) return reply(500, { error: 'The report couldn’t be saved. Please try again.' })

  // Email it to the owner. A failure here still leaves the report saved.
  let emailed = false
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (apiKey) {
    const text = [
      `From: ${user.email ?? 'unknown'} (${user.id})`,
      `When: ${saved.created_at}`,
      `Page: ${report.page ?? '-'}`,
      `App version: ${report.app_version ?? '-'}`,
      `Device: ${report.device ?? '-'}`,
      '',
      'What happened:',
      report.what_happened,
      '',
      'What they expected:',
      report.expected ?? '-',
      '',
      `Report id: ${saved.id}`,
    ].join('\n')
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'GiftHub bug reports <onboarding@resend.dev>',
          to: [Deno.env.get('BUG_REPORT_TO') ?? 'janasoumil1005@gmail.com'],
          reply_to: user.email ?? undefined,
          subject: `GiftHub bug: ${report.what_happened.slice(0, 60)}`,
          text,
          attachments: screenshotB64 ? [{ filename: screenshotPath!.split('/').pop(), content: screenshotB64 }] : undefined,
        }),
      })
      emailed = res.ok
    } catch {
      emailed = false
    }
    if (emailed) await admin.from('bug_reports').update({ emailed: true }).eq('id', saved.id)
  }

  // Housekeeping: reports are kept for up to a year (Privacy Policy).
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 3600_000).toISOString()
  const { data: old } = await admin.from('bug_reports').delete().lt('created_at', cutoff).select('screenshot_path')
  const oldShots = (old ?? []).map((r) => r.screenshot_path).filter((p): p is string => !!p)
  if (oldShots.length) await admin.storage.from('bug-screenshots').remove(oldShots)

  return reply(200, { id: saved.id, emailed })
})
