# GiftHub — Zero-Cost Plan

How to build, launch and run GiftHub for **$0, permanently**: what's included, what's cut, the quotas that keep usage inside free limits, and what happens when those limits are reached.

> Limits below come from each provider's published free plans as of mid-2026. Re-check the pricing pages before launch — they change.

---

## 1. The Rules

1. **Every service runs on a free plan.** No paid plans, no "free trials".
2. **No payment method on any account** (Supabase, GitHub, Cloudflare, Resend, Sentry, PostHog). Without a card, nothing can bill — services stop at their limit instead of charging overage.
3. **The app enforces quotas** so normal use stays well under every limit (§4).
4. **At 80% of any limit, the app protects itself** (§6) instead of upgrading.

---

## 2. What's In and What's Out

| Feature | Status | Free approach |
|---|---|---|
| Accounts, Circles, invite codes | ✅ In | Supabase Auth + Postgres |
| Wishlists, priority, occasions, grid/list | ✅ In | Supabase |
| Secretly Bought with realtime | ✅ In | RLS + Supabase Realtime |
| Link parsing | ✅ In | Edge Function + GitHub Actions Playwright fallback + manual form |
| Installable PWA, offline mode | ✅ In | `vite-plugin-pwa` |
| Add from Android Share menu | ✅ In | PWA share target |
| Add from iOS Share menu | ✅ In | Apple Shortcut + quick-add token |
| Add from desktop | ✅ In | Bookmarklet; browser extension on Firefox/Edge add-on stores (free) |
| Push notifications | ✅ In | Web Push (VAPID) from Edge Function |
| Price tracking + sale badges | ✅ In | pg_cron + Edge Function, with frequency limits |
| Android app | ✅ Optional | Capacitor APK on GitHub Releases (+ F-Droid if open source) |
| Custom domain | ❌ Out | Use `gifthub.grave07.workers.dev` |
| Google Play / Apple App Store | ❌ Out | $25 / $99 per year |
| Chrome Web Store extension | ❌ Out | $5 fee → bookmarklet or GitHub-hosted extension instead |
| Paid scraping/proxy services | ❌ Out | Manual entry for sites that block requests |
| Email digests / marketing email | ❌ Out | Push notifications instead (email budget is tiny) |

---

## 3. Free Stack & Limits

| Need | Service | Free limit that matters |
|---|---|---|
| Database | Supabase Free | 500 MB |
| File storage | Supabase Free | 1 GB |
| Data transfer | Supabase Free | **5 GB egress/month** |
| Users | Supabase Free | 50k monthly active users |
| Realtime | Supabase Free | 200 concurrent connections |
| Server functions | Supabase Edge Functions | 500k invocations/month |
| Inactivity | Supabase Free | **Pauses after 7 days without activity** |
| Backups | Supabase Free | **None** |
| Code, issues, project board | GitHub Free | Unlimited private repos |
| CI + scheduled jobs | GitHub Actions | 2,000 min/month private repo — **unlimited if public** |
| Web hosting | Cloudflare Workers static assets | Free, unlimited static asset requests; Workers Builds minutes are capped on the free plan |
| Push | Web Push | No cost |
| Email | Resend Free | **100/day**, 3,000/month |
| Errors | Sentry Developer | ~5k errors/month |
| Analytics | PostHog Cloud | ~1M events/month |

**Tightest limits:** email (100/day), Supabase egress (5 GB/month) and realtime connections (200). The design below is built around these.

---

## 4. Quotas Enforced in the App

Enforced in the database (constraints/triggers or RPC checks), so they can't be bypassed from the browser. These are today's limits for everyone. From the public launch, Free and Pro plans replace the per-person ones (`Development Plan.md` → Phase 5.5): Free has 50 wishes, 5 Circles, 10 photos, 20 members and 15 link reads a day; Pro has 150, 15, 50, 50 and 30 or more. The global caps that keep the app inside free infrastructure still apply to everyone.

| Quota | Value | Protects |
|---|---|---|
| Active items per user | 150 | DB size, price-check budget |
| Circles per user | 10 | DB size |
| Members per Circle | 20 | Realtime fan-out |
| Photo uploads per user | 10, resized in-browser to ≤100 KB WebP | 1 GB storage |
| Link parses per user per day | 30 | Edge Function budget |
| Quick-add (Shortcut/bookmarklet) per user per day | 30 | Edge Function budget |
| Invite-code join attempts | 5 per hour per user | Brute force + functions |
| Price checks | Daily for priority ≥ 6, weekly otherwise; none for claimed/received items | Function budget |
| Global tracked-items cap | 10,000 | Function budget |
| Price history | Row written only when the price changes; kept 12 months | DB size |

---

## 5. Design Choices That Save Free Capacity

**Email (100/day)**
- Prefer Google sign-in and password login; magic links are optional.
- Email only for: signup confirmation, password reset. Everything else is push or in-app.
- Second free sender (e.g. Brevo, 300/day) for app emails sent from Edge Functions if Resend runs out.

**Egress (5 GB/month)**
- Product images load directly from retailers' servers — never through Supabase.
- Select only needed columns, paginate lists (30 items/page).
- TanStack Query caching + service-worker caching → repeat visits fetch only changes.
- Rough budget: ~50 KB per session → ~100k sessions/month.

**Realtime (200 concurrent)**
- Subscribe only while the Circle workspace is open and the tab is visible; unsubscribe on background.
- Fallback to refetch-on-focus if the connection is refused.

**Edge Functions (500k/month)**
- `parse_cache` for 24 h; same URL parsed once for everyone.
- Price checks batched (many items per invocation).
- Budget: ~10k tracked items checked on schedule ≈ 150k–200k/month, rest for app traffic.

**GitHub Actions (2,000 min/month on private repo)**
- Playwright jobs skip when the queue is empty; browsers cached.
- Make the repo public to get unlimited minutes (decision pending — see Development Plan, open question 6).

**Supabase pause & backups**
- Daily GitHub Actions keep-alive query.
- Nightly `pg_dump` → encrypted file committed to a separate private backup repo (keep 14 days).

---

## 6. When Limits Are Reached

The app monitors usage (admin `usage` page + a daily GitHub Actions check that opens a GitHub Issue as a warning).

| Level | Action |
|---|---|
| 60% of any limit | GitHub Issue warning; review quotas |
| 80% | **Waitlist mode:** new signups go to a waitlist; people joining an existing Circle by invite are still allowed |
| 90% egress or functions | Price checks drop to weekly for everything; parse fallback paused |
| 100% | Service stops for the rest of the month (no bill). Read-only offline cache keeps wishlists visible in the PWA |

**Estimated capacity on $0:** roughly **2,000–3,000 active users** in a few hundred Circles. Egress and email are the first limits to bind.

**If GiftHub outgrows free tiers**, the options are (none required):
- Accept the waitlist and grow slowly.
- Use revenue (affiliate links, premium features) to pay — which would end the $0 rule.
- Self-host Supabase on a free VM (e.g. Oracle Cloud Always Free). Free to run, but requires a card for identity verification and you manage the server yourself.

---

## 7. Phase-by-Phase Cost Check

| Phase | Cost | Notes |
|---|---|---|
| 0 Foundations | $0 | Includes usage page and no-card accounts |
| 1 Accounts & Circles | $0 | Resend SMTP; Google OAuth |
| 2 Wishlist Core | $0 | Quotas built here |
| 3 Secretly Bought (MVP, private beta) | $0 | |
| 4 Link Parsing | $0 | Some sites need manual entry |
| 5 PWA & Quick-Add (public launch) | $0 | `gifthub.grave07.workers.dev` |
| 6 Price Tracking | $0 | Frequency limits + global cap |
| 7 Growth | $0 | Firefox/Edge add-on stores, affiliate programs, Amazon Creators API once eligible (10 sales in 30 days) |
| 8 Android APK | $0 | GitHub Releases / F-Droid |

**Total: $0 to build, $0 to launch, $0/month to run.**
