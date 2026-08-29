# Admin Dashboard — Page Override

Overrides `MASTER.md` for the aggregate/admin view.

## Layout

- Hero: full-width `--accent` background with "Tier 2 · Aggregate Only" badge
- Stats row: 4 cards (total, alerts, rising trends, avg check-ins)
- Charts: `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`
- Geography table: full-width with horizontal scroll

## Charts

- Pie: donut (inner 55, outer 90), earth-tone fills, custom tooltip
- Bar: trend directions, earth-tone fills, suppressed counts in tooltip
- All charts use `ResponsiveContainer` for fluid width

## Geography Table

- Scope toggle: segmented control (national / state / district)
- Columns: Region, Cases, Low, Moderate, Elevated, High, Alerts, Rising
- Band column headers use band foreground colors

## Privacy

- Always visible: accent-pale notice at bottom
- "Individual case data is never visible at this level"
- Small buckets (<5 cases) suppressed in geography view

## Critical Rule

The aggregate tier receives ONLY:
`{ district, state, caseStage, priorityTags, monthsSinceRegistration, band, escalated, trendDirection, checkInCount }`

Never: pseudonym, case ID, check-in text, signal phrases, score
