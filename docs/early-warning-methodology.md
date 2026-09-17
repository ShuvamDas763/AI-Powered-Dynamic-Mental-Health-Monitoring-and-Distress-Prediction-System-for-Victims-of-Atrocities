# Early-Warning Trajectory Engine Methodology

## 1. Ethical & Regulatory Framing
The Sahara platform explicitly does **NOT** make clinical psychiatric diagnoses, nor does it generate speculative statements such as *"Subject will enter severe depression in exactly 12 days"*.

Instead, it implements an **Empirical Early-Warning Trajectory Engine** designed to alert human caregivers when longitudinal indicators show worsening support signals.

> **Institutional Disclaimer**:
> *"Empirical trajectory projection based on synthetic demonstration check-ins. This is an operational early-warning heuristic, NOT a psychiatric diagnosis or clinical prognosis."*

---

## 2. Mathematical Formulation
Rather than treating sequential check-ins as uniform index steps ($i = 1, 2, 3$), the engine calculates actual timestamps and elapsed intervals:

1. **Elapsed Time Window ($\Delta t$)**:
   $$\Delta t = t_n - t_1 \quad (\text{in days})$$

2. **Longitudinal Velocity ($v$)**:
   The rate of distress change with respect to elapsed real-world time:
   $$v = \frac{S_n - S_1}{\max(1, \Delta t)} \quad (\text{points / day})$$

3. **Missingness Ratio ($M$)**:
   To account for disengagement and withdrawal:
   $$M = \frac{N_{\text{missed}}}{N_{\text{scheduled}}}$$

4. **Bounded Escalation Horizon Window ($W$)**:
   Rather than predicting a single deceptive point in time, the system computes a bounded window $[d_{\min}, d_{\max}]$:
   $$d_{\text{nominal}} = \frac{T - S_n}{\text{adjustedSlope}}$$
   $$d_{\min} = \max(1, \lfloor d_{\text{nominal}} \times 0.75 \rfloor)$$
   $$d_{\max} = \lceil d_{\text{nominal}} \times 1.35 \rceil$$
   Where $T = 65$ is the escalation threshold and $S_n$ is the current distress score.

5. **Court Date Temporal Overlap**:
   Scheduled court dates are cross-referenced with the projected window $[d_{\min}, d_{\max}]$. If a court date occurs within or immediately following the window:
   $$\text{courtDateRisk} = \text{true}$$
   This triggers an urgent flag for counsellor review and witness protection coordination.

---

## 3. Evidence Quality Grading
To prevent over-reliance on limited interactions, every projection is assigned an explicit **Evidence Quality** rating:

| Evidence Level | Criteria | Interpretation |
|---|---|---|
| **Preliminary** | Observations $\le 3$ or Window $< 14$ days | Low statistical certainty; preliminary signal requiring continued monitoring. |
| **Moderate** | Observations $4 - 6$ and Window $\ge 14$ days | Fair longitudinal signal; suitable for proactive check-in adjustment. |
| **Robust** | Observations $\ge 7$, Window $\ge 28$ days, low missingness | High consistency; strong indication of sustained trajectory shift. |

---

## 4. Explainable Score Drivers
Scores and trajectories are fully decomposed into four transparent contributors:
1. **Verbatim Linguistic Sentiment**: Lexical and emotional expressions in the victim's current response.
2. **Behavioral Participation**: Latency of response, word count changes, and missed interactions.
3. **Historical Trajectory**: Rate of score change over the observation period.
4. **Vulnerability Modifiers**: Special atrocity context tags (witness intimidation, sexual assault, grave bodily harm).
