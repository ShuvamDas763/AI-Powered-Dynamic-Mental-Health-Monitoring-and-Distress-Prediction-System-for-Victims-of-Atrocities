# Login Page — Page Override

Overrides `MASTER.md" for the login/role-selection view.

## Layout

1. Hero section: full-width `--accent` background, white text
2. Card grid: negative-margin overlap, max-width 48rem, centered
3. Footer disclaimer: centered, muted

## Hero

- Badge: "SIH26094 · Prototype", pill style, white/10% bg
- H1: clamp(1.6rem, 4vw, 2.2rem), white
- Description: white/80% opacity
- Sub-description: 0.88rem, white/70% opacity

## Role Cards

- Grid: `repeat(auto-fit, minmax(280px, 1fr))`, gap 1.25rem
- Card: `card card-elevated`, cursor pointer
- Icon container: 48×48, `--accent` (counsellor) or `--warm` (admin), rounded, shadow-md
- **Replace emoji icons with SVG** (currently 🩺 and 📊)
- Title + subtitle in header row
- Description: 0.88rem, `--ink-soft`
- CTA: sunken footer bar, muted text, "Sign in with demo credentials →"

## Footer

- Centered, max-width 36rem
- Disclaimer: 0.82rem, muted
- Attribution: 0.75rem, 70% opacity

## Interactions

- Card click triggers sign-in (not a separate button)
- Hover: subtle shadow elevation
- Busy state: disabled clicks

## Accessibility

- Convert to `<button>` elements or add `role="button"` + keyboard handlers
- Replace emoji icons with accessible SVG alternatives
