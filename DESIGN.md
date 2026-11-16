---
name: GiftHub
description: A private shared wishlist where claimed gifts are wrapped for givers and invisible to the recipient.
colors:
  tissue-paper: "#F1F2F6"
  surface: "#FFFFFF"
  navy-ink: "#20233F"
  ink-hover: "#2E3258"
  slate-muted: "#5D6280"
  placeholder: "#8A8FA8"
  hairline: "#DCDFE8"
  hairline-hover: "#B9BDCC"
  quiet-fill: "#E6E8EF"
  meter-off: "#D3D6E2"
  berry-ribbon: "#B0174F"
  berry-deep: "#8C0F3D"
  berry-knot: "#5A0725"
  berry-wash: "#F8E4EB"
  sale-green: "#1C7350"
  sale-wash: "#E2F2EA"
  focus-blue: "#3B5BDB"
typography:
  display:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "clamp(28px, 3.6vw, 40px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  price:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    fontFeature: "\"tnum\" 1"
rounded:
  meter: "1px"
  badge: "6px"
  control: "8px"
  toast: "10px"
  tile: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  2xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  input-link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  chip:
    backgroundColor: "{colors.tissue-paper}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.pill}"
    padding: "0 13px"
    height: "34px"
  chip-selected:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.surface}"
  badge-sale:
    backgroundColor: "{colors.sale-wash}"
    textColor: "{colors.sale-green}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  product-tile:
    rounded: "{rounded.tile}"
  toast:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.toast}"
    padding: "12px 16px"
---

# Design System: GiftHub

## Overview

**Creative North Star: "Tissue and Ribbon"**

GiftHub looks like the inside of a gift box: cool tissue-paper surfaces, navy ink for everything you read, and a single berry ribbon that only appears when someone has claimed a gift. The interface stays calm and plain, as the product voice does, so the ribbon is the one thing that feels like an event.

Density is moderate. Product imagery leads in the grid and steps back in the list, and controls are familiar and quiet so givers can scan a partner's list quickly on a phone. Depth comes from tone and hairlines, not shadows.

The system rejects the warm cream-and-terracotta look, black-with-neon accents, and the generic SaaS card kit (identical shadowed cards and gradient washes).

**Key Characteristics:**
- Cool, near-white tissue background with navy ink; no pure black anywhere.
- Berry is reserved for claims: the ribbon, claim status text, and nothing else.
- One typeface (Schibsted Grotesk) carries every role through weight and size alone.
- Flat surfaces separated by hairlines and tonal fills.
- Priority shown as a 10-step meter plus its band name, never as a lone number in the grid.

## Colors

A cool, low-chroma neutral world with one warm, saturated accent kept for the act of giving.

### Primary
- **Berry Ribbon** (berry-ribbon): the ribbon band across a reserved item's tile and the "Reserved by you" / "Bought by you" status text. It means "a giver has claimed this".
- **Berry Deep** (berry-deep): the ribbon on bought items, and the bow on reserved ones.
- **Berry Knot** (berry-knot): the bow on bought items, so it stays visible against the deep ribbon.
- **Berry Wash** (berry-wash): pale berry tint for future claim-related backgrounds (e.g. activity rows).

### Secondary
- **Sale Green** (sale-green) on **Sale Wash** (sale-wash): Sale badge, "On sale" text, and price-drop states only.

### Neutral
- **Navy Ink** (navy-ink): all primary text, the primary button, selected chips, the active tab underline, filled meter steps, and toasts.
- **Ink Hover** (ink-hover): hover state for navy-filled controls.
- **Slate Muted** (slate-muted): secondary text such as store domain, occasion, counts, and helper notes.
- **Placeholder** (placeholder): input placeholder text only.
- **Tissue Paper** (tissue-paper): the app background.
- **Surface** (surface): inputs, buttons, notes, and the selected Circle in the sidebar.
- **Hairline** (hairline) / **Hairline Hover** (hairline-hover): every border and divider, and the border colour on hover.
- **Quiet Fill** (quiet-fill): nav hover and the selected segment in segmented controls.
- **Meter Off** (meter-off): unfilled priority-meter steps.
- **Focus Blue** (focus-blue): keyboard focus rings only.

Product tiles use pale per-item tints (around 90–94% lightness, such as #E3E7F4, #F3E6DF, #E2EEE6) behind the product image or placeholder. They are content colour, not system tokens.

### Named Rules
**The Ribbon Is Earned Rule.** Berry appears only where a claim exists. It is never used for decoration, brand flourishes, primary buttons, or links.

**The Owner Never Sees Berry Rule.** On any screen showing a user their own items, no berry renders, because a claim would be the only reason for it.

## Typography

**Display Font:** Schibsted Grotesk (with system-ui, sans-serif)
**Body Font:** Schibsted Grotesk

**Character:** A sturdy, slightly newsy grotesk. It is heavy and tight in headings, plain and readable in body text, and works as a single family.

### Hierarchy
- **Display** (800, clamp(28px, 3.6vw, 40px), 1.05, -0.03em): the page heading, e.g. "Maya's list". One per screen.
- **Title** (600, 15.5px, 1.3; 14.5px on phones): item titles and sidebar wordmark-level labels.
- **Body** (400, 15px, 1.5): running text, notes, and empty states, kept under 72ch.
- **Label** (500, 13px): store domain, occasion, counts, and meter band names, in sentence case.
- **Price** (700, 15px, tabular figures): prices; a struck-through previous price sits beside it at 400, 14px, in slate.

### Named Rules
**The Sentence Case Rule.** No all-caps labels, no tracked-out eyebrows, and no monospace. Hierarchy comes from weight and size.

## Layout

The app shell is a 248px sidebar (wordmark, sections, Circles, invite code) beside a fluid main column, with main padding of clamp(16px, 3.4vw, 44px). Below 900px the sidebar becomes a sticky top bar (wordmark plus a Circle picker) and a fixed bottom nav (My list, Circles, Activity, Received).

Main column order: heading and next-occasion line on the left with the paste-a-link box on the right (full width on phones), then member tabs, then tools (occasion chips, then the owner-preview switch, sort and Grid/List), then an optional note, then items.

The grid uses auto-fill columns at least 232px wide with 28px row and 22px column gaps, and exactly two columns on phones. The list view uses rows of thumbnail, title, price, priority and claim; priority and occasion drop out on phones, and claim actions wrap under the title. Occasion chips scroll horizontally on phones instead of wrapping.

The layout must work from 360px wide with no horizontal scroll.

## Elevation & Depth

Flat. There are no shadows on cards, buttons or tiles. Depth comes from the tissue-to-surface tonal step and 1px hairlines. The selected sidebar item uses an inset hairline instead of a shadow. The toast is the only floating layer, and it is set apart by being filled with navy ink, not by a shadow.

**The Flat Box Rule.** If something needs to stand out, change its fill or border, not its elevation.

## Shapes

Corners are gently rounded and step up with object size: the meter at 1px, badges at 6px, controls at 8px, the toast at 10px, product tiles at 12px, and chips and switches as full pills. Product tiles clip their contents so the ribbon runs edge to edge. Item metadata sits directly on the tissue background beneath the tile, with no card around it.

## Components

### Buttons
- **Shape:** gently rounded (8px).
- **Primary:** navy fill with white 600-weight text, 44px tall. Used for the main action of a section, such as Add.
- **Secondary:** white surface with a hairline border, 36–44px tall. Used for Reserve and similar per-item actions.
- **Text button:** underlined slate text, which darkens to navy on hover. Used for secondary claim actions (I bought it, Mark bought, Undo, Mark received).
- **Hover / Focus:** primary moves to ink-hover; secondary's border darkens to hairline-hover. Focus is a 2px focus-blue outline with a 2px offset.

### Chips
- **Style:** pill, 34px tall, hairline border, transparent fill, 500-weight 14px text.
- **State:** selected chips fill with navy and white text. They are single-select filters with an aria-pressed state.

### Product tile (signature)
- A 4:3 tile (1:1, 56px, in the list view) with a pale item tint, the product image centred, and an optional Sale badge in the top-left corner.
- **The ribbon:** when claimed, an 18px vertical band at 68% and a horizontal band at 58% cross the tile, with a bow at the crossing. Reserved items use berry-ribbon with a berry-deep bow; bought items use berry-deep with a berry-knot bow. The product art dims to 45% opacity under it. In the list view the bands are 6px and there is no bow.
- **Motion:** the vertical band draws down (380ms), then the horizontal band sweeps across (starting 160ms later), then the bow pops in with a slight overshoot (starting at 420ms). This is the only orchestrated animation in the system, and it is removed when reduced motion is requested.

### Priority meter
Ten 4×12px bars with 2px gaps, filled in navy up to the priority value, followed by the band name (Must have, Would love, Nice to have). The list view shows the number instead of the band name.

### Inputs / Fields
- **Style:** white surface, hairline border, 8px radius, 44px tall, 14px horizontal padding, with placeholder-colour hint text. The paste-a-link field pairs with a primary Add button.
- **Focus:** the focus-blue outline.
- **Error:** a plain-language toast saying what to do next (e.g. "That doesn't look like a link. Copy the address from your browser and try again.").

### Navigation
- **Sidebar:** 500-weight items with counts in slate; hover fills with quiet-fill; the selected Circle gets a white surface and an inset hairline.
- **Member tabs:** 600-weight text in slate; the selected tab is navy with a 2px navy underline sitting on the hairline divider.
- **Bottom nav (phones):** 12px 600-weight labels in slate; the current section is navy.

### Notes and toasts
- **Note:** white surface, hairline border, 8px radius, a 16px lock icon, and slate text with a navy bold lead-in. Used for privacy explanations.
- **Toast:** navy fill, white 14px text, bottom-centred (raised above the bottom nav on phones). It rises 20px and fades in, then dismisses after 3.2s.

## Do's and Don'ts

### Do:
- **Do** keep berry for claims only, so a ribbon always means "someone is giving this".
- **Do** show price in tabular figures and format it in the item's own currency, for the viewer's locale.
- **Do** put store domain, title, price with priority, then occasion, in that order under every product tile.
- **Do** separate surfaces with 1px hairlines and tonal fills.
- **Do** keep visible 2px focus-blue focus rings on every interactive element.

### Don't:
- **Don't** render any claim colour, badge, count, or motion on a screen showing users their own items.
- **Don't** add drop shadows to cards, tiles, or buttons.
- **Don't** use all-caps labels, tracked eyebrows, monospace labels, or arrows appended to button text.
- **Don't** wrap item metadata in bordered or shadowed cards; it sits on the tissue background.
- **Don't** add a second display typeface or decorative motion beyond the ribbon wrap.
