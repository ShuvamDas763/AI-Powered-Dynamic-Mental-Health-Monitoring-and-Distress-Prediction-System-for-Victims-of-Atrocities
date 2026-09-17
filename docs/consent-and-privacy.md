# Consent, Privacy, & Victim Rights Architecture

## 1. Statutory & Ethical Foundation
Under the **Scheduled Castes and the Scheduled Tribes (Prevention of Atrocities) Act, 1989** and national human rights standards, victims and witnesses cannot be subjected to coercive or non-consensual surveillance.

Sahara establishes a **Server-Authoritative Consent Architecture** that prioritizes victim autonomy, dignity, and granular control.

---

## 2. Granular Consent Purposes
Consent is not an opaque binary checkbox. It is tracked per case and divided into three independent purposes:

1. `monitoring` (**Well-being Monitoring**):
   - Authorizes the assigned District Welfare Officer to review check-in transcripts, emotional cues, and distress trajectories.
   - If revoked, routine monitoring ceases immediately.

2. `communication` (**Periodic Proactive Outreach**):
   - Authorizes the automated scheduling of check-in prompts via preferred channels (Web, App, SMS, IVRS).

3. `voice_analysis` (**Acoustic Pattern Analysis**):
   - Authorizes optional browser-based acoustic pattern extraction (pitch variability, pause frequency, speaking pace).
   - Audio is processed entirely in the browser memory and is **never recorded, stored, or transmitted**.

---

## 3. Revocation & Duty-of-Care Exception
- Victims can revoke consent at any moment via the client interface or `POST /api/consent/revoke`.
- When consent is revoked:
  - Routine check-in assessment is blocked on the server (`403 Consent Revoked`).
  - Proactive outreach reminders are halted.
- **Duty-of-Care Exception**: If a victim whose consent is revoked initiates contact and expresses imminent self-harm or suicide intent, the server triggers the **Crisis Protocol** (providing emergency helplines Tele-MANAS 14416 and alerting crisis responders) to safeguard human life.

---

## 4. Privacy Preserving Analytics (Tier 2 k-Anonymity)
For administrators and policy analysts:
- Strict segregation of Tier 1 (Identified) and Tier 2 (Aggregate) data.
- **Small-Cell Suppression ($k < 5$)**: Any query yielding fewer than 5 matching cases suppresses the count and displays `<5` to eliminate the possibility of linkage attacks or re-identification in low-density districts.
- Zero PII, narrative transcripts, or individual timestamps are stored in Tier 2 aggregates.
