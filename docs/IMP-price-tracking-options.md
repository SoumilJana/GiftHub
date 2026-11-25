# ⚠️ IMP — Price tracking: where to read prices from

**Written 25 Nov 2026. Read before building Phase 6 (price-drop alerts).** Nothing here is tested yet.

## The problem

Price-drop alerts need GiftHub to re-read every wish's store page on a schedule. Today's reader chain (built for "add a link") is:

1. **Cloudflare Worker** fetch — free, unlimited, but **Amazon now blocks it** (since about 24 Nov 2026). Flipkart still works.
2. **Supabase `parse-url` Edge Function** — free (500k calls/month), tried twice. Works for Amazon today (`cloudflare blocked > supabase ok`). Amazon could block Supabase's servers too, as it did Cloudflare's.
3. **scrape.do** — last resort, about **1,000 credits a month free** (1 credit per normal read, about 10 for residential proxies). Shared with "add a link", so price checks get a budget of about 300 a month.

At a few hundred wishes, checked daily, that's thousands of reads a month: steps 1–2 must carry nearly all of it, and scrape.do can't be the plan.

## Other options

| Option | What it is | Fit for GiftHub |
|---|---|---|
| **Amazon Creators API** (replaces PA-API) | Amazon's official product data, including prices, for Associates | **Best for Amazon.** No blocking, no scraping. Needs **10 qualifying sales in the last 30 days** on the Associates account before access. |
| **Flipkart Affiliate API** | Flipkart's product feed for affiliates, with prices | Good for Flipkart, if GiftHub joins Flipkart Affiliate. Check whether the program is accepting new members. |
| **Google Apps Script** | A free Google script that fetches pages (`UrlFetchApp`) from Google's servers on a timer | Another set of servers to spread checks across; generous daily quota. Amazon may block it too. |
| **Deno Deploy** | Free host like Cloudflare Workers, with cron | One more set of servers in the rotation. |
| **GitHub Actions** | Scheduled jobs on GitHub's servers; can run a real browser (Playwright) | Free, slow; fine for overnight batches. Amazon often blocks these servers. |
| **ScraperAPI / Crawlbase free tiers** | Services like scrape.do, about 1,000 requests a month each | Extra backup capacity when scrape.do runs out. Free tier, no card. |
| **The Android app (Phase 8)** | The user's own phone checks prices on its own connection | **Most reliable free route for Amazon**: stores don't block home and mobile connections. |

### Ruled out

- **Vercel Hobby (free)** — non-commercial use only; affiliate links make GiftHub commercial.
- **Oracle Cloud free servers** — sign-up needs a card; breaks the $0, no-card rule.
- **Keepa** (Amazon price history) — paid.

## Recommended plan

**Best combination:** Creators API for Amazon once eligible, Flipkart's API for Flipkart, and spread the rest across Cloudflare → Supabase → Apps Script / Deno Deploy, with scrape.do last.

**How the price checker should pace itself** (fold into Phase 6):

- **Start each store at the step that last worked** (e.g. Amazon straight to Supabase), instead of always trying Cloudflare first. Remember it per store; retry Cloudflare now and then in case the block lifts.
- **Pace Amazon:** a few checks a minute, spread through the day, not all at once.
- **Back off** when a store refuses: wait longer before the next try, don't hammer it.
- **Check by priority:** high-priority and soon-occasion wishes daily, the rest weekly. Claimed wishes stay on the same schedule (so nobody can tell a wish was claimed).
- **scrape.do only within its monthly budget** (about 300 credits for price checks), and never for a wish already checked this week.
- **Log every check** the same way `/api/parse` does (`npm run logs`), and watch scrape.do with `npm run scrapedo-usage`.

## Before relying on any of this

- Get 10 Amazon sales in 30 days → apply for Creators API access.
- Confirm the site address (`gifthub.grave07.workers.dev`) is listed in the Amazon Associates account.
- Check each free tier's current terms (they change); never sign up for anything that asks for a card.

Related: `Development Plan.md` → Phase 6; `docs/link-reading-2026-11-19.md`; `web/worker/index.ts`.
