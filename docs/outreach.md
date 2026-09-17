# Multi-Channel Outreach Orchestrator

## 1. Overview
Atrocity victims often reside in rural areas with intermittent internet access or lack smartphone devices. Sahara provides a multi-channel **Outreach Orchestrator** capable of delivering scheduled check-ins over:
- **Native Web / App**
- **SMS Gateway** (simulated telecom adapter)
- **IVRS Voice Telephony** (simulated automated telephony adapter)

---

## 2. Finite-State Machine Workflow
Every scheduled outreach interaction transitions through a deterministic state machine:

```
                  ┌──────────────┐
                  │ CHECKIN_DUE  │
                  └──────┬───────┘
                         │ triggerDispatch()
                         ▼
             ┌───────────────────────┐
             │  DELIVERY_ATTEMPTED   │
             └───────────┬───────────┘
                         │
             ┌───────────┴───────────┐
             │ (Delivery Ack)        │ (Failure / Timeout)
             ▼                       ▼
      ┌──────────────┐       ┌──────────────┐
      │  DELIVERED   │       │    RETRY     │
      └──────┬───────┘       └──────┬───────┘
             │                      │ maxRetries exceeded
      ┌──────┴───────┐              ▼
      │ (Response)   │       ┌──────────────────────┐
      ▼              │       │  ALTERNATE_CHANNEL   │
┌───────────┐        │       └──────────┬───────────┘
│ RESPONDED │        │                  │ fallback exhausted
└───────────┘        │                  ▼
                     │       ┌──────────────────────┐
                     │       │   COUNSELLOR_FLAG    │
                     └──────>│   (Disengagement)    │
                             └──────────────────────┘
```

---

## 3. Fallback & Escalation Policies
1. **Primary Delivery Attempt**: Uses the victim's selected preferred channel.
2. **Exponential Backoff Retry**: If delivery fails (e.g. SMS delivery pending), up to 2 retries are scheduled.
3. **Channel Fallback**: If App delivery fails or is unopened after 48 hours, system falls back to SMS or IVRS.
4. **Non-Punitive Counsellor Flagging**: If the outreach remains unacknowledged after fallbacks, the orchestrator generates a `COUNSELLOR_FLAG` (`"missed_interaction"`). This is treated non-punitively as a potential safety risk (e.g. intimidation or device confiscation), prompting a human welfare officer to initiate a discreet welfare check.
