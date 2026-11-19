---
name: GiftHub
description: A private shared wishlist where every wish is a frame in your partner's photo-booth strip, and claimed gifts are wrapped in ribbon for givers only.
colors:
  blush: "#FFE4EC"
  blush-deep: "#FFD3E0"
  print: "#FFFFFF"
  plum: "#3B1D3F"
  plum-hover: "#552B5A"
  plum-soft: "#74557A"
  placeholder: "#85688A"
  edge: "#F2CFDA"
  heart-off: "#F3D3DD"
  ribbon: "#FF5247"
  ribbon-deep: "#D93A30"
  ribbon-knot: "#A8231B"
  sky: "#7CC4FF"
  sky-wash: "#E2F2FF"
  sky-ink: "#0B4F8A"
  stamp: "#D9570A"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(30px, 4vw, 40px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.25
  small:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  price:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    fontFeature: "\"tnum\" 1"
rounded:
  photo: "3px"
  print: "6px"
  panel: "14px"
  sheet: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "22px"
  2xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.print}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.plum-hover}"
  button-ghost:
    backgroundColor: "{colors.print}"
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  input-link:
    backgroundColor: "{colors.print}"
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "46px"
  member-tab-selected:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.print}"
    rounded: "{rounded.pill}"
    height: "38px"
  chip:
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    padding: "0 13px"
    height: "34px"
  chip-selected:
    backgroundColor: "{colors.print}"
    textColor: "{colors.plum}"
  badge-sale:
    backgroundColor: "{colors.sky-wash}"
    textColor: "{colors.sky-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  print-frame:
    backgroundColor: "{colors.print}"
    rounded: "{rounded.print}"
    padding: "8px 8px 0"
  toast:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.print}"
    rounded: "{rounded.pill}"
    padding: "12px 18px"
---

# Design System: GiftHub

## Overview

**Creative North Star: "Photo Booth Strip"**

Every wish is a frame in your partner's photo-booth strip. The app sits on a booth-curtain blush ground; each product is a glossy white print with a thick caption edge and a small orange date imprint in the photo's corner, the way a film camera burns the day into the picture. When a giver claims something, the booth flashes once and a tomato ribbon wraps the photo. That flash-and-wrap is the one big moment. Everything else moves like paper in a booth: sheets rise, prints slide out, and a few small gift moments (see Motion) stay short and run once.

The look is cute and fun, but kept clean and grown-up for couples: one decoration per frame at most, three type sizes with rank carried by weight, every product at one frame ratio on one white ground, and plain, calm copy (PRODUCT.md voice). Controls are familiar web controls: pills, tabs, a select, a toggle.

This system replaced "Tissue and Ribbon" on 2026-11-17. Merged forward from it: the ribbon-and-bow claim wrap, the rules that the ribbon colour means "claimed" and never appears on an owner's own items, sentence case, and no decorative shadows. It rejects childish sticker-book clutter, the generic white Pinterest masonry with heart buttons, and the warm cream-and-terracotta look.

**Key Characteristics:**
- Blush ground, white print frames, plum ink. No grey UI chrome and no pure black.
- Tomato ribbon is reserved for claims; sky blue carries sale and selection; orange is only the date stamp.
- Bricolage Grotesque for everything, at three sizes (display, body, small); weight carries rank.
- Pills for every small control; prints keep sharp-ish 6px corners like real photo paper.
- Claim changes happen in place: fixed claim slot, zero layout shift.

## Colors

A committed blush shell with white prints, plum ink and three small, single-job accents.

### Primary
- **Ribbon Tomato** (ribbon): the ribbon bands on a reserved item's photo. It means "a giver has claimed this" and nothing else.
- **Ribbon Deep** (ribbon-deep): ribbon on bought items, the bow on reserved ones, claim status text ("Reserved by you", "Bought by you"), and filled priority hearts.
- **Ribbon Knot** (ribbon-knot): the bow on bought items, so it stays visible on the deep ribbon.

### Secondary
- **Sky** (sky): text selection highlight.
- **Sky Wash** (sky-wash) with **Sky Ink** (sky-ink): the Sale badge, "On sale" text and privacy notes ("You won't see who is buying what").

### Tertiary
- **Date Stamp Orange** (stamp): the date-added imprint in each photo's corner: bare orange digits, day first and dotted ("19·11·26"), semibold with wide tracking, no chip. A faint white-and-orange glow keeps them legible over any tint, photo or ribbon.

### Neutral
- **Blush** (blush): the app background (booth curtain). **Blush Deep** (blush-deep): hover on unselected member tabs.
- **Print White** (print): frames, the desktop rail, the bottom nav, inputs, List view panel, notes.
- **Plum** (plum): all primary text, primary buttons, selected tabs and nav items, toasts, focus rings. **Plum Hover** (plum-hover) for its hover.
- **Plum Soft** (plum-soft): secondary text (store, occasion, counts, helper text). **Placeholder** (placeholder): input hints only.
- **Edge** (edge): 1.5px inset outlines on inputs, chips, ghost buttons and segmented controls. **Heart Off** (heart-off): unfilled priority hearts.

Product photos sit on pale per-item tints (around 92–96% lightness, e.g. #E8EEFF, #FFF0E6, #E6F5EC). They are content, not tokens.

### Named Rules
**The Ribbon Is Earned Rule.** Tomato appears only where a claim exists. It is never a brand flourish, a primary button, a floating action button, or a link colour.

**The Owner Never Sees The Ribbon Rule.** On any screen showing users their own active wishes, no ribbon, claim status, claim colour or claim motion renders. The one exception is Received: once a wish is marked received the surprise is over, so a claimed gift wears its ribbon there (tomato if it was reserved, deep if bought), wrapping in as the page opens, without the flash.

## Typography

**Display and body font:** Bricolage Grotesque (with system-ui, sans-serif), loaded from Google Fonts with optical sizes 12–96 at weights 400, 600 and 800.

**Character:** Rounded, slightly quirky grotesque that reads friendly without looking like a kids' app. Heavy and tight in headings, open and plain in body.

### Hierarchy
- **Display** (800, clamp(30px, 4vw, 40px), line-height 1, -0.035em): the page heading, one per screen.
- **Body** (400, 15px, 1.45): running text and the next-occasion line. Item **titles** use the same size at 600.
- **Small** (600, 13px): store, occasion, chips, counts, claim status, toasts, badges. Prices are body size at 800 with tabular figures; a struck-through old price is small at 400.

### Named Rules
**The Three Sizes Rule.** Only display, body and small. Need more emphasis? Change the weight, not the size.

**The Sentence Case Rule.** No all-caps labels, no tracked eyebrows, no monospace.

## Layout

The desktop shell is a 240px white rail with rounded right corners (22px) next to the blush main column, with padding clamp(16px, 3.4vw, 44px). Its content is centred and capped at 1320px, so on wide monitors the list tools stay next to the wishes (five or six frames across at most). The rail holds the wordmark, sections, Circles and the invite code. Below 900px the rail becomes a white top bar (wordmark and profile avatar, rounded bottom corners) and a white bottom nav with rounded top corners (22px).

Touch screens (`pointer: coarse`): every small control keeps its look but gets a 44px-tall hit area (the `tap` class adds an invisible layer above and below). The list's priority and sort selects and the price box can't carry that layer, so they grow to 44px instead. Scrolling chip rows carry 5px of vertical padding so the hit area isn't clipped.

Main column order: heading with the next-occasion line, and the paste-a-link pill beside it (full width on phones); member pills; tools (occasion chips, then the "See it as Maya does" switch, sort and the Strip/List control); an optional note; then items. There is no floating Add button: it would duplicate the paste bar and break the ribbon rule.

**Strip view:** auto-fill columns at least 204px wide, gaps of 22px between rows and 18px between columns. Phones always show two columns with 14px × 12px gaps. Each frame holds a square photo, then the store, title, price with hearts, occasion and a fixed-height claim slot pinned to the bottom.

**List view:** a single white panel with dense rows of a 48px thumbnail, title, price, hearts and claim actions. On phones the hearts are hidden and the claim actions wrap under the title.

The layout works from 360px wide with no horizontal scroll; occasion chips scroll sideways on phones.

## Elevation & Depth

Nearly flat. Depth comes from white prints on the blush ground. A print frame has one soft paper edge (`0 1px 2px rgba(59,29,63,.08)`), and the phone bottom nav has a faint upward one. Controls use inset 1.5px edge outlines, never drop shadows.

**The Paper Edge Rule.** A shadow only ever says "this is a piece of paper on the table". No floating cards, no glows, no hard offset shadows.

## Shapes

- **Photo paper:** prints have 6px corners, and photos inside them 3px.
- **Containers:** panels such as the List view and notes use 14px; the rail and bottom nav use 22px.
- **Controls:** every small control is a full pill. That includes buttons, inputs, tabs, chips, the sort select, segmented controls, badges, toasts and the Circle picker.
- **Icons:** priority hearts and the bow are filled SVG shapes. Product placeholders are 2.6px line drawings.

## Components

### Buttons
- **Primary:** a plum pill with white 600-weight text, 40px tall (46px beside the paste input, 34px inside a frame). It moves to plum-hover on hover.
- **Ghost:** a white pill with an inset edge outline, used for Mark received. The outline darkens to plum-soft on hover.
- **Text button:** small 600-weight text in plum-soft with an underline, used for I bought it, Mark bought and Undo. It turns plum on hover.
- **Focus:** a 2px plum outline with a 2px offset everywhere.

### Member tabs, chips and segmented control
- **Member tabs:** 38px pills. The selected tab is plum with white text and shows the item count at 75% opacity.
- **Occasion chips:** 34px pills with an inset edge. The selected chip is white with an inset plum outline.
- **Strip/List control:** a white pill track. The selected segment is a plum pill.

### Print frame (signature)
- **Frame:** a white print with 8px padding on the top and sides and none at the bottom, plus a square photo.
- **Photo:** the product image on its pale tint, an optional Sale badge in the top-left, and the date imprint ("13·11·26") bottom-right, straight on the photo like a film camera's.
- **Caption:** store, title, price with three hearts (3 = Must have, 2 = Would love, 1 = Nice to have; the band name is the accessible label), occasion, then the fixed claim slot.

### The ribbon claim (signature motion)
- **Bands:** a claimed photo gets a 16px vertical band at 64% and a horizontal band at 58%, with a bow where they cross.
  - **Reserved:** tomato ribbon with a ribbon-deep bow.
  - **Bought:** ribbon-deep with a ribbon-knot bow.
  - The product drawing dims to 40% under the ribbon.
- **List view:** the bands shrink to 5px and the bow is hidden.
- **Motion (wrap):** the frame always starts unwrapped and animates into its claimed state; it is never redrawn already wrapped.
  1. A soft white booth flash peaks at 70% opacity and fades over 600ms.
  2. The vertical band draws down: 550ms, starting at 200ms, with an expo-out ease (cubic-bezier(.22,1,.36,1)).
  3. The horizontal band sweeps across: starting at 400ms.
  4. The bow settles in with a slight overshoot: 500ms, starting at 800ms.
  5. The product drawing dims to 40% over 500ms.
- **Motion (other changes):**
  - Reserved to bought: the ribbon and bow re-colour over 400ms in place, with no re-wrap and no flash.
  - Undo: the bow lifts first (200ms), then the bands retract with an ease-in (300ms).
- In calm mode the ribbon fades in and out in place, with no drawing and no flash.

### Inputs
- **Paste-a-link:** a white 46px pill with an inset edge, hint text in the placeholder colour and a plum Add button.
- **Link reading (add form):** no spinner or card. The Link field's hint line carries the state in plain words: "Getting details from flipkart.com. You can save now." on a new wish ("Reading the page on flipkart.com…" when updating one), then "Filled in from flipkart.com. Check it looks right.", or, when a store refuses, "ajio.com doesn't let us read its pages yet. Fill in the rest yourself." (Honest about limits, never an error colour.) While reading, an empty Name field shows "Reading the page…" as its placeholder. Fields the person typed in are never overwritten. Saved before the read finished: the wish fills in afterwards with one toast, "Details added from flipkart.com." The empty Price field shows "Reading…" meanwhile. Long store titles are shortened to the brand and model ("Samsung Galaxy M35 5G"); the specs they carried go into Notes when Notes is empty.
- **Add form order:** Link, Name, Price and Currency, then Photo (so a photo filled from the link is seen at once), then priority, Occasions, Who can see it, Notes. The image-link field stays folded behind "Use an image link instead" unless it's in use. On phones, "Add to my list" and Cancel stay pinned at the bottom of the sheet on the print colour, above a blush hairline; on wider screens they sit at the end of the form.
- **Errors:** shown as a plain-language toast that says what to do next.

### Navigation
- **Icons:** My list is a gift tag, Circles two overlapping rings, Received an open gift box; 22px line drawings with 2px rounded strokes, like the gift placeholders. Profile is your initials avatar.
- **Rail items:** 600-weight pills with the icon before the label. Hover fills them blush. One plum pill slides behind the current section (white text); Circle links below use a plain plum fill, and their counts turn pale pink.
- **Bottom nav:** icon above a 12px 600-weight label, plum-soft; the current item turns plum (colour only, so nothing shifts). A plum pill sits behind the current icon and slides between items. On Profile it shrinks into a 2px plum ring around the avatar, with a white gap.
- **Phone top bar:** a white sheet with rounded bottom corners (22px) and a faint downward paper edge, mirroring the bottom nav. It holds the wordmark and the **Circle switcher**: a white pill with the other person's face, the Circle's title ("You and Maya") and a chevron. It shows the Circle you're in, or the one you opened last on this device; tapping it opens a sheet of your Circles. With no Circles it reads "Start a Circle". The bar is the app's frame; the page heading below it, on the blush ground, is the page's own name. Brand and page never sit as two stacked headings on the same ground.
- **Wordmark:** the gift mark plus "GiftHub" in plum at 800, -0.03em. 28px mark and 22px text in the phone top bar, 34px and 28px in the rail, 40px and 32px on signed-out screens. It is the only text outside the three sizes; its white bar (or rail) carries the rank, not its size.

### Reading pages (Help, Privacy, Terms, Cookies)
- Public and reachable signed in or out. The same white top bar as the phone app on every width, with "Sign in" or "Back to your list" on the right.
- Display heading, plain lead, "Last updated" in small. A white "On this page" panel when there are more than three sections. Sections sit in one white panel, separated by blush hairlines, with body text held to 68ch.
- FAQ answers open in place under each question, with a chevron that turns; topic chips at the top jump to each group.
- Help · Privacy · Terms · Cookies links sit under the sign-in panel, on Profile and at the foot of each reading page.

### Circles index
- **Your Circles first:** one white panel card per Circle (14px corners, no shadow; hover adds an inset edge outline). A card holds the name at 800, a blush role pill for owners and admins, a chevron, overlapping member initials (up to four, then "+N") and a "With Maya and Sam" line. A single Circle gets one full-width card with larger initials; several sit two to a row from 640px.
- **Adding another:** below a hairline, "Add another Circle" with two chip toggles (Start a new Circle, Join with a code). Each reveals only its form and focuses its field. With no Circles, both forms show directly under the empty state.

### Notes and toasts
- **Note:** sky-wash panel, sky-ink text with an 800-weight lead-in and a lock icon. Used for privacy explanations.
- **Toast:** a plum pill with white small text, bottom-centred and raised above the bottom nav on phones, sized to its text (one line unless it's wider than the screen). It slides up 16px, fades in and dismisses after 3.2s.

## Motion

Motion explains what changed, and a few small moments make giving feel like giving. All of it lives in `web/src/index.css` and `web/src/lib/motion.ts`, with shared timings (`--dur-fast` 150ms, `--dur` 250ms, `--dur-slow` 320ms) and easing (`--ease-out` cubic-bezier(.22,1,.36,1)). Only transform, opacity and clip-path animate.

- **Sheets** rise from the bottom on phones (fade and settle from 640px), 320ms; they leave faster (200ms) however they're closed.
- **Sliding pills:** the bottom bar, rail, Circle tabs and Strip/List switch share one plum pill that slides to the current item (250ms).
- **A new wish prints:** once any sheet has gone, the new frame is revealed top to bottom with a small drop (750ms); the page scrolls to it first if it's off screen. Other frames glide to make room.
- **Removing a wish:** the frame fades and shrinks where it was (220ms) and the rest glide into the gap. Switching to a different list just fades in (150ms).
- **Playful moments** (each once per action, never blocking a tap):
  - Hearts pop as they fill in the priority picker, and dip as they empty.
  - The logo's bow hops when a new wish is saved.
  - Mark received: the frame flies in an arc into the Received tab, and the box icon bounces.
  - Answered hand-off cards fold away.
- **Calm mode** (the device asks for reduced motion, or Fewer animations is on in Profile): no sliding, printing, flying, flash or hops. Fades and colour changes stay, so every state change still shows.

### Named Rules
**The One Big Moment Rule.** The ribbon wrap is the only orchestrated sequence. Everything else is short, single-element and tied to a gift action. No confetti, mascots or sound.

**The Owner Never Sees Claim Motion Rule.** No moment above may hint at a claim on the owner's own active wishes.

## Do's and Don'ts

### Do:
- **Do** keep tomato for claims only, so a ribbon always means "someone is giving this".
- **Do** put every product in the same white print at a square ratio on its pale tint.
- **Do** keep the claim slot a fixed height so claiming never moves anything.
- **Do** use weight, not new sizes, when something needs more emphasis.
- **Do** format prices in the item's own currency, with tabular figures, for the viewer's locale.

### Don't:
- **Don't** render any ribbon, claim status, colour or motion on a screen showing users their own active wishes. Received is the only exception.
- **Don't** add stickers, mascots, confetti or more than one flourish per frame; cute stays clean.
- **Don't** add a floating Add button or any tomato control.
- **Don't** use drop shadows beyond the paper edge, or hard offset shadows.
- **Don't** use all-caps labels, eyebrows, monospace, emoji icons or arrows appended to button text.
