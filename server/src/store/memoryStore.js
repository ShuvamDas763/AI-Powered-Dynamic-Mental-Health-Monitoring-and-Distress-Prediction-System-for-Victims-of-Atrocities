/**
 * The in-memory store. Holds the identified tier and nothing else.
 *
 * WHAT THIS IS AND IS NOT
 * -------------------------------------------------------------------------
 * This is the IDENTIFIED data product from access/roles.js — pseudonymous case
 * records, their check-in history, and their assessment series. Counsellor-tier
 * routes read it. Admin-tier routes must never touch it; the aggregate tier is a
 * separate projection that consumes only latest-assessment summaries and emits
 * counts. Keeping that a module boundary rather than a conditional inside one
 * function is the point: there is no code path where an aggregate response is one
 * forgotten `if` away from serialising a person's check-in text.
 *
 * WHY RAW INPUTS ARE KEPT AND RECORDS ARE REBUILT
 * -------------------------------------------------------------------------
 * The store keeps the raw check-in declarations, not the finished records, and
 * rebuilds through makeCheckInHistory on every write. That looks wasteful for six
 * cases and it buys two things worth far more than the cycles:
 *
 *  - A live check-in added during the demo goes through exactly the same factory
 *    as the seed, so its word count is derived from what the person actually typed
 *    and cannot be asserted by whatever called the API.
 *  - Carry-forward of a surface reading across a missed check-in is threaded by
 *    the factory in one pass over the whole history. Appending to a finished array
 *    would need that logic duplicated here, where it would drift.
 *
 * The assessment series is recomputed the same way, so every point on a trend
 * chart stays a real prefix-only assessment after a live write, not a stale one
 * with a new dot on the end.
 */

import { buildPersonaCases } from '../data/personas.js';
import { assessCaseHistory } from '../domain/assessCase.js';
import { makeCheckInHistory, PROVENANCE } from '../domain/records.js';
import { buildConsentRecord, revokeConsent, isPurposeConsented, CONSENT_PURPOSE, COMMUNICATION_CHANNELS } from '../domain/consent.js';

/**
 * Build a store.
 *
 * Exposed as a factory rather than only a singleton so tests get an isolated
 * instance with a fixed clock instead of mutating shared module state.
 *
 * @param {{ now?: number }} options `now` fixes the clock the seed's relative
 *   dates resolve against. Defaults to the real one.
 */
export function createStore(options = {}) {
  const seedClock = Number.isFinite(options.now) ? options.now : Date.now();

  /** caseId -> { caseRecord, raw, history, series }. */
  const cases = new Map();

  /** caseId -> consentRecord. */
  const consents = new Map();

  /** caseId -> Array<InterventionRecord>. */
  const interventions = new Map();
  let interventionId = 0;

  /** caseId -> OutreachScheduleRecord. */
  const outreaches = new Map();

  /** victimUsername -> Array<{ id, caseId, type, message, createdAt, readAt }>. */
  const notifications = new Map();
  let notificationId = 0;

  /** alertId -> OperationalAlertRecord. */
  const operationalAlerts = new Map();
  let operationalAlertId = 0;

  /** Audit trail — who accessed what, when. */
  const auditLog = [];

  /** Recompute history and assessments for one case from its raw declarations. */
  function rebuild(entry) {
    const history = makeCheckInHistory(entry.caseRecord.caseId, entry.raw, { now: seedClock });
    const series = assessCaseHistory(entry.caseRecord, history, { now: seedClock });
    entry.history = history;
    entry.series = series;
    return entry;
  }

  function seedCase(caseRecord, history) {
    const raw = history.map((c) => ({
      daysAgo: c.daysAgo,
      occurredAt: c.occurredAt,
      status: c.status,
      channel: c.channel,
      locale: c.locale,
      turns: c.turns.map((t) => ({ speaker: t.speaker, text: t.text })),
      responseLatencyHours: c.responseLatencyHours,
      surfaceSentiment: c.surfaceSentimentCarriedForward ? undefined : c.surfaceSentiment,
      signals: [...c.signals],
      signalPhrases: [...c.signalPhrases],
      immediateReviewRequested: c.immediateReviewRequested,
      provenance: c.provenance,
    }));
    const entry = rebuild({ caseRecord, raw, history: [], series: [] });
    cases.set(caseRecord.caseId, entry);

    // 1. Authoritative consent seed — opt-in default for optional acoustic analysis
    const isHindiCase = caseRecord.preferredLocale === 'hi';
    consents.set(
      caseRecord.caseId,
      buildConsentRecord({
        caseId: caseRecord.caseId,
        userId: caseRecord.victimUsername || 'victim',
        purposes: {
          [CONSENT_PURPOSE.MONITORING]: true,
          [CONSENT_PURPOSE.COMMUNICATION]: true,
          [CONSENT_PURPOSE.VOICE_ANALYSIS]: true, // Seeded demo persona baseline
        },
        channelsAllowed: [
          COMMUNICATION_CHANNELS.APP,
          COMMUNICATION_CHANNELS.WEB,
          COMMUNICATION_CHANNELS.SMS,
          COMMUNICATION_CHANNELS.IVRS,
        ],
      }),
    );

    // 2. Closed-loop interventions seed from latest assessment
    const latestAssessment = entry.series.at(-1);
    const initialActions = latestAssessment?.interventions ?? [];
    const caseIntvs = initialActions.map((action, idx) => ({
      id: `intv-${++interventionId}`,
      caseId: caseRecord.caseId,
      code: action.code,
      label: action.label,
      description: action.description,
      urgency: action.urgency,
      responsibleUnit: action.urgency === 'immediate'
        ? 'District Protection Cell / DLSA'
        : 'Special Court Welfare Unit',
      assignedOfficer: null,
      status: 'RECOMMENDED',
      outcomeNote: null,
      outcomeCode: null,
      createdAt: new Date(seedClock - (idx + 1) * 86_400_000).toISOString(),
      dueAt: new Date(seedClock + (action.urgency === 'immediate' ? 86_400_000 : 7 * 86_400_000)).toISOString(),
      updatedAt: new Date(seedClock).toISOString(),
    }));

    // Demo Scenario 6: Persona B (SIH-CASE-0002) has an intervention in progress (ASSIGNED)
    if (caseRecord.caseId === 'SIH-CASE-0002' && caseIntvs.length > 0) {
      caseIntvs[0].status = 'ASSIGNED';
      caseIntvs[0].assignedOfficer = 'District Protection Cell / DLSA';
    }

    // Demo Scenario 7: Persona C (SIH-CASE-0003) has a completed intervention (COMPLETED)
    if (caseRecord.caseId === 'SIH-CASE-0003' && caseIntvs.length > 0) {
      caseIntvs[0].status = 'COMPLETED';
      caseIntvs[0].outcomeCode = 'support_completed';
      caseIntvs[0].outcomeNote = 'Post-compensation support session completed successfully.';
    }

    interventions.set(caseRecord.caseId, caseIntvs);

    // 3. Outreach schedule seed
    const isExhaustedPersonaH = caseRecord.caseId === 'SIH-CASE-0008';
    outreaches.set(caseRecord.caseId, {
      caseId: caseRecord.caseId,
      nextCheckInDate: isExhaustedPersonaH
        ? new Date(seedClock - 86_400_000).toISOString().split('T')[0]
        : new Date(seedClock + 3 * 86_400_000).toISOString().split('T')[0],
      preferredChannel: isHindiCase ? 'app' : 'web',
      channel: isExhaustedPersonaH ? 'ivrs' : (isHindiCase ? 'app' : 'web'),
      lastSuccessfulChannel: isExhaustedPersonaH ? null : 'app',
      lastAttemptedChannel: isExhaustedPersonaH ? 'ivrs' : 'app',
      deliveryState: isExhaustedPersonaH ? 'COUNSELLOR_FLAG' : 'DELIVERED',
      state: isExhaustedPersonaH ? 'COUNSELLOR_FLAG' : 'DELIVERED',
      attemptCount: isExhaustedPersonaH ? 2 : 1,
      attemptNumber: isExhaustedPersonaH ? 2 : 1,
      responseState: isExhaustedPersonaH ? 'UNRESPONSIVE' : 'RESPONDED',
      missedStreak: isExhaustedPersonaH ? 2 : history.slice(-2).filter((c) => c.status === 'missed').length,
      attemptedChannels: isExhaustedPersonaH ? ['app', 'sms', 'ivrs'] : ['app'],
      failureReason: isExhaustedPersonaH ? 'Repeated unsuccessful contact across configured outreach channels.' : null,
      updatedAt: new Date(seedClock).toISOString(),
    });
  }

  function seedAll() {
    for (const { caseRecord, history } of buildPersonaCases({ now: seedClock })) {
      seedCase(caseRecord, history);
    }

    // Demo Scenario 4: Seed operational alert for exhausted outreach (Persona H, SIH-CASE-0008)
    operationalAlerts.set('op-alert-1', {
      id: `op-alert-${++operationalAlertId}`,
      caseId: 'SIH-CASE-0008',
      type: 'outreach_exhausted',
      reason: 'Repeated unsuccessful contact across configured outreach channels.',
      urgency: 'medium',
      source: 'outreach_orchestrator',
      missedStreak: 2,
      attemptedChannels: ['app', 'sms', 'ivrs'],
      lastAttemptedChannel: 'ivrs',
      status: 'active',
      createdAt: new Date(seedClock - 3600_000).toISOString(),
      updatedAt: new Date(seedClock - 3600_000).toISOString(),
      resolvedAt: null,
      resolutionNote: null,
    });
  }

  // Seed the eight personas and fixtures.
  seedAll();

  const entry = (caseId) => cases.get(caseId) ?? null;

  return {
    /** The clock the seed resolved against. Useful for deterministic tests. */
    seedClock,

    // ── Audit Trail ───────────────────────────────────────────────────

    /** Log an access event. */
    logAccess({ userId, role, action, caseId, details }) {
      auditLog.push({
        timestamp: new Date().toISOString(),
        userId,
        role,
        action,
        caseId: caseId ?? null,
        details: details ?? null,
      });
    },

    /** Get recent audit entries (last 100). */
    getAuditLog(limit = 100) {
      return auditLog.slice(-limit);
    },

    // ── Notifications ──────────────────────────────────────────────────

    /** Create a notification for a victim. */
    addNotification(victimUsername, { caseId, type, message }) {
      if (!notifications.has(victimUsername)) {
        notifications.set(victimUsername, []);
      }
      const notification = {
        id: `notif-${++notificationId}`,
        caseId,
        type,
        message,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      notifications.get(victimUsername).push(notification);
      return notification;
    },

    /** Get all notifications for a victim, newest first. */
    getNotifications(victimUsername) {
      return (notifications.get(victimUsername) ?? []).slice().reverse();
    },

    /** Get unread notification count for a victim. */
    getUnreadCount(victimUsername) {
      return (notifications.get(victimUsername) ?? []).filter((n) => !n.readAt).length;
    },

    /** Mark all notifications for a victim as read. */
    markNotificationsRead(victimUsername) {
      const now = new Date().toISOString();
      for (const n of notifications.get(victimUsername) ?? []) {
        if (!n.readAt) n.readAt = now;
      }
    },

    /** Case records only — no history, no scores. */
    listCases() {
      return [...cases.values()].map((e) => e.caseRecord);
    },

    /** One case record, or null. */
    getCase(caseId) {
      return entry(caseId)?.caseRecord ?? null;
    },

    /** True when the case belongs to the given victim username. */
    isOwnedBy(caseId, username) {
      const e = entry(caseId);
      return e !== null && e.caseRecord.victimUsername === username;
    },

    /** Full check-in history for one case, oldest first. */
    getHistory(caseId) {
      return entry(caseId)?.history ?? [];
    },

    /** Every assessment for one case, one per check-in, oldest first. */
    getAssessmentSeries(caseId) {
      return entry(caseId)?.series ?? [];
    },

    /** The current assessment for one case, or null when there is no history. */
    getLatestAssessment(caseId) {
      return entry(caseId)?.series.at(-1) ?? null;
    },

    /**
     * Record a new check-in and return the assessment it produces.
     *
     * `raw.turns` is the conversation as it happened. Word count, status and
     * engagement metrics are derived from it downstream — this method does not
     * accept them, so an API caller cannot assert an engagement pattern.
     *
     * @returns the new latest assessment, or null if the case does not exist.
     */
    appendCheckIn(caseId, raw = {}, appendOptions = {}) {
      const found = entry(caseId);
      if (!found) return null;

      const at = Number.isFinite(appendOptions.now) ? appendOptions.now : Date.now();
      found.raw = [...found.raw, {
        ...raw,
        // A live check-in is pinned to an absolute moment. Recording it as
        // `daysAgo` would make it drift backwards every time the store is rebuilt.
        occurredAt: raw.occurredAt ?? new Date(at).toISOString(),
        daysAgo: undefined,
        provenance: raw.provenance ?? PROVENANCE.LIVE,
      }];
      rebuild(found);
      return found.series.at(-1);
    },

    /**
     * Cases ranked for a counsellor's attention — spec Section 4's case
     * prioritisation requirement.
     *
     * Escalated cases come first as a block, because an unescalated case scoring
     * 60 must never sort above an escalated one scoring 45: escalation means a
     * named rule fired, and a raw number should not be able to outrank that.
     * Within each block, the priority-adjusted score orders them, so the docket's
     * own sensitivity is reflected rather than the bare distress reading.
     */
    prioritisedQueue() {
      return [...cases.values()]
        .map((e) => ({
          caseRecord: e.caseRecord,
          assessment: e.series.at(-1) ?? null,
          checkInCount: e.history.length,
        }))
        .filter((row) => row.assessment !== null)
        .sort((a, b) => {
          const escalated = Number(b.assessment.escalation.triggered) - Number(a.assessment.escalation.triggered);
          if (escalated !== 0) return escalated;
          const adjusted = b.assessment.escalation.priorityAdjustedScore - a.assessment.escalation.priorityAdjustedScore;
          if (adjusted !== 0) return adjusted;
          // Stable tie-break so the queue does not reshuffle between requests.
          return a.caseRecord.caseId.localeCompare(b.caseRecord.caseId);
        });
    },

    /** Just the cases a named rule has escalated, in queue order. */
    alerts() {
      return this.prioritisedQueue().filter((row) => row.assessment.escalation.triggered);
    },

    /**
     * Minimal per-case summaries for the aggregate projection to consume.
     *
     * Deliberately narrow: band, escalation flag, coarse geography, docket stage
     * and tags. No pseudonym, no case id, no check-in text, no quoted phrases.
     * The aggregate tier cannot leak what it was never handed, so the smallest
     * possible input to it is itself a privacy control.
     */
    aggregateInputs() {
      return [...cases.values()]
        .filter((e) => e.series.length > 0)
        .map((e) => {
          const latest = e.series.at(-1);
          return {
            district: e.caseRecord.district,
            state: e.caseRecord.state,
            caseStage: e.caseRecord.caseStage,
            priorityTags: [...e.caseRecord.priorityTags],
            monthsSinceRegistration: e.caseRecord.monthsSinceRegistration,
            band: latest.band,
            escalated: latest.escalation.triggered,
            trendDirection: latest.trend.direction,
            checkInCount: e.history.length,
          };
        });
    },

    // ── Consent Repository Implementation ───────────────────────────

    getConsent(caseId) {
      return consents.get(caseId) ?? null;
    },

    saveConsent(record) {
      if (!record?.caseId) throw new Error('Consent record requires a caseId');
      consents.set(record.caseId, record);
      return record;
    },

    revokeConsent(caseId, reason) {
      const existing = consents.get(caseId);
      if (!existing) return null;
      const revoked = revokeConsent(existing, reason);
      consents.set(caseId, revoked);
      return revoked;
    },

    hasPurposeConsent(caseId, purpose) {
      const record = consents.get(caseId);
      return isPurposeConsented(record, purpose);
    },

    // ── Intervention Repository Implementation ──────────────────────

    getInterventions(caseId) {
      return (interventions.get(caseId) ?? []).slice();
    },

    saveIntervention(intv) {
      if (!intv?.caseId) throw new Error('Intervention requires a caseId');
      const list = interventions.get(intv.caseId) ?? [];
      const item = {
        id: intv.id || `intv-${++interventionId}`,
        caseId: intv.caseId,
        code: intv.code,
        label: intv.label,
        description: intv.description,
        urgency: intv.urgency || 'this_week',
        responsibleUnit: intv.responsibleUnit || 'District Protection Cell / DLSA',
        assignedOfficer: intv.assignedOfficer || null,
        status: intv.status || 'RECOMMENDED',
        outcomeNote: intv.outcomeNote || null,
        outcomeCode: intv.outcomeCode || null,
        createdAt: intv.createdAt || new Date().toISOString(),
        dueAt: intv.dueAt || new Date(Date.now() + 7 * 86_400_000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.push(item);
      interventions.set(intv.caseId, list);
      return item;
    },

    updateIntervention(id, updates = {}) {
      for (const [caseId, list] of interventions.entries()) {
        const idx = list.findIndex((it) => it.id === id);
        if (idx !== -1) {
          const updated = {
            ...list[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          list[idx] = updated;
          interventions.set(caseId, list);
          return updated;
        }
      }
      return null;
    },

    getInterventionStats() {
      let total = 0;
      let backlog = 0;
      let overdue = 0;
      let completed = 0;
      const now = new Date();

      for (const list of interventions.values()) {
        for (const item of list) {
          total++;
          if (item.status === 'COMPLETED' || item.status === 'CLOSED') {
            completed++;
          } else if (item.status !== 'DECLINED') {
            backlog++;
            if (item.dueAt && new Date(item.dueAt) < now) {
              overdue++;
            }
          }
        }
      }

      return {
        totalInterventions: total,
        backlogCount: backlog,
        overdueCount: overdue,
        completedCount: completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    },

    // ── Outreach Repository Implementation ──────────────────────────

    getOutreachSchedule(caseId) {
      return outreaches.get(caseId) ?? null;
    },

    saveOutreachSchedule(schedule) {
      if (!schedule?.caseId) throw new Error('Outreach schedule requires a caseId');
      outreaches.set(schedule.caseId, schedule);
      return schedule;
    },

    updateOutreachSchedule(caseId, updates = {}) {
      const existing = outreaches.get(caseId);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      outreaches.set(caseId, updated);
      return updated;
    },

    listPendingOutreaches() {
      return [...outreaches.values()].filter(
        (o) => o.deliveryState === 'CHECKIN_DUE' || o.deliveryState === 'DELIVERY_ATTEMPTED',
      );
    },

    getAggregateOutreachStats() {
      let total = 0;
      let missedCount = 0;
      for (const e of cases.values()) {
        total += e.history.length;
        missedCount += e.history.filter((c) => c.status === 'missed').length;
      }
      return {
        totalCheckIns: total,
        missedCount,
        missedCheckInRate: total > 0 ? Math.round((missedCount / total) * 100) : 0,
      };
    },

    // ── Operational Alerts Repository (Contact Continuity) ─────────────

    /**
     * Create an operational alert (e.g. outreach exhaustion).
     * Idempotent: If an active (unresolved) alert already exists for the same
     * caseId and type, updates its metadata instead of creating duplicate alerts.
     */
    createOperationalAlert(alertData) {
      if (!alertData?.caseId) throw new Error('Operational alert requires a caseId');
      const now = new Date().toISOString();

      // Check for existing unresolved alert for this case and type
      for (const alert of operationalAlerts.values()) {
        if (alert.caseId === alertData.caseId && alert.type === alertData.type && alert.status === 'active') {
          alert.updatedAt = now;
          if (alertData.missedStreak !== undefined) alert.missedStreak = alertData.missedStreak;
          if (alertData.lastAttemptedChannel) alert.lastAttemptedChannel = alertData.lastAttemptedChannel;
          if (alertData.attemptedChannels) alert.attemptedChannels = alertData.attemptedChannels;
          if (alertData.urgency) alert.urgency = alertData.urgency;
          return { alert, created: false };
        }
      }

      const alert = {
        id: `op-alert-${++operationalAlertId}`,
        caseId: alertData.caseId,
        type: alertData.type || 'outreach_exhausted',
        reason: alertData.reason || 'Repeated unsuccessful contact across configured outreach channels.',
        urgency: alertData.urgency || 'medium',
        source: alertData.source || 'outreach_orchestrator',
        missedStreak: alertData.missedStreak ?? 1,
        attemptedChannels: alertData.attemptedChannels || ['app', 'sms', 'ivrs'],
        lastAttemptedChannel: alertData.lastAttemptedChannel || 'app',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        resolutionNote: null,
      };

      operationalAlerts.set(alert.id, alert);
      return { alert, created: true };
    },

    /**
     * Get operational alerts, newest first. Optional filter by caseId, status, or type.
     */
    getOperationalAlerts(filter = {}) {
      let list = [...operationalAlerts.values()];
      if (filter.caseId) {
        list = list.filter((a) => a.caseId === filter.caseId);
      }
      if (filter.status) {
        list = list.filter((a) => a.status === filter.status);
      }
      if (filter.type) {
        list = list.filter((a) => a.type === filter.type);
      }
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    /**
     * Resolve an operational alert.
     */
    resolveOperationalAlert(alertId, resolutionNote = '') {
      const alert = operationalAlerts.get(alertId);
      if (!alert) return null;
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      alert.resolutionNote = resolutionNote || 'Resolved by counsellor';
      alert.updatedAt = alert.resolvedAt;
      return alert;
    },

    /**
     * DEV ONLY — Reset the store to its initial seed state.
     * Clears all live check-ins and rebuilds from the persona declarations.
     */
    reset() {
      cases.clear();
      consents.clear();
      interventions.clear();
      outreaches.clear();
      operationalAlerts.clear();
      interventionId = 0;
      operationalAlertId = 0;

      seedAll();
    },
  };
}

/**
 * The process-wide store the routes read.
 *
 * A hackathon prototype with a lightweight local store, per the spec's stack
 * constraint. Everything above is a pure function of the seed plus whatever was
 * appended, so swapping this for a real database later is a change of one module.
 */
export const store = createStore();
