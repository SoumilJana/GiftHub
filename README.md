# GiftHub

A private shared wishlist for couples, friends and families. Each person keeps their own list and shares it with the Circles they choose. Others can secretly reserve or buy a gift, and the list's owner never sees who.

Live: https://gifthub.grave07.workers.dev · Budget: $0, free plans only.

## What's in the app

- **Accounts and Circles:** sign in with Google, email and password, or an email link. A Circle is a couple (two people, "You and Maya") or a group. People join with a 6-letter code or a `/join/CODE` link.
- **Wishlists:** paste a link and the name, price and photo fill themselves in from the store page (Amazon.in, Flipkart, Shopify shops, Decathlon and more; stores that refuse get a pre-filled form). Each wish has priority hearts, occasions, notes and a choice of Circles that can see it.
- **Secretly Bought:** reserve or buy someone's wish. Other givers see "Already claimed"; the owner sees nothing until they mark it received.
- **Gift hand-off:** the giver picks a date, GiftHub asks "Did you give it?", and the receiver confirms.
- **Help, Privacy, Terms, Cookies** and an in-app bug report.
- **Motion:** sheets rise, new wishes print out, received gifts fly to Received. Profile → "Fewer animations" turns it down (also automatic when the phone asks for reduced motion).

The full plan, with what is built and live, is in [Development Plan.md](Development%20Plan.md). Design rules are in [DESIGN.md](DESIGN.md), product rules in [PRODUCT.md](PRODUCT.md), and the latest handover in [docs/](docs/).

## How it's built

| Part | Where | Notes |
|---|---|---|
| Web app (PWA) | `web/` | React 19, Vite, TypeScript, TanStack Router and Query, Tailwind 4 |
| Hosting and `/api` | `web/wrangler.jsonc`, `web/worker/` | Cloudflare Workers. Static files are served directly; only `/api/*` runs the Worker (link reading). Optional secret `SCRAPEDO_TOKEN` enables the scrape.do retry for stores that refuse |
| Database, sign-in, storage | `supabase/` | Supabase Postgres with row-level security on every table; all claim access goes through database functions |
| Edge Functions | `supabase/functions/` | `report-bug` (bug reports, emailed through Resend) and `parse-url` (link-reading retry from Supabase's servers) |
| Shared link parser | `supabase/functions/_shared/parse.ts` | Used by both the Worker and `parse-url` |

Privacy is enforced in the database, not the app: `supabase/rls-tests` checks it against a real Postgres (PGlite), along with edge cases such as two people claiming the same wish at once.

Sign-up, sign-in, email links and password resets carry a Cloudflare Turnstile token, which Supabase checks. The public site key is in `web/src/lib/turnstile.ts`; locally, set `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (Cloudflare's always-pass test key) in `web/.env.local` if the real key refuses `localhost`.

## Running it locally

Needs Node 24.

1. Copy `web/.env.example` to `web/.env.local` and fill in the Supabase URL and **publishable** key (never the secret key).
2. From `web/`:

```bash
npm install
```

```bash
npm run dev
```

The app runs on http://localhost:5173. Link reading calls `/api/parse`, which Vite passes to the Worker. To use it locally, build once and start the Worker in a second terminal (from `web/`):

```bash
npm run build
```

```bash
npx wrangler dev --port 8787
```

## Checks

From `web/` (CI runs all four on every push):

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

Database privacy and edge-case checks, from `supabase/rls-tests/`:

```bash
npm test
```

## Deploying

- **Web app and Worker:** every push to `main` deploys through Cloudflare Workers Builds. That build doesn't see `web/.env.local`, so anything the live app needs at build time must be in the code or in the Workers Builds settings. A manual `npx wrangler deploy` from `web/` is replaced by the next push.
- **Database:** from the repository root, after checking the migration:

```bash
npx supabase db push --remote
```

- **Edge Functions:** from the repository root, for example:

```bash
npx supabase functions deploy parse-url --use-api
```

Apply a migration before pushing app code that needs it.

Page security headers (Content Security Policy and others) are in `web/public/_headers`. A new outside script, frame or connection must be added there, or the browser blocks it.

## Watching link reads

Each link read writes one line to Workers Logs: the store, how each step ended (Cloudflare, then Supabase up to twice, then scrape.do) and, when scrape.do ran, its credits left. From `web/`:

```bash
npm run logs                      # live, one line per read
npm run logs -- saved.jsonl       # a saved `wrangler tail --format json` file
```

Older reads (about 3 days) are in the Cloudflare dashboard under Workers > gifthub > Logs; search for `read`. Fewer than 100 scrape.do credits left logs a warning.

scrape.do's monthly allowance (10 checks a minute at most; the token is never printed):

```powershell
$env:SCRAPEDO_TOKEN = '<your token>'; npm run scrapedo-usage
```

## Rules

- No paid services. Free tiers are fine.
- The Supabase secret (service role) key is only used inside Edge Functions, never in the app.
- `web/.env.local` is never committed.
