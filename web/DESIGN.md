# RideFinder Design System — "High Desert Night"

Small, complete, hand-written CSS system. Dark-first for 2am desert screens; warmth comes
from the accent, never from muddying the neutrals. One accent (ember) for action + driver
identity; violet strictly for rider identity. Mobile-first, desktop-native at ≥768px.

## 1. Tokens (web/src/styles/tokens.css is the single source of truth)

### Color
| Token | Value | Role |
|---|---|---|
| `--bg` | `#121110` | App background (near-black, faint warmth) |
| `--surface` | `#1c1a18` | Cards, bars |
| `--surface-2` | `#26231f` | Inputs, hover states, nested chips |
| `--surface-3` | `#312d27` | Active/pressed surfaces |
| `--border` | `#3a352e` | Default 1px lines — must be *visible* |
| `--border-strong` | `#4c463d` | Focused/hovered borders |
| `--text` | `#f2ede4` | Primary text (≥13:1 on bg) |
| `--text-dim` | `#b5aa9c` | Secondary text (≥4.6:1 on surface) |
| `--ember` | `#ff6b35` | THE accent: primary buttons, links, driver identity, active nav |
| `--ember-press` | `#e0592a` | Pressed primary |
| `--ember-soft` | `rgba(255,107,53,.15)` | Tinted fills (active segment, my-bubble, driver pill) |
| `--violet` | `#a78bfa` | Rider identity ONLY (rail, pill, section header) |
| `--violet-soft` | `rgba(167,139,250,.15)` | Rider tinted fill |
| `--ok` | `#57c785` | Success |
| `--warn` | `#f0b429` | Offline bar, pending/expired pills |
| `--danger` | `#ef6461` | Destructive text/borders |
| `--focus` | `--ember` | 2px outline, 2px offset, on :focus-visible everywhere |

Rules: never place `--text-dim` on `--surface-3`; pills always pair a `-soft` bg with its
full-strength text color; exactly ONE solid-ember element per card/section (the primary action).

### Type (system-ui stack)
`--fs-xs .8125rem · --fs-sm .875rem · --fs-md 1rem · --fs-lg 1.125rem · --fs-xl 1.375rem · --fs-2xl 1.75rem`
Weights 400/600/700. Body line-height 1.5; headings 1.25. Page title = xl/700; section title = lg/700;
card name = md/700; meta = sm/400 dim; micro (timestamps, pill text) = xs/600.

### Space / radius / shadow / motion
Space scale (px): 4, 8, 12, 16, 20, 24, 32, 48 → `--sp-1..--sp-8`. All margins/paddings/gaps
come from this scale — no arbitrary values.
Radius: `--r-sm 6px` (pills-inner, inputs-inner), `--r-md 10px` (controls), `--r-lg 14px` (cards, sheets), `--r-full 999px` (pills, icon buttons, segments).
Shadow: `--shadow-1: 0 1px 2px rgba(0,0,0,.5)` (cards), `--shadow-2: 0 12px 32px rgba(0,0,0,.5)` (sheets/modals/popovers).
Motion: `--t-fast 120ms ease-out`, `--t-med 200ms ease-out`. Reduced-motion kills all.

### Control metrics
`--control-h: 44px` (mobile) → `40px` at ≥768px. EVERY button (non-icon), input, and select is
exactly `--control-h` tall. Icon buttons are 40×40 always. Touch targets never < 40px.

## 2. Controls

**Buttons — three tiers + icon, used by rule:**
- `.btn` (primary): ember bg, `#1a0d06` text (dark-on-ember for AA), 600 weight, radius md; hover brightness(1.06); active `--ember-press`. Max ONE per card/section/modal.
- `.btn-secondary`: `--surface-2` bg + `--border`, `--text`. Hover `--surface-3` + `--border-strong`.
- `.btn-danger`: transparent bg, `--danger` text + border-color transparent; hover: `rgba(239,100,97,.12)` bg + danger border. Always confirm before acting.
- `.btn-ghost`: bare text-dim; hover text + `--surface-2` bg. For "More filters", "+ share contact", back links.
- `.icon-btn`: 40×40, radius full, centered glyph, hover `--surface-2`; MUST have aria-label. Star (favorite) and ⋯ (overflow) use this.

**Inputs/selects/textarea:** `--surface-2` bg, 1px `--border`, radius md, height `--control-h`
(textarea auto), padding-inline `--sp-4`; placeholder `--text-dim`; focus = focus ring + `--border-strong`.
Selects get a custom chevron (inline SVG data-URI, `--text-dim`) and `appearance: none`.

**Segmented control (one component, `.seg`):** container `--surface-2`, radius full, 3px padding,
inline-flex. Option: radius full, height calc(var(--control-h) - 6px), padding-inline `--sp-4`,
text-dim. Active option: `--ember-soft` bg + `--ember` text + 600 — NOT solid ember.

**Pills (`.pill`):** radius full, xs/600, padding 3px 10px, min-height 24px (display metadata, not a target).
Variants: neutral (surface-2 + border + text-dim), `.pill-driver` (ember-soft/ember), `.pill-rider`
(violet-soft/violet), `.pill-warn` (warn-soft/warn — Expired, Waiting to sync), `.pill-dim` (Cancelled).

## 3. Card anatomy (the core fix — everything CONTAINED)

```
┌─ .card ─ surface, 1px border, r-lg, shadow-1, overflow hidden ──┐
│▌ 3px type rail (ember=driver / violet=rider) as inset border    │
│  header row: [type pill] [route: "→ BRC · Sat, Aug 29" sm/600]  │
│              [spacer] [☆ icon-btn]                              │
│  identity:   Name (md/700) · Location (sm dim)                  │
│  meta row:   time slot · pills (seats, gear) — wraps            │
│  details:    collapsed; "Details ▾" ghost toggle                │
│  ─ footer: border-top --border, padding-top sp-3 ─              │
│  [Message .btn]                    [⋯ icon-btn → menu]          │
│  (own card: [Edit .btn-secondary] [Cancel .btn-secondary]      │
│             spacer [Delete .btn-danger])                        │
└─────────────────────────────────────────────────────────────────┘
```
Footer buttons NEVER escape the card. Route line is the second-loudest element (after name).
Copy: pluralize ("1 seat"/"3 seats"); "Details" not "More…".

## 4. Layout & patterns

- **Container:** max-width 1080px, padding-inline `--sp-4` mobile / `--sp-6` desktop.
- **Filter bar:** row 1 = two `.seg` controls (direction, kind) wrapping. Row 2 = CSS grid
  `repeat(auto-fit, minmax(160px, 1fr))` gap sp-2 — day select, city search, gear select all
  identical height/width rhythm. Row 3 = "More filters" `.btn-ghost` with chevron; expanded
  checkboxes become toggle pills. Sticky ≥768px only.
- **Board:** two-column grid ≥1024 (gap sp-6); section headers: emoji + lg/700 title + neutral
  count pill; driver header text plain `--text` (not orange) — identity lives in the cards.
- **Thread:** scrollable message area with composer as ONE bordered bar docked at bottom
  (fixed above TabBar on mobile; at container bottom on desktop with messages filling the
  space above, anchored bottom via flex column + margin-top:auto on message list).
  Composer bar: borderless textarea inside + bottom row [+ Contact `.btn-ghost`] [spacer]
  [Send `.btn`]. Bubbles: mine = ember-soft bg, radius lg with 4px bottom-right corner; theirs =
  surface-2, 4px bottom-left; max-width min(78%, 560px); timestamp BELOW bubble, xs dim;
  day divider = hairline + centered xs/600 dim label.
- **Modal/sheet:** mobile = bottom sheet (slide-up t-med, radius-top lg, drag-handle bar);
  desktop = centered 480px card, backdrop rgba(0,0,0,.6). One primary button, right-aligned
  in a footer row with `.btn-secondary` Cancel left of it.
- **Inbox rows:** 64px min, unread dot (8px ember) column + name(600)/preview(dim, 1-line
  ellipsis) + right column time xs dim; hover surface-2; entire row is the link.
- **Profile:** single 640px column; each section = `.card` with lg/700 title; recovery code
  block keeps monospace xl letter-spaced on `--surface-2`.
- **Status bar:** warn bg, `#1a1204` text, docked above header (existing behavior).
- **Empty states:** icon-less; md dim title + sm dim hint, centered, sp-8 vertical padding.

## 5. Accessibility contract
AA contrast minimum everywhere (checked: text 13:1, dim 4.6:1, ember-on-bg 6:1, dark-on-ember 8:1);
:focus-visible ring on every interactive element; icon buttons labelled; touch ≥40px;
`prefers-reduced-motion` respected; hit areas never rely on hover alone.
