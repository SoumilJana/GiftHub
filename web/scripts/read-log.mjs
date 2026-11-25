// Live link reads from the Worker, one line each: time, store, result, steps, scrape.do credits.
// Run from web/ (needs `npx wrangler login`):  npm run logs
// Or read a saved `wrangler tail --format json` file:  npm run logs -- saved.jsonl
// Older reads (about 3 days) are in the Cloudflare dashboard: Workers > gifthub > Logs, search "read".
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

let buf = ''
function take(chunk) {
  buf += chunk
  // wrangler prints one JSON object per event, possibly over several lines.
  for (;;) {
    const start = buf.indexOf('{')
    if (start < 0) return
    let depth = 0, end = -1, inStr = false, esc = false
    for (let i = start; i < buf.length; i++) {
      const c = buf[i]
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
      if (c === '"') inStr = true
      else if (c === '{') depth++
      else if (c === '}' && --depth === 0) { end = i; break }
    }
    if (end < 0) return
    const text = buf.slice(start, end + 1)
    buf = buf.slice(end + 1)
    let ev
    try { ev = JSON.parse(text) } catch { continue }
    for (const log of ev.logs ?? []) {
      let r
      try { r = JSON.parse(log.message?.[0]) } catch { continue }
      if (!r?.read) continue
      const time = new Date(ev.eventTimestamp).toLocaleTimeString()
      const result = r.ok ? 'ok' : `FAILED (${r.reason})`
      const credits = r.scrapedo ? `  scrape.do: ${r.scrapedo.left} left${r.scrapedo.cost ? `, cost ${r.scrapedo.cost}` : ''}` : ''
      console.log(`${time}  ${r.read}  ${result}${r.cached ? ' (cached)' : ''}  ${(r.trail ?? []).join(' > ')}${credits}${log.level === 'warn' ? '  << LOW CREDITS' : ''}`)
    }
  }
}

const file = process.argv[2]
if (file) take(readFileSync(file, 'utf8'))
else {
  const tail = spawn('npx wrangler tail gifthub --format json', { shell: true })
  tail.stdout.on('data', take)
  tail.stderr.on('data', (d) => process.stderr.write(d))
  tail.on('exit', (code) => process.exit(code ?? 0))
  console.log('Watching link reads. Ctrl+C to stop.')
}
