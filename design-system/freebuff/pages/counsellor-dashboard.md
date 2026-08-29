# Counsellor Dashboard — Page Override

Overrides `MASTER.md` for the counsellor-facing views.

## Layout

- **Case queue:** `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))`
- **Stats row:** `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`
- **Max width:** 80rem (main-content container)

## Case Cards

- Icon container: 40×40, stage-appropriate background
- Urgent indicator: 3px top border `--risk-high`
- Band badge: top-right of card header
- Stats: score (1.35rem bold) / check-ins / trend (with arrow + color)
- Trigger reasons: pills with `--risk-high-bg` background

## Alert Cards

- Left border: 4px `--risk-high`
- Layout: pseudonym + band badge + score → adjusted + trigger reasons
- Case ID: right-aligned, muted

## Empty State

- Centered card, 3rem padding
- Checkmark icon (not emoji — use SVG)
- "No active alerts" heading in `--risk-low`
- Muted description

## Interactions

- Cards are clickable → `cursor: pointer`
- Hover: subtle shadow elevation change
- Click navigates to case detail

## Accessibility

- Convert clickable `<div>` to `<button>` or add `role="button"` + keyboard handlers
- Band badges convey meaning via text, not color alone
- Trend uses text arrows (↗ ↘ →) alongside color
