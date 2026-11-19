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
  - Since Phase 3 (18 Nov 2026) the table has no API access at all: claims go through `circle_claims`, `claim_item`, `unclaim_item`, `mark_received` and `my_received`, which return only the status and whether a claim is yours. Live updates use the insert-only `claim_signals` table, which the wish's owner can't read.
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

### Phase 2.5 — Help, Legal and Bug Reports (2–3 days, live 18 Nov 2026)
**Goal:** the pages a public app needs, plus a way for people to report problems. Required before Google's branding approval, which asks for a privacy policy and home page address.

Scope
- Public pages, reachable signed in or out, each with a "Last updated" date, a short contents list and a comfortable reading width:
  - `/help`: about 12 FAQ answers in groups (how it works, privacy and the surprise, wishes, account, limits).
  - `/privacy`: what is collected and why, who processes it, no ads or data selling, retention, deletion, rights, a complaints contact (janasoumil1005@gmail.com, replies within 90 days per India's DPDP Rules), 18+ only.
  - `/terms`: 18+, acceptable use, user content, invite codes, free and as-is with quotas, no price guarantee, possible future commissions, ending accounts, liability, Indian law.
  - `/cookies`: lists the browser storage used. All of it is strictly necessary, so **no consent banner**. A banner (with Accept and Reject given equal weight) arrives only if analytics or error tracking that stores identifiers is added.
- Font self-hosted instead of loaded from Google Fonts, so visitors' IP addresses are not sent to Google.
- Links: Help · Privacy · Terms under the sign-in form; an "agree to the Terms and Privacy Policy" line under sign-up; a "Help and legal" section on Profile.
- **Report a bug:** an in-app form (what happened, what you expected, optional screenshot). It adds the page, app version and device, and tells the person so. The Edge Function `report-bug` saves the report to `bug_reports` (5 a day per person, never readable by users) and emails it to the owner through Resend's free plan. The screenshot goes in a private bucket. Sign-in screens get a "Can't sign in? Email us" link instead.
- **Affiliate Disclosure is deferred to Phase 7.** Until affiliate links exist, the Terms only mention possible future commissions. Phase 7 adds the disclosure page and a "GiftHub may earn a commission" line next to store links.
- No call-to-action card grid. Prompts appear only where a step is missing (empty list, a Circle with one member, wishes shared nowhere, a one-time install prompt in Phase 5).

Needs from the owner: a free Resend account and its API key, stored as a Supabase secret. Have the legal text reviewed before relying on it.

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

**Status (18 Nov 2026):** built and tested (66 database checks in the existing PGlite suite rather than pgTAP; it already runs in GitHub Actions). Goes live once `20261120000000_phase3_claims.sql` is applied.

Done when: RLS tests pass, and with the owner signed in on a second device, nothing changes on their screen — and no claim data appears in their network traffic — while others claim.

**→ Private beta** with 5–10 couples/friend groups on the live web app.

---

### Phase 3.5 — Gift Hand-off (3–4 days, built 18 Nov 2026; goes live with migration `20261121000000_gift_handoff.sql`)
**Goal:** a bought gift ends up in Received without anyone having to remember to mark it.

Flow
1. When a giver marks a gift **Bought**, GiftHub asks "When will you give it?" with a date, or "Not sure yet". The giver can change the date later from the claim slot.
2. From the day after that date, the giver sees "Did you give Maya the headphones?": **Yes, I gave it** or **Not yet** (pick a new date).
3. On **Yes**, the receiver sees "Did you get the headphones? Sam marked it as given.": **Yes, mark received** (the normal Mark received, revealing the giver) or **Not yet** (the prompt goes away).

Privacy
- The give date sits on the claim and is returned only to the claimer. Other givers and the owner never see it.
- The receiver hears nothing until the giver says the gift was handed over, so the surprise is already over. The giver's prompt asks the question plainly ("Did you give Maya the headphones?"), so a single tap on Yes is the confirmation.
- Database checks cover all of this, including that the owner has no prompt or date before the giver's Yes.

Delivery
- **Now (free):** prompt cards at the top of Your list, shown when the app is opened. The giver's "is it due?" check uses the device's local date.
- **Phase 5:** the same prompts also arrive as Web Push notifications, sent by a daily scheduled Edge Function. Email waits until there is an own domain (Resend's free sender only reaches the account owner).

Done when: a bought gift with a past give date prompts the giver; their Yes prompts the receiver; the receiver's Yes moves it to Received with the giver's name; nothing reaches the receiver earlier.

---

### Phase 3.6 — Couple and Group Circles (built and live 18 Nov 2026)
**Goal:** a Circle for two feels like a shared space for a couple; a group Circle stays a coordination tool. Same privacy rules for both.

Today there is no difference: every Circle is a group of up to 20, and a "couple" is just a Circle with two members.

Proposed design
- **An explicit kind, chosen when starting a Circle:** "Just the two of us" or "A group". Stored with `kind_confirmed` so older Circles can be asked once. Stored as `circles.kind` (`couple` | `group`). Counting members isn't reliable, since every group starts with two.
  - A couple Circle holds exactly 2 people. Once the partner joins, the invite code closes and the invite panel disappears.
  - It can become a group later (to add family) from Circle settings. A group with 2 members or fewer can become a couple.
- **Couple Circle, how it looks:**
  - The title is "You and Maya" unless the couple has renamed it, with two overlapping avatars.
  - No member tabs: it opens on the partner's list, with a "Your list" switch.
  - No Members or roles panel: both are equal. Settings keep rename (or return to the automatic name), leave and delete, and either partner can delete it.
  - The anniversary and Valentine's Day occasions come first in the chips.
  - Copy speaks to one person: "Maya won't see this", "Hand it over".
- **Couple Circle, how it works:**
  - Nobody else is in the Circle to coordinate with, so a claim is a private plan. "Reserve" reads as "Planning to get this". A claim made in another Circle still shows "Already claimed".
  - Gift hand-off (3.5) is the main way gifts reach Received.
- **Group Circle, how it looks and works:** as today. Member tabs, the Members panel with roles, invite code and Circle name. Later candidates: a "Who's left to buy for" overview, birthday occasion first.
- **Circles index:** couple Circles show as a single card with two avatars and "You and Maya". Groups show "With Maya, Sam and 3 others".

Decisions (18 Nov 2026)
1. **One couple Circle per person.** Starting or joining a second is refused with a plain message; groups are unlimited (within the 10-Circle quota).
2. **Name:** a couple Circle is called "You and Maya" automatically (each partner sees their own "You and …"). Either partner can set their own name for it in Circle settings, which both then see; clearing it returns to the automatic name.
3. **Existing two-person Circles are asked once:** the first time the owner opens one, a card asks "Is this Circle just the two of you?" with **Yes, make it a couple Circle** or **No, keep it a group**. The answer is stored, so it never asks again. A Circle with more than two members is never asked.

---

### Phase 3.7 — Navigation and Motion (built 18 Nov 2026)
**Goal:** on a phone, your partner's list is one tap away, and the app moves like a photo booth: prints slide out, sheets rise, and a few small gift moments make it fun without clutter. No database changes and no new libraries.

Decided with the user (18 Nov 2026): icons with labels in the bottom bar, a Circle switcher in the phone top bar, and "a few playful moments" of motion.

**Phone top bar**
- Left: the wordmark, as today. Right: a **Circle switcher** pill in place of the avatar (Profile already has a tab).
  - It shows the current Circle: two small faces and "You and Maya" for a couple, overlapping faces and the name for a group, then a chevron. Long names truncate.
  - The current Circle is the one you're in, or else the one you opened last on this device.
  - Tapping it opens a sheet listing your Circles (faces, name, "Couple" tag), plus "Start or join a Circle". Choosing one goes straight to it.
  - With no Circles, the pill reads "Start a Circle" and goes to the Circles page.
  - It only ever lists your own Circles to you, so it respects "each Circle is its own room".

**Bottom bar (phone) and rail (desktop)**
- Four items, each a 22px line icon above its 12px label, drawn like the gift placeholders (rounded 2px strokes):
  - My list: a tag. Circles: two overlapping rings. Received: an open gift box. Profile: your initials avatar, replacing the one removed from the top bar.
- The current item gets a plum pill behind its icon (icon turns white). The pill **slides** to the new item when you switch, instead of jumping.
- Labels stay the same weight (only the colour changes), so nothing shifts sideways when you switch.
- The desktop rail gets the same icons beside its labels, and its plum pill slides between items the same way.

**Motion: smooth basics**
- **Sheets** (add, edit, view a wish, give date, Circle switcher) rise from the bottom on phones and fade and scale in on desktop, over about 300ms. They close faster, in about 200ms. The backdrop fades.
- **Sliding pills:** the "Maya's list / Your list" switch, group member tabs and the Strip/List switch all slide their plum pill like the bottom bar.
- **Changing lists:** switching member tab or filter cross-fades the strip (about 150ms) instead of popping.
- **A new wish prints:** after you save a wish, its frame slides out of a slot at the top of the strip, revealed top to bottom like a booth print (about 450ms). The frames after it ease along to make room.
- **Removing a wish** (delete, Mark received, Put back on my list): the frame fades and shrinks, and the frames after it close the gap smoothly.
- **Help answers** open and close smoothly where the browser supports it; elsewhere they open instantly, as today.

**Motion: playful moments** (each one short, run once per action, never blocks a tap)
- **Hearts pop:** setting how much you want something fills the hearts left to right, with a small pop on the last one.
- **The lid lifts:** when a wish is saved, the gift logo in the top bar or rail lifts its lid and drops it back, as if the wish went in.
- **Off to Received:** when you mark a wish received, its frame shrinks and flies to the Received tab, and the box icon there bounces once.
- **Hand-off cards:** "Yes, I gave it" and "Yes, mark received" fold their card away instead of it vanishing.
- The ribbon wrap stays the one big moment. No confetti, mascots or sound.

**Rules**
- Never show claim motion to the owner of an active wish. Received stays the only exception, as now.
- Reduced motion: today it turns off every transition. Change it so movement is removed (no sliding, flying or printing) but fades and colour changes stay, so you still see what changed.
- **"Fewer animations" toggle in Profile** (added 18 Nov 2026): gives the same calm version as the phone's reduce-motion setting, without changing phone settings. It's stored on the device, and it's on automatically when the phone asks for reduced motion.
- Every animation is separate and lives in one place (`index.css`, plus one small helper for moves that need JavaScript), with shared timing and easing settings. Removing or retuning one never touches features: every screen works the same with all motion removed.
- Use CSS transitions and keyframes, plus the browser's built-in animation API for the "fly to Received" and gap-closing moves. No animation library.
- Animate only `transform`, `opacity` and `clip-path`, so it stays smooth on cheap Android phones.

**Build order, reviewed in steps** (the user sees each checkpoint before the next part starts)
1. Motion tokens, the reduced-motion fix, the "Fewer animations" toggle, and sheets.
2. Bottom bar and rail icons with the sliding pill.
   - **Review A:** sheets, bars and the toggle.
3. Top bar Circle switcher and its sheet.
4. List continuity: sliding switches, cross-fade, a new wish prints, removals close the gap.
   - **Review B:** switcher and list motion.
5. Playful moments, each one kept or dropped on its own.
   - **Review C.**
6. Check at 360px and desktop, with reduced motion on, and keep the Lighthouse accessibility score at 90 or above. Then update DESIGN.md (Navigation and Motion sections).

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
- No paid scraping service; free tiers of scraping services are allowed (decided 18 Nov 2026). Sites that still block requests use the manual form; Amazon's official Creators API can be added for free once the Associates account qualifies (Phase 7).
- Last resort: pre-filled manual form ("We couldn't read this page — fill in the gaps").
- Abuse protection: per-user rate limit, block private IP ranges (SSRF), response-size cap.

Deliverables: quick-add bar, parse preview card, editable fields before saving.

Done when: ≥80% of a 100-URL test set from target retailers parses title + image + price correctly (instantly or via fallback).

#### Research notes (17 Nov 2026), read before starting this phase

**What store pages contain** (fetched from a home connection):

| Store | Name / image / price | Source on the page |
|---|---|---|
| Flipkart | all three | JSON-LD `Product` + Open Graph |
| Myntra | all three | JSON-LD `Product` + Open Graph |
| Amazon.in | all three | No JSON-LD or Open Graph. Needs an adapter: `#productTitle`, `.a-price-whole`, `#landingImage` / `data-old-hires` |

Tested on 18 Nov 2026: see the blocking test results below.

**First step: blocking test.** Deploy a throwaway parser to both a Cloudflare Worker and a Supabase Edge Function. Run about 20 links (Amazon.in, Flipkart, Myntra, Nykaa, Ajio, Meesho, Croma, Tata CLiQ, Etsy, a Shopify shop) through each. Build on whichever is blocked less, then delete both.

**Blocking test results (18 Nov 2026).** Plain `fetch` with a desktop Chrome user agent, 18 product pages plus 4 home pages, one run each. Both test deployments were deleted afterwards.

| Store | Cloudflare Worker | Supabase Edge Function | Home connection |
|---|---|---|---|
| Amazon.in (4) | ✅ name, image, price (Amazon adapter) | ✅ same | ❌ captcha (after a few search-page requests) |
| Flipkart (2) | ✅ JSON-LD | ❌ 429 | ✅ |
| boAt, a Shopify shop (2) | ✅ JSON-LD | ✅ | ✅ |
| Decathlon (2) | ✅ JSON-LD | ✅ | ✅ |
| FirstCry (1) | ❌ 403 | ⚠️ name and image only (Open Graph) | ⚠️ same |
| Croma (home page) | ❌ 403 | ✅ page loads | ✅ |
| Tata CLiQ (home page) | ✅ loads, but the app is client-rendered: no product data in the HTML | same | same |
| Myntra (2) | ❌ 520 | ❌ "Site Maintenance" page | ✅ |
| Nykaa (2) | ❌ 403 | ❌ 403 | ✅ |
| Ajio (2), Meesho, Etsy | ❌ 403 | ❌ 403 | ❌ 403 |

Fully parsed product pages: Worker 10 of 18, Edge Function 8 of 18 (+1 partial). Amazon worked from both data centres, against expectations.

**Decision:** build `parse-url` on the **Cloudflare Worker** (more stores, same host as the site). When the Worker is blocked (403/429/520 or a block page), retry once from a small Supabase Edge Function, which covers FirstCry and Croma. Still blocked → the fallbacks below. Myntra, Nykaa, Ajio, Meesho and Etsy need a browser or a scraping service. Tata CLiQ needs its product API or a browser.

**Fallback test (19 Nov 2026)** on the blocked stores, test Worker deleted afterwards:
- **Cloudflare Browser Run:** ❌ ruled out. Nykaa, Ajio, FirstCry, Meesho and Croma returned 403, Etsy a captcha, and Myntra timed out; Tata CLiQ loaded with a captcha and no price. The free plan also refuses more than a few browser starts a minute (429).
- **ScrapingAnt free plan:** ❌ ruled out. It refuses Myntra, Nykaa, Ajio, Meesho and Croma by name ("This domain is not allowed for Free subscription plan"). FirstCry loaded with name and image, as from Supabase; Tata CLiQ was detected.
- **Still untested:** ScraperAPI's free 1,000 credits a month, GitHub Actions + Playwright, and reading the page from the user's own phone (share text in Phase 5, CapacitorHttp in Phase 8).

**For these stores, plan on the pre-filled manual form for now:** the app still keeps the link and fills in whatever the URL itself gives (store name, and often the product name from the URL slug, as on Myntra, Nykaa and Ajio).

**Parser code: our own, open-source rules as reference.** JSON-LD `Product` → Open Graph (`og:*`, `product:price:*`) → meta and Twitter tags → per-store adapters → heuristics.
- [metascraper](https://npmjs.com/package/metascraper) and `metascraper-amazon` (MIT, microlink): good rule sets for title and image; no evidence they extract price.
- [product-info-fetcher](https://root.packagist.org/packages/givetwice/product-info-fetcher) (PHP): reference for price from JSON-LD and Open Graph.

**Where to run it** ($0 either way):
- **Cloudflare Worker:** the site is already hosted there. 100k requests a day free, and the built-in `HTMLRewriter` reads pages fast. Verify the Supabase sign-in token inside the Worker.
- **Supabase Edge Function:** the original plan. Outbound traffic comes from shared, changing addresses that stores may block ([Supabase docs](https://supabase.com/docs/guides/troubleshooting/why-supabase-edge-functions-cannot-provide-static-egress-ips-for-whitelisting-3d78b0)).

**Fallbacks when a store blocks the parser, in order:**
1. **Cloudflare Browser Run** (formerly Browser Rendering): free plan has 10 browser-minutes a day and 3 concurrent browsers ([limits](https://developers.cloudflare.com/browser-rendering/limits/)). That is roughly 100–200 blocked links a day.
2. **GitHub Actions + Playwright** on `parse_jobs`: slow (fills the item minutes later) but free.
3. **Free tiers of scraping services** (allowed: the user confirmed on 18 Nov 2026 that free tiers count as $0): [ScrapingAnt](https://scrapingant.com/web-scraping-api), 10k credits a month with no card (browser rendering costs more credits per page); [ScraperAPI](https://docs.scraperapi.com/resources/faq/plans-and-billing), 1k credits a month.
4. **Name and image only:** [Microlink](https://microlink.io/meta), 25 requests a day free. [LinkPreview.net](https://www.linkpreview.net), 60 an hour, but personal use only.
5. The manual form, pre-filled with whatever was found.

**Amazon-specific routes:**
- **Share text (Phase 5):** sharing from the Amazon app includes the product name. Parse it from the share-target text even when the page can't be read.
- **Android app (Phase 8):** `CapacitorHttp` sends `fetch` through native networking, which [skips CORS](https://github.com/ionic-team/capacitor/blob/main/core/http.md). The app can then read the page from the user's own phone and connection, the most reliable free route for Amazon.
- **Creators API (Phase 7):** PA-API 5.0 was retired in 2026 and replaced by the [Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction), which uses OAuth 2.0 client credentials. Access needs **10 qualifying sales in the past 30 days, per marketplace** (Amazon.in counts separately), and can be lost if sales drop.

**Ruled out:**
- Self-hosted [Firecrawl](https://webscraping.ai/faq/firecrawl/is-firecrawl-open-source-and-can-i-self-host-it): needs a server with more than 4 GB of memory, has no anti-blocking layer, and is AGPL.
- [FlareSolverr, Camoufox, curl-impersonate](https://scrapfly.io/blog/posts/best-anti-bot-bypass-tools): need an always-on server and frequent fixes as stores change their defences.

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
- **Web Push:** subscribe flow, VAPID keys, sending from an Edge Function. Events: new item in a Circle, claim activity (non-owners only), upcoming occasion, and the gift hand-off prompts from Phase 3.5 (sent by a daily scheduled Edge Function). iOS supports this only for apps installed to the home screen (16.4+).
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
- Affiliate links (Amazon Associates, impact.com, etc.) rewritten server-side on outbound clicks — main revenue source. Ship with an Affiliate Disclosure page and a "GiftHub may earn a commission" line next to store links (ASCI expects the disclosure near the link).
- Occasion reminders (birthdays/anniversaries per member) with a "top picks" digest.
- Group gifting / contribution pooling.
- Browser extension for desktop quick-add, published free on **Firefox Add-ons** and **Microsoft Edge Add-ons**; Chrome users load it from GitHub Releases or keep using the bookmarklet (the Chrome Web Store charges $5).
- Amazon Creators API (PA-API's 2026 successor; free once Associates has 10 qualifying sales in 30 days on that marketplace) for reliable Amazon data.
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
| Retailers block scraping (esp. Amazon) | Parsing/price tracking fails | Layered parser, Browser Run and Actions fallbacks, share-text names, phone-side fetch in the APK, manual fallback, Amazon Creators API once eligible |
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
4. ~~Show who claimed an item to other members, or only "Claimed"?~~ Decided 18 Nov 2026: only "Already claimed", for everyone except the claimer.
5. Monetisation: affiliate-only, or freemium too?
6. Make the GitHub repo public? (Unlimited free Actions minutes and F-Droid eligibility, but the code becomes visible; secrets stay safe in repo secrets.)
