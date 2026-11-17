---
version: 1
slug: "design-circle-workspace-html"
primary_target: "design/circle-workspace.html"
related_targets: ["web/src/components/AppShell.tsx"]
---

# Circle workspace (app shell + member lists)

Scope: the app's working screens (Circle workspace, My list, Received), starting with the Circle workspace. Mode: Operate.
Audience/job: a giver browsing a partner's list on a phone before an occasion, claiming one gift; an owner adding and managing wishes.
Constraints from the user (2026-11-17): cute and fun but clean; not childish, not cluttered; copy stays calm (PRODUCT.md voice); the ribbon-and-bow claim wrap stays.

## Direction contract

THESIS: Every wish is a frame in your partner's photo-booth strip. Refuses the category's white Pinterest masonry with heart buttons.

OWN-WORLD: Booth-curtain blush ground, glossy white print borders with a thicker bottom edge, plum ink, one tomato-red ribbon for claims, sky blue for selection, a small orange date stamp in each photo's corner. Bricolage Grotesque throughout, three sizes, rank by weight. Pills for small controls, 6px print corners, no shadows beyond a 1px print edge.

STORY: Sam opens Maya's strip, sees what she wants most and what is already wrapped, reserves one, and knows Maya's screen will never change.

FIRST VIEWPORT: Phone: wordmark and Circle pill on the blush ground; "Maya's list" heading with the next occasion line; member pills; occasion chips; a two-up strip of white-bordered frames (photo with date stamp, store, title, price, priority hearts, Reserve). Bottom nav on white; adding a wish is the paste-a-link pill under the heading (no floating Add button: it duplicated the bar and tomato is reserved for claims; user answer 2026-11-17 "not cluttered"). Desktop adds a white rail on the left and a 4–5-up strip.

FORM: Photo Booth Strip, candidate 6 of 7 on my ordered list. seed:e52ca08be9d5c2eb. Raises: states mark the frame (ticket wallet); three type sizes, weight carries rank (timetable); truly dense List view (high-density); one frame ratio on one white ground (botanical); claims update in place, zero layout shift (split-flap).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
