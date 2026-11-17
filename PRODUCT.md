# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Responsive web app installed as a PWA (360 px phones to desktop). A later Capacitor Android wrapper reuses the same web UI and does not change the design language.

## Stack

Decided in `Development Plan.md` §0: React + Vite + TypeScript SPA, TanStack Router, Tailwind CSS + shadcn/ui, TanStack Query + supabase-js, `vite-plugin-pwa`. Backend is Supabase (Postgres, Auth, RLS, Realtime, Edge Functions). Hosted on Cloudflare Workers (static assets) at `gifthub.grave07.workers.dev`.

## Users

Primary: **couples**. Two partners in a private Circle who want to know what the other actually wants, buy it, and keep it a surprise. When needs conflict, the two-person Circle wins.

Secondary: friend groups and families in Circles of 3–20 members, mostly coordinating to avoid buying the same gift. A user can be in several Circles at once (e.g. one with a partner, one with friends).

Jobs:
- Wishers: save things they want from any store, quickly, and signal how much they want each one.
- Givers: browse someone's list before an occasion, pick something, and claim it so no one else buys it.

## Product Purpose

GiftHub is a private, shared wishlist for people who buy gifts for each other. Members keep their own lists, share them into Circles, and claim items to buy without the recipient ever finding out. Success means gifts that are wanted, never duplicated, and still a surprise when opened.

## Positioning

"Secretly Bought": when a giver claims an item, everyone else in the Circle sees it as claimed immediately, but the owner's view never changes. This is enforced in the database (RLS), so claim data is never sent to the owner at all, not just hidden in the UI. The claim is revealed only when the owner marks the item Received ("Bought by Sam").

## Operating Context

- Joining is by a 6-character invite code (unambiguous alphabet, e.g. `K7QX3M`) or a `/join/<code>` link shared through any messaging app.
- Items arrive mostly by pasting a product URL (auto-parsed into image, title, price, store), from the Android share sheet (PWA share target), an iOS Shortcut, or a desktop bookmarklet. Manual entry is the fallback when a store blocks parsing.
- Browsing happens in a Circle workspace with a tab per member, in a Grid (image-first) or List (dense, scannable) view.
- Use clusters around occasions: Anniversary, Birthday, Holiday, Valentine's Day, Just Because.

## Capabilities and Constraints

- Priority 1–10 per item, in bands: 9–10 *Must have*, 6–8 *Would love*, 1–5 *Nice to have*.
- Claim states: *Reserved* and *Bought*; the claimer can undo. Owner can mark *Received*, which reveals the giver and archives the item.
- Price tracking with a *Sale* badge (≥5% below baseline) and was/now display.
- Offline read of cached lists and Circles; queued adds sync later. Web Push for Circle activity (never claim activity to the owner).
- **$0 budget, permanently.** Free tiers only, enforced quotas: 150 active items/user, 10 Circles/user, 20 members/Circle, 30 parses/day, 30 items/page. At 80% of any limit the app goes into waitlist mode.
- Product images load directly from retailer servers; user uploads are resized to ≤100 KB WebP.
- **Global from day one:** multi-currency (per-profile preferred currency), no single home market or retailer set.
- Terminology: *Circle* (group), *Secretly Bought*, *Reserved*, *Bought*, *Received*, *invite code*.
- Joining: a valid, unexpired invite code or `/join/<code>` link adds the person straight away; no owner approval (decided 2026-11-17).
- Undecided (`Development Plan.md` §6): hiding an item from one member inside a Circle; whether other members see *who* claimed or only "Claimed"; affiliate-only vs freemium; public repo.

## Brand Commitments

- Name: **GiftHub**.
- Voice: **calm and plain.** Friendly but understated; the product gets out of the way. Copy explains state clearly rather than performing excitement.

## Evidence on Hand

- Planning documents only: `Wishlist App Product Plan.md` (and `.pdf`), `Development Plan.md`, `Free Tier Build Plan.md`.
- No logo, product imagery, users, testimonials, metrics, or press yet. Future work must not invent any of these.

## Product Principles

1. **The surprise is sacred.** Nothing in the owner's experience (UI, notifications, network traffic, counts, timing) may hint that an item was claimed.
2. **Two people first.** Design every flow so it is effortless for a couple; groups scale from that, not the other way round.
3. **Adding a wish should take seconds.** Share-to-save and paste-to-parse are the main path; manual entry is a graceful fallback, not a punishment.
4. **Honest about limits.** Free-tier quotas, parse failures, and offline states are explained plainly, never hidden or dressed up.
5. **Works on any store, in any currency.** No feature assumes one country or retailer.
6. **Each Circle is its own room.** Nobody can tell which other Circles a member belongs to: not their names, count, members, or which other Circles an item is shared with. A partner must never learn from GiftHub that the other is in another group. Claims made from another Circle show only as "Already claimed", never the Circle or the claimer. Enforced by RLS, like the surprise rule.

## Accessibility & Inclusion

- Lighthouse accessibility score ≥90 is a launch gate (Phase 5).
- Fully usable from 360 px wide phones; mobile is the primary browsing context for the List view.
- Global audience: currencies and prices must format by locale.
