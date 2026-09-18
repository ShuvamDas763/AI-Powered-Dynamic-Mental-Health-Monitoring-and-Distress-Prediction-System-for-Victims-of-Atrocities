# Well-being Support & Monitoring — SIH26094 Prototype

> NHAA (14566) tracks legal grievances for atrocity victims. Nothing tracks
> their psychological well-being. This is the missing layer.

A prototype well-being check-in and support-monitoring system for complainants
and victims registered under the **SC/ST (Prevention of Atrocities) Act, 1989**.
Built for Smart India Hackathon 2026, Problem Statement **SIH26094** (Ministry
of Social Justice & Empowerment).

> **⚠ TEMPORARY REVIEW DEPLOYMENT** — This is a temporary deployment with
> **synthetic data only**. There is no real victim data, no real case data,
> and no real personal information. All personas are fictional constructs.
> Do not share this URL publicly.

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
- All data in this repository is **synthetic**. The eight demonstration personas
  come from Section 6 of the project spec and contain no real names, no real
  case details, and no incident description of any kind.

---

## Build status

Phases follow the build order in the project brief. This table is the honest
record of what actually exists — check it before demoing anything.

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, two-tier access-control skeleton | **Done** |
| 2 | Core data layer — personas, check-in and score schemas | **Done** |
| 3 | AI layer — scoring, explainability, interventions, fallback | **Done** |
| 4 | Victim-facing check-in UI, multilingual toggle | **Done** |
| 5 | Counsellor dashboard — case view, trends, alerts | **Done** |
| 6 | Admin dashboard — aggregate/anonymised view | **Done** |
| 7 | Integration pass, persona seeding | **Done** |
| 8 | Edge-case pass (Persona F) | **Done** |
| 9 | Polish — design, copy, responsive, bilingual UI, exports | **Done** |
| 10 | Deployment — Vercel (frontend) + Render (backend) | **Ready** |
| 11 | Multi-stage crisis dialogue, dual-route escalation & SOS UI | **Done** |

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

### One-command start (LAN demo)

For the three-laptop live demo (victim / counsellor / admin on the same WiFi):

```bash
bash start.sh
```

The script starts both servers, prints this machine's LAN IP, and the client
listens on `0.0.0.0` so other laptops on the same network can join at
`http://<THIS_IP>:5173`. Laptop 1 opens the victim entry, laptop 2 signs in as
counsellor, laptop 3 as admin — three roles, one live system.

### Automated Testing

Run the full automated test suite:

```bash
npm test
```

Executes **383 tests across 73 test suites** via Node's native test runner (`node --test`), verifying access control boundaries, scoring arithmetic, crisis detection, early-warning trajectory projections without timestamp fallbacks, pre-LLM consent gating, multi-channel outreach state machines, background scheduler locks, operational alerts on channel exhaustion, closed-loop interventions, and multilingual providers without external network dependencies.

### Technical Documentation

Comprehensive architectural and methodological documentation is available in `docs/`:
- [System Architecture](docs/architecture.md): 2-Tier Data Boundary, security hardening, repository interfaces.
- [Early-Warning Methodology](docs/early-warning-methodology.md): Longitudinal velocity, bounded windows, evidence quality, and court date overlap.
- [Consent & Privacy Framework](docs/consent-and-privacy.md): Server-authoritative consent, granular purposes, and k-anonymity suppression ($k < 5$).
- [Outreach Orchestrator](docs/outreach.md): Multi-channel state machine (Web, App, SMS, IVRS) and non-punitive retry policies.
- [Intervention Lifecycle Workflow](docs/intervention-workflow.md): Traceable closed-loop interventions from recommendation to documented outcome.
- [Future Validation Roadmap](docs/future-validation.md): Non-clinical claims, ethical review, and institutional validation roadmap.

---

## Comprehensive API Specification

The API is strictly organized around the two-tier data boundary and role-based case scoping.

### Route Summary & Access Tiers

| Method | Endpoint | Access Tier / Role | Case-Scoping Rules | Parameters / Body | Responses & Status |
|---|---|---|---|---|---|
| `GET` | `/api/health` | Public | None | None | `200` `{ status, llmMode, model, isDev }` |
| `POST` | `/api/auth/login` | Public (Rate-limited) | None | Body: `{ username, passcode }` | `200` `{ ok, user }`, `401` Invalid credentials |
| `POST` | `/api/auth/logout` | Public | None | None | `200` `{ ok: true }` |
| `GET` | `/api/auth/me` | Public | Self-scoped session | None | `200` `{ user }` |
| `POST` | `/api/checkin` | Victim / Counsellor (Rate-limited) | Victim locked to own `caseId`; Counsellor requires existing case | Body: `{ caseId, message, stage, clientDistressScore }` | `200` Analysis & response; `403` if routine check-in without active consent (`consentRequired: true`); emergency crisis routes bypass consent check |
| `GET` | `/api/checkin/prompts/:caseId` | Victim / Counsellor | Victim locked to own `caseId`; Counsellor requires existing case | Path: `caseId` | `200` `{ caseId, prompts, locale }`, `403` / `404` |
| `GET` | `/api/consent` | Victim / Counsellor | Admin blocked (`403`); Victim locked to own `caseId` (`403`); Counsellor targets case via `?caseId=` (`404` if not found) | Query: `?caseId=` (for Counsellor) | `200` `{ caseId, consentRecord, active, allowedChannels, allowedPurposes }` |
| `POST` | `/api/consent` | Victim / Counsellor | Admin blocked (`403`); Victim locked to own `caseId`; Counsellor targets case | Body: `{ caseId?, consentGiven, allowedPurposes, allowedChannels, languagePreference }` | `200` `{ ok: true, consent }`, `400`, `403`, `404` |
| `POST` | `/api/consent/revoke` | Victim / Counsellor | Admin blocked (`403`); Victim locked to own `caseId`; Counsellor targets case | Body: `{ caseId?, reason }` | `200` `{ ok: true, consent }` with inactive status and recorded rationale |
| `GET` | `/api/outreach/:caseId` | Counsellor / Victim | Admin blocked (`403`); Victim locked to own `caseId` (`403`); Counsellor targets case | Path: `caseId` | `200` `{ caseId, schedule, history }`, `403`, `404` |
| `POST` | `/api/outreach/schedule` | Counsellor / Victim | Admin blocked (`403`); Victim locked to own `caseId`; Counsellor targets case | Body: `{ caseId?, preferredChannel, scheduledAt }` | `201` `{ ok: true, schedule }`, `400`, `403`, `404` |
| `POST` | `/api/outreach/:id/simulate-delivery` | Counsellor / Victim | Admin blocked (`403`); Victim locked to own case of outreach item | Path: `id`; Body: `{ status, failureReason }` | `200` `{ ok: true, schedule }` with updated state and fallback channel; triggers operational alert if exhausted |
| `POST` | `/api/outreach/:id/simulate-response` | Counsellor / Victim | Admin blocked (`403`); Victim locked to own case of outreach item | Path: `id`; Body: `{ responded }` | `200` `{ ok: true, schedule }` |
| `GET` | `/api/notifications` | Victim (self-scoped) | Session victim only | None | `200` `{ notifications, unreadCount }` |
| `POST` | `/api/notifications/read` | Victim (self-scoped) | Session victim only | None | `200` `{ ok: true, readCount }` |
| `GET` | `/api/counsellor/cases` | Tier 1 (Counsellor) | Tier 1 router guard; Admin blocked (`403`) | Query: optional filtering | `200` `{ cases, total, prioritisedQueue }` with triage status and WHY banners |
| `GET` | `/api/counsellor/cases/:id` | Tier 1 (Counsellor) | Tier 1 router guard; Admin blocked (`403`) | Path: `id` | `200` Case detail, check-in history, trajectory, emotion profile, operational alerts, consent record |
| `GET` | `/api/counsellor/alerts` | Tier 1 (Counsellor) | Tier 1 router guard; Admin blocked (`403`) | None | `200` `{ alerts, operationalAlerts }` including crisis reviews and outreach continuity flags |
| `GET` | `/api/counsellor/operational-alerts` | Tier 1 (Counsellor) | Tier 1 router guard; Admin blocked (`403`) | Query: `?status=open|resolved` | `200` `{ alerts }` filterable operational alerts list |
| `POST` | `/api/counsellor/operational-alerts/:id/resolve` | Tier 1 (Counsellor) | Tier 1 router guard; Admin blocked (`403`) | Path: `id`; Body: `{ note }` | `200` `{ ok: true, alert }` resolved operational alert |
| `GET` | `/api/counsellor/cases/:caseId/interventions` | Tier 1 (Counsellor) | Tier 1 router guard; Admin blocked (`403`) | Path: `caseId` | `200` `{ interventions }` closed-loop support actions |
| `POST` | `/api/counsellor/cases/:caseId/interventions/:id/action` | Tier 1 (Counsellor) | Tier 1 router guard; Admin blocked (`403`) | Path: `caseId`, `id`; Body: `{ action, note }` | `200` `{ ok: true, intervention }` lifecycle state transition |
| `GET` | `/api/admin/summary` | Tier 2 (Admin) | Tier 2 router guard; Counsellor blocked (`403`) | None | `200` Aggregate counts, operational backlog, resolution metrics |
| `GET` | `/api/admin/trends` | Tier 2 (Admin) | Tier 2 router guard; Counsellor blocked (`403`) | None | `200` Band distributions and trend directions with $k < 5$ suppression (`"<5"`) |
| `GET` | `/api/admin/geography` | Tier 2 (Admin) | Tier 2 router guard; Counsellor blocked (`403`) | None | `200` Hierarchical geographic breakdown (national/state/district) with $k < 5$ suppression |
| `GET` | `/api/export/cases.csv` | Tier 1 (Counsellor) | Tier 1 router guard; Admin blocked (`403`) | None | `200` CSV stream of case records |
| `GET` | `/api/export/summary` | Tier 2 (Admin / Counsellor) | Tier 2 aggregate guard | None | `200` Aggregate summary report |
| `POST` | `/api/dev/reset` | Dev-only | Disabled in production (`isDev: false`) | None | `200` In-memory store reset to synthetic seed |

### Detailed Router Specifications

#### 1. Public Authentication & Health (`/api/health`, `/api/auth`)
- **`GET /api/health`**: Diagnostic liveness probe returning server status, LLM operational mode (`live` or `cached-fallback`), active model identifier, and environment flag.
- **`POST /api/auth/login`**: Authenticates user against institutional demo credentials. Establishes an `httpOnly`, secure session cookie (`sih26094.sid`). Returns the session user object (`role`, `name`, `caseId`, `district`, `state`). Protected by `authLimiter`.
- **`POST /api/auth/logout`**: Destroys the server session and clears session cookie.
- **`GET /api/auth/me`**: Returns currently authenticated session user or `401` if unauthenticated.

#### 2. Check-In Pipeline (`/api/checkin`)
- **Deterministic Crisis First**: Before any consent or LLM check, incoming text is evaluated against `detectCrisis()`. If crisis keywords/patterns are detected, the system immediately returns an emergency safety referral response (QPR framework, Tele-MANAS `14416`, `112`, assigned welfare officer alert) with status `200` (`crisisDetected: true`, `immediateReviewRequested: true`). It **never calls routine LLM analysis** and **never blocks emergency safety on missing consent**.
- **Pre-LLM Consent Enforcement Gate**: For all routine (non-crisis) check-in submissions, the server strictly validates `store.isConsentActive(caseId)`. If consent is absent or inactive, the request is immediately rejected with HTTP `403` and `{ error: 'Active consent is required for routine well-being check-ins.', consentRequired: true }`. **Zero LLM tokens are consumed and zero routine inference providers are executed without active consent.**
- **Live Analysis & Longitudinal Assessment**: When active consent is present, check-in text is analyzed via `analysisProvider.analyseCheckIn()`, emotions are extracted, the 4-component distress score is updated, dual-route escalation rules are evaluated, and check-in receipts are stored for the victim.
- **`GET /api/checkin/prompts/:caseId`**: Returns trauma-informed opening prompts localized to the victim's language preference. Strict case scoping: victims can only request prompts for their own case ID.

#### 3. Server-Authoritative Consent Management (`/api/consent`)
- **Granular Data Purposes**: Tracks explicit permission for `welfare_monitoring`, `safety_alerts`, and `longitudinal_trends`.
- **Multi-Channel Delivery Preferences**: Records victim-authorized communication channels (`web`, `app`, `sms`, `ivrs`).
- **Unrestricted Non-Punitive Revocation**: Victims can revoke consent at any time via `POST /api/consent/revoke`. Revocation requires no clinical justification, is immediately authoritative on the server, and records a non-punitive audit rationale.
- **Case Scoping**: Enforced via centralized `resolveAuthorizedCase()`. Administrators are blocked (`403`). Victims can only read or mutate their own case consent (`403` on mismatch). Counsellors have Tier 1 case oversight (`404` if case does not exist).

#### 4. Multi-Channel Outreach & Background Scheduler (`/api/outreach`)
- **State Machine**: Schedules and tracks check-in outreach across configured channels (`PENDING` → `SCHEDULED` → `DELIVERED` → `RESPONDED`).
- **Non-Punitive Fallback**: When an outreach delivery attempt fails on a preferred channel, the orchestrator selects the next authorized fallback channel based on the victim's consent preferences. Non-response is never treated as non-compliance.
- **Exhaustion Operational Review**: When all authorized channels are exhausted without successful delivery, the outreach state transitions to `COUNSELLOR_FLAG` and automatically generates an idempotent operational review alert (`operationalAlerts`) for the welfare team with contact continuity reasoning: *"Repeated unsuccessful contact across configured outreach channels."*
- **Automated Background Scheduler**: Built into `server/src/domain/outreachScheduler.js` and wired to server boot in `server/src/index.js`:
  - Configured via `OUTREACH_SCHEDULER_INTERVAL_MS` (default 60,000ms) and `OUTREACH_SCHEDULER_ENABLED`.
  - Concurrency lock (`this.running`) ensures overlapping ticks do not trigger duplicate dispatches.
  - Strict date validation filters unparseable dates.
  - Idempotency guards prevent redundant scheduling or alert generation.
  - Clean lifecycle management: `start()`, `stop()`, and graceful shutdown on `SIGINT`/`SIGTERM`.

#### 5. Early Warning Trajectory Engine (`server/src/domain/prediction.js`)
- **Decision-Support Triage Only**: Estimates longitudinal distress velocity over strictly bounded 14, 30, and 60-day horizons. Explicitly designed as decision support for human counsellors; **makes no clinical diagnostic predictions and claims no diagnostic accuracy.**
- **Mandatory Timestamp Validation**: All check-in timestamps are strictly validated (`parseValidTimestamp` matching `/^\d{4}-\d{2}-\d{2}/`).
- **Safe Insufficient-Evidence Fallback**: Completely eliminates fabricated 7-day fallbacks. When observation timestamps are missing, unparseable, or provide fewer than 2 valid observations, the engine safely returns:
  - `projected: false`
  - `estimatedWindowDays: null`
  - `evidenceQuality: 'insufficient'`
  - `reasoning: "Trajectory projection requires valid observation timing; no projection is generated without a defensible observation window."`

#### 6. Closed-Loop Support Interventions (`/api/counsellor/cases/:caseId/interventions`)
- **Statutory Scheme Mapping**: Grounded in statutory Indian schemes and legal protections under the SC/ST (Prevention of Atrocities) Act, 1989:
  - Witness Protection Scheme 2018 (Section 15A)
  - Immediate Relief / Compensation (Rule 12(4) of PoA Rules)
  - Emergency Mental Health Support (Tele-MANAS)
  - Free Legal Aid (NALSA / State Legal Services Authority)
  - Social Re-integration & Educational Support
- **Lifecycle Tracking**: Interventions transition through explicit operational states: `recommended` → `approved` → `dispatched` → `completed` (or `dismissed` with mandatory counsellor justification note).

#### 7. Security & Two-Tier Access-Control Hardening (`server/src/access/`)
- **Centralized Case Authorization Resolver (`resolveAuthorizedCase`)**: Standardizes access boundaries across all routes:
  - Administrators receive instant `403` on any individual-level endpoint.
  - Victims are strictly scoped to their own `session.user.caseId` (any query or body mismatch returns `403`).
  - Counsellors operate with Tier 1 oversight (`404` if case does not exist).
- **Aggregate Isolation**: Tier 2 administrator routes (`/api/admin/*`) never touch individual-level records or serialize case IDs.
- **Small-Cell Privacy Suppression ($k < 5$)**: Any aggregate cohort count fewer than 5 is automatically suppressed to `"<5"` to prevent deductive re-identification of complainants in small districts.

### Demo sign-in

| Username | Passcode | Role |
|---|---|---|
| `victim` | `demo` | Complainant — own case only (self-scoped check-ins) |
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

## Crisis Dialogue & Dual-Route Escalation Architecture

### 1. Multi-Stage Crisis Dialogue Protocol

Traditional mental health chatbots output a static helpline announcement when a user expresses acute distress. When the user responds with exhaustion (*"no i m tired of all this"*), legacy bots repeat the identical wall-of-text script, destroying trust.

Our system implements a **trauma-informed, multi-stage crisis dialogue protocol**:

* **Turn 1 — Authoritative Safety Referral (QPR Framework):**
  - Triggered immediately by pattern-based crisis hard-triggers (independent of LLM availability).
  - Delivers an authoritative emergency referral to **Tele-MANAS** (`14416` / toll-free `1-800-891-4416`) and national emergency (`112`).
  - Alerts the assigned welfare officer and places the case at the top of the counsellor queue.
  - Activates a pinned **Emergency SOS Banner** in the victim UI with 1-tap dial buttons.
* **Turns 2+ — Empathetic De-escalation & Psychological First Aid (PFA):**
  - Keeps escalation active in the backend (`immediateReviewRequested: true`, `crisisDetected: true`).
  - Instead of repeating the canned helpline block, generates contextual, non-repetitive de-escalation responses via `generateCrisisFollowUp()` (Groq LLM guided by `CRISIS_FOLLOW_UP_SYSTEM_PROMPT`, falling back to deterministic templates if offline).
  - Classifies user intent across 5 psychological sub-states:
    1. **Exhaustion & Giving Up** (*"tired of all this"*, *"can't continue"*, *"थक गया"*) — validates pain, relieves pressure, provides holding presence.
    2. **Imminent Means / Method** (*"pills"*, *"rope"*, *"फाँसी"*, *"ज़हर"*) — urgent safety appeals, immediate emergency contacts.
    3. **Connection Seeking** (*"just talk to me"*, *"no one cares"*) — active listening, non-judgmental presence.
    4. **Calming / Grounding** (*"ok"*, *"sitting down"*) — physical grounding, breathing anchors.
    5. **General Ongoing Distress** — supportive de-escalation without toxic positivity.

### 2. Dual-Route Escalation Architecture

Escalation is deterministic and does not rely on LLM discretion ([`server/src/domain/escalation.js`](server/src/domain/escalation.js)):

* **Route 1: Priority-Adjusted Score Threshold ($\ge 65$):**
  $$\text{Priority-Adjusted Score} = \min(100, \text{Distress Score} \times \text{Docket Sensitivity Weight})$$
  Crossing 65 fires `threshold_crossed`.
* **Route 2: Named Hard Triggers (Score-Independent):**
  Even if a score reads low (e.g. 20 or 40), hard triggers escalate immediately:
  - `crisis_detected`: Explicit self-harm or suicidal language detected.
  - `immediate_review_requested`: Flagged for urgent human review by safety filter or model.
  - `intimidation_on_witness_case`: Witness intimidation reported on a sensitive docket.
  - `sustained_surface_mismatch`: Flat/polite replies paired with falling participation.
  - `hopelessness_with_disengagement`: Expressions of hopelessness combined with withdrawal from contact.

* **Top-of-Queue Priority:** In [`memoryStore.js`](server/src/store/memoryStore.js) (`prioritisedQueue()`), all escalated cases are sorted as a mandatory first block. An unescalated case scoring 60 can never outrank an escalated case scoring 40.

---

## Project layout

```
docs/
  design-system.md      Institutional design system specifications (AHRQ/USWDS based)
  intervention-table.md Research-grounded Indian scheme & legal provision mapping table
server/src/
  access/         Two-tier access control. Read roles.js first.
    roles.js          Roles, data tiers, and the invariant they protect
    requireRole.js    Route guards. Every route sits behind one of these.
    caseAuthorization.js Centralized case scoping & tier enforcement resolver.
  config/env.js   All environment reading happens here, nowhere else.
  data/
    personas.js       Eight synthetic personas from spec Section 6
  domain/
    records.js        Record schema: case, check-in, assessment
    distressScore.js  Composite distress score (4 components)
    engagement.js     Engagement metrics and trend detection
    emotions.js       Emotion profile per check-in (radar view)
    prediction.js     Escalation trajectory estimation (safe insufficient-data state)
    escalation.js     Deterministic escalation rule (dual-route)
    priorityWeighting.js  Priority-use-case weighting table
    interventions.js  Scheme-mapped intervention recommendation table
    assessCase.js     Assessment pipeline: history -> scored series
    outreachOrchestrator.js Multi-channel state machine & channel fallback
    outreachScheduler.js Background automated outreach scheduler with concurrency lock
  llm/
    prompts.js        LLM prompts (analysis, follow-up, crisis PFA, moderation)
    groqClient.js     Groq API client with timeout, fallback, caching
  routes/
    auth.js           Establishes the server-side role session
    checkin.js        Check-in submission with pre-LLM consent gate & live crisis route
    consent.js        Server-authoritative consent management & revocation
    outreach.js       Outreach schedules, delivery simulation, and response tracking
    notifications.js  Victim-facing check-in receipts
    export.js         CSV/report exports (tier-guarded)
    counsellor.js     TIER 1 — individual-level data (guarded router-wide)
    admin.js          TIER 2 — aggregate only (guarded router-wide)
    dev.js            Dev-only data reset utilities (gated to non-production)
  safety/
    contentPatterns.js  Content-safety regex patterns
    crisisDetection.js  Pattern-based crisis hard-trigger (runs before the LLM)
    crisisResponse.js   Multi-stage crisis templates & PFA de-escalation engine
    crisisResponse.test.js  Automated test suite for crisis dialogue & sub-states
    fallbackSignals.js  Offline signal detection (same vocabulary as the LLM)
  store/
    memoryStore.js    In-memory store with prioritised queue & operational alerts
client/src/
  styles/tokens.css   Design tokens, SOS banner, and accessibility styles
  App.jsx             Application shell with navigation
  i18n.jsx            Hindi/English locale system (server + UI)
  LoginPage.jsx       Sign-in page (demo credentials)
  CounsellorDashboard.jsx  Case queue and alerts view
  CaseDetail.jsx      Individual case with trend chart and explainability
  AdminDashboard.jsx  Aggregate dashboard with charts and geography drill-down
  IndiaMap.jsx        Interactive state-level map for the admin view
  CheckinChat.jsx     Victim-facing chatbot with pinned SOS banner & grounding chips
```

> **Note on private documentation:** pitch decks, speaker notes, judge-prep
> briefings, and captured screenshots live in `docs/` locally but are
> **deliberately git-ignored** — they are internal team material, not part of
> the published prototype. See `.gitignore` for the exact list.

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
- **Voice stress analytics is not included.** Text-based sentiment analysis
  covers the check-in channel. Voice/emotion AI is a Phase 2 addition for the
  IVRS channel, which is currently simulated per the spec's honest scoping.
- **Law-enforcement coordination is Phase 2.** The system routes alerts to
  counsellors. Inter-agency notification and law-enforcement integration are
  Phase 2 roadmap items, same framing as HRMS/NHAA live integration.

---

## Known accessibility gaps

Flagged for post-hackathon hardening. None block the demo but all should be
resolved before any production deployment.

| Gap | Location | Impact | Fix |
|---|---|---|---|
| **Clickable `<div>` elements** | `CounsellorDashboard` CaseCard/AlertCard, `CaseDetail` CheckInCard | Keyboard users cannot reach or activate case cards. Screen readers announce them as static text, not interactive controls. | Convert to `<button>` elements, or add `role="button"` + `tabIndex={0}` + `onKeyDown` handler for Enter/Space. |
| **Emoji as structural icons** | `CounsellorDashboard` stage icons (🔍⚖️⏳📋✅), login role icons (🩺📊), assessment status (⚠✓🟢📋) | Platform-dependent rendering, no aria support, inconsistent across OS/browsers. | Replace with inline SVG icons from a consistent family (e.g. Lucide, Heroicons). |
| **No `aria-busy` on loading states** | `CounsellorDashboard` loading shimmer, `AdminDashboard` loading shimmer | Screen readers do not announce that content is loading. | Add `aria-busy="true"` and `role="status"` to shimmer containers. |
| **No `role="status"` on live assessment** | `CheckinChat` assessment summary bar | Score updates after each reply are not announced to screen readers. | Wrap the assessment bar in `<div role="status" aria-live="polite">`. |
| **No `prefers-reduced-motion` CSS** | `tokens.css` | Users who prefer reduced motion still see all animations. | Add `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`. |
| **Chat input not labelled** | `CheckinChat` text input | Screen readers announce "edit text" with no context. | Add `aria-label="Type your reply"` (or Hindi equivalent based on locale). |

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
