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
| Email | Gmail SMTP for Supabase Auth emails (set up 19 Nov 2026); Resend for bug reports | Free tier covers early stage |
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
- Auth: email + password, magic link, Google sign-in. Auth emails go through Gmail SMTP (`smtp.gmail.com`, port 465, an app password set by the owner in Supabase), since Supabase's own sender stopped delivering.
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

### Phase 3 — "Secretly Bought" (1–2 weeks, live 18 Nov 2026) → **MVP milestone**
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

### Phase 3.5 — Gift Hand-off (3–4 days, live 18 Nov 2026)
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

### Phase 3.7 — Navigation and Motion (live 18 Nov 2026)
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

### Phase 4 — Automated Link Parsing (2–3 weeks, done 19 Nov 2026)
**Goal:** paste a URL and get a clean product card in ~3 s for most stores. **Status (19 Nov 2026): ✅ done. The 80% target is met (85% on the third link test) and the phone check passed.**

**Built 19 Nov 2026** (the original scope below is kept for reference; where they differ, this wins):
- **Where it runs:** `POST /api/parse` on the site's own Cloudflare Worker (`web/worker/index.ts`), not an Edge Function, because the blocking test showed Cloudflare gets through to more stores. When a store refuses Cloudflare, the Worker asks the Edge Function `parse-url` once (`supabase/functions/parse-url`), which FirstCry and Croma let through. Still refused: scrape.do (see the fallback test below).
- **One parser for both:** `supabase/functions/_shared/parse.ts`, plain web APIs and no imports. Order: JSON-LD `Product` → Amazon page adapter → Open Graph and meta tags → page title. Store suffixes are trimmed from names ("| Flipkart.com"). Tested in `web/src/lib/parse.test.ts`.
- **Clean links:** tracking parameters removed; Amazon cut to `/dp/ASIN`; Flipkart kept to `?pid=`; short links followed to the product.
- **Safety:** signed-in users only (the Supabase session is checked with Supabase), 30 links a minute per person (Cloudflare rate-limit binding), https/http pages on ordinary hostnames only (no IP addresses, local names or odd ports); since the security pass (Phase 4.5), every redirect hop is checked and every hostname is looked up first, so nothing that points at a private, local or cloud-metadata address is fetched; 2.5 MB and 10 s per page, HTML only.
- **Cache:** Cloudflare's cache, not the `parse_cache` table: a day for read pages, an hour for refusals. `parse_cache` and `parse_jobs` stay unused for now.
- **In the app:** pasting a link in the bar, or into the Link field of a new wish, reads the page. Name, price with currency, and photo fill in; anything you've typed yourself is kept. The line under Link says "Reading the page on flipkart.com…", then "Filled in from flipkart.com. Check it looks right." or, when refused, "ajio.com doesn't let us read its pages yet. Fill in the rest yourself." Editing a wish offers "Update from the store", which refreshes name, price and photo (an uploaded photo stays).
- **No waiting (19 Nov 2026):** Save works while the page is still being read ("Getting details from amazon.in. You can save now."). The read carries on after the form closes. Then the saved wish gets whatever is still guessed or empty, and a one-line toast says "Details added from amazon.in." A name you typed is kept, and nothing changes if you edited the wish in the meantime. If the app is closed before the read finishes, the wish keeps its guessed name.
- **Short names (19 Nov 2026):** long store titles ("Samsung Galaxy M35 5G (Moonlight Blue, 8GB RAM) | 6000mAh Battery | …") become "Samsung Galaxy M35 5G". The cut is at the first `|`, bracket, dash or later comma, with a 60-character cap. The specs go into Notes when Notes is empty. This applies to shared text, the page read and the background fill; a name you typed is never changed.
- **Shared text (19 Nov 2026):** store apps copy "Product name https://amzn.in/d/…". The paste bar and the Link field pick out the link, and the words become the first guess at the name. The paste bar no longer lets the browser reject such text as "not a URL".
- **Local development:** `npm run dev` proxies `/api` to `npx wrangler dev` on port 8787 (the "worker" entry in `.claude/launch.json`; run `npm run build` first).

**Still to do in Phase 4:**
1. ~~Deploy `parse-url`~~ (deployed 19 Nov 2026).
2. ~~Try it live on a phone with real links~~ (done 19 Nov 2026). ~~Link test~~: done, 85% on the third run (see below). Rerun `web/scripts/link-test.mjs` after parser changes.
3. ~~Save Myntra photos to GiftHub's storage~~: not needed. Checked 19 Nov 2026 in a browser from another site: photos from all 13 stores in the test (Myntra, Amazon, Flipkart, Nykaa, Croma, Meesho and others) load fine.
4. Daily link limit: Free 15 a day, Pro 30 or more (Phase 5.5, with a `usage_daily` count). Until then, 30 a minute for everyone, as built. Cached links don't count.
5. ~~Add scrape.do as the third retry~~ (built 19 Nov 2026; needs the `SCRAPEDO_TOKEN` secret). Other untested fallbacks for the blocked stores: ScraperAPI's free tier, GitHub Actions + Playwright on `parse_jobs`, and the share text from store apps (Phase 5).

**Original scope:**

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
- **scrape.do (tested 19 Nov 2026, run from the user's terminal, Indian proxies): ✅ works.** With standard proxies it got Myntra (name, photo, price), Nykaa (all three), Ajio (all three) and FirstCry (name and photo, no price on the page), in 1.5–4 s each. Meesho, Croma and Tata CLiQ were tried only on their home pages, which loaded. Etsy needs the residential proxies (`super=true`); standard ones return HTTP 400. Free plan: about 1,000 credits a month (a standard request is 1 credit, residential about 10).
- **Still untested:** ScraperAPI's free 1,000 credits a month, GitHub Actions + Playwright, and reading the page from the user's own phone (share text in Phase 5, CapacitorHttp in Phase 8).
- **Built 19 Nov 2026:** scrape.do is the Worker's last retry, used only after Cloudflare and Supabase are both refused (Indian proxies; residential only for Etsy). It is active once the user sets the Worker secret `SCRAPEDO_TOKEN`. Results are cached for a day, so each product costs at most one credit a day. When the month's credits run out, refused stores fall back to the pre-filled form.

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

**Link test, first run (19 Nov 2026, 76 links from 14 stores, live site): 37 of 76 with name, photo and price (49%).** Amazon 13 of 15 (the other 2 are unavailable products), Flipkart 7 of 11 (the other 4 show no price), IKEA, Decathlon, boAt, Etsy all full, Nykaa 4 of 6 through scrape.do. Myntra 0 of 10, Croma and Tata CLiQ 0 of 6 (no price), Meesho 1 of 4, Ajio 0 of 1. Fixes made the same day:
- **Myntra:** it answers Cloudflare with an empty page rather than a refusal, so the retries never ran. Empty pages now go through Supabase and scrape.do too (scrape.do reads Myntra in full).
- **Croma:** the price is in the page's own data (`pdpPriceData`), now read.
- **FirstCry:** the price is worked out from the product's MRP and discount in the page data.
- **Tata CLiQ:** the page is an empty shell; its product API (`/marketplacewebservices/v2/mpl/products/productDetails/MP…`) gives name, photo and price.
- **Home-page shells:** a product link answered with the shop's home page (Lenskart's US pages) now counts as unreadable instead of giving the shop's name as the product.
- **Removed products:** a 404 page now says "That page is gone from nykaa.com" and skips the paid retries.
- **Trail:** each answer lists the steps it went through (`cloudflare unreadable > supabase blocked > scrapedo 403`), so the next run shows why Meesho and Ajio still fail.
- The cache key carries a parser version, so pages read by the old parser are read again.

**Link test, second run (19 Nov 2026, after the fixes, 74 links): 62 of 74 with name, photo and price (84%). ✅ Target met.** Myntra 10 of 10, Croma 6 of 6, Tata CLiQ 6 of 6, FirstCry 2 of 2, Lenskart 1 of 1, Nykaa 4 of 6, Amazon 13 of 15, Flipkart 7 of 11, Meesho 1 of 4, Ajio 0 of 1. Of the 12 misses, 6 are products that no longer exist or aren't for sale (Nykaa 2 and Meesho 2 gone, Amazon 2 unavailable) and 4 are Flipkart listings with no price shown. Only 2 are real failures: scrape.do timed out on Meesho and Ajio after 25 s. Leaving out the gone products: 62 of 68 (91%). Follow-up fixes: scrape.do's 404/410 now reports "gone" instead of "blocked", and its time limit went up to 40 s (Save no longer waits for the read, so a slow read only fills in later).

**Link test, third run (19 Nov 2026, after the security pass): 63 of 74 (85%). ✅** A Meesho page that timed out before now reads in full; the 4 removed products report "gone". The 11 misses: 4 removed products, 2 unavailable Amazon items, 4 Flipkart listings with no price, and Ajio (scrape.do timeout). Most links came from the one-day cache, so only 6 went through the new address checks; a rerun after the cache clears covers all of them.

### Phase 4.5 — Pre-beta check (after Phase 4; before the private beta)
**Goal:** friends find the app solid on the first try. Bugs and edge cases get caught by us, not by them.

**Status (19 Nov 2026):** edge-case tests, security pass, Security Advisor fixes and the robustness pass are done. First-run onboarding (Phase 4.6) is live. Google sign-in works on the phone (confirmed by the owner, 19 Nov 2026). The last open security item, the `parse-url` function, is closed and live (see the security pass below). **Phase 4.5 is done; next is the private beta**, then Phase 5. The two-phone test runs in the final pre-launch check. **The two-phone test moves to just before the public launch** (decided 19 Nov 2026): it becomes part of a final pre-launch check, where every test runs again on the finished app (see Phase 5).

Scope
- **Automated edge-case tests (database checks, run on every push):** two claims on the same wish at the same moment (only one wins); a member removed in the middle of a claim; a Circle deleted while a hand-off is pending; leaving a couple Circle; wishes with no price, a huge price, a very long or emoji name; expired and reused invite codes.
  - ✅ **Done 19 Nov 2026** (`supabase/rls-tests/edge.test.mjs`, 41 checks, runs with `npm test`). Found and fixed in migration `20261123000000_edge_fixes.sql`:
    - A reservation stayed when the owner stopped sharing the wish, or when the giver left or was removed. The wish was stuck as "claimed" for everyone else. Now the reservation is dropped once the giver can't see the wish; a gift already bought stays claimed.
    - A price too big to store, or a made-up currency, gave a raw database error. Now: "That price is too high." / "Pick a currency code like INR or USD."
    - A photo address wasn't checked at all. Now it must be a web address.
    - Applied to the live database on 19 Nov 2026.
- **Security pass:** ✅ done 19 Nov 2026.
  - **Link reader:** it followed redirects blindly, and hostnames that point at internal addresses (such as `127.0.0.1.nip.io`) got through, so a link could make our servers fetch an internal address. Now every redirect hop is checked, and every hostname is looked up first (over DNS-over-HTTPS): private, local and cloud-metadata addresses are refused. Tested against `127.0.0.1.nip.io` and a redirect to `169.254.169.254`; real store links still read.
  - **Page headers:** added a Content Security Policy (scripts only from our own site, Google sign-in and Cloudflare Turnstile; connections only to our site, Supabase and Google sign-in), blocking of other sites framing the app (clickjacking), and HSTS. Checked live: the app loads, Google sign-in and Turnstile work, other sites are blocked. (The first version blocked Google's sign-in script for about 2 minutes; fixed the same day.)
  - **Leftover design mockup:** `demo.html` was being deployed and was live at /demo. It's now left out of deploys (`public/.assetsignore`).
  - **Sign-in return link:** a link like `/\evil.com` (which browsers read as another website) is now refused.
  - **Packages:** nothing in the shipped app has a known flaw. 4 moderate warnings are in build tools only; the suggested "fix" is a downgrade, so they stay until the tools update.
  - **Leaked keys:** none in the code, the git history or the built app.
  - **Already in place:** database access rules (96 checks), rate limits on link reading (30 a minute), invite-code guessing (5 tries) and bug reports (daily cap), quotas on wishes, Circles and photos.
  - **Dashboard settings (done by the owner, 19 Nov 2026):** email confirmation on, minimum password length 8, "Secure password change" on, Security Advisor run (see below). The scrape.do key was regenerated and the ScrapingAnt account deleted.
  - **Cloudflare Turnstile (free person check), live 19 Nov 2026:** on sign-up, sign-in, Google sign-in, email links and password reset; usually invisible. Supabase checks the token (Authentication → Attack Protection, secret key set by the owner). The public site key is written in `web/src/lib/turnstile.ts`, because the automatic deploy on every push builds without `web/.env.local`: one such deploy dropped the key while Supabase required the check, which would have broken sign-in.
  - **Closed and live (19 Nov 2026):** the `parse-url` Supabase function could be called directly by any signed-in person, skipping the 30-a-minute limit. Now the Worker and the function share a secret, `PARSE_URL_SECRET` (set by the owner in Cloudflare and in Supabase's function secrets, at least 32 characters). The function refuses any call without it, and refuses everything while its own copy isn't set; the Worker skips that retry when it has no secret. Checked live: direct calls without the secret, or with a wrong one, get 403. Both secrets were set by the owner as Secrets (never in `wrangler.jsonc`). The signed-in Croma/FirstCry check of the Worker's own copy was skipped by the owner; if those stores stop filling in, set both secrets again with one value. Until both match, links that Cloudflare can't read go straight to scrape.do, so nothing breaks.
- **Security Advisor (19 Nov 2026):**
  - `rls_auto_enable()` (Supabase's own function that turns RLS on for new tables) was callable by anyone. Migration `20261124000000_lock_rls_auto_enable.sql` removes that (applied live 19 Nov 2026).
  - The 18 "signed-in users can run a SECURITY DEFINER function" warnings are intended: these are the app's own actions (claim, join, create Circle…). Each one checks who is asking, and the database tests cover them.
  - "RLS enabled, no policy" on `bug_reports`, `join_attempts`, `parse_cache` and `parse_jobs` is intended: only the server uses these tables. (`parse_cache` and `parse_jobs` are unused leftovers from the first design.)
  - Leaked password protection needs Supabase's paid plan, so it stays off; minimum length 8 instead.
- **App robustness pass:** every screen empty and with a lot of data; slow and dropped connections; double taps on every button; error messages on every form; long names everywhere; phone, tablet and desktop sizes. **Done (19 Nov 2026)** with made-up data (40 own wishes, 30 others, 12 members, very long names and titles):
  - No page or sheet overflows at phone (375 px), tablet (768 px) or desktop (1440 px); long titles cut off cleanly and broken photos fall back to the gift icon.
  - Fixed: fast double or triple taps sent a claim, a wish save or "Put back on my list" more than once; now one at a time.
  - Fixed: names over 60 characters gave a raw database error; the fields now stop at 60.
  - Fixed: "Remove" and "Make owner" in Circle settings happened in one tap; both now ask first.
  - Fixed: a page that couldn't load had no way back short of reloading; every list now has "Try again".
  - Fixed: with no connection, pages sat on "Loading…" for about 18 seconds (the Supabase client retried 3 times on top of the app's own retry); now the message shows in about a second.
  - Checked and fine: empty list, Circles and Received pages; form error messages; busy states on slow saves.
- **Manual test script (moved to the final pre-launch check in Phase 5; the owner, about 20 minutes, two accounts on two phones):** sign up, start and join a Circle, add wishes by link and by hand, upload a photo, claim, buy, the gift hand-off, Received, a couple Circle, Help and bug report.
- **Light load check (optional):** about 20 simulated users for a couple of minutes against a test copy (a second free Supabase project), never the live database. The full stress test stays in Phase 7.5.
- Then: fix what turns up and open sign-up for the people invited (email confirmation is already back on).

Done when: all automated checks pass, nothing in the robustness pass or the security pass is left open, and Google sign-in works on a phone. Then the private beta (5–10 couples and friend groups). The two-phone test runs before the public launch instead.

### Phase 4.6 — First-run onboarding (added 19 Nov 2026; about 2–3 days, before the private beta)
**Status (19 Nov 2026): live.** Intro cards at `/intro` (the front door: every signed-out visit starts there; linked from Help), an invite screen on `/join/<code>` that names the inviter from the link (`?from=Maya`, display only), Welcome in three numbered steps (name and currency → Circle → first wish), one-time hints on Circle lists, six-box invite code entry, and an invite link that types its code into the boxes before the Circle opens. Checked locally at phone and desktop sizes, with the keyboard and in calm mode.

**Added after the first build (19–19 Nov 2026, live):**
- **Circles tab opens your Circle (phones):** the bottom bar's Circles tab opens the Circle shown in the top-right switcher: the one you picked or opened last, else your couple Circle, else your first. In only one Circle, it opens straight away. The page with all your Circles stays one tap away ("Start or join a Circle" in the switcher). The desktop side menu already lists every Circle, so it's unchanged.
- **A fourth intro card**, "Your Circle, one tap away": a small phone where Family is picked at the top and the Circles tab opens Family's wishes.
- **What's new, once:** people who signed up before this see only that card, once per device, on a phone, if they're in a Circle. "Got it" fades it out and the real Circles tab pulses once. New people never see it (the intro already showed it). Pattern for later features: one card, once, then out of the way.
- **Loading screens:** the gift hops over a small shadow, centred, with the label below; full screen for "Signing you in" and app start, smaller inside pages. It fades in after 0.2 s, so quick loads don't flash. In calm mode the gift stays still.

**Goal:** a new person understands GiftHub in under 30 seconds and has a Circle and a first wish within 2 minutes, without help. Today the first run is only "name and currency, then start a Circle", and nothing explains the secret claims, which is the whole point.

Scope
- **Intro, before sign-up:** three short cards, swiped or tapped through, in the photo-booth style of Phase 3.7:
  1. "Save wishes from any store": paste a link, a print slides out.
  2. "Share with your Circle": a couple, or a group of friends or family.
  3. "Gifts stay a surprise": givers reserve and buy in secret; you only see who gave what once you mark it received.
  Skip at any point; dots show where you are. Shown on every signed-out visit (decided 19 Nov 2026), and from Help. Works with swipe, buttons and keyboard; with reduced motion the cards fade instead of sliding.
- **Invite links get their own first screen:** "Maya invited you to …" with one line on secret claims, then sign-up, then straight into the Circle. No generic intro.
- **Welcome steps, with "Step 1 of 3":** name and currency → start or join a Circle (or skip) → add your first wish (paste a link, or add by hand). After starting a Circle, the invite step offers the phone's own Share menu as well as copying the code.
- **First visit hints, once each:** the first time you open someone else's list, one line explains Reserve and "I bought it" and that they won't see it. The first time you open your own list in a Circle, one line explains that claims stay hidden. (The existing privacy note on My list stays.)
- Plain words, no jargon; every screen fits a phone at 375 px with no scrolling for the intro.

Done when: on a phone, a tester who has never seen GiftHub gets from an invite link, or from the home page, to a Circle and a first wish in under 2 minutes without help; the intro shows once; and it works at 375 px, with a keyboard and with reduced motion.

### Phase 5 — PWA Experience & Quick-Add (2 weeks)
**Goal:** the web app feels like a native app and items can be added from anywhere.

**Status (25 Nov 2026):** started. Already in place from Phase 0: the manifest and automatic updates (a new version loads on its own, so no "refresh" prompt is needed). Built: the install prompt (Chrome, Edge and Samsung Internet show an Install button; iPhone and iPad get the Share → Add to Home Screen steps; Safari on a Mac gets File → Add to Dock), as a one-time card on My list on phones and an "Install the app" panel on Profile. App icons redone so the home-screen icon is one solid blush tile, not a pink square on a white card. Next: offline reading, the Share menu, quick-add, push.

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

Then Phase 5.5 (Free and Pro plans), then the final pre-launch check, then the public launch.

**Final pre-launch check (decided 19 Nov 2026):** on the finished app, run everything again in one go: all automated tests, the robustness pass (screen sizes, slow and dropped connections, double taps, long names), the security pass (Security Advisor, headers, packages, leaked keys), and the two-phone test from Phase 4.5 (the owner, two accounts on two phones, about 20 minutes, now also covering install, the Share menu, push notifications and the plans). The launch waits until it runs clean.

---

### Phase 5.5 — Free and Pro plans (planned 19 Nov 2026; build just before the public launch)
**Not now.** The main app comes first (Phases 4 and 5). This phase is built last, right before the public launch, so the app opens to everyone with its plans in place. Until then, today's single set of limits applies to everyone.

**Model (decided 19 Nov 2026): freemium.** Free allows almost everything; Pro lifts the "extreme" limits. A one-time **Event** pass covers big occasions such as a wedding gift list. Affiliate links (Phase 7) stay the other revenue source.

**Rules for what can be paid:**
1. **The surprise is never paid.** Claims, privacy, Circles, the hand-off and Received are the same on every plan.
2. **Givers never meet a paywall.** Viewing someone's list, reserving and buying are always free. Only the list owner's own heavy use is limited.
3. **Limits are plain and calm.** At a limit, one line says what happened and what Pro allows (for example, "You've read 15 links today. Pro reads more."). No pop-ups, nagging, countdowns or ads.
4. **Nothing is taken away.** People already past a Free limit when plans start, or whose Pro ends, keep everything visible and editable; they just can't add more until they're under the limit.
5. **Pro still fits the free infrastructure**, unless Pro revenue pays for an upgrade.

**Limits (decided 19 Nov 2026):**

| | Free | Pro |
|---|---|---|
| Link reading | 15 a day | 30 or more a day (exact number set with the price) |
| Active wishes | 50 | 150 |
| Circles | 5 | 15 |
| Photo uploads | 10 | 50 |
| Members per Circle (set by the Circle owner's plan) | 20 | 50 |
| Price-drop alerts (Phase 6) | 5 a month | Every wish |
| Bulk import, custom occasions, themes | No | Yes |
| Claims, hand-off, Received, privacy, couple and group Circles, notifications | Yes | Yes |

**Event pass (idea, one-time price):** one Circle for one occasion, such as a wedding or baby-shower gift list, with **unlimited members** (guests). It lasts for the event and a while after, then the Circle stays readable. Still to design: how long it lasts, whether guests need accounts to reserve, and how it differs from a group Circle.

**Price: not set.** Research Indian and world markets first: what similar wishlist and registry apps charge, what people pay for comparable apps in India (UPI subscriptions) and elsewhere, and monthly vs yearly vs one-time. Set Pro and the Event pass price from that.

**Payments (to choose at build time):**
- **Razorpay:** no setup fee, about 2% per payment, UPI and cards, accepts individuals with PAN and a bank account.
- **Outside India:** Razorpay international cards, or a merchant of record (Lemon Squeezy, Paddle) that handles tax worldwide.
- Fees come out of revenue, so the $0 rule holds. Card and UPI details stay on the provider's hosted checkout. GST registration is needed only above ₹20 lakh a year.

**How it would be built:**
1. **Plan-aware limits:**
   - `profiles.plan` (free, pro), `pro_until` and event passes are set only by the server.
   - `private.plan_of(uid)` feeds every quota trigger instead of fixed numbers.
   - `usage_daily` with a `use_credit(kind)` function counts link reading; the Worker asks it before reading a page, and cached links are free.
2. **Profile → "Your plan":** what you've used, what Pro adds, Upgrade and Manage.
3. **Checkout and a `payments-webhook` Edge Function** that verifies the provider's signature and sets the plan; renewals and cancellations arrive the same way.
4. **Legal and Help:**
   - Terms: the paid plans, renewal, cancelling and refunds.
   - Privacy: names the payment provider.
   - Help: a "Free and Pro" section.
   - The legal review covers all of this.
5. **Tests:** only the server can set a plan; quotas switch with the plan; usage can't be reset from the browser.

**Decisions still open:** the price; the payment provider; whether one partner's Pro covers the couple Circle; the Event pass details; whether Pro revenue pays for Supabase's paid plan if needed.

Done when: someone can upgrade, renew and cancel on the live site; limits switch with the plan; and Free users never see an ad, a pop-up or a locked claim.

**→ Public launch** of the web app.

**Launch trailer (motion graphic):** made after Phase 5 is done, while Phase 5.5 is being built, so the screens it shows are final and it can include the headline features (share from any store app, the secret claim, the gift hand-off, install and notifications). Record from the real app with made-up names and wishes, never real accounts. The script and storyboard can start any time.

---

### Phase 6 — Price Tracking (2 weeks)
**Goal:** notice price drops and tell the people who might buy.

**Updated 25 Nov 2026** to match how link reading was built in Phase 4. Already in the database since Phase 0: `items.original_price` and the `price_history` table (readable with the item, written by the server only).

Scope
- **Checking prices:** a Cloudflare Cron Trigger on the site's Worker (free) runs the same reader as `/api/parse`: Cloudflare first, then the `parse-url` Edge Function, then scrape.do. Price checks skip the one-day cache so they see today's price, and they only update the price, never the name, photo or notes.
- **Frequency:** daily for priority ≥ 6, weekly for the rest. Checks stop for received and archived wishes, wishes with no link, and links that came back "gone" (the wish shows "No longer sold at <store>").
- **Privacy:** claimed wishes are checked on the same schedule as unclaimed ones. If checks stopped on a claim, the owner could tell from the badge or chart that someone reserved it, which breaks the core privacy rule.
- **scrape.do budget:** the free plan is about 1,000 credits a month, shared with link reading. Pasted links always come first. Price checks may use at most about 300 credits a month (a setting in the Worker). Stores that need scrape.do (Myntra, Nykaa, Ajio, Meesho, Etsy) are checked weekly whatever their priority, and once the budget is used up their checks wait until next month. Etsy (residential proxies, about 10 credits) is left out of price checks.
- **Spread the load:** checks run in small batches through the day, at most a few per store a minute, with an honest user agent. A store that starts refusing is paused for a day.
- **Saving:** every check that finds a price writes a row to `price_history`, then updates `items.price`. The first price saved is the baseline. The original-price form field (a smaller leftover) is built here, and the check fills it from the store's MRP or "was" price when the page shows one.
- **Sale badge:** shown when the price is at least 5% below the baseline, on My list, in Circles and on the wish.
- **On the wish:** a price-history sparkline and a "was / now" price.
- **Alerts:** Web Push (Phase 5) to Circle members who can see the wish, and to the owner if they turn it on, when a wish's price drops by 5% or more. At most one alert per wish a week, and none for a drop smaller than the last one. Free plans get 5 drop alerts a month and Pro every wish (Phase 5.5); until 5.5 is built, everyone gets every wish.
- **Fallback:** if all three readers fail, the wish keeps its last price and the chart shows a gap. GitHub Actions + Playwright stays untested and is not part of this phase.

Deliverables: scheduled price checks, sale badges, price chart, original-price field, drop notifications.

Done when: changing a test item's price on a mock store triggers a badge and a notification within one cycle; a claimed wish keeps being checked; price checks stay within their monthly scrape.do budget.

---

### Phase 7 — Growth & Monetisation (ongoing)
**Goal:** sustainable growth and revenue.

Scope
- Affiliate links (Amazon Associates, impact.com, etc.) rewritten server-side on outbound clicks — main revenue source. Ship with an Affiliate Disclosure page and a "GiftHub may earn a commission" line next to store links (ASCI expects the disclosure near the link).
- Occasion reminders (birthdays/anniversaries per member) with a "top picks" digest.
- Group gifting / contribution pooling.
- Browser extension for desktop quick-add, published free on **Firefox Add-ons** and **Microsoft Edge Add-ons**; Chrome users load it from GitHub Releases or keep using the bookmarklet (the Chrome Web Store charges $5).
- Amazon Creators API (PA-API's 2026 successor; free once Associates has 10 qualifying sales in 30 days on that marketplace) for reliable Amazon data.
- Paid plans: Free, Pro and the Event pass are built before the launch (Phase 5.5).
- SEO landing pages, referral through invite links.

Done when: tracked by metrics — weekly active Circles, items added per user, claim rate, affiliate revenue.

---

### Phase 7.5 — Stress Testing (added 19 Nov 2026; much later, before any big growth push)
**Goal:** know where the site and app break under load, and fix the first bottleneck before real users find it.

Scope
- **Tools (free):** k6 or Artillery (open source), run from a laptop or GitHub Actions.
- **Never against the live database:** test on a second free Supabase project (the free plan allows two) and a separate Worker, both filled with fake accounts, Circles and wishes.
- **Scenarios:** many people opening lists and Circles at once; many claims on the same wish at the same moment (only one may win); link reading at the rate limit; photo uploads; sign-in bursts after an invite link is shared widely.
- **Limits to watch:** Supabase free plan (database connections, 500 MB database, 5 GB egress, Edge Function calls), Cloudflare Workers free plan (100,000 requests a day), scrape.do credits.
- **Output:** a short report of the numbers where things slowed or failed, the first limit to hit, and what fixing it would cost.

Done when: the site holds the expected launch load (to be set at the time) with pages under 2 s and no wrong claim results, and the first limit to hit is written down with its fix.

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
      [P0 Base][P1 Circles][P2 Wishlist][P3 Secret ★][P4 Parsing][P4.6 Onboarding][P5 PWA+QuickAdd][P5.5 Plans][P6 Prices][P7 Growth][P8 APK?]
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
5. ~~Monetisation: affiliate-only, or freemium too?~~ Decided 19 Nov 2026: freemium (Free, Pro and an Event pass, see Phase 5.5) alongside affiliate links.
6. Make the GitHub repo public? (Unlimited free Actions minutes and F-Droid eligibility, but the code becomes visible; secrets stay safe in repo secrets.)

---

## 7. Ideas to plan later (added 19 Nov 2026)
Not scheduled yet. Each needs a short design pass before building.

1. **Buy something for yourself.** On My list, an option to mark one of your own wishes as bought by you (a treat, or you gave up waiting). Open points: what it's called ("I bought it myself"?), whether it moves straight to Received or to its own "Bought myself" group, and what Circle members see. It must never look like a giver's claim, and a giver who already reserved it should be told gently, without revealing who else did.
2. **See which Circles each wish is shared with, on My list.** Today that's only visible inside the edit sheet. The page is clean, so keep it light. Option to try first: small Circle dots or the Circle icon beside the edit button on each wish (one dot per Circle, with a tooltip or label, and "Only you" when it's in none). Other options: a "Shared with" filter dropdown next to the existing filters, or tapping the dots to change sharing without opening the sheet. Must work at 375 px in both Strip and List views and with long Circle names.
3. **Affiliate links (a way to cover running costs). Built and live (19 Nov 2026, 1295c69):** opening a wish on amazon.in adds the tag `gifthub0e-21`, and on amazon.com the tag `gifthub0c-20` (code in `web/src/lib/affiliate.ts`). Short `amzn.in` links, other Amazon countries, other stores and links that already have a tag are left alone. Disclosure line under "Open in store" on Amazon wishes; Terms and Privacy updated. Both Associates accounts close around 18 May 2027 if there are no qualifying sales by then. Still to do: other stores (Flipkart, Cuelinks or EarnKaro). The original note follows. Why: a shared wishlist is something people can do for free elsewhere, so few will pay for it, yet a large user base costs money (storage, Worker and database use, link reading). Affiliate commission earns from purchases people already make, without charging them. How: keep the pasted link as it is; when someone taps "Buy", the Worker adds GiftHub's Amazon Associates tag on the way out, so the tag can change or be turned off without touching saved wishes. Later, other stores too (Flipkart's own program, or a network such as Cuelinks or EarnKaro for Croma, Myntra and others). Checks before building (confirm against the current Amazon terms): join near launch, since a new Associates account is usually closed without about 3 sales in its first 180 days; a visible disclosure in the app and the privacy policy; the app's domain registered on the account; never overwrite a tag already in a pasted link; your own purchases don't earn (so not on "Buy something for yourself"). Commission is low (roughly 1–9% on amazon.in, short cookie), so it complements Phase 5.5 plans rather than replacing them.
