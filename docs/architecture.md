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

## 3. Storage Abstraction Interfaces
The backend decouples domain logic from persistence via explicit repository contracts defined in `server/src/store/repositoryInterfaces.js`:
- `CaseRepository`: Retrieval and updating of cases and check-in series.
- `ConsentRepository`: Retrieval, grant, and revocation of consent records.
- `InterventionRepository`: Storage, listing, and state-transitions for case interventions.
- `OutreachRepository`: Scheduling, tracking, and recording outcomes of scheduled contact dispatches.

---

## 4. Security Hardening
- **CORS Allowlist**: Strictly binds origin to `CLIENT_ORIGIN` environment variable.
- **Production Secret Validation**: In `production` environment, the server immediately halts if `SESSION_SECRET` is unset, default, or fewer than 32 characters.
- **Sliding-Window Rate Limiting**: Zero-dependency memory-efficient rate limiting prevents credential brute-forcing (`/api/auth/login`) and automated flooding of check-in endpoints (`/api/checkin`).
