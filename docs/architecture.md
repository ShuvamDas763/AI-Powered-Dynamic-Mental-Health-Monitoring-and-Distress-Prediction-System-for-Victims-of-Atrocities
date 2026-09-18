# System Architecture & Technical Design

## 1. Overview
Sahara is an explainable, longitudinal, human-in-the-loop victim support and early-warning platform built for problem statement **SIH26094** (*AI-Powered Dynamic Mental Health Monitoring and Distress Prediction System for Victims of Atrocities under SC/ST (Prevention of Atrocities) Act, 1989*).

The platform rejects autonomous diagnosis and predictive black-boxes in favor of an **explainable early-warning heuristic, server-authoritative consent management, multi-channel outreach orchestration, and closed-loop intervention lifecycle management**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (React + Vite)                        │
├────────────────────────────────┬────────────────────────────────────────────┤
│ Victim / Complainant Portal    │ Counsellor Triage & Case Detail Desk       │
│ • Dignified check-in dialogue  │ • Triage queues (New, Review, Active, etc.)│
│ • Supportive Care & Cadence    │ • "WHY THIS CASE IS HERE" banner           │
│ • Dynamic Consent Management   │ • Early-Warning Trajectory Engine          │
│ • Quick-Safe Camouflage Mode   │ • Closed-Loop Interventions Manager        │
│ • 24/7 Verified Helplines      │ • Statutory Case Lifecycle Stepper         │
├────────────────────────────────┴────────────────────────────────────────────┤
│ Administrator Oversight Desk (National Overview)                            │
│ • Tier 2 Aggregate Analytics & Operational Health Metrics                   │
│ • Small-cell k-anonymity suppression (<5) badges                            │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ (HTTP / JSON + Cookie Auth)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND API LAYER (Node.js Express)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Security & Access Control:                                                  │
│ • Origin Allowlisting (CLIENT_ORIGIN / CORS)                                │
│ • Sliding Window Rate Limiters (Auth & Check-in routes)                     │
│ • Production Session Secret Validation                                      │
│ • Server-Side Role-Based Access Control (RBAC: victim, counsellor, admin)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Domain Engines & Orchestrators:                                             │
│ • Consent Service (purposes: monitoring, communication, voice_analysis)     │
│ • Outreach Orchestrator (Web, App, SMS, IVRS state-machine & fallbacks)     │
│ • Early-Warning Trajectory Engine (velocity, elapsed days, bounded windows) │
│ • Closed-Loop Intervention Lifecycle (RECOMMENDED → CLOSED transitions)    │
│ • Emotion & Distress Heuristic (Lexicon + Sentiment + Disengagement)        │
│ • Priority Weighting & Escalation Gatekeeper                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Abstract Data Storage Layer:                                                │
│ • CaseRepository, ConsentRepository, InterventionRepository, OutreachRepo  │
│ • In-memory Store (Default zero-dependency for testing & demo)              │
│ • Strict Tier 1 (Identified) vs Tier 2 (Aggregate) Data Separation         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Strict Two-Tier Data Separation
The platform enforces a cryptographic and architectural boundary between individual case data and administrative reporting:

1. **Tier 1 (Identified Clinical / Caregiver Layer)**:
   - Accessible only to authenticated counsellors with role `counsellor`.
   - Provides longitudinal distress trajectories, signal phrases, own words, contact history, and intervention assignments.
   - Endpoint: `/api/counsellor/*`.
   - Attempts by users with `admin` or unauthenticated sessions return `403 Forbidden`.

2. **Tier 2 (Aggregate Administrative Oversight Layer)**:
   - Accessible to administrative and monitoring personnel with role `admin`.
   - Consumes anonymized aggregates where no PII or narrative text is accessible.
   - **Small-Cell Suppression ($k < 5$)**: Any aggregate cell with fewer than 5 records is automatically masked to `<5` to eliminate re-identification risk.
   - Endpoint: `/api/admin/*`.
   - Attempts by users with `counsellor` or `victim` roles return `403 Forbidden`.

---

## 3. Cross-Tier Operational Services Architecture

While Sahara enforces a strict separation between Tier 1 (identified clinical case data for counsellors) and Tier 2 (anonymised aggregate data for administrators), several core operational services support victim empowerment, conversational triage, multi-channel outreach, and feedback loops:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-TIER OPERATIONAL SERVICES                          │
├───────────────────┬───────────────────┬───────────────────┬─────────────────┤
│ /api/checkin      │ /api/consent      │ /api/outreach     │ /api/notifs     │
│ Victim check-in   │ Dynamic consent   │ Multi-channel     │ Non-clinical    │
│ & crisis triage   │ & revocations     │ dispatch/fallback │ feedback loop   │
└─────────┬─────────┴─────────┬─────────┴─────────┬─────────┴────────┬────────┘
          │                   │                   │                  │
          ▼                   ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Case Scoping: resolveAuthorizedCase(user, caseId) / requireVictim           │
│ • Victims locked to own session caseId (403 on mismatch)                    │
│ • Counsellors validated against case registry (404 if not found)            │
│ • Administrators strictly BLOCKED (403 Forbidden on all operational routes) │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────┐
│ Tier 1: Identified Clinical Consumer  │ │ Tier 2: Aggregate Consumer        │
│ • Full longitudinal check-in history  │ │ • Anonymised projection inputs    │
│ • Early-warning trajectory velocity   │ │ • No PII, no caseId, no raw text  │
│ • Outreach continuity alerts (exhaust)│ │ • Score bands only (no raw scores)│
│ • Intervention state management       │ │ • Small-cell k-anonymity (k < 5)  │
└───────────────────────────────────────┘ └───────────────────────────────────┘
```

### 3.1 Operational Services Breakdown

1. **Victim Conversational Check-In (`/api/checkin`)**:
   - **Purpose**: Intake pipeline for structured check-in conversations. Performs deterministic emergency crisis detection first (bypassing LLM inference and consent checks to deliver immediate safety contacts: Tele-MANAS `14416`, `112`). For routine submissions, strictly enforces a pre-LLM server-authoritative consent gate (`purposes.monitoring === true`), updates longitudinal distress trajectories, extracts emotion and engagement signals, and stores check-in receipts.
   - **Authorized Role**: `victim` exclusively (`requireVictim` middleware). Counsellors and administrators cannot write check-in records on a victim's behalf.
   - **Case Scoping**: Strictly bound to `req.session.user.caseId`. Any attempt to post check-in data for a mismatched case ID is rejected with `403 Forbidden`.

2. **Server-Authoritative Consent Management (`/api/consent`)**:
   - **Purpose**: Victim self-service consent lifecycle management. Enforces safe opt-in defaults (all purposes default to `false`; communication channels default to `[]`). Supports granular consent purposes (`monitoring`, `communication`, `voice_analysis`) and communication channels (`web`, `app`, `sms`, `ivrs`). Allows instant, non-punitive revocation that immediately halts routine monitoring and outreach while recording an immutable audit log.
   - **Authorized Roles**: `victim` (self-service) and `counsellor` (oversight and advocacy). Administrators are blocked with `403 Forbidden`.
   - **Case Scoping**: Evaluated via `resolveAuthorizedCase()`. A victim can only read or update consent for their own `session.user.caseId` (`403 Forbidden` on mismatch). A counsellor must specify a valid registered case (`404 Not Found` if nonexistent).

3. **Multi-Channel Outreach Orchestrator (`/api/outreach`)**:
   - **Purpose**: Schedules and executes multi-channel check-in contact across authorized channels (`web`, `app`, `sms`, `ivrs`). Respects victim communication consent; applies consent-aware fallback channel progression (`APP -> SMS -> IVRS`, `WEB -> SMS -> IVRS`); enforces configurable retry delay timing (`nextAttemptAt = now + retryDelayMs`); and upon complete channel exhaustion transitions to `COUNSELLOR_FLAG` and generates an idempotent operational alert for human welfare review.
   - **Authorized Roles**: `victim` (preference configuration) and `counsellor` (contact continuity monitoring). Administrators are blocked with `403 Forbidden`.
   - **Case Scoping**: Evaluated via `resolveAuthorizedCase()`. Victims are restricted to their own `caseId`. Counsellors manage outreach for valid registered cases.

4. **Victim Notifications (`/api/notifications`)**:
   - **Purpose**: Provides a trauma-informed, non-clinical feedback loop ("Your check-in was reviewed by your support team") closing the communication loop so victims know their check-ins are acknowledged and supported. Contains zero clinical risk terminology, diagnostic labels, or case details.
   - **Authorized Role**: `victim` exclusively (`requireVictim` middleware).
   - **Case Scoping**: Strictly scoped to the authenticated session's `victimUsername`.

### 3.2 Data Separation & Non-Leakage Guarantees

- **No Administrator Access to Operational Routes**: Administrators attempting to call `/api/checkin`, `/api/consent`, `/api/outreach`, or `/api/notifications` are blocked with `403 Forbidden`.
- **Decoupled Aggregate Projections**: Operational data feeds Tier 2 administrative reporting solely through server-side mathematical aggregation routines (`store.aggregateInputs()`, `store.getAggregateOutreachStats()`, `store.getInterventionStats()`). These routines project data into anonymous cohort buckets:
  - Zero PII, pseudonyms, phone numbers, or free-text responses are included.
  - Case identifiers are discarded before responses are serialized.
  - Distress scores are mapped to coarse risk bands (`low`, `moderate`, `elevated`, `high`), preventing micro-targeting or individual reconstruction.
  - Any cohort or geographic count fewer than 5 is automatically suppressed to `"<5"` ($k$-anonymity).
- **Absolute Boundary Verification**: No operational endpoint bridges or leaks Tier 1 identified data into Tier 2. There are no polymorphic or shared endpoints that return identified records when invoked by administrative tokens.

---

## 4. Storage Abstraction Interfaces
The backend decouples domain logic from persistence via explicit repository contracts defined in `server/src/store/repositoryInterfaces.js`:
- `CaseRepository`: Retrieval and updating of cases and check-in series.
- `ConsentRepository`: Retrieval, grant, and revocation of consent records.
- `InterventionRepository`: Storage, listing, and state-transitions for case interventions.
- `OutreachRepository`: Scheduling, tracking, and recording outcomes of scheduled contact dispatches.

---

## 5. Security Hardening
- **CORS Allowlist**: Strictly binds origin to `CLIENT_ORIGIN` environment variable.
- **Production Secret Validation**: In `production` environment, the server immediately halts if `SESSION_SECRET` is unset, default, or fewer than 32 characters.
- **Sliding-Window Rate Limiting**: Zero-dependency memory-efficient rate limiting prevents credential brute-forcing (`/api/auth/login`) and automated flooding of check-in endpoints (`/api/checkin`).
