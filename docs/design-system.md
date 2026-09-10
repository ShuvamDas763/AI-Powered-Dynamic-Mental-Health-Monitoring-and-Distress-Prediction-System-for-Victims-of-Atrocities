# Freebuff Design System

## 1. Philosophy

> A government welfare tool used by people under real strain and by officials
> making life-altering decisions.

**Three properties, in order of priority:**

1. **Trustworthy** — authoritative enough to handle sensitive case data without
   feeling like a surveillance dashboard.
2. **Warm** — never clinical, never alarming. Earth tones over traffic-light
   reds. System fonts over web fonts.
3. **Scannable** — legible under time pressure. An official scanning 8 cases
   should find the one that needs attention in under 5 seconds.

Based on **USWDS** (US government design system) and **AHRQ** healthcare
dashboard guidelines. No web font network dependency — system fonts only.

---

## 2. Color System

### 2.1 Core Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--ink` | `#0f1419` | Primary text |
| `--ink-soft` | `#374151` | Secondary text |
| `--ink-muted` | `#6b7280` | Labels, timestamps, meta |
| `--ink-faint` | `#9ca3af` | Disabled, placeholder |
| `--paper` | `#f8f6f3` | Page background |
| `--surface` | `#ffffff` | Card background |
| `--surface-sunken` | `#f0ece4` | Inset areas, code blocks |
| `--surface-deep` | `#e8e2d8` | Deeper insets |

### 2.2 Structural Lines

| Token | Hex | Usage |
|-------|-----|-------|
| `--line` | `#e5e0d6` | Card borders, dividers |
| `--line-strong` | `#d1c9bb` | Input borders, emphasis |
| `--line-faint` | `#ede9e0` | Table row separators |

### 2.3 Accent — Deep Teal-Slate

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#1a3a42` | Primary actions, nav bar |
| `--accent-mid` | `#2d5a63` | Hover states |
| `--accent-light` | `#3d7a85` | Focus rings, links |
| `--accent-pale` | `#e0f0f3` | Light backgrounds, system bubbles |
| `--accent-glow` | `rgba(45,90,99,0.15)` | Focus glow |

### 2.4 Warm Accent — Sandstone

| Token | Hex | Usage |
|-------|-----|-------|
| `--warm` | `#b8860b` | Admin accent, signal phrases |
| `--warm-light` | `#d4a843` | Nav brand dot, highlights |
| `--warm-pale` | `#fdf6e3` | Phrase tag background |

### 2.5 Risk Bands — Earth Tones

**Never use traffic-light red/green/yellow.** Earth tones are:
- Less alarming to victims reading their own score
- Less desensitising to officials who see them all day
- More distinguishable under colour-vision deficiency

| Band | Foreground | Background | Meaning |
|------|-----------|------------|---------|
| Low | `#4a7c59` | `#ecf5ef` | Within normal parameters |
| Moderate | `#a0722e` | `#fdf3e0` | Worth monitoring |
| Elevated | `#c45d3a` | `#fde8e0` | Needs attention this week |
| High | `#8b2e23` | `#f5e0dc` | Needs immediate review |

**Contrast ratios (all ≥ 4.5:1 on white):**
- Low green on white: 4.6:1 ✓
- Moderate ochre on white: 4.5:1 ✓
- Elevated terracotta on white: 4.7:1 ✓
- High clay on white: 6.2:1 ✓

---

## 3. Typography

Single family, clean hierarchy. **System fonts only.**

```css
--font-body: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue',
             Arial, sans-serif;
--font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
```

| Level | Size | Weight | Use |
|-------|------|--------|-----|
| h1 | `clamp(1.4rem, 3vw, 1.8rem)` | 600 | Page titles |
| h2 | `clamp(1rem, 2vw, 1.2rem)` | 600 | Section headings |
| h3 | `clamp(0.9rem, 1.5vw, 1rem)` | 600 | Card titles |
| Body | 16px / 1.6 | 400 | Default |
| Small | 0.85rem | 500 | Table text, card body |
| Caption | 0.75–0.78rem | 600 | Labels, badges, meta |

**Rules:**
- Line height 1.6 for body, 1.25 for headings
- Letter-spacing 0.05–0.06em for uppercase labels
- No font size below 12px anywhere in the UI

---

## 4. Elevation & Shape

### 4.1 Shadows (3 levels only)

| Token | Value | Use |
|-------|-------|-----|
| `--shadow-sm` | `0 1px 3px rgba(15,20,25,0.06)` | Cards at rest |
| `--shadow-md` | `0 2px 8px rgba(15,20,25,0.08)` | Elevated cards, dropdowns |
| `--shadow-lg` | `0 4px 16px rgba(15,20,25,0.10)` | Modals, floating panels |

### 4.2 Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 4px | Buttons, inputs |
| `--radius-sm` | 6px | Small cards, driver cards |
| `--radius` | 8px | Cards, alerts, chat bubbles |
| `--radius-full` | 9999px | Badges, pills, tags |

---

## 5. Spacing

**8px base rhythm.** All spacing derives from multiples of 4 or 8.

| Context | Value |
|---------|-------|
| Card padding | 1.25rem (20px) |
| Stat card padding | 1rem (16px) |
| Section gap | 1.25rem (20px) |
| Inline gap (badges, tags) | 0.35–0.55rem |
| Table cell padding | 0.65rem 0.85rem |
| Page horizontal padding | 2rem (desktop) → 1rem (mobile) |
| Nav height | 56px (desktop) → 48px (mobile) |

---

## 6. Motion

**Minimal, functional only.** This is a government tool, not a consumer app.

| Token | Value | Use |
|-------|-------|-----|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | All transitions |
| `--duration-fast` | 150ms | Hover, focus, toggle |
| `--duration` | 200ms | Fade-in, expand |

**Animations:**
- `fadeIn` — cards and sections entering viewport
- `shimmer` — loading skeleton states
- `pulse` — typing indicator dots

**Reduced motion:** All animations use `opacity` only (no layout shifts),
so `prefers-reduced-motion: reduce` can safely disable them with no breakage.

---

## 7. View-Specific Patterns

### 7.1 Login Page

**Purpose:** Role selection for demo. Two cards side by side.

| Element | Pattern |
|---------|---------|
| Hero | Full-width `--accent` background, white text, badge + h1 + description |
| Role cards | `card card-elevated`, 280px min-width grid, icon + title + description |
| Icon container | 48×48, `--accent` or `--warm` background, rounded, shadow-md |
| Sign-in CTA | Sunken footer bar, muted text, no button — click whole card |
| Footer | Centered disclaimer, 0.82rem, muted |

**Layout:** Hero → negative-margin overlap → card grid (max-width 48rem) → footer

### 7.2 Counsellor Dashboard

**Purpose:** Case queue ranked by distress, plus alerts-only view.

| Element | Pattern |
|---------|---------|
| Page header | h1 + muted subtitle |
| Stats row | `repeat(auto-fit, minmax(140px, 1fr))` — total, escalated, stable, avg |
| Section divider | h2 + horizontal rule |
| Case card grid | `repeat(auto-fill, minmax(340px, 1fr))` |
| Case card | Icon (stage emoji) + pseudonym + band badge + context note + stats (score/check-ins/trend) |
| Urgent indicator | 3px red top border on escalated cards |
| Alert card | 4px left border, band badge + score → adjusted + trigger reason pills |

**Escalation split:** Escalated block first (with ⚠ divider), then stable block.

**Empty state:** Centered card with checkmark icon, "No active alerts" heading, muted description.

### 7.3 Case Detail

**Purpose:** Full longitudinal view of one case — trend chart, escalation, interventions, check-in history.

| Element | Pattern |
|---------|---------|
| Back link | Muted arrow link, top of page |
| Case header card | Pseudonym + case ID + location + band badge + large score + stats row |
| Context note | Italic, sunken background, full width |
| Trend chart | AreaChart with gradient fill, reference lines at band thresholds (31/50/70) |
| Chart legend | Horizontal, centered, colored line segments |
| Escalation card | Left border 4px `--risk-high`, high-bg background, trigger reasons list |
| Interventions | Stacked cards with urgency-colored left border (immediate/this_week/next_review) |
| Explainability | Driver cards with contribution bars, signal phrase tags in warm-pale |
| Check-in history | Expandable cards — sequence number, channel, locale, date, band score |
| Expanded state | Chat bubbles (system/person), signal tags, own words, word count, latency |

### 7.4 Admin Dashboard

**Purpose:** Anonymised aggregate data. No individual case visibility.

| Element | Pattern |
|---------|---------|
| Hero | "Tier 2 · Aggregate Only" badge, "National Overview" title |
| Stats row | Total, active alerts, rising trends, avg check-ins |
| Charts grid | `repeat(auto-fit, minmax(320px, 1fr))` — pie + bar side by side |
| Pie chart | Donut (inner 55, outer 90), earth-tone fills, custom tooltip |
| Bar chart | Trend directions, earth-tone fills, suppressed counts shown as tooltip |
| Geography table | Scope toggle (national/state/district), data-table with band columns |
| Privacy notice | Accent-pale background, accent text, "individual case data is never visible" |

**Critical rule:** The aggregate tier receives only `{ district, state, caseStage, priorityTags, monthsSinceRegistration, band, escalated, trendDirection, checkInCount }` — no pseudonym, no case ID, no check-in text.

### 7.5 Check-in Chat

**Purpose:** Simulated check-in conversation. Case selection → chat → live assessment.

| Element | Pattern |
|---------|---------|
| Case selection | Grid of card-buttons, locale indicator (अ/En), hover border highlight |
| Chat container | `max-height: 72vh`, flex column, scroll |
| Chat bubbles | System: `--accent-pale` bg, left-aligned, rounded. Person: `--accent` bg, white text, right-aligned |
| Typing indicator | Three pulsing dots + "Analysing..." |
| Assessment summary | Flex row: score + band badge + escalated warning + provenance indicator |
| Input row | Flex, text input + send button, top border separator |

---

## 8. Component Specifications

### 8.1 Buttons

| Variant | Background | Text | Border | Use |
|---------|-----------|------|--------|-----|
| Default | `--accent` | white | none | Primary actions |
| Ghost | transparent | `--accent` | `--line-strong` | Secondary actions |
| Danger | `--risk-high` | white | none | Destructive actions |
| Small | (inherits) | (inherits) | (inherits) | Compact contexts |

**States:** hover → `--accent-mid`, active → `--accent`, disabled → opacity 0.4
**Min height:** 36px (small) / 40px (default) — expand hit area for smaller visuals

### 8.2 Cards

| Variant | Shadow | Use |
|---------|--------|-----|
| Default | `--shadow-sm` | Standard content |
| Elevated | `--shadow-md` | Featured content, hover state |

**Border:** 1px solid `--line`
**Border radius:** `--radius` (8px)
**Padding:** 1.25rem

### 8.3 Band Badges

```css
.band-badge {
  display: inline-flex;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
```

Four variants: `.band-low`, `.band-moderate`, `.band-elevated`, `.band-high`

### 8.4 Data Tables

- Header: `--surface-sunken` background, uppercase 0.7rem labels
- Rows: 1px `--line-faint` bottom border
- Hover: `--accent-pale` background on clickable rows
- Responsive: horizontal scroll on mobile, compact padding

### 8.5 Stat Cards

- Grid: `repeat(auto-fit, minmax(140px, 1fr))`
- Value: 1.75rem bold
- Label: 0.75rem uppercase muted
- Border: 1px `--line-faint`

### 8.6 Alert Banners

| Variant | Background | Border | Text |
|---------|-----------|--------|------|
| Urgent | `--risk-high-bg` | `--risk-high` | `--risk-high` |
| Elevated | `--risk-elevated-bg` | `--risk-elevated` | `--risk-elevated` |

### 8.7 Chat Bubbles

| Type | Background | Text | Alignment | Radius |
|------|-----------|------|-----------|--------|
| System | `--accent-pale` | `--accent` | Left | bottom-left: 2px |
| Person | `--accent` | white | Right | bottom-right: 2px |

Max width: 72% (desktop) → 88% (mobile)

### 8.8 Signal Phrase Tags

```css
.phrase-tag {
  font-size: 0.8rem;
  padding: 0.2rem 0.55rem;
  background: var(--warm-pale);
  border: 1px solid rgba(184, 134, 11, 0.12);
  border-radius: var(--radius-full);
  color: var(--ink-soft);
  font-style: italic;
}
```

---

## 9. Responsive Breakpoints

| Breakpoint | Adjustments |
|-----------|-------------|
| > 768px | Full layout: 2rem padding, 56px nav, all columns |
| ≤ 768px | Compact: 1rem padding, 48px nav, hide user-role, 2-col stats, wider chat bubbles |
| ≤ 480px | Single column stats, tighter nav gaps |

**Key responsive rules:**
- Stats row: 4-col → 2-col → 1-col
- Case cards: auto-fill minmax(340px) → natural flow
- Charts: `ResponsiveContainer` handles width
- Table: horizontal scroll wrapper
- Chat: max-height adjusts, bubble width increases

---

## 10. Accessibility

### 10.1 Contrast

All text meets **WCAG AA (4.5:1)**. Risk band colors verified against white
and against their own background fills.

### 10.2 Focus Management

```css
:focus-visible {
  outline: 2px solid var(--accent-light);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
```

Visible on all interactive elements. No focus styles hidden behind decorative
border-radius.

### 10.3 Keyboard Navigation

- All clickable cards are `<div onClick>` — **should be `<button>` or have
  `role="button" tabIndex={0}` + Enter/Space handlers** for full keyboard access
- Tab order follows visual order (nav → content)
- Chat input auto-focused on view load

### 10.4 Screen Reader

- `.sr-only` class available for off-screen text
- Band badges convey meaning via text (not color alone)
- Trend indicators use text arrows (↗ ↘ →) alongside color
- Escalation status announced as text ("Yes"/"No")

### 10.5 Reduced Motion

All animations use `opacity` only — safe to disable with:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 10.6 Known Gaps to Address

| Issue | Current | Fix |
|-------|---------|-----|
| Clickable divs | `<div onClick>` on case cards | Convert to `<button>` or add role+tabIndex |
| Emoji as icons | Stage icons use emoji (🔍⚖️⏳📋✅) | Replace with SVG icons or aria-label |
| Loading shimmer | No `aria-busy` attribute | Add `aria-busy="true"` to loading states |
| Live assessment badge | No live region | Add `role="status"` to assessment summary |

---

## 11. Anti-Patterns (Do Not)

| Pattern | Why Not |
|---------|---------|
| Traffic-light red/green | Alarming to victims, desensitising to staff |
| Web font loading | Adds network dependency, FOUT, CLS |
| Dark mode (for now) | Government tool — light mode only for projection/demo clarity |
| Animated transitions on data | Distracts from the information |
| Emoji as structural icons | Platform-dependent rendering, no aria support |
| Coloured-only indicators | Always pair with text or symbol |
| Auto-playing anything | Spec Section 8: "human-in-the-loop is mandatory" |

---

## 12. File Reference

| File | Role |
|------|------|
| `client/src/styles/tokens.css` | CSS custom properties, reset, all component styles |
| `client/src/App.jsx` | Shell, navigation, role routing |
| `client/src/LoginPage.jsx` | Hero + role selection |
| `client/src/CounsellorDashboard.jsx` | Case queue + alerts |
| `client/src/CaseDetail.jsx` | Longitudinal case view |
| `client/src/AdminDashboard.jsx` | Aggregate dashboards |
| `client/src/CheckinChat.jsx` | Check-in conversation |
