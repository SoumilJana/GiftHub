# Scripts

## link-test.mjs

Sends every link in `links.txt` to the live link reader, exactly as the app does, and prints how many came back with a name, photo and price (Phase 4's target is 80%).

It needs your own sign-in token, because `/api/parse` only answers signed-in people. The token lasts about an hour, is only sent to GiftHub's own site, and the script never prints or saves it.

1. Sign in on https://gifthub.grave07.workers.dev in your browser.
2. Open the browser console (F12 → Console) and run:

   ```js
   copy(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('-auth-token')))).access_token)
   ```

   The token is now on your clipboard.
3. In PowerShell, from `web/`:

   ```powershell
   $env:GIFTHUB_TOKEN = Get-Clipboard
   node scripts/link-test.mjs
   ```

New links are spaced 2.2 s apart to stay under 30 a minute, so about 80 links take 3 to 4 minutes. Stores that refuse are retried through Supabase and then scrape.do, which uses some of the free scrape.do credits. Results are saved to `.scratch/link-test-results.json`.
