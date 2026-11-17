# GiftHub — Development Plan (Web + PWA first)

Companion to *Wishlist App Product Plan.md*. This document turns the concept into build phases, each with a goal, scope, deliverables and an exit test ("done when").

**Release strategy:** ship a responsive **web app that installs as a PWA**. An Android APK built from the same code is an optional later phase.

**Budget constraint: $0, permanently.** Every service runs on a free plan, no payment method is ever added to any account (so nothing can bill by surprise), and the app enforces usage quotas to stay inside the free limits. See *Free Tier Build Plan.md* for the limits, quotas and what happens if they're reached.

---

## 0. Key Decisions (locked)

| Decision | Choice | Reason |
|---|---|---|
| Backend | **Supabase** — Postgres, Auth, Row Level Security, Realtime, Edge Functions, pg_cron, Storage | Relational data; RLS enforces the "Secretly Bought" privacy rule in the database |
| Code, CI, automation | **GitHub** — repo, Actions (CI, deploys, scheduled jobs), Issues/Projects for tracking | One place for code and automation |
| Frontend | **React + Vite + TypeScript** (single-page app) | Supabase is the backend, so no server framework is needed; fast builds, simple hosting |
| Routing | TanStack Router (or React Router) | Type-safe routes |
| UI | Tailwind CSS + shadcn/ui | Accessible components, mobile-first styling |
| Data | TanStack Query + supabase-js | Caching, optimistic updates, realtime invalidation |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, service worker, offline cache, update prompts |
| Hosting | **Cloudflare Workers (static assets)**, auto-deployed from GitHub via Workers Builds; config in `web/wrangler.jsonc` | Free, unlimited bandwidth, commercial use allowed, preview URL per pull request |
| Push | Web Push (VAPID) sent from a Supabase Edge Function | No third-party service |
| Email | Resend (SMTP for Supabase Auth + notifications) | Free tier covers early stage |
| Monitoring | Sentry + PostHog | Free tiers cover early stage |
| Domain | `gifthub.grave07.workers.dev` (free Cloudflare subdomain) | No domain purchase |
| Later Android app | **Capacitor** APK published on GitHub Releases | Reuses ~100% of the code; no Play Store fee |
| Not used | Paid scraping APIs, app stores, paid domains, Chrome Web Store | All cost money |

**Hosting note:** GitHub Pages was considered. Cloudflare Pages wins because GitHub Pages' terms exclude commercial SaaS use, it can't set custom headers (needed for service-worker and security headers), and SPA routing there needs a 404 workaround. Code still lives on GitHub; Cloudflare just builds from it.

### Core privacy rule (non-negotiable)
> A user must **never receive** claim data for their own items — not hidden in the UI, but absent from every API response.

This is enforced by RLS on the `claims` table, never by front-end logic.

---

## 1. Data Model (initial)

```
profiles           (id → auth.users, display_name, avatar_url, currency, created_at)
circles            (id, name, invite_code UNIQUE, invite_expires_at, created_by, created_at)
circle_members     (circle_id, user_id, role: owner|admin|member, joined_at)   PK(circle_id,user_id)
items              (id, owner_id, title, url, image_url, domain, price, currency,
                    original_price, priority 1–10, notes, status: active|received|archived,
                    created_at, updated_at)
item_circles       (item_id, circle_id)            -- which Circles can see the item
item_occasions     (item_id, occasion)             -- Anniversary, Birthday, Holiday, Valentine's, Just Because
claims             (id, item_id UNIQUE, claimed_by, status: reserved|bought, created_at)
price_history      (id, item_id, price, checked_at)
parse_cache        (url_hash, payload jsonb, fetched_at)
parse_jobs         (id, url, item_id, status, attempts, created_at)   -- fallback queue
push_subscriptions (id, user_id, endpoint, keys jsonb, user_agent, created_at)
quick_add_tokens   (id, user_id, token_hash, label, created_at, revoked_at)  -- bookmarklet / iOS Shortcut
notifications      (id, user_id, type, payload, read_at)
```

### RLS summary
- **items**: owner sees own; others see an item if they share a Circle listed in `item_circles`.
- **claims**: readable only if the viewer can see the item **AND** `items.owner_id <> auth.uid()`. Insert allowed under the same condition; update/delete only by `claimed_by`.
- **circle_members**: visible to members of the same Circle.
- **circles**: joining only through an RPC (`join_circle(code)`) that checks the code, expiry and a rate limit — never a direct insert.
- **push_subscriptions / quick_add_tokens**: owner only.

Clarified behaviour:
- An item can be shared to several Circles. A claim belongs to the **item**, so every non-owner who can see it, in any Circle, sees the claim (prevents double-buying across groups).
- When the owner marks an item **Received**, the claim is revealed to them ("Bought by Sam 🎁").

---

## 2. Phases

Estimates assume **one developer, part-time (~15–20 h/week)**. Halve them for full-time.

### Phase 0 — Foundations (1–2 weeks)
**Goal:** a deployable, installable skeleton from day one.

Scope
- GitHub repo: `web/` (Vite app), `supabase/` (migrations, functions, tests). Branch protection on `main`.
- Supabase project + local development with the Supabase CLI (Docker); migrations committed to git.
- Vite + React + TS strict, Tailwind, shadcn/ui, routing, layout shell (bottom nav on mobile, sidebar on desktop).
- **Basic PWA:** web manifest, icons, theme colour, service worker caching the app shell → installable from the start.
- GitHub Actions: typecheck, lint, unit tests, DB migration check on every PR.
- Cloudflare Workers Builds connected to GitHub: production deploy on `main`, preview URL on every PR.
- Sentry + PostHog wired in (with sampling so they stay within free quotas). Environment variables documented in `.env.example`.
- Accounts created **without any payment method**. A `usage` admin page reading Supabase stats (DB size, MAU, function calls) so limits are visible early.

Deliverables: empty app live at `gifthub.grave07.workers.dev`, installable on Android and desktop; schema v1 migrated.

Done when: merging to `main` deploys automatically, and the app installs to a phone home screen.

---

### Phase 1 — Accounts & Circles (2 weeks)
**Goal:** users can sign up and form groups with invite codes.

Scope
- Auth: email + password, magic link, Google sign-in. Custom SMTP via Resend.
- Profile setup (name, avatar, preferred currency). Account deletion.
- Create Circle → 6-char code from an unambiguous alphabet (no `0/O/1/I`), e.g. `K7QX3M`.
- Join Circle by code: during onboarding, from the dashboard, or via link `gifthub.app/join/K7QX3M`.
- Multiple Circles per user, Circle switcher.
- Circle management: rename, regenerate code, set code expiry, remove member, leave, transfer ownership.
- Invite sharing via the Web Share API (falls back to copy-to-clipboard on desktop).

Deliverables: onboarding flow, Circle list, Circle settings screen.

Done when: 3 test accounts can create/join 2 overlapping Circles, and a removed member immediately loses access (verified by automated RLS tests).

---

### Phase 2 — Wishlist Core (2–3 weeks)
**Goal:** users can build and browse wishlists by hand (no scraping yet).

Scope
- Add/edit/delete items: title, URL, image (upload or URL), price, currency, notes.
- Priority 1–10 in bands: 9–10 *Must have*, 6–8 *Would love*, 1–5 *Nice to have*.
- Occasion tags + filters.
- Per-item Circle visibility (default: all my Circles).
- Circle workspace: a tab per member showing that member's list.
- Views: **Grid** (masonry, image-first) and **List** (compact table); choice remembered per device.
- Sort (priority, price, newest) and filter (occasion, price range, priority band).
- Responsive from 360 px phones to desktop.
- **Free-tier quotas** enforced in the database: max items per user, max Circles per user, max members per Circle, upload size cap (see *Free Tier Build Plan.md* §4).
- Images: retailer image URLs stored as links; user uploads resized in the browser to ≤100 KB WebP.

Deliverables: My Wishlist screen, Circle workspace, item detail sheet.

Done when: a user can add 20 items and tag them, and a Circle member sees exactly the items shared to that Circle.

---

### Phase 3 — "Secretly Bought" (1–2 weeks) → **MVP milestone**
**Goal:** the core differentiator works and is provably private.

Scope
- Claim states: **Reserved** (planning to buy) and **Bought**. The claimer can undo.
- Realtime: other members see a claim within ~1 s (Supabase Realtime).
- The owner's view never changes; the owner cannot fetch claims (RLS).
- "Mark as Received" by the owner → reveals the giver and moves the item to a *Received* archive.
- Automated RLS test suite (pgTAP) in GitHub Actions covering every claim-visibility case.

Deliverables: claim buttons, claimed badges, received archive.

Done when: RLS tests pass, and with the owner signed in on a second device, nothing changes on their screen — and no claim data appears in their network traffic — while others claim.

**→ Private beta** with 5–10 couples/friend groups on the live web app.

---

### Phase 4 — Automated Link Parsing (2–3 weeks)
**Goal:** paste a URL and get a clean product card in ~3 s for most stores.

Scope
- Edge Function `parse-url`:
  1. Normalise the URL (strip tracking parameters, resolve short links like `amzn.to`).
  2. Check `parse_cache` (24 h).
  3. Fetch the HTML; extract via JSON-LD `Product` → Open Graph → meta tags → heuristics.
  4. Return title, image, price, currency, domain and a confidence score.
- Adapters for the top retailers in your target region.
- Fallback: low confidence or blocked → row in `parse_jobs`; a scheduled GitHub Actions job runs Playwright on the queue and fills the item in later.
- No paid scraping service. Sites that still block requests use the manual form; Amazon's official product API can be added for free once the Associates account qualifies (Phase 7).
- Last resort: pre-filled manual form ("We couldn't read this page — fill in the gaps").
- Abuse protection: per-user rate limit, block private IP ranges (SSRF), response-size cap.

Deliverables: quick-add bar, parse preview card, editable fields before saving.

Done when: ≥80% of a 100-URL test set from target retailers parses title + image + price correctly (instantly or via fallback).

---

### Phase 5 — PWA Experience & Quick-Add (2 weeks) → **Public web launch**
**Goal:** the web app feels like a native app and items can be added from anywhere.

Scope
- **Install experience:** custom install prompt (Android/desktop), iOS "Add to Home Screen" guide.
- **Offline:** cached wishlists and Circles readable offline; adds queued and synced when back online.
- **Update flow:** "New version available — refresh" prompt.
- **Share target:** manifest `share_target` → in Android Chrome the installed app appears in the Share menu and receives URLs.
- **Quick-add for other platforms:**
  - Desktop: bookmarklet ("Add to GiftHub" in the bookmarks bar).
  - iOS: an Apple Shortcut that appears in the Share menu and posts the URL with a personal quick-add token (iOS doesn't support PWA share targets).
  - Edge Function `quick-add` accepting the token.
- **Web Push:** subscribe flow, VAPID keys, sending from an Edge Function. Events: new item in a Circle, claim activity (non-owners only), upcoming occasion. iOS supports this only for apps installed to the home screen (16.4+).
- Notification centre in-app + email digest fallback.
- Launch basics: landing page, privacy policy, terms, Open Graph preview images for invite links, Lighthouse PWA/performance pass.

Deliverables: installable PWA with offline mode, share target, bookmarklet, iOS Shortcut, push notifications.

Done when: on Android, sharing from Chrome or the Amazon app adds an item without opening GiftHub fully; on iOS, the Shortcut does the same; Lighthouse scores ≥90 for performance and accessibility.

**→ Public launch** of the web app.

---

### Phase 6 — Price Tracking (2 weeks)
**Goal:** notice price drops and tell the people who might buy.

Scope
- pg_cron job batches active, unclaimed items and re-parses the price (Edge Function; Playwright fallback via GitHub Actions).
- Frequency: daily for priority ≥ 6, weekly for the rest; stops for received/archived items.
- Write to `price_history`; show a **Sale** badge when the price is ≥ 5% below baseline.
- Item detail: price-history sparkline, "was / now" display.
- Web Push alerts to Circle members (optionally the owner) when a watched item drops.

Deliverables: sale badges, price chart, drop notifications.

Done when: changing a test item's price on a mock store triggers a badge and a notification within one cycle.

---

### Phase 7 — Growth & Monetisation (ongoing)
**Goal:** sustainable growth and revenue.

Scope
- Affiliate links (Amazon Associates, impact.com, etc.) rewritten server-side on outbound clicks — main revenue source.
- Occasion reminders (birthdays/anniversaries per member) with a "top picks" digest.
- Group gifting / contribution pooling.
- Browser extension for desktop quick-add, published free on **Firefox Add-ons** and **Microsoft Edge Add-ons**; Chrome users load it from GitHub Releases or keep using the bookmarklet (the Chrome Web Store charges $5).
- Amazon Product Advertising API (free once Associates sales qualify) for reliable Amazon data.
- Optional revenue (doesn't affect the $0 cost rule): premium features like custom occasions or themes.
- SEO landing pages, referral through invite links.

Done when: tracked by metrics — weekly active Circles, items added per user, claim rate, affiliate revenue.

---

### Phase 8 — Android App, Free Distribution (optional, 1–2 weeks)
**Goal:** a downloadable Android app without paying for a store account.

Scope
- Wrap the web app with **Capacitor**; native Android share intent and FCM push (Firebase Cloud Messaging is free).
- Build the APK in GitHub Actions; publish signed releases on **GitHub Releases**, linked from the website.
- Optional free store: submit to **F-Droid** if the project is open source.
- In-app update check against the latest GitHub Release.

Out of scope (cost money): Google Play ($25), Apple App Store ($99/yr). iOS users stay on the PWA + Apple Shortcut.

---

## 3. Timeline Overview

```
Weeks:  1-2     3-4        5-7         8-9          10-12        13-14          15-16       17+        later
      [P0 Base][P1 Circles][P2 Wishlist][P3 Secret ★][P4 Parsing][P5 PWA+QuickAdd][P6 Prices][P7 Growth][P8 APK?]
                                            ↑ private beta                  ↑ public web launch
```

About 3.5 months part-time to public launch (~7–8 weeks full-time), at a total cost of $0.

---

## 4. GitHub Workflow

- **Issues** per feature, grouped by **Milestones** = phases above; a **Project board** (Backlog → In progress → Review → Done).
- Branch per issue → pull request → CI + Cloudflare preview URL → merge to `main` → production deploy.
- Supabase migrations applied by a GitHub Action on merge (`supabase db push`) using repository secrets.
- Scheduled Actions: Playwright parse/price fallback, nightly DB backup, keep-alive ping.

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Retailers block scraping (esp. Amazon) | Parsing/price tracking fails | Layered parser, manual fallback, Amazon PA-API once eligible via Associates sales |
| Claim data leaks to the owner | Destroys core value | RLS-only access, automated tests in CI, no client-side filtering |
| iOS PWA limits (no share target, push only when installed) | Weaker iOS experience | Apple Shortcut quick-add, clear install guide, Phase 8 native wrapper if needed |
| Invite code brute-forcing | Strangers join Circles | 31-char alphabet × 6 chars (~887M combos), rate limit, expiry, optional admin approval |
| Service-worker caching bugs serve stale app | Users stuck on old version | Versioned caches, update prompt, network-first for API calls |
| Price-scraping terms-of-service issues | IP bans | Low frequency, caching, honest user agent |
| Free tier limits reached | Service stops or degrades | Per-user quotas, usage dashboard, signup waitlist at 80% of limits — see *Free Tier Build Plan.md* |
| Supabase project paused or data lost | Downtime / data loss | Daily keep-alive job, nightly backup via GitHub Actions |
| A free plan changes or disappears | Forced migration | Standard Postgres + static site → portable to other free hosts |

---

## 6. Open Questions
1. Target region/retailers first? (Sets parser adapters and default currency.)
2. Should Circle admins approve new joiners, or is a valid code enough?
3. Can a user hide an item from one member inside a Circle (e.g. partner-only items)?
4. Show who claimed an item to other members, or only "Claimed"?
5. Monetisation: affiliate-only, or freemium too?
6. Make the GitHub repo public? (Unlimited free Actions minutes and F-Droid eligibility, but the code becomes visible; secrets stay safe in repo secrets.)
