# Case Detail — Page Override

Overrides `MASTER.md` for the longitudinal case view.

## Layout

1. Back link (muted arrow)
2. Case header card (hero-style)
3. Trend chart
4. Escalation card (conditional)
5. Interventions
6. Explainability panel
7. Check-in history

## Case Header Card

- Elevated card with conditional `--risk-high-bg` when escalated
- Escalated: 4px top border `--risk-high`
- Layout: pseudonym + case ID + location (left) | band badge + large score (right)
- Stats row: check-ins, months since registration, case stage, escalated status
- Context note: italic, sunken background, full width

## Trend Chart

- AreaChart with gradient fill (`--accent` at 20% → 2%)
- Reference lines at band thresholds: 31 (moderate), 50 (elevated), 70 (high)
- Line: 3px `--accent`, dots: 5px with white stroke
- Legend: horizontal, centered, colored line segments

## Escalation Card

- Left border: 4px `--risk-high`
- Background: `--risk-high-bg`
- Header: ⚠ icon + "Escalation Reasons" in `--risk-high`
- Trigger reasons: unordered list
- Details: sunken background, priority-adjusted score + threshold + weight

## Interventions

- Stacked cards, each with urgency-colored left border:
  - Immediate: `--risk-high`
  - This week: `--risk-moderate`
  - Next review: `--risk-low`
- Urgency badge: pill with matching color
- Layout: label + badge (top), description (bottom)

## Explainability

- Driver cards: header (label + contribution), detail text
- Signal phrases: warm-pale background, italic phrase tags
- "Person's own words" label above phrases

## Check-in History

- Expandable cards: sequence number circle + channel + locale + date + band score
- Expanded: chat bubbles, signal tags, own words, word count, latency
- Missed: sunken background, dash in sequence circle
- Escalated: left border `--risk-high`

## Accessibility

- Expand/collapse: use `<button>` with `aria-expanded`
- Chart: provide text summary for screen readers
- Signal tags: semantic list markup
