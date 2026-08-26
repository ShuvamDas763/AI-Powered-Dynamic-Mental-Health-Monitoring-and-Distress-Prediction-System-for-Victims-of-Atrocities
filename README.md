# Well-being Support & Monitoring — SIH26094 Prototype

> NHAA (14566) tracks legal grievances for atrocity victims. Nothing tracks
> their psychological well-being. This is the missing layer.

A prototype well-being check-in and support-monitoring system for complainants
and victims registered under the **SC/ST (Prevention of Atrocities) Act, 1989**.
Built for Smart India Hackathon 2026, Problem Statement **SIH26094** (Ministry
of Social Justice & Empowerment).

## What this is, and what it is not

This is a **decision-support triage prototype**. It is deliberately honest about
its limits, and so is its interface:

- It is **not** a diagnostic tool and produces no clinical diagnoses.
- It is **not** a clinically validated predictor. No labelled distress- or
  crisis-outcome data exists for this population that any team could train or
  validate against, so no accuracy figure is claimed anywhere in the UI, the
  code, or this document.
- **A person always decides.** The system flags cases for human review. It never
  auto-acts on anyone.
- All data in this repository is **synthetic**. The six demonstration personas
  come from Section 6 of the project spec and contain no real names, no real
  case details, and no incident description of any kind.

---

## Build status

Phases follow the build order in the project brief. This table is the honest
record of what actually exists — check it before demoing anything.

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, two-tier access-control skeleton | **Done** |
| 2 | Core data layer — personas, check-in and score schemas | Not started |
| 3 | AI layer — scoring, explainability, interventions, fallback | Not started |
| 4 | Victim-facing check-in UI, multilingual toggle | Not started |
| 5 | Counsellor dashboard — case view, trends, alerts | Not started |
| 6 | Admin dashboard — aggregate/anonymised view | Not started |
| 7 | Integration pass, persona seeding | Not started |
| 8 | Edge-case pass (Persona F) | Not started |
| 9 | Polish — design, copy, responsive, docs | Not started |

---

## Setup

**Prerequisites:** Node.js 20 or newer. (Verified on Node 24.18, npm 12.)

```bash
npm install
```

```bash
npm run dev
```

That's it — two commands. `npm run dev` starts the API server on
**http://localhost:3001** and the web client on **http://localhost:5173**.
Open the client URL.

### API key (optional to run, required for live analysis)

The app runs **without any API key** — it falls back to pre-generated cached
responses and stays fully demoable. To enable live model calls:

```bash
cp .env.example .env
```

Then put a real `GROQ_API_KEY` in `.env` (get one at
[console.groq.com](https://console.groq.com)). `.env` is git-ignored; never
commit a key.

`GET /api/health` reports which mode you are in (`live` or `cached-fallback`),
and so does the client's Server panel.

### Demo sign-in

| Username | Passcode | Role |
|---|---|---|
| `counsellor` | `demo` | Welfare officer — individual case access |
| `admin` | `demo` | Administrator — aggregate data only |

These are local demo credentials, not secrets. Credential handling is
intentionally trivial; see *Scoped prototype decisions* below.

---

## The two-tier access control model

This is the project's headline architectural feature and the direct answer to
the problem statement's own privacy requirement. Read
[`server/src/access/roles.js`](server/src/access/roles.js) for the authoritative
version.

There are **two different data products** built from the same store — not one
dataset with more or less of it revealed:

**Tier 1 — Welfare / counselling staff (identified).** Sees a specific person:
their case record, check-in history, each distress score with the signals that
drove it, their trend line, their recommended interventions. Exists so a human
can act on an individual.

**Tier 2 — District / State / national administration (aggregate).** Sees only
counts, distributions and cohort trends. Never a name, never a case id that
resolves to one person, never a single check-in's text, never one individual's
trend line.

**Administration is not a downgraded counsellor. It never touches the identified
store at all.**

### What makes it real rather than decorative

1. **Enforcement is server-side, at the data boundary.** Tier 2 is served by
   different endpoints that only ever emit aggregate rows. Individual records
   are never serialised into a Tier 2 response, so there is nothing for a
   devtools network tab or a replayed request to find.
2. **Cross-tier requests are refused, not filtered.** An administrator
   requesting an individual case endpoint gets `403` and no case data — not a
   redacted record. There is no code path that loads individual data for an
   admin and then trims it, so there is no trimming bug to have.
3. **Small-cell suppression.** Aggregate buckets below `MIN_CELL_SIZE`
   (default 5) render as `<5` rather than an exact count. "1 high-risk case in
   this block" re-identifies someone even with no name attached.
4. **Role is a server-side session fact**, never a client-supplied value. The
   browser cannot self-elevate by flipping a variable or editing a header.

The `national → state → district` drill-down is **geographic and stays inside
the aggregate tier.** Narrowing the scope reaches smaller aggregate buckets; it
never bottoms out at a person. This is exactly why small-cell suppression
matters most at district level.

### Verifying it yourself

Sign in as `admin`, then press **Request individual-level data** on the home
screen. The server refuses with `403`. Sign in as `counsellor` and the same
request reaches the endpoint. An automated Playwright test asserting this
(including that no persona identifier appears in any Tier 2 response) lands in
Phase 6 at `tests/e2e/access-control.spec.js`.

---

## Project layout

```
server/src/
  access/         Two-tier access control. Read roles.js first.
    roles.js          Roles, data tiers, and the invariant they protect
    requireRole.js    Route guards. Every route sits behind one of these.
  config/env.js   All environment reading happens here, nowhere else.
  routes/
    auth.js           Establishes the server-side role session
    counsellor.js     TIER 1 — individual-level data (guarded router-wide)
    admin.js          TIER 2 — aggregate only (guarded router-wide)
client/src/
  styles/tokens.css   Design tokens, with the visual brief explained inline
  App.jsx             Application shell
```

Routers are organised **by access tier, not by feature**, so the separation is
reviewable by reading the route files. A single-tier file per tier means an
endpoint cannot be added to the wrong side without it being obvious in review.

---

## Design notes

The visual identity is **institutional but humane**: calm, legible, dignified.
It deliberately avoids consumer-app and "AI startup" cues — no dark mode, no
neon gradients, no glow.

Two choices worth knowing about:

- **Fonts are system stacks, not webfonts.** A hosted font is a network
  dependency, and this app has to survive a bad venue network during a live
  demo.
- **Risk colours are muted on purpose** (sage / ochre / terracotta / clay).
  Traffic-light red is alarming to a victim reading their own screen and
  desensitising to staff reading dozens of cases. Risk level is never signalled
  by colour alone; it always carries a text label.

---

## Scoped prototype decisions

Called out so nobody mistakes a hackathon shortcut for a design claim:

- **Credential handling is trivial** — fixed demo accounts, no hashing, no user
  store. The login step exists purely so the *role* is a server-side fact. Real
  authentication is out of scope.
- **Storage is local and lightweight.** No production database, no encryption at
  rest. The spec's position is "designed for compliance", **not** "certified
  compliant" — actual DPDP Act certification requires institutional process that
  a hackathon cannot produce.
- **`FORCE_FALLBACK_MODE=true`** in `.env` is a panic switch that skips all
  network calls and serves cached responses. Use it if the venue network is
  unusable.

---

## Content rules for contributors

Non-negotiable, from Section 12 of the project spec:

- Never write text depicting violence, assault, or incident detail — not even
  for realism, not even fictionalised. Persona language stays abstract and
  administrative ("reported feeling unsafe", "expressed fatigue about case
  delays").
- Never fabricate quotes or scenarios that read like real case reporting.
- Never use clinical diagnostic language in scores or explanations. Frame
  everything as risk and support signals, never as a diagnosis.
- Never claim predictive accuracy, live system integration, or legal
  certification — in code, UI copy, docs, or presentation.

---

## Licence and data

Prototype built for evaluation. Contains synthetic demonstration data only.
