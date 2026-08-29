# Check-in Chat — Page Override

Overrides `MASTER.md` for the check-in conversation view.

## Case Selection

- Grid: `repeat(auto-fill, minmax(280px, 1fr))`
- Card-buttons: border 1.5px `--line`, hover → `--accent-light` border + shadow-md
- Locale indicator: 36×36 circle, `--accent` bg, white text (अ/En)
- Label + description below icon

## Chat Interface

- Container: `max-height: 72vh`, flex column
- Messages: flex column, gap 0.75rem, smooth scroll
- Bubble max-width: 72% (desktop) → 88% (mobile)

### Bubble Styles

| Type | Background | Text | Alignment | Radius |
|------|-----------|------|-----------|--------|
| System | `--accent-pale` | `--accent` | Left | bottom-left: 2px |
| Person | `--accent` | white | Right | bottom-right: 2px |

### Typing Indicator

- Three pulsing dots (opacity animation)
- "Analysing..." text
- System bubble style, opacity 0.7

## Assessment Summary

- Flex row below messages: score + band badge + escalation warning + provenance
- Escalated: `--risk-high-bg` background, border
- Not escalated: `--surface-sunken` background
- Provenance: 🟢 Live or 📺 Cached (replace emoji with SVG)

## Input

- Flex row: text input + send button
- Top border separator
- Input: 0.65rem 0.85rem padding, `--line-strong` border, focus → `--accent-light` + glow
- Send button: default variant, disabled when empty or busy

## Accessibility

- Chat input auto-focused on view load
- Assessment summary: add `role="status"` for screen readers
- Replace emoji provenance indicators with text labels
