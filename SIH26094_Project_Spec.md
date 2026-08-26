# SIH26094 — AI-Based Dynamic Mental Health Monitoring & Distress Prediction System
## Project Spec & Build Brief (Handoff Document)

---

## 1. Problem Statement (Official, MoSJE)

Victims of atrocities frequently experience prolonged psychological distress after complaint registration — due to threats, intimidation, repeated court appearances, delays in investigation and trial, social ostracism, economic hardship, and rehabilitation challenges. Existing mechanisms (NHAA 14566, Integrated Portal) focus on **legal and financial support only** — there is no continuous monitoring of victim psychological well-being.

**Task:** Build an AI-based system that continuously monitors and predicts psychological distress among victims/complainants throughout investigation, trial, rehabilitation, and compensation — via chatbot, IVRS, SMS, mobile app, web portal, or helpline follow-up.

**Priority use cases:** victims of rape/gang rape, murder, grievous hurt, arson; witnesses facing intimidation/threats; families affected by caste-based violence; SC/ST (Prevention of Atrocities) Act, 1989 beneficiaries.

---

## 2. The One-Line Pitch

> "NHAA tracks legal grievances for atrocity victims. Nothing tracks their psychological well-being. We built the missing layer."

Every slide, every feature, every demo moment should trace back to this sentence.

---

## 3. Market Positioning (why this is defensible)

- No existing product — Indian or global — integrates mental-health monitoring with a legal-grievance pipeline for this population.
- General mental-health apps (Wysa, Boli, InnerHour) exist but are **not** integrated with any legal/case-tracking system and are **not** tuned for atrocity-specific trauma patterns.
- NHAA (14566) is a real, high-volume, operational system — not a hypothetical: 6.5+ lakh calls since Dec 2021, ~half from UP, thousands of formally registered/resolved grievances.
- **If asked "why isn't this just Wysa":** general apps don't know a user is a legal complainant, don't route to district/state officials, and aren't designed around the specific escalation risks of this population (threats, intimidation, court-appearance stress).

---

## 4. Core Architecture

```
[Victim/Complainant]
    ↓ (chatbot / IVRS / SMS / mobile app / web portal)
[Conversational Intake Layer — multilingual]
    ↓
[NLP + Sentiment Analysis + Voice-Emotion Layer]
    ↓
[Dynamic Distress Scoring Engine — explainable]
    ↓ (score + trend over time)
[Risk Threshold Check] → if crossed → [Automated Alert Routing]
    ↓                                        ↓
[Intervention Recommendation]      [Counsellor / District / State Official]
    ↓
[Role-Based Dashboards: District / State / National]
```

**Critical design principle — build this as the headline feature, not an afterthought:**
Two-tier access control:
- **Individual-level data** → visible only to designated welfare/counselling staff.
- **Command/administrative/policy level** → sees only **anonymized, aggregated** trend data, never raw individual identity + distress data.
- This directly answers the PS's own listed requirement ("privacy protection... compliance with ethical standards") and is your strongest differentiator in Q&A.

---

## 5. Feature Scope — What to Build vs. What to Honestly Simulate

| Feature (from official PS) | Build for real | How |
|---|---|---|
| Chatbot check-in | ✅ Real | Conversational UI, LLM-driven, multi-turn |
| Web portal | ✅ Real | Same app, browser-based |
| SMS follow-up | 🟡 Simulate | Show as a channel option in UI; don't need real SMS gateway integration |
| IVRS voice calls | 🟡 Simulate | Simplified call-flow demo screen; not live telephony infra |
| Text NLP + Sentiment Analysis | ✅ Real | LLM-based sentiment/emotion extraction per check-in response |
| Voice Stress Analytics / Emotion AI | ✅ Real (achievable) | Use an existing pretrained speech-emotion-recognition model (e.g., wav2vec2-based SER model from HuggingFace) — do not train your own |
| Dynamic Distress Score + trend | ✅ Real | Composite score from sentiment + engagement pattern + flagged keywords, tracked over multiple check-ins, shown as a trend line |
| Predictive escalation ("before crisis emerges") | 🟡 Real but honestly scoped | Rule-based / LLM-reasoned early-warning logic (rising distress trend + specific flagged patterns). **State explicitly in the pitch: this is a decision-support triage tool, not a clinically validated predictor** — no real labeled crisis-outcome data exists for any team to train on |
| Automated alerts to counsellors/officials | ✅ Real | Threshold-based trigger + notification/routing logic |
| Intervention recommendations | ✅ Real | Mapping table: distress category + priority-use-case tag → recommended action (counselling / medical / witness protection / relocation / financial aid / legal aid / rehabilitation). **Have the medical team refine this table** |
| District/State/National dashboards | ✅ Real | Role-based aggregation views, drill-down from national → state → district |
| Explainable AI | ✅ Real (near-automatic) | Show which specific factors (keywords, sentiment shift, engagement drop) drove a given score — LLM reasoning traces do this naturally |
| Multilingual | ✅ Real | Use Bhashini or multilingual LLM prompting; demo 2 languages deeply (e.g., English + Hindi) rather than claiming broad shallow coverage |
| Automated Case Prioritisation | ✅ Real | Ranking/queue logic: distress score × priority-use-case weighting (rape/gang rape, witness intimidation, caste violence = higher base sensitivity) |
| Privacy / data security / legal compliance | 🟡 Real at architecture level | Implement real role-based access + anonymization + basic encryption. **Present as "designed for compliance," not "certified compliant"** — you cannot get real legal sign-off in a hackathon |
| HRMS / NHAA live integration | 🔴 Do not attempt | Mock with synthetic data structured like a real NHAA docket export. Present live integration as Phase 2 roadmap |

---

## 6. Synthetic Persona Set (use these — do NOT invent real-feeling atrocity narratives)

Build and test against abstract, non-graphic personas. Keep language clinical/administrative, never descriptive of violence:

1. **Persona A** — Registered complainant, caste-based violence case, 3 months post-registration, showing declining engagement + flat affect in responses. (Target: moderate rising distress trend)
2. **Persona B** — Witness in an active trial, reporting intimidation-adjacent language ("scared," "being watched"). (Target: high/urgent flag — witness protection recommendation)
3. **Persona C** — Complainant post-compensation disbursement, engagement stable, positive sentiment trend. (Target: low distress, system correctly does NOT over-flag)
4. **Persona D** — Family member (secondary victim) reporting social ostracism themes, inconsistent check-in frequency. (Target: social-support / rehabilitation recommendation, not crisis-tier)
5. **Persona E** — Long-pending case (12+ months), fatigue/hopelessness language pattern. (Target: tests longitudinal trend detection, not just single-message sentiment)
6. **Persona F — edge case** — Sarcastic/deflecting responses ("I'm totally fine 🙃" repeatedly paired with declining engagement). (Target: stress-test that the system doesn't over-trust surface-positive language — use this in your live demo rehearsal deliberately)

---

## 7. Tech Stack Recommendation (vibecode-friendly, no ML training required)

- **Frontend:** React (web) — chatbot UI, dashboard, mobile-responsive
- **Conversational/reasoning layer:** LLM API calls (Claude) for sentiment analysis, distress scoring reasoning, explainability text, and intervention recommendation generation
- **Voice emotion (if time allows):** pretrained SER model via HuggingFace inference API — do not train
- **Multilingual:** Bhashini API or multilingual LLM prompting
- **Backend/data:** Lightweight backend (Node/Python) + simple DB for check-in history and role-based access control
- **Dashboard visualization:** Standard charting library for trend lines and aggregate views

---

## 8. Known Limitations — State These Explicitly, Do Not Hide Them

1. **No real validation data.** No team can get labeled distress/crisis-outcome data from actual atrocity victims. Present distress scoring as rule/LLM-reasoned, explainable triage support — not a clinically validated predictor.
2. **Voice/IVRS is simulated for demo purposes.** Real telephony integration is a Phase 2 deployment item.
3. **No live legal/compliance certification.** Architecture is designed for DPDP Act alignment and role-based privacy; actual certification requires real institutional process.
4. **Human-in-the-loop is mandatory.** The system flags for counsellor/official review — it does not auto-act on any individual. State this explicitly if asked "what if the system is wrong."

---

## 9. Anticipated Jury Questions + Prepared Answers

| Question | Answer |
|---|---|
| "Why isn't this just Wysa/Boli?" | General mental-health apps aren't integrated with the legal grievance pipeline and aren't tuned for atrocity-specific escalation patterns (threats, court-appearance stress, caste-based intimidation) |
| "How accurate is your prediction?" | We don't claim validated clinical accuracy — no team can, without real institutional data. This is a decision-support triage tool built on explainable, rule/LLM-reasoned logic, with a clear Phase 2 pilot roadmap for real validation with MoSJE/NHAA oversight |
| "How do you prevent this becoming surveillance?" | Two-tier access control — individual data to welfare/counselling staff only, command/policy level sees only anonymized aggregates. [Point to architecture diagram] |
| "What if the system flags wrong — false negative on someone in real crisis?" | Human-in-the-loop: the system flags for human counsellor review, it does not auto-act. Escalation goes to a person, not an automated response |
| "Where does the data live, who's liable for a leak?" | Architecture designed for role-based access + encryption + DPDP Act alignment; final infrastructure/liability decision is a Phase 2 government deployment question, not something a hackathon prototype resolves |

---

## 10. Official SIH Idea Presentation Format (6 slides max)

1. **Title & Problem Statement** — PS 26094, team name, human-framed restatement of the gap
2. **Idea & Proposed Solution** — the architecture diagram (Section 4), kept visual not text-heavy
3. **Technical Approach** — stack (Section 7), naming actual models/APIs used
4. **Feasibility & Viability** — NHAA scale as real-world context, honest limitations (Section 8), privacy/trust design as the answer to the PS's own stated challenge
5. **Impact & Benefits** — map directly to the PS's own "Expected Outcomes" language
6. **Research & References** — NHAA data, trauma-informed care framework (SAMHSA), any academic literature reviewed

---

## 11. Team Role Mapping

- **3 Devs (parallel):** (1) chatbot/conversational interface, (2) distress-scoring + explainability engine, (3) dashboard + alert/access-control system
- **2 Medical (radiology) students:** trauma-informed design research, intervention-mapping table refinement, clinical/ethical Q&A ownership during presentation
- **Standby member:** pitch narrative, PPT structure/design, floats to whichever workstream needs support

---

## 12. Non-Negotiable Content Guidelines

- Never use real case details or anything resembling real victim narratives, even fictionalized — use only the abstract synthetic personas in Section 6.
- Keep all demo language clinical/administrative — never descriptive of violence or graphic incident detail.
- Do not overclaim predictive accuracy, live system integration, or legal certification anywhere in slides or demo narration.
